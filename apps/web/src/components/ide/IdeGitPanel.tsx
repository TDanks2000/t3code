import { useCallback, useEffect, useRef, useState } from "react";
import {
  GitBranchIcon,
  RefreshCwIcon,
  FileIcon,
  FilePlusIcon,
  FileXIcon,
  FileWarningIcon,
  FileUpIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type {
  EnvironmentId,
  GitChangedFile,
  GitReviewFileDiffResult,
  GitReviewStatusResult,
  GitReviewRevertFileResult,
} from "@t3tools/contracts";
import type { IdeMissionEvidenceItem } from "./ide-types";

export type GitPanelTab = "git";

export interface IdeGitPanelProps {
  environmentId: EnvironmentId | null;
  workspaceRoot?: string | null;
  evidenceItems: ReadonlyArray<IdeMissionEvidenceItem>;
  onAddEvidence: (item: IdeMissionEvidenceItem) => void;
  onOpenFile: (path: string) => void;
  className?: string;
}

type PanelState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly data: GitReviewStatusResult }
  | { readonly status: "error"; readonly message: string };

type DiffState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly diff: string }
  | { readonly status: "not_found" }
  | { readonly status: "too_large" }
  | { readonly status: "binary" }
  | { readonly status: "error"; readonly message: string };

type RevertState =
  | { readonly status: "idle" }
  | { readonly status: "confirming" }
  | { readonly status: "reverting" }
  | { readonly status: "done"; readonly result: GitReviewRevertFileResult }
  | { readonly status: "error"; readonly message: string };

let nextEvidenceId = 1;
const generateEvidenceId = (): string => `ev-git-${nextEvidenceId++}`;

async function loadApi(environmentId: EnvironmentId) {
  const { readEnvironmentApi } = await import("~/environmentApi");
  return readEnvironmentApi(environmentId);
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  modified: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  added: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  deleted: "bg-red-500/15 text-red-400 border-red-500/30",
  renamed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  copied: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  untracked: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  conflicted: "bg-red-500/15 text-red-400 border-red-500/30",
  unknown: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const STATUS_ICONS: Record<string, typeof FileIcon> = {
  modified: FileWarningIcon,
  added: FilePlusIcon,
  deleted: FileXIcon,
  renamed: FileUpIcon,
  copied: FileUpIcon,
  untracked: FileIcon,
  conflicted: AlertCircleIcon,
  unknown: FileIcon,
};

function statusLabel(status: string): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "untracked":
      return "?";
    case "conflicted":
      return "!";
    default:
      return "?";
  }
}

