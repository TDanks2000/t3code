import { type ServerLifecycleWelcomePayload } from "@t3tools/contracts";
import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  Outlet,
  createRootRoute,
  type ErrorComponentProps,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { APP_BASE_NAME, APP_DISPLAY_NAME, APP_STAGE_LABEL } from "../branding";
import { resolveServerBackedAppDisplayName } from "../branding.logic";
import { AppSidebarLayout } from "../components/AppSidebarLayout";
import { CommandPalette } from "../components/CommandPalette";
import { ErrorBoundaryFatal } from "../components/ErrorBoundary";
import { ProviderAutoUpdateOverlay } from "../components/ProviderAutoUpdateOverlay";
import {
  type ProviderAutoUpdatePhase,
  collectAutoUpdateSessionState,
  allUpdatesTerminal,
} from "../components/ProviderAutoUpdateOverlay.logic";
import { RelayClientInstallDialog } from "../components/cloud/RelayClientInstallDialog";
import { SshPasswordPromptDialog } from "../components/desktop/SshPasswordPromptDialog";
import { ProviderUpdateLaunchNotification } from "../components/ProviderUpdateLaunchNotification";
import { SlowRpcRequestToastCoordinator } from "../components/SlowRpcRequestToastCoordinator";
import { Button } from "../components/ui/button";
import {
  AnchoredToastProvider,
  stackedThreadToast,
  ToastProvider,
  toastManager,
} from "../components/ui/toast";
import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { useClientSettings, usePrimarySettings } from "../hooks/useSettings";
import {
  deriveLogicalProjectKeyFromSettings,
  derivePhysicalProjectKeyFromPath,
  selectProjectGroupingSettings,
} from "../logicalProject";
import { useUiStateStore } from "../uiStateStore";
import { syncBrowserChromeTheme } from "../hooks/useTheme";
import { configureClientTracing } from "../observability/clientTracing";
import { resolveInitialServerAuthGateState } from "../environments/primary";
import { hasHostedPairingRequest, isHostedStaticApp } from "../hostedPairing";
import { shellEnvironment } from "../state/shell";
import { useAtomValue } from "@effect/atom-react";
import { useAtomCommand } from "../state/use-atom-command";
import { useEnvironments, usePrimaryEnvironment } from "../state/environments";
import {
  primaryServerConfigAtom,
  primaryServerConfigEventAtom,
  primaryServerProvidersAtom,
  primaryServerWelcomeAtom,
  serverEnvironment,
} from "../state/server";
import { readProject, setActiveEnvironmentId, useActiveEnvironmentId } from "../state/entities";
import {
  createKeybindingsUpdateToastController,
  type KeybindingsUpdateToastController,
} from "../components/KeybindingsUpdateToast.logic";

const AUTO_UPDATE_RAN = "t3code:auto-update-ran";
const autoUpdateSessionRef = { current: false };

function useAutoUpdateHasRan(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange();
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    () => localStorage.getItem(AUTO_UPDATE_RAN) === "true",
    () => false,
  );
}

function useAutoUpdatePhase(): {
  phase: ProviderAutoUpdatePhase;
  setPhase: (phase: ProviderAutoUpdatePhase) => void;
} {
  const sessionStorageKey = "t3code:auto-update-in-progress";
  const [phase, setPhaseState] = useState<ProviderAutoUpdatePhase>(() => {
    if (sessionStorage.getItem(sessionStorageKey)) {
      return "updating";
    }
    return "checking";
  });

  const setPhase = useCallback((next: ProviderAutoUpdatePhase) => {
    setPhaseState(next);
    if (next === "updating") {
      sessionStorage.setItem(sessionStorageKey, "true");
    } else {
      sessionStorage.removeItem(sessionStorageKey);
    }
  }, []);

  return { phase, setPhase };
}

