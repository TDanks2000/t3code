import { PROVIDER_DISPLAY_NAMES } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PROVIDER_ICON_BY_PROVIDER } from "./chat/providerIconUtils";
import { primaryServerProvidersAtom } from "../state/server";
import {
  collectAutoUpdateSessionState,
  allUpdatesTerminal,
  anyUpdatesFailed,
  type ProviderAutoUpdatePhase,
  type ProviderAutoUpdateStatus,
} from "./ProviderAutoUpdateOverlay.logic";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

const CHANGELOG_FETCH_TIMEOUT_MS = 5_000;

interface ProviderChangelog {
  readonly text: string;
  readonly url: string;
}

function useProviderChangelogs(
  statuses: ReadonlyArray<ProviderAutoUpdateStatus>,
): ReadonlyMap<string, ProviderChangelog | "loading" | "error"> {
  const [changelogs, setChangelogs] = useState<
    Map<string, ProviderChangelog | "loading" | "error">
  >(new Map());

  useEffect(() => {
    const controller = new AbortController();
    for (const status of statuses) {
      if (
        status.updateStatus === "succeeded" &&
        status.changelogUrl &&
        !changelogs.has(status.instanceId)
      ) {
        const key = status.instanceId;
        setChangelogs((prev) => {
          const next = new Map(prev);
          next.set(key, "loading");
          return next;
        });

        const timeout = setTimeout(() => {
          setChangelogs((prev) => {
            const next = new Map(prev);
            next.set(key, "error" as const);
            return next;
          });
        }, CHANGELOG_FETCH_TIMEOUT_MS);

        fetch(status.changelogUrl, { signal: controller.signal })
          .then((res) => res.text())
          .then((html) => {
            clearTimeout(timeout);
            const text = extractReleaseNotesFromHtml(html);
            setChangelogs((prev) => {
              const next = new Map(prev);
              next.set(key, { text, url: status.changelogUrl! });
              return next;
            });
          })
          .catch(() => {
            clearTimeout(timeout);
            setChangelogs((prev) => {
              const next = new Map(prev);
              next.set(key, "error" as const);
              return next;
            });
          });
      }
    }
    return () => controller.abort();
  }, [statuses, changelogs]);

  return changelogs;
}

function extractReleaseNotesFromHtml(html: string): string {
  const match = html.match(
    /<div\s+class="[^"]*markdown-body[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/main>/i,
  );
  if (match) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const lines = text.split("\n").filter(Boolean);
    return lines.slice(0, 80).join("\n");
  }
  return "";
}

function formatVersion(value: string | null): string {
  if (!value) return "";
  return value.startsWith("v") ? value : `v${value}`;
}

function ProviderRow({
  status,
  changelog,
}: {
  status: ProviderAutoUpdateStatus;
  changelog: ProviderChangelog | "loading" | "error" | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[status.driver];
  const name = PROVIDER_DISPLAY_NAMES[status.driver] ?? status.driver;

  const statusIcon = (() => {
    switch (status.updateStatus) {
      case "succeeded":
        return (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckIcon className="size-3" strokeWidth={3} />
          </span>
        );
      case "failed":
      case "unchanged":
        return (
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <XIcon className="size-3" strokeWidth={3} />
          </span>
        );
      case "queued":
      case "running":
        return <Spinner className="size-5" />;
      default:
        return <Spinner className="size-5 opacity-50" />;
    }
  })();

  const showChangelog = status.updateStatus === "succeeded" && status.changelogUrl;

  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="shrink-0">{statusIcon}</span>
        {ProviderIcon ? (
          <span className="shrink-0">
            <ProviderIcon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">{name}</span>
            {status.currentVersion ? (
              <span className="text-xs text-muted-foreground">
                {formatVersion(status.currentVersion)}
                {" → "}
                <span className="font-medium text-foreground">
                  {formatVersion(status.latestVersion)}
                </span>
              </span>
            ) : null}
          </div>
          {status.message ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{status.message}</p>
          ) : null}
        </div>
      </div>
      {showChangelog ? (
        <div className="mt-2 pl-8">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide changelog" : "What's new"}
          </button>
          {expanded ? (
            <div className="mt-1 rounded bg-muted/30 p-2">
              {changelog === "loading" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  Loading changelog...
                </div>
              ) : changelog && changelog !== "error" ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-xs text-foreground/80">
                  {changelog.text || "No changelog available."}
                </pre>
              ) : (
                <a
                  href={status.changelogUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLinkIcon className="size-3" />
                  View on GitHub
                </a>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ProviderAutoUpdateOverlay({
  phase,
  onContinue,
}: {
  phase: ProviderAutoUpdatePhase;
  onContinue: () => void;
}) {
  const providers = useAtomValue(primaryServerProvidersAtom);
  const { statuses } = useMemo(() => collectAutoUpdateSessionState(providers), [providers]);
  const changelogs = useProviderChangelogs(statuses);
  const terminal = allUpdatesTerminal(statuses);
  const hasFailures = anyUpdatesFailed(statuses);
  const allSucceeded = terminal && !hasFailures;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-lg px-4">
        <div className="text-center">
          {phase === "checking" ? (
            <>
              <Spinner className="mx-auto mb-4 size-8" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Checking for provider updates
              </h1>
            </>
          ) : phase === "updating" && !terminal ? (
            <>
              <Spinner className="mx-auto mb-4 size-8" />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Auto Updating Providers
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Installing the latest versions of your provider CLIs.
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
                {allSucceeded ? (
                  <CheckIcon className="size-6" strokeWidth={2.5} />
                ) : (
                  <span className="text-xl">!</span>
                )}
              </span>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {allSucceeded ? "Providers up to date" : "Some updates did not complete"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {allSucceeded
                  ? "All provider CLIs are now up to date."
                  : "Some provider updates failed. You can retry from provider settings."}
              </p>
            </>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {statuses.map((status) => (
            <ProviderRow
              key={status.instanceId}
              status={status}
              changelog={status.instanceId ? changelogs.get(status.instanceId) : undefined}
            />
          ))}
        </div>

        {terminal ? (
          <div className="mt-6 flex justify-center gap-3">
            {hasFailures ? (
              <Button variant="outline" onClick={onContinue}>
                Continue
              </Button>
            ) : (
              <Button onClick={onContinue}>Continue</Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