export const IdeGitPanel = ({
  environmentId,
  workspaceRoot,
  evidenceItems: _evidenceItems,
  onAddEvidence,
  onOpenFile,
  className,
}: IdeGitPanelProps) => {
  const [panelState, setPanelState] = useState<PanelState>({ status: "loading" });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<DiffState>({ status: "idle" });
  const [revertState, setRevertState] = useState<RevertState>({ status: "idle" });
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updatePanelState = useCallback((state: PanelState) => {
    if (mountedRef.current) setPanelState(state);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!environmentId) return;
    updatePanelState({ status: "loading" });
    const api = await loadApi(environmentId);
    if (!api) {
      updatePanelState({ status: "error", message: "Unable to connect to environment." });
      return;
    }
    try {
      const result = await api.gitReview.getStatus({ cwd: workspaceRoot ?? "" });
      updatePanelState({ status: "loaded", data: result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load Git status.";
      updatePanelState({ status: "error", message });
    }
  }, [environmentId, updatePanelState, workspaceRoot]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const fetchDiff = useCallback(
    async (path: string) => {
      if (!environmentId) return;
      setDiffState({ status: "loading" });
      const api = await loadApi(environmentId);
      if (!api) {
        setDiffState({ status: "error", message: "Unable to connect to environment." });
        return;
      }
      try {
        const result = await api.gitReview.getFileDiff({ cwd: workspaceRoot ?? "", path });
        switch (result.status) {
          case "ok":
            setDiffState({ status: "loaded", diff: result.diff });
            onAddEvidence({
              id: generateEvidenceId(),
              kind: "manual",
              status: "passed",
              title: "Reviewed diff",
              detail: path,
              finishedAt: new Date().toISOString(),
            });
            break;
          case "not_found":
            setDiffState({ status: "not_found" });
            break;
          case "too_large":
            setDiffState({ status: "too_large" });
            break;
          case "binary":
            setDiffState({ status: "binary" });
            break;
          case "not_repo":
            setDiffState({ status: "error", message: "Not a Git repository." });
            break;
          case "error":
            setDiffState({ status: "error", message: result.detail });
            break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load diff.";
        setDiffState({ status: "error", message });
      }
    },
    [environmentId, onAddEvidence, workspaceRoot],
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      setSelectedPath(path);
      setRevertState({ status: "idle" });
      fetchDiff(path);
    },
    [fetchDiff],
  );

  const handleOpenFile = useCallback(
    (path: string) => {
      onOpenFile(path);
    },
    [onOpenFile],
  );

  const handleRevertClick = useCallback(() => {
    setRevertState({ status: "confirming" });
  }, []);

  const handleConfirmRevert = useCallback(async () => {
    if (!environmentId || !selectedPath) return;
    setRevertState({ status: "reverting" });
    const api = await loadApi(environmentId);
    if (!api) {
      setRevertState({ status: "error", message: "Unable to connect to environment." });
      return;
    }
    try {
      const result = await api.gitReview.revertFile({
        cwd: workspaceRoot ?? "",
        path: selectedPath,
      });
      setRevertState({ status: "done", result });
      if (result.status === "ok") {
        onAddEvidence({
          id: generateEvidenceId(),
          kind: "manual",
          status: "passed",
          title: "Reverted file",
          detail: selectedPath,
          finishedAt: result.revertedAt,
        });
        setDiffState({ status: "idle" });
        fetchStatus();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to revert file.";
      setRevertState({ status: "error", message });
    }
  }, [environmentId, selectedPath, workspaceRoot, onAddEvidence, fetchStatus]);

  const handleCancelRevert = useCallback(() => {
    setRevertState({ status: "idle" });
  }, []);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const changedFiles: ReadonlyArray<GitChangedFile> =
    panelState.status === "loaded" && panelState.data.status === "ok"
      ? panelState.data.changedFiles
      : [];

  const canRevert =
    selectedPath !== null &&
    revertState.status !== "reverting" &&
    revertState.status !== "done" &&
    changedFiles.some((f) => f.path === selectedPath && f.status !== "untracked");

  return (
    <div
      role="region"
      aria-label="Git Changes"
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden text-[13px]", className)}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-3 py-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Git Changes
        </h2>
        <button
          type="button"
          aria-label="Refresh Git status"
          onClick={fetchStatus}
          disabled={panelState.status === "loading"}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground/80 disabled:opacity-40"
        >
          <RefreshCwIcon
            className={cn("size-3", panelState.status === "loading" && "animate-spin")}
            aria-hidden
          />
          <span>Refresh</span>
        </button>
      </div>

      {panelState.status === "loading" && changedFiles.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-[11px] text-muted-foreground/40">Loading Git status...</p>
        </div>
      ) : panelState.status === "error" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-[11px] text-red-400/70">{panelState.message}</p>
        </div>
      ) : panelState.status === "loaded" && panelState.data.status === "not_repo" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-[11px] text-muted-foreground/40">{panelState.data.message}</p>
        </div>
      ) : panelState.status === "loaded" && panelState.data.status === "error" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <p className="text-[11px] text-red-400/70">{panelState.data.detail}</p>
        </div>
      ) : panelState.status === "loaded" &&
        panelState.data.status === "ok" &&
        panelState.data.isClean ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <GitBranchIcon className="mr-2 size-4 text-muted-foreground/30" aria-hidden />
          <p className="text-[11px] text-muted-foreground/40">No changes</p>
        </div>
      ) : null}

      {changedFiles.length > 0 && (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-1/2 min-w-0 flex-col overflow-hidden border-r border-border/30">
            <div className="flex shrink-0 items-center px-3 py-1 text-[11px] text-muted-foreground/50">
              <span>
                {changedFiles.length} file{changedFiles.length !== 1 ? "s" : ""} changed
              </span>
            </div>
            <div role="list" className="flex-1 overflow-y-auto" aria-label="Changed files">
              {changedFiles.map((file) => {
                const StatusIcon = STATUS_ICONS[file.status] ?? FileIcon;
                const isSelected = selectedPath === file.path;
                return (
                  <div key={file.path}>
                    <button
                      type="button"
                      role="listitem"
                      aria-selected={isSelected}
                      onClick={() => handleSelectFile(file.path)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-accent/30",
                        isSelected && "bg-accent/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(file.path);
                        }}
                        className="shrink-0 text-muted-foreground/40"
                        aria-label={expandedFiles.has(file.path) ? "Collapse" : "Expand"}
                      >
                        {expandedFiles.has(file.path) ? (
                          <ChevronDownIcon className="size-3" aria-hidden />
                        ) : (
                          <ChevronRightIcon className="size-3" aria-hidden />
                        )}
                      </button>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center rounded border px-1 font-mono text-[10px] leading-none",
                          STATUS_BADGE_CLASSES[file.status] ?? STATUS_BADGE_CLASSES.unknown,
                        )}
                      >
                        {statusLabel(file.status)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{file.path}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFile(file.path);
                        }}
                        className="shrink-0 text-muted-foreground/40 hover:text-foreground/70"
                        aria-label={`Open ${file.path}`}
                      >
                        <EyeIcon className="size-3" aria-hidden />
                      </button>
                    </button>
                    {expandedFiles.has(file.path) && file.oldPath && (
                      <div className="px-3 pb-1 pl-10 text-[11px] text-muted-foreground/50">
                        from: {file.oldPath}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex w-1/2 min-w-0 flex-col overflow-hidden">
            {selectedPath ? (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-3 py-1">
                  <span className="truncate text-[11px] text-muted-foreground/70">
                    {selectedPath}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenFile(selectedPath)}
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground/80"
                    >
                      Open file
                    </button>
                    <button
                      type="button"
                      onClick={handleRevertClick}
                      disabled={!canRevert}
                      className="rounded px-1.5 py-0.5 text-[10px] text-red-400/70 transition-colors hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Revert file changes"
                    >
                      Revert file
                    </button>
                  </div>
                </div>

                {revertState.status === "confirming" && (
                  <div className="shrink-0 border-b border-border/30 bg-red-500/5 px-3 py-2">
                    <p className="mb-1.5 text-[11px] text-foreground/80">
                      Revert changes to <span className="font-medium">{selectedPath}</span>? This
                      will discard local changes to this file.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmRevert}
                        className="rounded bg-red-500/20 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/30"
                      >
                        Revert
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRevert}
                        className="rounded bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground/70 hover:bg-muted/50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {revertState.status === "reverting" && (
                  <div className="shrink-0 border-b border-border/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground/70">Reverting...</p>
                  </div>
                )}

                {revertState.status === "done" && (
                  <div className="shrink-0 border-b border-border/30 px-3 py-2">
                    {revertState.result.status === "ok" ? (
                      <p className="text-[11px] text-emerald-400/80">File reverted successfully.</p>
                    ) : revertState.result.status === "conflict" ? (
                      <p className="text-[11px] text-amber-400/80">{revertState.result.reason}</p>
                    ) : revertState.result.status === "error" ? (
                      <p className="text-[11px] text-red-400/80">{revertState.result.detail}</p>
                    ) : revertState.result.status === "not_found" ? (
                      <p className="text-[11px] text-muted-foreground/70">File not found.</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/70">
                        {revertState.result.status}
                      </p>
                    )}
                  </div>
                )}

                {revertState.status === "error" && (
                  <div className="shrink-0 border-b border-border/30 px-3 py-2">
                    <p className="text-[11px] text-red-400/80">{revertState.message}</p>
                  </div>
                )}

                <div className="flex-1 overflow-auto">
                  {diffState.status === "loading" ? (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-muted-foreground/40">Loading diff...</p>
                    </div>
                  ) : diffState.status === "loaded" ? (
                    <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-foreground/80">
                      {diffState.diff.split("\n").map((line, i) => {
                        let lineClass = "";
                        if (line.startsWith("+")) lineClass = "text-emerald-400/80";
                        else if (line.startsWith("-")) lineClass = "text-red-400/80";
                        else if (line.startsWith("@")) lineClass = "text-cyan-400/70";
                        else if (
                          line.startsWith("diff --git") ||
                          line.startsWith("---") ||
                          line.startsWith("+++")
                        )
                          lineClass = "text-muted-foreground/50";
                        return (
                          <div key={i} className={cn("whitespace-pre", lineClass)}>
                            {line}
                          </div>
                        );
                      })}
                    </pre>
                  ) : diffState.status === "not_found" ? (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-muted-foreground/40">No diff available.</p>
                    </div>
                  ) : diffState.status === "too_large" ? (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-amber-400/70">Diff is too large to display.</p>
                    </div>
                  ) : diffState.status === "binary" ? (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-muted-foreground/40">
                        Binary file — diff not available.
                      </p>
                    </div>
                  ) : diffState.status === "error" ? (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-red-400/70">{diffState.message}</p>
                    </div>
                  ) : (
                    <div className="flex min-h-0 items-center justify-center p-4">
                      <p className="text-[11px] text-muted-foreground/40">
                        Select a changed file to view its diff.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <p className="text-[11px] text-muted-foreground/40">Select a file to view diff</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