function ProviderAutoUpdateBootstrap() {
  const providers = useAtomValue(primaryServerProvidersAtom);
  const settings = usePrimarySettings();
  const primaryEnvironment = usePrimaryEnvironment();
  const updateProvider = useAtomCommand(serverEnvironment.updateProvider, {
    reportFailure: false,
  });
  const hasRan = useAutoUpdateHasRan();
  const { phase, setPhase } = useAutoUpdatePhase();
  const [started, setStarted] = useState(false);
  const trackedRef = useRef<Set<string> | null>(null);

  const shouldAutoUpdate =
    settings.autoUpdateProvidersOnStartup &&
    !hasRan &&
    primaryEnvironment &&
    !autoUpdateSessionRef.current;

  const { candidates, statuses } = useMemo(
    () => collectAutoUpdateSessionState(providers),
    [providers],
  );

  const terminal = allUpdatesTerminal(statuses);

  useEffect(() => {
    if (!shouldAutoUpdate || candidates.length === 0 || started) return;

    autoUpdateSessionRef.current = true;
    setStarted(true);
    setPhase("updating");

    void (async () => {
      for (const candidate of candidates) {
        await updateProvider({
          environmentId: primaryEnvironment!.environmentId,
          input: {
            provider: candidate.driver,
            instanceId: candidate.instanceId,
          },
        });
      }
      // Wait for config stream to reflect final state
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      localStorage.setItem(AUTO_UPDATE_RAN, "true");
    })();
  }, [shouldAutoUpdate, candidates, started, primaryEnvironment, updateProvider, setPhase]);

  useEffect(() => {
    if (!started) return;
    if (trackedRef.current === null) {
      trackedRef.current = new Set();
    }
    for (const s of statuses) {
      trackedRef.current.add(s.instanceId);
    }
  }, [statuses, started]);

  useEffect(() => {
    if (terminal && started) {
      setPhase(allUpdatesTerminal(statuses) ? "done" : "failed");
    }
  }, [terminal, statuses, started, setPhase]);

  const handleContinue = useCallback(() => {
    localStorage.removeItem(AUTO_UPDATE_RAN);
    setPhase("skipped");
  }, [setPhase]);

  if (phase === "skipped") {
    return null;
  }

  return <ProviderAutoUpdateOverlay phase={phase} onContinue={handleContinue} />;
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/pair" && hasHostedPairingRequest(new URL(window.location.href))) {
      return {
        authGateState: {
          status: "hosted-pairing",
        } as const,
      };
    }

    if (isHostedStaticApp(new URL(window.location.href))) {
      return {
        authGateState: {
          status: "hosted-static",
        } as const,
      };
    }

    const authGateState = await resolveInitialServerAuthGateState();
    return {
      authGateState,
    };
  },
  component: RootRouteView,
  errorComponent: RootRouteErrorView,
  head: () => ({
    meta: [{ name: "title", content: APP_DISPLAY_NAME }],
  }),
});

function RootRouteView() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { authGateState } = Route.useRouteContext();
  const primaryEnvironmentAuthenticated = authGateState.status === "authenticated";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      syncBrowserChromeTheme();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  if (pathname === "/pair" || pathname.startsWith("/design")) {
    return (
      <>
        <DocumentTitleSync />
        <Outlet />
      </>
    );
  }

  if (authGateState.status !== "authenticated" && authGateState.status !== "hosted-static") {
    return (
      <>
        <DocumentTitleSync />
        <Outlet />
      </>
    );
  }

  const appShell = (
    <ErrorBoundaryFatal>
      <CommandPalette>
        <AppSidebarLayout>
          <Outlet />
        </AppSidebarLayout>
      </CommandPalette>
    </ErrorBoundaryFatal>
  );

  return (
    <ToastProvider>
      <AnchoredToastProvider>
        <DocumentTitleSync />
        {primaryEnvironmentAuthenticated ? <AuthenticatedTracingBootstrap /> : null}
        <RelayClientInstallDialog />
        <SshPasswordPromptDialog />
        <SlowRpcRequestToastCoordinator />
        <HostedStaticEnvironmentBootstrap />
        {primaryEnvironmentAuthenticated ? <EventRouter /> : null}
        {primaryEnvironmentAuthenticated ? <ProviderUpdateLaunchNotification /> : null}
        {primaryEnvironmentAuthenticated ? <ProviderAutoUpdateBootstrap /> : null}
        <div className="relative">{appShell}</div>
      </AnchoredToastProvider>
    </ToastProvider>
  );
}

function DocumentTitleSync() {
  const primaryServerVersion =
    useAtomValue(primaryServerConfigAtom)?.environment.serverVersion ?? null;
  const title = resolveServerBackedAppDisplayName({
    baseName: APP_BASE_NAME,
    fallbackDisplayName: APP_DISPLAY_NAME,
    fallbackStageLabel: APP_STAGE_LABEL,
    primaryServerVersion,
  });

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}

function HostedStaticEnvironmentBootstrap() {
  const { environments } = useEnvironments();
  const activeEnvironmentId = useActiveEnvironmentId();

  useEffect(() => {
    if (
      environments.some(
        (environment) => environment.entry.target._tag === "PrimaryConnectionTarget",
      )
    ) {
      return;
    }

    if (activeEnvironmentId) {
      return;
    }

    const firstSavedEnvironment = environments[0];
    if (!firstSavedEnvironment) {
      return;
    }

    setActiveEnvironmentId(firstSavedEnvironment.environmentId);
  }, [activeEnvironmentId, environments]);

  return null;
}

