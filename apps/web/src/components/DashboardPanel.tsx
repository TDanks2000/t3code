import { useCallback, useEffect, useState } from "react";
import { DollarSignIcon, HashIcon, ActivityIcon, CpuIcon, RefreshCwIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CostAggregate, ToolInvocationRecord } from "@t3tools/contracts";

import { readLocalApi } from "../localApi";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/utils";

function formatUsd(cents: number): string {
  if (cents < 0.01) return "$0.00";
  return `$${cents.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: {
  icon: typeof DollarSignIcon;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Icon className="size-4 text-muted-foreground" />
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {sublabel ? <p className="mt-1 text-[11px] text-muted-foreground/70">{sublabel}</p> : null}
      </CardContent>
    </Card>
  );
}

function ModelCostChart({ byModel }: { byModel: CostAggregate["byModel"] }) {
  if (byModel.length === 0) return null;

  const data = byModel.map((m) => ({
    name: m.model.length > 20 ? m.model.slice(0, 20) + "..." : m.model,
    cost: Math.round(m.totalCostUsd * 100) / 100,
  }));

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        Cost by Model
      </h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
            }}
            formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
          />
          <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

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
  const [usage, setUsage] = useState<CostAggregate | null>(null);
  const [tools, setTools] = useState<readonly ToolInvocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const api = readLocalApi();
    if (!api) return;

    void Promise.all([
      api.server.getUsageSummary({}).then((result) => setUsage(result)),
      api.server.listToolInvocations({ limit: 20 }).then((result) => setTools(result)),
    ])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <Button size="sm" variant="outline" onClick={fetchData}>
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
  };

  const summary = usage ?? emptySummary;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        <Button size="icon-sm" variant="ghost" onClick={fetchData} aria-label="Refresh dashboard">
          <RefreshCwIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatCard
          icon={DollarSignIcon}
          label="Total Cost"
          value={formatUsd(summary.totalCostUsd)}
          sublabel={`${summary.totalTurns} turns`}
        />
        <StatCard
          icon={HashIcon}
          label="Input Tokens"
          value={formatTokens(summary.totalInputTokens)}
        />
        <StatCard
          icon={ActivityIcon}
          label="Output Tokens"
          value={formatTokens(summary.totalOutputTokens)}
        />
        <StatCard
          icon={CpuIcon}
          label="Reasoning"
          value={formatTokens(summary.totalReasoningTokens)}
        />
      </div>

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
          {summary.byProvider.length > 0 ? (
            <div className="space-y-2">
              {summary.byProvider.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2"
                >
                  <span className="text-sm text-foreground/80">{p.provider}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{p.totalTurns} turns</span>
                    <span className="font-medium text-foreground">{formatUsd(p.totalCostUsd)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-muted-foreground/40">
              No provider data available yet
            </p>
          )}
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
