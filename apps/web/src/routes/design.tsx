import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProviderInstanceId, type ModelSelection, type ProjectId } from "@t3tools/contracts";
import { useStore } from "~/store";
import { createThreadSelectorAcrossEnvironments } from "~/storeSelectors";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { readThreadDetail } from "~/state/entities";
import { usePrimarySettings } from "~/hooks/useSettings";
import { useAtomValue } from "@effect/atom-react";
import { primaryServerProvidersAtom } from "~/state/server";
import { resolveAppModelSelectionState } from "~/modelSelection";
import { readEnvironmentApi } from "~/environmentApi";
import { newCommandId, newMessageId, newThreadId } from "~/lib/utils";
import {
  createInitialDesignWorkspaceState,
  setDraftPrompt,
  addContextSource,
  addArtifact,
  selectArtifact,
  setGenerationState,
  getSelectedArtifact,
  type DesignArtifact,
  type DesignContextSource,
} from "~/designWorkspace/designWorkspaceState";
import { buildDesignWorkspacePrompt } from "~/designWorkspace/buildDesignWorkspacePrompt";
import { deriveTargetPath, validateTargetPath } from "~/designWorkspace/designArtifactDiscovery";
import { DesignWorkspaceShell } from "~/designWorkspace/DesignWorkspaceShell";
import { DesignContextRail } from "~/designWorkspace/DesignContextRail";
import { DesignCanvasArea } from "~/designWorkspace/DesignCanvasArea";
import { renderContextDialog } from "~/designWorkspace/DesignContextDialogs";

