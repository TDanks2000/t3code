import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import { SidebarInset } from "../ui/sidebar";
import { IdeTopBar } from "./IdeTopBar";
import { IdeFileExplorerPanel } from "./IdeFileExplorerPanel";
import { IdeEditorPanel } from "./IdeEditorPanel";
import { IdeAgentPanel } from "./IdeAgentPanel";
import { IdeBottomPanel, type IdeBottomTab } from "./IdeBottomPanel";
import { IdeEmptyState } from "./IdeEmptyState";
import { usePrimaryEnvironmentId } from "../../environments/primary/context";
import {
  useSavedEnvironmentRegistryStore,
  useSavedEnvironmentRuntimeStore,
} from "../../environments/runtime";
import { readEnvironmentApi } from "../../environmentApi";
import { useUiStateStore } from "../../uiStateStore";
import { useStore } from "../../store";
import type {
  DiagnosticRunKind,
  DiagnosticsRunResult,
  EnvironmentId,
  WorkspaceFileTreeEntry,
} from "@t3tools/contracts";
import type { IdeMissionEvidenceItem, IdeProblem } from "./ide-types";
import { toIdeProblem } from "./ide-types";
import {
  buildFixDiagnosticPrompt,
  buildFixAllDiagnosticsPrompt,
  diagnosticKindToEvidenceKind,
} from "./ide-agent-prompts";
import { selectIdeAgentContext } from "./ide-agent-context";

const FILE_TREE_STALE_TIME_MS = 15_000;

export type IdeSelectedLocation = {
  readonly filePath: string;
  readonly line?: number;
  readonly column?: number;
};

export type DiagnosticsRunState =
  | {
      readonly status: "idle";
      readonly problems: ReadonlyArray<IdeProblem>;
    }
  | {
      readonly status: "running";
      readonly runningKind: DiagnosticRunKind;
      readonly lastRun: DiagnosticsRunResult | null;
      readonly problems: ReadonlyArray<IdeProblem>;
    }
  | {
      readonly status: "complete";
      readonly lastRun: DiagnosticsRunResult;
      readonly problems: ReadonlyArray<IdeProblem>;
    };

let nextEvidenceId = 1;
const generateEvidenceId = (): string => `ev-${nextEvidenceId++}`;

const resultToEvidenceItem = (result: DiagnosticsRunResult): IdeMissionEvidenceItem => ({
  id: generateEvidenceId(),
  kind: diagnosticKindToEvidenceKind(result.kind),
  status: result.status,
  title: result.commandLabel,
  detail: result.outputPreview ? result.outputPreview.slice(0, 200) : undefined,
  problemCount: result.problems.length,
  startedAt: result.startedAt,
  finishedAt: result.finishedAt,
  durationMs: result.durationMs,
});

const copyToClipboard = (text: string): boolean => {
  if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  navigator.clipboard.writeText(text).catch(() => {});
  return true;
};

interface IdeShellProps {
  environmentIdOverride?: string | null;
  workspaceRootOverride?: string | null;
  initialFilePath?: string | null;
}

