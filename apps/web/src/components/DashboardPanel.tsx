import { RefreshCwIcon } from "lucide-react";

import type { CostAggregate, ToolInvocationRecord } from "@t3tools/contracts";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/utils";
import { useUsageAggregate } from "../hooks/useUsageAggregate";
import { UsageStatCards, ModelCostChart, ProviderBreakdown } from "./UsageDisplay";

function RecentTools({ tools }: { tools: readonly ToolInvocationRecord[] }) {
  if (tools.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-muted-foreground/40">No tool activity yet</p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {tools.slice(0, 10).map((tool) => (
        <div
          key={tool.id}
          className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs"
        >
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
              tool.status === "completed"
                ? "bg-emerald-500/10 text-emerald-500"
                : tool.status === "failed" || tool.status === "declined"
                  ? "bg-red-500/10 text-red-500"
                  : "bg-muted text-muted-foreground/50",
            )}
          >
            {tool.toolType}
          </span>
          {tool.toolName ? (
            <span className="truncate text-foreground/80">{tool.toolName}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DashboardPanel() {
  const { usage, tools, loading, error, refetch } = useUsageAggregate();

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-24 w-[160px] rounded-xl" />
          <Skeleton className="h-24 w-[160px] rounded-xl" />
          <Skeleton className="h-24 w-[160px] rounded-xl" />
          <Skeleton className="h-24 w-[160px] rounded-xl" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12">
        <p className="text-sm text-red-500">{error}</p>
        <Button size="sm" variant="outline" onClick={refetch}>
          Retry
        </Button>
      </div>
    );
  }

  const emptySummary: CostAggregate = {
    totalTurns: 0,
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedInputTokens: 0,
    totalReasoningTokens: 0,
    byProvider: [],
    byModel: [],
    byThread: [],
    accountLimits: [],
  };

  const summary = usage ?? emptySummary;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <Button size="icon-sm" variant="ghost" onClick={refetch} aria-label="Refresh dashboard">
          <RefreshCwIcon className="size-4" />
        </Button>
      </div>

      <UsageStatCards summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Usage by Model</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.byModel.length > 0 ? (
            <ModelCostChart byModel={summary.byModel} />
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground/40">
              No usage data available yet
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Breakdown by Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderBreakdown byProvider={summary.byProvider} />
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Recent Tool Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTools tools={tools} />
        </CardContent>
      </Card>
    </div>
  );
}