function DesignRoute() {
  const [state, setState] = useState(createInitialDesignWorkspaceState);
  const [contextDialogKind, setContextDialogKind] = useState<string | null>(null);
  const processedTurnRef = useRef<string | null>(null);

  const settings = usePrimarySettings();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const serverProviders = useAtomValue(primaryServerProvidersAtom);

  const firstProjectId = useStore((s): ProjectId | null => {
    for (const envState of Object.values(s.environments)) {
      const ids = envState.projectIds;
      if (ids.length > 0) {
        const firstId = ids[0]!;
        const project = envState.projectById[firstId];
        if (project) return project.id;
      }
    }
    return null;
  });
  const firstProjectCwd = useStore((s): string | undefined => {
    for (const envState of Object.values(s.environments)) {
      const ids = envState.projectIds;
      if (ids.length > 0) {
        const firstId = ids[0]!;
        const project = envState.projectById[firstId];
        if (project) return project.workspaceRoot;
      }
    }
    return undefined;
  });

  const environmentId = state.environmentId ?? primaryEnvironmentId;

  const modelSelectionState = useMemo(
    () => resolveAppModelSelectionState(settings, serverProviders),
    [settings, serverProviders],
  );

  const modelLabel = useMemo(() => {
    if (!modelSelectionState) return "Model";
    const label = modelSelectionState.model;
    if (!label) return "Model";
    return label.includes("/") ? label.split("/").pop()! : label;
  }, [modelSelectionState]);

  // Watch the design thread in the global store for turn completion
  const threadSelector = useMemo(
    () => createThreadSelectorAcrossEnvironments(state.threadId),
    [state.threadId],
  );
  const threadShell = useStore(threadSelector);

  // When a turn settles, extract the artifact path and load the HTML
  useEffect(() => {
    if (!threadShell) return;
    if (state.generationState.status !== "generating") return;

    const latestTurn = threadShell.latestTurn;
    if (!latestTurn) return;
    if (latestTurn.state === "running") return;

    const turnKey = latestTurn.turnId;
    if (processedTurnRef.current === turnKey) return;
    processedTurnRef.current = turnKey;

    if (latestTurn.state !== "completed") {
      setState((prev) =>
        setGenerationState(prev, {
          status: "error",
          message: `Generation ${latestTurn.state}. Please try again.`,
        }),
      );
      return;
    }

    const assistantMessageId = latestTurn.assistantMessageId;
    const thread = readThreadDetail({
      environmentId: threadShell.environmentId,
      threadId: threadShell.id,
    });
    const messages = thread?.messages ?? [];
    const assistantMsg = assistantMessageId
      ? messages.find((m) => m.id === assistantMessageId)
      : [...messages].toReversed().find((m) => m.role === "assistant" && !m.streaming);

    if (!assistantMsg) {
      setState((prev) =>
        setGenerationState(prev, {
          status: "error",
          message: "Could not find assistant response. The agent may not have run.",
        }),
      );
      return;
    }

    const match = assistantMsg.text.match(/ARTIFACT:\s*([\w./-]+\.html)/);

    if (!match?.[1]) {
      setState((prev) =>
        setGenerationState(prev, {
          status: "error",
          message: "Agent did not produce an artifact. Try a more specific prompt.",
        }),
      );
      return;
    }

    const artifactPath = match[1].trim();

    if (!environmentId) {
      setState((prev) =>
        setGenerationState(prev, { status: "error", message: "No environment available." }),
      );
      return;
    }

    const api = readEnvironmentApi(environmentId);
    if (!api) {
      setState((prev) =>
        setGenerationState(prev, { status: "error", message: "No environment API available." }),
      );
      return;
    }

    setState((prev) => setGenerationState(prev, { status: "loading-artifact" }));

    api.workspace
      .readTextFile({ relativePath: artifactPath, cwd: firstProjectCwd })
      .then((result) => {
        if (result.status === "ok") {
          setState((prev) => {
            const existingArtifact =
              prev.artifacts.find((a) => a.path === artifactPath) ??
              prev.artifacts[prev.artifacts.length - 1];

            const updatedArtifact: DesignArtifact = existingArtifact
              ? { ...existingArtifact, html: result.content, path: artifactPath }
              : {
                  id: assistantMsg.id,
                  path: artifactPath,
                  html: result.content,
                  title: artifactPath.split("/").pop()!.replace(".html", ""),
                  createdAt: assistantMsg.createdAt,
                  turnId: latestTurn.turnId,
                };

            let next = addArtifact(prev, updatedArtifact);
            next = selectArtifact(next, updatedArtifact.id);
            return setGenerationState(next, { status: "idle" });
          });
        } else {
          setState((prev) =>
            setGenerationState(prev, {
              status: "error",
              message: `Could not load artifact (${result.status}). Check that the agent created the file at: ${artifactPath}`,
            }),
          );
        }
      })
      .catch((err: unknown) => {
        setState((prev) =>
          setGenerationState(prev, {
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load artifact",
          }),
        );
      });
  }, [threadShell, state.generationState.status, environmentId, firstProjectCwd]);

  const handleOpenContextDialog = useCallback((kind: string) => {
    setContextDialogKind(kind);
  }, []);

  const handleSaveContext = useCallback(
    (value: string) => {
      if (!contextDialogKind) return;
      const source: DesignContextSource = {
        kind: contextDialogKind as DesignContextSource["kind"],
        label:
          contextDialogKind === "design-system"
            ? "Design system"
            : contextDialogKind === "screenshot"
              ? "Screenshot"
              : "Figma",
        value,
      };
      setState((prev) => addContextSource(prev, source));
      setContextDialogKind(null);
    },
    [contextDialogKind],
  );

  const handleDraftChange = useCallback((prompt: string) => {
    setState((prev) => setDraftPrompt(prev, prompt));
  }, []);

  const handleSend = useCallback(async () => {
    if (!state.draft.prompt.trim()) return;
    if (!environmentId) return;
    if (
      state.generationState.status === "generating" ||
      state.generationState.status === "loading-artifact"
    ) {
      return;
    }

    const api = readEnvironmentApi(environmentId);
    if (!api) return;

    setState((prev) => setGenerationState(prev, { status: "generating" }));
    processedTurnRef.current = null;

    try {
      const targetPath = deriveTargetPath(state.draft.prompt);
      const pathValidation = validateTargetPath(targetPath);
      if (!pathValidation.valid) {
        setState((prev) =>
          setGenerationState(prev, {
            status: "error",
            message: pathValidation.error ?? "Invalid target path",
          }),
        );
        return;
      }

      const threadId = state.threadId ?? newThreadId();
      const messageId = newMessageId();
      const commandId = newCommandId();
      const createdAt = new Date().toISOString();

      const promptText = buildDesignWorkspacePrompt({
        userPrompt: state.draft.prompt,
        contextSources: state.contextSources,
        targetPath: pathValidation.normalizedPath,
      });

      const modelSelectionForDispatch: ModelSelection = modelSelectionState ?? {
        instanceId: ProviderInstanceId.make("codex"),
        model: "claude-sonnet-4-20250514",
        options: [],
      };

      const isNewThread = state.threadId === null;

      if (isNewThread) {
        const projectId = firstProjectId ?? ("" as unknown as ProjectId);
        await api.orchestration.dispatchCommand({
          type: "thread.create",
          commandId: newCommandId(),
          threadId,
          projectId,
          title: "Design Workspace",
          modelSelection: modelSelectionForDispatch,
          runtimeMode: "full-access" as const,
          interactionMode: "default" as const,
          branch: null,
          worktreePath: null,
          createdAt,
        });
      }

      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId,
        threadId,
        message: {
          messageId,
          role: "user",
          text: promptText,
          attachments: [],
        },
        modelSelection: modelSelectionForDispatch,
        titleSeed: "Design: " + state.draft.prompt.slice(0, 60),
        runtimeMode: "full-access" as const,
        interactionMode: "default" as const,
        createdAt,
      });

      setState((prev) => ({
        ...prev,
        threadId,
        environmentId,
        draft: { prompt: "", attachments: [] },
      }));
    } catch (err) {
      setState((prev) =>
        setGenerationState(prev, {
          status: "error",
          message: err instanceof Error ? err.message : "Failed to send design brief",
        }),
      );
    }
  }, [state, environmentId, modelSelectionState, firstProjectId]);

  const handleSelectArtifact = useCallback((artifactId: string | null) => {
    setState((prev) => selectArtifact(prev, artifactId));
  }, []);

  const selectedArtifact = useMemo(() => getSelectedArtifact(state), [state]);

  return (
    <>
      <div className="h-full w-full bg-[#f4f1eb] p-4">
        <DesignWorkspaceShell
          contextRail={
            <DesignContextRail
              workspaceTitle={state.workspaceTitle}
              contextSources={state.contextSources}
              draft={state.draft}
              generationState={state.generationState}
              modelLabel={modelLabel}
              onOpenContextDialog={handleOpenContextDialog}
              onDraftChange={handleDraftChange}
              onSend={handleSend}
              onOpenModelPicker={undefined}
            />
          }
          canvasArea={
            <DesignCanvasArea
              artifacts={state.artifacts}
              selectedArtifact={selectedArtifact}
              generationState={state.generationState}
              onSelectArtifact={handleSelectArtifact}
              onOpenInEditor={(path) => {
                console.log("Open in editor:", path);
              }}
              onShare={undefined}
            />
          }
        />
      </div>

      {contextDialogKind &&
        renderContextDialog(contextDialogKind, {
          open: true,
          onOpenChange: (open) => {
            if (!open) setContextDialogKind(null);
          },
          onSave: handleSaveContext,
        })}
    </>
  );
}

export const Route = createFileRoute("/design")({
  beforeLoad: async ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }
  },
  component: DesignRoute,
});
