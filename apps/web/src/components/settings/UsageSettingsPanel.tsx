import { DollarSignIcon, HashIcon, ActivityIcon, CpuIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CostAggregate, ToolInvocationRecord } from "@t3tools/contracts";

import { readLocalApi } from "../../localApi";
import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

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
    <Card className="flex-1">
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

function ModelBarChart({ byModel }: { byModel: CostAggregate["byModel"] }) {
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

function statusClass(status: string | undefined): string {
  if (status === "completed") return "text-emerald-500";
  if (status === "failed" || status === "declined") return "text-red-500";
  return "text-muted-foreground/50";
}

function RecentToolsList({ tools }: { tools: ToolInvocationRecord[] }) {
  if (tools.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/60">
        No recent tool invocations
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      {tools.slice(0, 10).map((tool) => (
        <div
          key={tool.id}
          className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-xs"
        >
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {tool.toolType}
          </span>
          {tool.toolName ? (
            <span className="truncate text-foreground/80">{tool.toolName}</span>
          ) : null}
          {tool.status ? (
            <span className={`ml-auto shrink-0 text-[10px] ${statusClass(tool.status)}`}>
              {tool.status}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function UsageSettingsPanel() {
  const [usage, setUsage] = useState<CostAggregate | null>(null);
  const [tools, setTools] = useState<ToolInvocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const api = readLocalApi();
    if (!api) return;

    void Promise.all([
      api.server.getUsageSummary({}).then((result) => setUsage(result)),
      api.server.listToolInvocations({ limit: 10 }).then((result) => setTools(Array.from(result))),
    ])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load usage data");
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
      <SettingsPageContainer>
        <SettingsSection title="Usage">
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  if (error) {
    return (
      <SettingsPageContainer>
        <SettingsSection title="Usage">
          <div className="p-6 text-center text-sm text-muted-foreground">
            <p className="text-red-500">{error}</p>
          </div>
        </SettingsSection>
      </SettingsPageContainer>
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
    <SettingsPageContainer>
      <SettingsSection title="Usage Summary">
        <div className="flex flex-wrap gap-3 p-4">
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
            label="Reasoning Tokens"
            value={formatTokens(summary.totalReasoningTokens)}
          />
        </div>

        <ModelBarChart byModel={summary.byModel} />

        {summary.byProvider.length > 0 ? (
          <div className="border-t border-border/60 px-4 py-3 sm:px-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
              By Provider
            </h4>
            <div className="mt-2 space-y-1">
              {summary.byProvider.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs"
                >
                  <span className="text-foreground/80">{p.provider}</span>
                  <span className="font-medium text-foreground">{formatUsd(p.totalCostUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Recent Tool Activity">
        <RecentToolsList tools={tools} />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
