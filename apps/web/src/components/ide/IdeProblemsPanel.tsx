import { type ComponentType } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  LightbulbIcon,
  ArrowUpRightIcon,
  Loader2Icon,
  PlayIcon,
  Trash2Icon,
  ClipboardCopyIcon,
} from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import type { DiagnosticRunKind } from "@t3tools/contracts";
import type { IdeProblem, IdeProblemSeverity } from "./ide-types";
import type { DiagnosticsRunState } from "./IdeShell";

interface IdeProblemsPanelProps {
  readonly problems: ReadonlyArray<IdeProblem>;
  readonly diagnosticsState?: DiagnosticsRunState | undefined;
  readonly onRunDiagnostics?: ((kind: DiagnosticRunKind) => void) | undefined;
  readonly onClearProblems?: (() => void) | undefined;
  readonly onOpenProblemLocation?: ((problem: IdeProblem) => void) | undefined;
  readonly onAskAgentToFix?: ((problem: IdeProblem) => void) | undefined;
  readonly onAskAgentToFixAll?: (() => void) | undefined;
  readonly className?: string | undefined;
}

const SEVERITY_ICONS: Record<IdeProblemSeverity, ComponentType<{ className?: string }>> = {
  error: AlertCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

const SEVERITY_COLORS: Record<IdeProblemSeverity, string> = {
  error: "text-red-400/80",
  warning: "text-amber-400/80",
  info: "text-blue-400/80",
};

const RUN_BUTTONS: Array<{ kind: DiagnosticRunKind; label: string }> = [
  { kind: "typecheck", label: "Run Typecheck" },
  { kind: "lint", label: "Run Check" },
  { kind: "test", label: "Run Tests" },
];

const STATE_LABELS: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  error: "Error",
  timed_out: "Timed out",
  unsupported: "Unsupported",
};

export const IdeProblemsPanel = ({
  problems,
  diagnosticsState,
  onRunDiagnostics,
  onClearProblems,
  onOpenProblemLocation,
  onAskAgentToFix,
  onAskAgentToFixAll,
  className,
}: IdeProblemsPanelProps) => {
  const isRunning = diagnosticsState?.status === "running";
  const runningKind = isRunning ? diagnosticsState.runningKind : null;
  const lastRun = diagnosticsState?.status === "complete" ? diagnosticsState.lastRun : null;
  const hasProblems = problems.length > 0;

  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Toolbar with run buttons */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/40 px-2 py-1.5">
        {RUN_BUTTONS.map(({ kind, label }) => (
          <RunDiagnosticButton
            key={kind}
            kind={kind}
            label={label}
            disabled={isRunning || (lastRun?.kind === kind && lastRun.status === "unsupported")}
            isRunning={runningKind === kind}
            isUnsupported={lastRun?.kind === kind && lastRun.status === "unsupported"}
            onRunDiagnostics={onRunDiagnostics}
          />
        ))}
        <div className="flex-1" />
        {hasProblems && (
          <Button
            variant="ghost"
            size="xs"
            disabled={isRunning}
            onClick={onAskAgentToFixAll}
            className="gap-1.5 text-[11px]"
            aria-label="Ask agent to fix all problems"
          >
            <LightbulbIcon className="size-3" aria-hidden />
            Fix all
          </Button>
        )}
        <Button
          variant="ghost"
          size="xs"
          disabled={!hasProblems && !lastRun}
          onClick={onClearProblems}
          className="gap-1.5 text-[11px]"
          aria-label="Clear problems"
        >
          <Trash2Icon className="size-3" aria-hidden />
          Clear
        </Button>
      </div>

      {/* Run state info */}
      {lastRun && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-1">
          <span
            className={cn(
              "text-[11px] font-medium",
              lastRun.status === "passed" && "text-green-400/80",
              lastRun.status === "failed" && "text-red-400/80",
              lastRun.status === "error" && "text-amber-400/80",
              lastRun.status === "timed_out" && "text-amber-400/80",
              lastRun.status === "unsupported" && "text-muted-foreground/60",
            )}
          >
            {STATE_LABELS[lastRun.status] ?? lastRun.status}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{lastRun.commandLabel}</span>
          <span className="text-[10px] text-muted-foreground/40">{lastRun.durationMs}ms</span>
          {lastRun.exitCode != null && (
            <span className="text-[10px] text-muted-foreground/40">
              exit code {lastRun.exitCode}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-400/80">
              <AlertCircleIcon className="size-3" aria-hidden />
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400/80">
              <AlertTriangleIcon className="size-3" aria-hidden />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Running indicator */}
      {isRunning && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3 py-1.5">
          <Loader2Icon className="size-3 animate-spin text-muted-foreground/50" aria-hidden />
          <span className="text-[11px] text-muted-foreground/60">
            Running{" "}
            {runningKind === "typecheck"
              ? "TypeScript typecheck"
              : runningKind === "lint"
                ? "project check"
                : "tests"}
            …
          </span>
        </div>
      )}

      {/* Problems list or output preview */}
      {hasProblems ? (
        <ScrollArea className="flex-1">
          <div className="py-1" role="list" aria-label="Problems">
            {problems.map((problem) => (
              <ProblemRow
                key={problem.id}
                problem={problem}
                onOpenLocation={onOpenProblemLocation}
                onAskAgentToFix={onAskAgentToFix}
              />
            ))}
          </div>
        </ScrollArea>
      ) : lastRun && lastRun.outputPreview && lastRun.status !== "passed" ? (
        <div className="flex flex-1 flex-col overflow-auto p-3">
          <p className="mb-1 text-[10px] font-medium text-muted-foreground/50">
            Raw diagnostic output preview
          </p>
          <pre className="whitespace-pre-wrap break-all rounded border border-border/30 bg-card/40 p-2 text-[10px] leading-relaxed text-muted-foreground/60">
            {lastRun.outputPreview}
          </pre>
        </div>
      ) : !isRunning ? (
        <IdeProblemsEmptyState />
      ) : null}
    </div>
  );
};

