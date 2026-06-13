import { memo, useEffect, useState } from "react";
import { PanelRightCloseIcon, WrenchIcon, RefreshCwIcon } from "lucide-react";

import type { ToolInvocationRecord, ThreadId } from "@t3tools/contracts";

import { readLocalApi } from "../localApi";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/utils";

interface ToolActivityPanelProps {
  threadId: ThreadId;
  mode?: "sheet" | "sidebar";
  onClose: () => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function statusBadgeVariant(status: string | undefined) {
  if (status === "completed") return "success" as const;
  if (status === "failed" || status === "declined") return "error" as const;
  return "default" as const;
}

const ToolActivityPanel = memo(function ToolActivityPanel({
  threadId,
  mode = "sidebar",
  onClose,
}: ToolActivityPanelProps) {
  const [tools, setTools] = useState<readonly ToolInvocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const fetchTools = () => {
    const api = readLocalApi();
    if (!api) return;

    void api.server
      .listToolInvocations({ threadId, limit: 50 })
      .then((result) => {
        setTools(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load tool activity");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTools();
  }, [threadId]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-card/50",
        mode === "sidebar"
          ? "h-full w-[340px] shrink-0 border-l border-border/70"
          : "h-full w-full",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="info"
            size="sm"
            className="rounded-md px-1.5 py-0 font-semibold tracking-wide uppercase"
          >
            Tool Activity
          </Badge>
          {!loading ? (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {tools.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={fetchTools}
            aria-label="Refresh tool activity"
            className="text-muted-foreground/50 hover:text-foreground/70"
            disabled={loading}
          >
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close tool activity sidebar"
            className="text-muted-foreground/50 hover:text-foreground/70"
          >
            <PanelRightCloseIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-red-500">{error}</p>
              <Button size="xs" variant="outline" className="mt-3" onClick={fetchTools}>
                Retry
              </Button>
            </div>
          ) : tools.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <WrenchIcon className="mb-3 size-8 text-muted-foreground/20" />
              <p className="text-[13px] text-muted-foreground/40">No tool activity yet.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/30">
                Tool invocations will appear here as they execute.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {tools.map((tool) => (
                <div key={tool.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/30"
                    onClick={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-bold",
                        tool.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : tool.status === "failed" || tool.status === "declined"
                            ? "bg-red-500/10 text-red-500"
                            : "bg-muted text-muted-foreground/50",
                      )}
                    >
                      {tool.toolType[0]?.toUpperCase() ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-foreground/80">
                          {tool.toolName ?? tool.toolType}
                        </span>
                        <Badge variant={statusBadgeVariant(tool.status)} size="sm">
                          {tool.status ?? "pending"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground/50">
                        {formatTime(tool.createdAt)}
                        {tool.elapsedMs != null
                          ? ` · ${tool.elapsedMs >= 1000 ? `${(tool.elapsedMs / 1000).toFixed(1)}s` : `${tool.elapsedMs}ms`}`
                          : ""}
                      </p>
                    </div>
                  </button>
                  {expandedTool === tool.id ? (
                    <div className="mx-2 mb-2 space-y-2 rounded-lg border border-border/40 bg-background/50 p-3 text-xs">
                      {tool.inputPreview ? (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                            Input
                          </p>
                          <pre className="whitespace-pre-wrap break-all text-muted-foreground/70">
                            {tool.inputPreview}
                          </pre>
                        </div>
                      ) : null}
                      {tool.outputPreview ? (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                            Output
                          </p>
                          <pre className="whitespace-pre-wrap break-all text-muted-foreground/70">
                            {tool.outputPreview}
                          </pre>
                        </div>
                      ) : null}
                      {tool.command ? (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                            Command
                          </p>
                          <code className="block rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground/70">
                            {tool.command}
                          </code>
                        </div>
                      ) : null}
                      {tool.exitCode != null ? (
                        <p className="text-muted-foreground/50">
                          Exit code:{" "}
                          <span
                            className={tool.exitCode === 0 ? "text-emerald-500" : "text-red-500"}
                          >
                            {tool.exitCode}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

export default ToolActivityPanel;
