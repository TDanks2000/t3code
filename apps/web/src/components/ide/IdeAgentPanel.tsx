import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BotIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  TimerIcon,
  FileSearchIcon,
  WrenchIcon,
  ActivityIcon,
  ArrowRightIcon,
  CircleIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import type { EnvironmentId, ToolInvocationRecord } from "@t3tools/contracts";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { cn } from "~/lib/utils";
import type { IdeMissionEvidenceItem } from "./ide-types";
import type { IdeAgentContext, IdeAgentPhase } from "./ide-agent-context";
import { readEnvironmentConnection } from "~/environments/runtime";

const STATUS_ICONS: Record<string, ReactNode> = {
  passed: <CheckCircleIcon className="size-3 text-green-400/80" aria-hidden />,
  failed: <XCircleIcon className="size-3 text-red-400/80" aria-hidden />,
  error: <AlertTriangleIcon className="size-3 text-amber-400/80" aria-hidden />,
  timed_out: <TimerIcon className="size-3 text-amber-400/80" aria-hidden />,
  unknown: <AlertTriangleIcon className="size-3 text-muted-foreground/40" aria-hidden />,
};

const KIND_LABELS: Record<string, string> = {
  typecheck: "Typecheck",
  lint: "Lint",
  test: "Tests",
  manual: "Manual",
  agent: "Agent",
};

interface IdeAgentPanelProps {
  className?: string;
  environmentId: EnvironmentId | null;
  agentContext: IdeAgentContext | null;
  evidenceItems?: ReadonlyArray<IdeMissionEvidenceItem> | undefined;
}

