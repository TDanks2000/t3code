import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileCode2Icon,
  AlertCircleIcon,
  BinaryIcon,
  FileLock2Icon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  SaveIcon,
  Undo2Icon,
  CheckCircleIcon,
  XCircleIcon,
  TimerIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { readEnvironmentApi } from "../../environmentApi";
import type {
  EnvironmentId,
  WorkspaceReadTextFileResult,
  WorkspaceWriteTextFileResult,
} from "@t3tools/contracts";
import { IdeMonacoEditor } from "./IdeMonacoEditor";
import type { IdeSelectedLocation } from "./IdeShell";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { Button } from "../ui/button";

interface IdeEditorPanelProps {
  selectedFile: string | null;
  environmentId: EnvironmentId | null;
  workspaceRoot?: string | null;
  selectedLocation?: IdeSelectedLocation | null;
  onFileSaved?: ((relativePath: string) => void) | undefined;
  onDirtyStateChange?: ((isDirty: boolean) => void) | undefined;
  className?: string;
}

const FILE_CONTENT_STALE_TIME_MS = 10_000;

type SaveStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "ok"; readonly hash: string }
  | { readonly kind: "conflict" }
  | { readonly kind: "error"; readonly detail: string };

export const IdeEditorPanel = ({
  selectedFile,
  environmentId,
  workspaceRoot,
  selectedLocation,
  onFileSaved,
  onDirtyStateChange,
  className,
}: IdeEditorPanelProps) => {
  const [editorValue, setEditorValue] = useState<string>("");
  const [originalValue, setOriginalValue] = useState<string>("");
  const [lastKnownHash, setLastKnownHash] = useState<string | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });

  const { data: fileResult, isPending } = useQuery({
    queryKey: ["workspaceReadTextFile", environmentId, workspaceRoot, selectedFile],
    queryFn: async (): Promise<WorkspaceReadTextFileResult | null> => {
      if (!selectedFile || !environmentId) return null;
      const api = readEnvironmentApi(environmentId);
      return api
        ? api.workspace.readTextFile({
            ...(workspaceRoot ? { cwd: workspaceRoot } : {}),
            relativePath: selectedFile,
          })
        : null;
    },
    staleTime: FILE_CONTENT_STALE_TIME_MS,
    enabled: selectedFile !== null && environmentId !== null,
  });

  // Reset editor state when file changes
  useEffect(() => {
    if (fileResult?.status === "ok") {
      setEditorValue(fileResult.content);
      setOriginalValue(fileResult.content);
      setLastKnownHash(fileResult.hash);
      setSaveStatus({ kind: "idle" });
    }
  }, [fileResult]);

  const isDirty = editorValue !== originalValue && fileResult?.status === "ok";
  const isSaveable = fileResult?.status === "ok" && isDirty && saveStatus.kind !== "saving";

  const handleChange = useCallback((newValue: string) => {
    setEditorValue(newValue);
    setSaveStatus({ kind: "idle" });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !environmentId || !isDirty) return;
    const api = readEnvironmentApi(environmentId);
    if (!api) {
      setSaveStatus({ kind: "error", detail: "Unable to connect to environment." });
      return;
    }

    setSaveStatus({ kind: "saving" });

    try {
      const result: WorkspaceWriteTextFileResult = await api.workspace.writeTextFile({
        ...(workspaceRoot ? { cwd: workspaceRoot } : {}),
        relativePath: selectedFile,
        content: editorValue,
        expectedHash: lastKnownHash,
      });

      switch (result.status) {
        case "ok":
          setOriginalValue(editorValue);
          setLastKnownHash(result.hash);
          setSaveStatus({ kind: "ok", hash: result.hash });
          onFileSaved?.(selectedFile);
          break;
        case "conflict":
          setSaveStatus({ kind: "conflict" });
          break;
        case "too_large":
          setSaveStatus({
            kind: "error",
            detail: `File too large (${result.sizeBytes} bytes, max ${result.maxSizeBytes}).`,
          });
          break;
        case "unsupported":
          setSaveStatus({ kind: "error", detail: result.reason });
          break;
        case "not_found":
          setSaveStatus({ kind: "error", detail: "File not found on disk." });
          break;
        case "error":
          setSaveStatus({ kind: "error", detail: result.detail });
          break;
      }
    } catch {
      setSaveStatus({ kind: "error", detail: "Save request failed." });
    }
  }, [
    selectedFile,
    environmentId,
    workspaceRoot,
    editorValue,
    isDirty,
    lastKnownHash,
    onFileSaved,
  ]);

  const handleDiscard = useCallback(() => {
    setEditorValue(originalValue);
    setSaveStatus({ kind: "idle" });
  }, [originalValue]);

  const handleReload = useCallback(() => {
    setSaveStatus({ kind: "idle" });
  }, []);

  // Report dirty state to parent for file switch gating
  useEffect(() => {
    onDirtyStateChange?.(isDirty);
  }, [isDirty, onDirtyStateChange]);

  // beforeunload warning
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const content = fileResult?.status === "ok" ? editorValue : null;
  const language = fileResult?.status === "ok" ? fileResult.language : "plaintext";
  const isEditable = fileResult?.status === "ok";

  const revealLine =
    selectedLocation && selectedLocation.filePath === selectedFile
      ? selectedLocation.line
      : undefined;
  const revealColumn =
    selectedLocation && selectedLocation.filePath === selectedFile
      ? selectedLocation.column
      : undefined;

  return (
    <div
      role="region"
      aria-label="Editor"
      className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)}
    >
      <EditorTabBar
        selectedFile={selectedFile}
        fileResult={fileResult}
        isDirty={isDirty}
        isEditable={isEditable}
        isSaving={saveStatus.kind === "saving"}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaveable={isSaveable}
        saveStatus={saveStatus}
        onReload={handleReload}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {selectedFile === null ? (
          <EditorEmptyState />
        ) : isPending ? (
          <EditorLoadingState />
        ) : !fileResult ? (
          <EditorErrorState message="Unable to connect to environment." />
        ) : fileResult.status === "ok" && content !== null ? (
          <IdeMonacoEditor
            path={selectedFile}
            language={language}
            value={content}
            readOnly={!isEditable}
            revealLine={revealLine}
            revealColumn={revealColumn}
            onChange={handleChange}
            className="flex-1"
          />
        ) : fileResult.status === "too_large" ? (
          <EditorStatusState
            Icon={FileLock2Icon}
            heading="File too large"
            detail={`This file (${formatBytes(fileResult.sizeBytes)}) exceeds the ${formatBytes(fileResult.maxSizeBytes)} preview limit.`}
          />
        ) : fileResult.status === "binary" ? (
          <EditorStatusState
            Icon={BinaryIcon}
            heading="Binary file"
            detail="Binary files cannot be previewed as text."
          />
        ) : fileResult.status === "unsupported" ? (
          <EditorStatusState
            Icon={FileCode2Icon}
            heading="Unsupported file type"
            detail={fileResult.reason}
          />
        ) : fileResult.status === "error" ? (
          <EditorErrorStateWithDetail detail={fileResult.detail} />
        ) : (
          <EditorStatusState
            Icon={AlertCircleIcon}
            heading="File not found"
            detail="This file could not be found in the workspace."
          />
        )}
      </div>
    </div>
  );
};