const IdeProblemsEmptyState = () => (
  <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center">
    <AlertCircleIcon className="mb-2 size-6 text-muted-foreground/20" aria-hidden />
    <p className="text-[12px] font-medium text-muted-foreground/50">No problems detected.</p>
    <p className="mt-1 max-w-[24rem] text-[11px] leading-relaxed text-muted-foreground/40">
      Run a diagnostic to check for issues in the workspace.
    </p>
  </div>
);

interface RunDiagnosticButtonProps {
  readonly kind: DiagnosticRunKind;
  readonly label: string;
  readonly disabled: boolean;
  readonly isRunning: boolean;
  readonly isUnsupported: boolean;
  readonly onRunDiagnostics?: ((kind: DiagnosticRunKind) => void) | undefined;
}

const RunDiagnosticButton = ({
  kind,
  label,
  disabled,
  isRunning,
  isUnsupported,
  onRunDiagnostics,
}: RunDiagnosticButtonProps) => (
  <Button
    variant="ghost"
    size="xs"
    disabled={disabled}
    onClick={() => onRunDiagnostics?.(kind)}
    className="gap-1.5 text-[11px]"
    aria-label={`${label}${isRunning ? " (running)" : ""}${isUnsupported ? " (unavailable)" : ""}`}
    aria-busy={isRunning}
  >
    {isRunning ? (
      <Loader2Icon className="size-3 animate-spin" aria-hidden />
    ) : (
      <PlayIcon className="size-3" aria-hidden />
    )}
    {label}
  </Button>
);

interface ProblemRowProps {
  readonly problem: IdeProblem;
  readonly onOpenLocation?: ((problem: IdeProblem) => void) | undefined;
  readonly onAskAgentToFix?: ((problem: IdeProblem) => void) | undefined;
}

const ProblemRow = ({ problem, onOpenLocation, onAskAgentToFix }: ProblemRowProps) => {
  const SeverityIcon = SEVERITY_ICONS[problem.severity];
  const colorClass = SEVERITY_COLORS[problem.severity];
  const hasLocation = problem.filePath !== undefined;
  const locationLabel = hasLocation
    ? `Open ${problem.filePath}${problem.line != null ? ` line ${problem.line}` : ""}${problem.column != null ? ` column ${problem.column}` : ""}`
    : undefined;

  const rowContent = (
    <>
      <SeverityIcon className={cn("mt-0.5 size-3.5 shrink-0", colorClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-foreground/80">{problem.message}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <SourceBadge source={problem.source} />
          {problem.code && (
            <span className="rounded-sm bg-accent/30 px-1 py-0.5 text-[9px] font-mono text-muted-foreground/50">
              {problem.code}
            </span>
          )}
          {hasLocation && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
              {problem.filePath}
              {problem.line != null && (
                <span>
                  :{problem.line}
                  {problem.column != null && `:${problem.column}`}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      {hasLocation && (
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label={locationLabel}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onOpenLocation?.(problem);
            }}
            className="flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground/30 hover:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            <ArrowUpRightIcon className="size-3" aria-hidden />
          </TooltipTrigger>
          <TooltipPopup>Open location</TooltipPopup>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={`Ask agent to fix: ${problem.message}`}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onAskAgentToFix?.(problem);
          }}
          className="flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground/30 hover:text-amber-400/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <ClipboardCopyIcon className="size-3" aria-hidden />
        </TooltipTrigger>
        <TooltipPopup>Ask agent to fix</TooltipPopup>
      </Tooltip>
    </>
  );

  if (hasLocation) {
    return (
      <button
        type="button"
        role="listitem"
        onClick={() => onOpenLocation?.(problem)}
        aria-label={locationLabel}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {rowContent}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2 px-3 py-1.5" role="listitem">
      {rowContent}
    </div>
  );
};

const SOURCE_LABELS: Record<string, string> = {
  typescript: "TS",
  lint: "Lint",
  test: "Test",
  runtime: "Runtime",
  agent: "Agent",
  security: "Security",
};

const SourceBadge = ({ source }: { source: string }) => (
  <span className="rounded-sm bg-accent/40 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/50">
    {SOURCE_LABELS[source] ?? source}
  </span>
);