export const IdeShell = ({
  environmentIdOverride,
  workspaceRootOverride,
  initialFilePath,
}: IdeShellProps) => {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentId: EnvironmentId | null = (environmentIdOverride ??
    primaryEnvironmentId) as EnvironmentId | null;
  const selectedFileStateKey = environmentId
    ? `${environmentId}:${workspaceRootOverride ?? ""}`
    : "";
  const storedFilePath = useUiStateStore((s) =>
    selectedFileStateKey ? (s.ideSelectedFilePath[selectedFileStateKey] ?? null) : null,
  );
  const setIdeSelectedFilePath = useUiStateStore((s) => s.setIdeSelectedFilePath);
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<string | null>(
    () => initialFilePath ?? storedFilePath,
  );
  const [selectedLocation, setSelectedLocation] = useState<IdeSelectedLocation | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<IdeBottomTab>("terminal");
  const [diagnosticsState, setDiagnosticsState] = useState<DiagnosticsRunState>({
    status: "idle",
    problems: [],
  });
  const [evidenceItems, setEvidenceItems] = useState<ReadonlyArray<IdeMissionEvidenceItem>>([]);
  const [fixCopiedLabel, setFixCopiedLabel] = useState<string | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    setSelectedFile(initialFilePath ?? storedFilePath);
    setSelectedLocation(null);
  }, [initialFilePath, selectedFileStateKey, storedFilePath]);

  const isScoped = environmentIdOverride !== null && environmentIdOverride !== primaryEnvironmentId;
  const envLookupKey = environmentId ?? "";
  const envLabel = useSavedEnvironmentRuntimeStore((s) =>
    envLookupKey ? (s.byId[envLookupKey]?.descriptor?.label ?? null) : null,
  );
  const envSavedLabel = useSavedEnvironmentRegistryStore((s) =>
    envLookupKey ? (s.byId[envLookupKey]?.label ?? null) : null,
  );
  const workspaceLabel =
    workspaceRootOverride ??
    (isScoped ? (envLabel ?? envSavedLabel ?? "Selected workspace") : null);

  const { data: fileTreeData, isPending: isFileTreePending } = useQuery({
    queryKey: ["workspaceGetFileTree", environmentId, workspaceRootOverride],
    queryFn: async () => {
      const api = environmentId ? readEnvironmentApi(environmentId) : null;
      return api
        ? api.workspace.getFileTree(
            workspaceRootOverride ? { cwd: workspaceRootOverride } : undefined,
          )
        : null;
    },
    staleTime: FILE_TREE_STALE_TIME_MS,
    enabled: environmentId !== null,
  });

  const fileTreeEntries: ReadonlyArray<WorkspaceFileTreeEntry> = fileTreeData?.entries ?? [];
  const fileTreeTruncated = fileTreeData?.truncated ?? false;
  const agentContext = useStore(
    useShallow((state) =>
      selectIdeAgentContext({
        state,
        environmentId,
        workspaceRoot: workspaceRootOverride ?? null,
      }),
    ),
  );

  const handleRunDiagnostics = useCallback(
    (kind: DiagnosticRunKind) => {
      if (diagnosticsState.status === "running") return;
      if (!environmentId) return;

      setDiagnosticsState((prev) => ({
        status: "running",
        runningKind: kind,
        lastRun: prev.status === "complete" ? prev.lastRun : null,
        problems: prev.problems,
      }));

      const api = readEnvironmentApi(environmentId);
      if (!api) {
        setDiagnosticsState((prev) => ({
          status: "complete",
          lastRun: {
            kind,
            status: "error",
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
            commandLabel: kind,
            problems: [],
            outputPreview: "Unable to connect to environment.",
          },
          problems: prev.problems,
        }));
        return;
      }

      api.diagnostics
        .run({
          kind,
          ...(workspaceRootOverride ? { cwd: workspaceRootOverride } : {}),
        })
        .then(
          (result: DiagnosticsRunResult) => {
            setEvidenceItems((prev) => [
              resultToEvidenceItem(result),
              ...prev.filter((item) => item.kind !== diagnosticKindToEvidenceKind(result.kind)),
            ]);
            setDiagnosticsState({
              status: "complete",
              lastRun: result,
              problems: result.problems.map(toIdeProblem),
            });
          },
          () => {
            setDiagnosticsState((prev) => ({
              status: "complete",
              lastRun: {
                kind,
                status: "error",
                startedAt: new Date().toISOString(),
                finishedAt: new Date().toISOString(),
                durationMs: 0,
                commandLabel: kind,
                problems: [],
                outputPreview: "Diagnostics request failed.",
              },
              problems: prev.problems,
            }));
          },
        );
    },
    [diagnosticsState.status, environmentId, workspaceRootOverride],
  );

  const handleClearProblems = useCallback(() => {
    setDiagnosticsState({ status: "idle", problems: [] });
  }, []);

  const handleOpenProblemLocation = useCallback(
    (problem: IdeProblem) => {
      if (!problem.filePath) return;
      setSelectedFile(problem.filePath);
      setSelectedLocation({
        filePath: problem.filePath,
        line: problem.line,
        column: problem.column,
      } as IdeSelectedLocation);
      if (environmentId) {
        setIdeSelectedFilePath(selectedFileStateKey, problem.filePath);
      }
    },
    [environmentId, selectedFileStateKey, setIdeSelectedFilePath],
  );

  const handleSelectFile = useCallback(
    (filePath: string | null) => {
      if (isDirtyRef.current) {
        const confirmed = window.confirm(
          "You have unsaved changes. Discard them and switch files?",
        );
        if (!confirmed) return;
      }
      setSelectedFile(filePath);
      setSelectedLocation(null);
      if (environmentId) {
        setIdeSelectedFilePath(selectedFileStateKey, filePath);
        navigate({
          to: "/ide",
          search: {
            environmentId,
            ...(workspaceRootOverride ? { workspaceRoot: workspaceRootOverride } : {}),
            ...(filePath ? { filePath } : {}),
          },
          replace: true,
        });
      }
    },
    [environmentId, navigate, selectedFileStateKey, setIdeSelectedFilePath, workspaceRootOverride],
  );

  const handleDirtyStateChange = useCallback((isDirty: boolean) => {
    isDirtyRef.current = isDirty;
  }, []);

  const handleFileSaved = useCallback((relativePath: string) => {
    setEvidenceItems((prev) => {
      const item: IdeMissionEvidenceItem = {
        id: generateEvidenceId(),
        kind: "manual",
        status: "passed",
        title: "Saved file",
        detail: relativePath,
        finishedAt: new Date().toISOString(),
      };
      return [item, ...prev];
    });
  }, []);

  const handleAddEvidence = useCallback((item: IdeMissionEvidenceItem) => {
    setEvidenceItems((prev) => [item, ...prev]);
  }, []);

  const handleOpenFile = useCallback(
    (path: string) => {
      if (isDirtyRef.current) {
        const confirmed = window.confirm(
          "You have unsaved changes. Discard them and switch files?",
        );
        if (!confirmed) return;
      }
      setSelectedFile(path);
      setSelectedLocation(null);
      if (environmentId) {
        setIdeSelectedFilePath(selectedFileStateKey, path);
        navigate({
          to: "/ide",
          search: {
            environmentId,
            ...(workspaceRootOverride ? { workspaceRoot: workspaceRootOverride } : {}),
            filePath: path,
          },
          replace: true,
        });
      }
    },
    [environmentId, navigate, selectedFileStateKey, setIdeSelectedFilePath, workspaceRootOverride],
  );

  const handleAskAgentToFix = useCallback(
    (problem: IdeProblem) => {
      const lastRun = diagnosticsState.status === "complete" ? diagnosticsState.lastRun : undefined;
      const prompt = buildFixDiagnosticPrompt({ problem, lastRun });
      const ok = copyToClipboard(prompt);
      setFixCopiedLabel(ok ? "Fix prompt copied" : "Failed to copy");
      setTimeout(() => setFixCopiedLabel(null), 2500);
    },
    [diagnosticsState],
  );

  const handleAskAgentToFixAll = useCallback(() => {
    const lastRun = diagnosticsState.status === "complete" ? diagnosticsState.lastRun : undefined;
    const prompt = buildFixAllDiagnosticsPrompt({
      problems: diagnosticsState.problems,
      lastRun,
    });
    const ok = copyToClipboard(prompt);
    setFixCopiedLabel(ok ? "Fix prompt copied" : "Failed to copy");
    setTimeout(() => setFixCopiedLabel(null), 2500);
  }, [diagnosticsState]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <IdeTopBar fixCopiedLabel={fixCopiedLabel} workspaceLabel={workspaceLabel} />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="hidden sm:flex">
            <IdeFileExplorerPanel
              entries={fileTreeEntries}
              truncated={fileTreeTruncated}
              isLoading={isFileTreePending && environmentId !== null}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          </div>

          <IdeEditorPanel
            selectedFile={selectedFile}
            environmentId={environmentId}
            workspaceRoot={workspaceRootOverride ?? null}
            selectedLocation={selectedLocation}
            onFileSaved={handleFileSaved}
            onDirtyStateChange={handleDirtyStateChange}
          />

          <div className="hidden lg:flex">
            <IdeAgentPanel
              environmentId={environmentId}
              agentContext={agentContext}
              evidenceItems={evidenceItems}
            />
          </div>
        </div>

        <IdeBottomPanel
          activeTab={activeBottomTab}
          onTabChange={setActiveBottomTab}
          problems={diagnosticsState.problems}
          diagnosticsState={diagnosticsState}
          onRunDiagnostics={handleRunDiagnostics}
          onClearProblems={handleClearProblems}
          onOpenProblemLocation={handleOpenProblemLocation}
          onAskAgentToFix={handleAskAgentToFix}
          onAskAgentToFixAll={handleAskAgentToFixAll}
          environmentId={environmentId}
          workspaceRoot={workspaceRootOverride ?? null}
          evidenceItems={evidenceItems}
          onAddEvidence={handleAddEvidence}
          onOpenFile={handleOpenFile}
        />
      </div>
    </SidebarInset>
  );
};