const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  html: "HTML",
  yaml: "YAML",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C++",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  csharp: "C#",
  shell: "Shell",
  sql: "SQL",
  graphql: "GraphQL",
  xml: "XML",
  plaintext: "Text",
  ignore: "Ignore",
  ini: "INI",
};

function formatLanguage(language: string): string {
  return LANGUAGE_LABELS[language] ?? language;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SaveStatusIndicatorProps {
  readonly saveStatus: SaveStatus;
  readonly onReload: () => void;
}

const SaveStatusIndicator = ({ saveStatus, onReload }: SaveStatusIndicatorProps) => {
  switch (saveStatus.kind) {
    case "idle":
    case "saving":
      return null;
    case "ok":
      return (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="flex items-center gap-1 text-[10px] text-green-400/80"
          >
            <CheckCircleIcon className="size-3" aria-hidden />
            <span>Saved</span>
          </TooltipTrigger>
          <TooltipPopup>File saved successfully.</TooltipPopup>
        </Tooltip>
      );
    case "conflict":
      return (
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-amber-400/80">
            <TimerIcon className="size-3" aria-hidden />
            <span>File changed on disk</span>
          </span>
          <button
            type="button"
            onClick={onReload}
            className="text-[10px] underline underline-offset-2 text-amber-400/70 hover:text-amber-400/90"
          >
            Reload from disk
          </button>
        </div>
      );
    case "error":
      return (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="flex items-center gap-1 text-[10px] text-red-400/80"
          >
            <XCircleIcon className="size-3" aria-hidden />
            <span>Failed</span>
          </TooltipTrigger>
          <TooltipPopup>{saveStatus.detail}</TooltipPopup>
        </Tooltip>
      );
  }
};

interface EditorTabBarProps {
  selectedFile: string | null;
  fileResult: WorkspaceReadTextFileResult | null | undefined;
  isDirty: boolean;
  isEditable: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  isSaveable: boolean;
  saveStatus: SaveStatus;
  onReload: () => void;
}

const EditorTabBar = ({
  selectedFile,
  fileResult,
  isDirty,
  isEditable,
  isSaving,
  onSave,
  onDiscard,
  isSaveable,
  saveStatus,
  onReload,
}: EditorTabBarProps) => {
  if (selectedFile === null) {
    return (
      <div className="flex h-9 shrink-0 items-center border-b border-border/60 bg-card/30 px-3">
        <span className="text-[11px] text-muted-foreground/40">No file open</span>
      </div>
    );
  }

  const fileName = selectedFile.split("/").findLast((part) => part.length > 0) ?? selectedFile;
  const language = fileResult?.status === "ok" ? fileResult.language : undefined;

  return (
    <div className="flex h-9 shrink-0 items-center gap-0 border-b border-border/60 bg-card/30">
      <div className="flex h-full items-center gap-1.5 border-r border-border/60 bg-background px-3">
        <FileCode2Icon className="size-3 text-muted-foreground/50" aria-hidden />
        <span className="text-[11px] text-foreground/80">{fileName}</span>
      </div>
      {language && (
        <div className="flex h-full items-center gap-1.5 border-r border-border/60 px-2.5">
          <span className="text-[10px] text-muted-foreground/50">{formatLanguage(language)}</span>
        </div>
      )}
      <div className="flex h-full items-center gap-1 px-2.5 text-muted-foreground/40">
        {isEditable ? (
          <>
            <PencilIcon className="size-2.5" aria-hidden />
            <span className="text-[10px]">Editable</span>
          </>
        ) : (
          <>
            <LockIcon className="size-2.5" aria-hidden />
            <span className="text-[10px]">Read-only</span>
          </>
        )}
      </div>
      {isDirty && (
        <div className="flex h-full items-center gap-1 px-2.5">
          <span className="text-[10px] font-medium text-amber-400/80">Unsaved changes</span>
        </div>
      )}
      <div className="flex h-full flex-1 items-center gap-1 px-2">
        <SaveStatusIndicator saveStatus={saveStatus} onReload={onReload} />
      </div>
      <div className="flex h-full items-center gap-1 px-1.5">
        {isDirty && (
          <Button
            variant="ghost"
            size="xs"
            disabled={!isDirty}
            onClick={onDiscard}
            aria-label="Discard changes"
            className="gap-1 text-[10px]"
          >
            <Undo2Icon className="size-3" aria-hidden />
            Discard
          </Button>
        )}
        {(isSaveable || isSaving) && (
          <Button
            variant="default"
            size="xs"
            disabled={!isSaveable}
            onClick={onSave}
            aria-label={isSaving ? "Saving file" : "Save file"}
            className="gap-1 text-[10px]"
          >
            <SaveIcon className="size-3" aria-hidden />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
};

const EditorEmptyState = () => (
  <div className="flex flex-col items-center gap-3 p-8 text-center">
    <div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground/30">
      <FileCode2Icon className="size-5" aria-hidden />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground/40">No file selected</p>
      <p className="max-w-[22rem] text-[11px] leading-relaxed text-muted-foreground/40">
        Select a file from the explorer to preview its contents.
      </p>
    </div>
  </div>
);

const EditorLoadingState = () => (
  <div className="flex flex-col items-center gap-3 p-8">
    <Loader2Icon className="size-5 animate-spin text-muted-foreground/40" aria-hidden />
    <p className="text-[11px] text-muted-foreground/40">Loading file…</p>
  </div>
);

const EditorErrorState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center gap-3 p-8 text-center">
    <AlertCircleIcon className="size-5 text-destructive/60" aria-hidden />
    <p className="text-[11px] text-muted-foreground/60">{message}</p>
  </div>
);

interface EditorStatusStateProps {
  Icon: ComponentType<{ className?: string }>;
  heading: string;
  detail: string;
}

const EditorStatusState = ({ Icon, heading, detail }: EditorStatusStateProps) => (
  <div className="flex flex-col items-center gap-3 p-8 text-center">
    <div className="flex size-10 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground/30">
      <Icon className="size-5" aria-hidden />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground/40">{heading}</p>
      <p className="max-w-[22rem] text-[11px] leading-relaxed text-muted-foreground/40">{detail}</p>
    </div>
  </div>
);

const EditorErrorStateWithDetail = ({ detail }: { detail: string }) => (
  <div className="flex flex-col items-center gap-3 p-8 text-center">
    <AlertCircleIcon className="size-5 text-destructive/60" aria-hidden />
    <p className="text-[11px] text-muted-foreground/60">{detail}</p>
  </div>
);