function RootRouteErrorView({ error, reset }: ErrorComponentProps) {
  const message = errorMessage(error);
  const details = errorDetails(error);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(44rem_16rem_at_top,color-mix(in_srgb,var(--color-red-500)_16%,transparent),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--background)_90%,var(--color-black))_0%,var(--background)_55%)]" />
      </div>

      <section className="relative w-full max-w-xl rounded-2xl border border-border/80 bg-card/90 p-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {APP_DISPLAY_NAME}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Something went wrong.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => reset()}>
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>

        <details className="group mt-5 overflow-hidden rounded-lg border border-border/70 bg-background/55">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="group-open:hidden">Show error details</span>
            <span className="hidden group-open:inline">Hide error details</span>
          </summary>
          <pre className="max-h-56 overflow-auto border-t border-border/70 bg-background/80 px-3 py-2 text-xs text-foreground/85">
            {details}
          </pre>
        </details>
      </section>
    </div>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "An unexpected router error occurred.";
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "No additional error details are available.";
  }
}

function AuthenticatedTracingBootstrap() {
  useEffect(() => {
    void configureClientTracing();
  }, []);

  return null;
}

function EventRouter() {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const projectGroupingSettings = useClientSettings(selectProjectGroupingSettings);
  const primaryEnvironment = usePrimaryEnvironment();
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, {
    reportFailure: false,
  });
  const serverConfig = useAtomValue(primaryServerConfigAtom);
  const serverConfigEvent = useAtomValue(primaryServerConfigEventAtom);
  const serverWelcome = useAtomValue(primaryServerWelcomeAtom);
  const readPathname = useEffectEvent(() => pathname);
  const handledBootstrapThreadIdRef = useRef<string | null>(null);
  const handledConfigEventRef = useRef(serverConfigEvent);
  const [keybindingsToastController] = useState<KeybindingsUpdateToastController>(() =>
    createKeybindingsUpdateToastController({}),
  );

  const handleWelcome = useEffectEvent((payload: ServerLifecycleWelcomePayload | null) => {
    if (!payload) return;

    setActiveEnvironmentId(payload.environment.environmentId);
    void (async () => {
      if (!payload.bootstrapProjectId || !payload.bootstrapThreadId) {
        return;
      }
      const bootstrapProject = readProject(
        scopeProjectRef(payload.environment.environmentId, payload.bootstrapProjectId),
      );
      const bootstrapProjectKey =
        (bootstrapProject
          ? deriveLogicalProjectKeyFromSettings(bootstrapProject, projectGroupingSettings)
          : null) ??
        (serverConfig?.cwd
          ? derivePhysicalProjectKeyFromPath(payload.environment.environmentId, serverConfig.cwd)
          : null) ??
        scopedProjectKey(
          scopeProjectRef(payload.environment.environmentId, payload.bootstrapProjectId),
        );
      useUiStateStore.getState().setProjectExpanded(bootstrapProjectKey, true);

      if (readPathname() !== "/") {
        return;
      }
      if (handledBootstrapThreadIdRef.current === payload.bootstrapThreadId) {
        return;
      }
      await navigate({
        to: "/$environmentId/$threadId",
        params: {
          environmentId: payload.environment.environmentId,
          threadId: payload.bootstrapThreadId,
        },
        replace: true,
      });
      handledBootstrapThreadIdRef.current = payload.bootstrapThreadId;
    })().catch(() => undefined);
  });

  const handleServerConfigUpdated = useEffectEvent(() => {
    const decision = keybindingsToastController.handle(serverConfigEvent);
    if (!decision) {
      return;
    }

    if (decision._tag === "Success") {
      toastManager.add({
        type: "success",
        title: "Keybindings updated",
        description: "Keybindings configuration reloaded successfully.",
      });
      return;
    }

    toastManager.add(
      stackedThreadToast({
        type: "warning",
        title: "Invalid keybindings configuration",
        description: decision.message,
        actionVariant: "outline",
        actionProps: {
          children: "Open keybindings.json",
          onClick: () => {
            if (!serverConfig || !primaryEnvironment) {
              return;
            }

            const editor = resolveAndPersistPreferredEditor(serverConfig.availableEditors);
            if (!editor) {
              return;
            }
            void (async () => {
              const result = await openInEditor({
                environmentId: primaryEnvironment.environmentId,
                input: {
                  cwd: serverConfig.keybindingsConfigPath,
                  editor,
                },
              });
              if (result._tag === "Success") {
                return;
              }
              const error = squashAtomCommandFailure(result);
              toastManager.add(
                stackedThreadToast({
                  type: "error",
                  title: "Unable to open keybindings file",
                  description:
                    error instanceof Error ? error.message : "Unknown error opening file.",
                }),
              );
            })();
          },
        },
      }),
    );
  });

  useEffect(() => {
    if (!serverConfig) {
      return;
    }

    setActiveEnvironmentId(serverConfig.environment.environmentId);
  }, [serverConfig]);

  useEffect(() => {
    handleWelcome(serverWelcome);
  }, [serverWelcome]);

  useEffect(() => {
    if (serverConfigEvent === null || handledConfigEventRef.current === serverConfigEvent) {
      return;
    }
    handledConfigEventRef.current = serverConfigEvent;
    handleServerConfigUpdated();
  }, [serverConfigEvent]);

  return null;
}