export const IdeAgentPanel = ({
  className,
  environmentId,
  agentContext,
  evidenceItems,
}: IdeAgentPanelProps) => {
  const hasEvidence = evidenceItems !== undefined && evidenceItems.length > 0;
  const navigate = useNavigate();
  const isLive =
    agentContext?.phase === "starting" ||
    agentContext?.phase === "running" ||
    agentContext?.phase === "waiting_for_approval" ||
    agentContext?.phase === "waiting_for_input";
  const toolQuery = useQuery({
    queryKey: ["ideAgentToolInvocations", environmentId, agentContext?.threadId ?? null],
    queryFn: async () => {
      if (!environmentId || !agentContext) return [];
      const connection = readEnvironmentConnection(environmentId);
      if (!connection) {
        throw new Error("Unable to connect to environment.");
      }
      const result = await connection.client.server.listToolInvocations({
        threadId: agentContext.threadId,
        limit: 8,
      });
      return [...result];
    },
    enabled: environmentId !== null && agentContext !== null,
    refetchInterval: isLive ? 2_500 : false,
    staleTime: 1_500,
  });
  const tools = toolQuery.data ?? [];

  return (
    <aside
      aria-label="Agent"
      className={cn("flex w-64 shrink-0 flex-col border-l border-border bg-card/20", className)}
    >
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
        <BotIcon className="size-3.5 text-muted-foreground/50" aria-hidden />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
          Agent
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          <AgentSection title="Current Mission">
            {agentContext ? (
              <div className="space-y-2 rounded-md border border-border/40 bg-background/50 p-2.5">
                <div className="flex items-start gap-2">
                  <PhaseDot phase={agentContext.phase} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-foreground/80">
                      {agentContext.threadTitle}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/50">
                      {agentContext.projectTitle}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={phaseBadgeVariant(agentContext.phase)} size="sm">
                    {agentContext.headline}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40">
                    {agentContext.modelTitle}
                  </span>
                </div>
                {agentContext.detail ? (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/55">
                    {agentContext.detail}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="rounded-md border border-border/40 bg-background/50 p-2.5">
                <p className="text-[11px] text-muted-foreground/50">No active mission</p>
              </div>
            )}
          </AgentSection>

          <AgentSection title="Status">
            <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2.5 py-2">
              {isLive ? (
                <Loader2Icon className="size-3 animate-spin text-info-foreground/80" aria-hidden />
              ) : (
                <BotIcon className="size-3 text-muted-foreground/40" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground/60">
                {agentContext?.headline ?? "Idle"}
              </span>
              {agentContext ? (
                <span className="text-[10px] text-muted-foreground/35">
                  {formatTime(agentContext.updatedAt)}
                </span>
              ) : null}
            </div>
          </AgentSection>

          <AgentSection title="Activity">
            <div className="space-y-1" role="list" aria-label="Agent tool activity">
              {toolQuery.isPending && agentContext ? (
                <ToolActivityPlaceholder />
              ) : toolQuery.error ? (
                <div className="rounded-md border border-border/40 bg-background/50 p-2.5">
                  <p className="text-[11px] text-destructive">
                    {toolQuery.error instanceof Error
                      ? toolQuery.error.message
                      : "Failed to load agent activity."}
                  </p>
                  <Button
                    variant="outline"
                    size="xs"
                    className="mt-2 gap-1.5"
                    onClick={() => void toolQuery.refetch()}
                  >
                    <RefreshCwIcon className="size-3" aria-hidden />
                    <span>Retry</span>
                  </Button>
                </div>
              ) : tools.length > 0 ? (
                tools.map((tool) => <ToolActivityItem key={tool.id} tool={tool} />)
              ) : (
                <div className="rounded-md border border-border/40 bg-background/50 p-2.5">
                  <p className="text-[11px] leading-relaxed text-muted-foreground/40">
                    {agentContext
                      ? "No tool activity recorded for this thread."
                      : "Open a workspace with an agent thread."}
                  </p>
                </div>
              )}
            </div>
          </AgentSection>

          <AgentSection title="Evidence">
            {hasEvidence ? (
              <div className="space-y-1" role="list" aria-label="Diagnostics evidence">
                {evidenceItems.map((item) => (
                  <div
                    key={item.id}
                    role="listitem"
                    className="flex items-start gap-2 rounded-md border border-border/40 bg-background/50 p-2"
                  >
                    <span className="mt-0.5 shrink-0">
                      {STATUS_ICONS[item.status] ?? STATUS_ICONS.unknown}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                          {KIND_LABELS[item.kind] ?? item.kind}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            item.status === "passed" && "text-green-400/80",
                            item.status === "failed" && "text-red-400/80",
                            item.status === "error" && "text-amber-400/80",
                            item.status === "timed_out" && "text-amber-400/80",
                          )}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/50">
                        {item.problemCount != null && (
                          <span>
                            {item.problemCount} problem{item.problemCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {item.durationMs != null && <span>{item.durationMs}ms</span>}
                      </div>
                      {item.detail && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground/40">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border/40 bg-background/50 p-2.5">
                <p className="text-[11px] leading-relaxed text-muted-foreground/40">
                  No evidence recorded yet. Run typecheck, lint, or tests from the Problems panel.
                </p>
              </div>
            )}
          </AgentSection>

          <AgentSection title="Actions">
            <div className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                size="xs"
                disabled={!agentContext}
                className="w-full justify-start gap-2"
                onClick={() => {
                  if (!agentContext) return;
                  void navigate({
                    to: "/$environmentId/$threadId",
                    params: {
                      environmentId: agentContext.environmentId,
                      threadId: agentContext.threadId,
                    },
                  });
                }}
              >
                <ArrowRightIcon className="size-3" aria-hidden />
                <span>Open thread</span>
              </Button>
              <Button variant="outline" size="xs" disabled className="w-full justify-start gap-2">
                <FileSearchIcon className="size-3" aria-hidden />
                <span>Explain this file</span>
              </Button>
              <Button variant="outline" size="xs" disabled className="w-full justify-start gap-2">
                <WrenchIcon className="size-3" aria-hidden />
                <span>Fix problem</span>
              </Button>
            </div>
          </AgentSection>
        </div>
      </ScrollArea>
    </aside>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function phaseBadgeVariant(
  phase: IdeAgentPhase,
): "default" | "info" | "warning" | "success" | "error" | "outline" {
  switch (phase) {
    case "running":
    case "starting":
      return "info";
    case "waiting_for_approval":
    case "waiting_for_input":
      return "warning";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "idle":
      return "outline";
  }
}

function PhaseDot({ phase }: { readonly phase: IdeAgentPhase }) {
  return (
    <span
      className={cn(
        "mt-1 flex size-2.5 shrink-0 rounded-full ring-2 ring-background",
        (phase === "running" || phase === "starting") && "bg-info-foreground/80",
        (phase === "waiting_for_approval" || phase === "waiting_for_input") &&
          "bg-warning-foreground/80",
        phase === "completed" && "bg-success-foreground/80",
        phase === "failed" && "bg-destructive",
        phase === "idle" && "bg-muted-foreground/30",
      )}
      aria-hidden
    />
  );
}

function toolBadgeVariant(
  status: ToolInvocationRecord["status"],
): "default" | "success" | "error" | "warning" | "outline" {
  if (status === "completed") return "success";
  if (status === "failed" || status === "declined") return "error";
  if (status === "inProgress") return "warning";
  return "outline";
}

function ToolActivityItem({ tool }: { readonly tool: ToolInvocationRecord }) {
  const label = tool.toolName ?? tool.title ?? tool.toolType;
  const detail = tool.command ?? tool.filePaths?.[0] ?? tool.inputPreview ?? tool.outputPreview;
  return (
    <div
      role="listitem"
      className="flex items-start gap-2 rounded-md border border-border/40 bg-background/50 p-2"
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-muted/60">
        {tool.status === "inProgress" ? (
          <Loader2Icon className="size-3 animate-spin text-warning-foreground/80" aria-hidden />
        ) : tool.status === "completed" ? (
          <CheckCircleIcon className="size-3 text-success-foreground/80" aria-hidden />
        ) : tool.status === "failed" || tool.status === "declined" ? (
          <XCircleIcon className="size-3 text-destructive" aria-hidden />
        ) : (
          <ActivityIcon className="size-3 text-muted-foreground/45" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/75">
            {label}
          </span>
          <Badge variant={toolBadgeVariant(tool.status)} size="sm">
            {tool.status ?? "queued"}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground/45">
          <span>{formatTime(tool.startedAt)}</span>
          {tool.elapsedMs != null ? <span>{formatDuration(tool.elapsedMs)}</span> : null}
          {tool.exitCode != null ? <span>exit {tool.exitCode}</span> : null}
        </div>
        {detail ? (
          <p className="mt-0.5 line-clamp-2 break-words text-[10px] text-muted-foreground/40">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  return ms >= 1_000 ? `${(ms / 1_000).toFixed(1)}s` : `${ms}ms`;
}

function ToolActivityPlaceholder() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-2 rounded-md border border-border/30 bg-background/40 p-2"
        >
          <CircleIcon className="size-3 text-muted-foreground/20" aria-hidden />
          <div className="h-2 flex-1 rounded bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

interface AgentSectionProps {
  title: string;
  children: ReactNode;
}

const AgentSection = ({ title, children }: AgentSectionProps) => (
  <div className="space-y-1.5">
    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/40">
      {title}
    </h3>
    {children}
  </div>
);
