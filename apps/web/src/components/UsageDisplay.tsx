import { ActivityIcon, CpuIcon, DollarSignIcon, HashIcon, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CostAggregate } from "@t3tools/contracts";

import { cn } from "~/lib/utils";

export function formatUsd(cents: number): string {
  if (cents < 0.01) return "$0.00";
  return `$${cents.toFixed(2)}`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return `${count}`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={cn(
        "relative min-h-28 overflow-hidden rounded-xl border border-border/55 bg-background/45 p-4 shadow-xs/5",
        tone === "primary" && "border-primary/20 bg-primary/[0.055]",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "absolute -right-6 -top-8 size-20 rounded-full bg-foreground/[0.035]",
          tone === "primary" && "bg-primary/10",
        )}
      />
      <div className="relative flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground",
            tone === "primary" && "bg-primary/[0.12] text-primary",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">
          {label}
        </span>
      </div>
      <div className="relative mt-4 text-2xl font-semibold tracking-[-0.03em] text-foreground">
        {value}
      </div>
      {sublabel ? (
        <p className="relative mt-1 text-[11px] leading-4 text-muted-foreground/70">{sublabel}</p>
      ) : null}
    </div>
  );
}

export function UsageStatCards({ summary }: { summary: CostAggregate }) {
  return (
    <div className="grid gap-3 border-b border-border/60 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
      <StatCard
        icon={DollarSignIcon}
        label="Total Cost"
        value={formatUsd(summary.totalCostUsd)}
        sublabel={`${summary.totalTurns} turns`}
        tone="primary"
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
  );
}

export function ModelCostChart({ byModel }: { byModel: CostAggregate["byModel"] }) {
  if (byModel.length === 0) return null;

  const data = byModel.map((m) => ({
    name: m.model.length > 20 ? m.model.slice(0, 20) + "..." : m.model,
    cost: Math.round(m.totalCostUsd * 100) / 100,
  }));

  return (
    <div className="border-b border-border/60 px-4 py-4 sm:px-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55">
            Cost by Model
          </h4>
          <p className="mt-1 text-xs text-muted-foreground/65">Spend distribution across models.</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgb(0 0 0 / 0.10)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
          />
          <Bar dataKey="cost" fill="var(--primary)" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProviderBreakdown({ byProvider }: { byProvider: CostAggregate["byProvider"] }) {
  if (byProvider.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground/50">
        No provider data available yet
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {byProvider.map((p) => (
        <div
          key={p.provider}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/45 bg-background/35 px-3 py-2.5"
        >
          <span className="min-w-0 truncate text-sm font-medium text-foreground/85">
            {p.provider}
          </span>
          <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
            <span>{p.totalTurns} turns</span>
            <span className="font-medium text-foreground">{formatUsd(p.totalCostUsd)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadUsageList({
  byThread,
  selectedThreadId,
  onSelect,
}: {
  byThread: CostAggregate["byThread"];
  selectedThreadId?: string | undefined;
  onSelect?: ((threadId: string) => void) | undefined;
}) {
  if (byThread.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground/50">
        No thread usage data available
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55">
            By Thread
          </h4>
          <p className="mt-1 text-xs text-muted-foreground/65">
            Open a thread row to isolate its totals.
          </p>
        </div>
      </div>
      <div className="mt-3 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/55 bg-background/30">
        {byThread.map((t) => (
          <button
            key={t.threadId}
            type="button"
            onClick={() => onSelect?.(t.threadId)}
            className={[
              "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-xs transition-colors",
              "hover:bg-muted/55",
              t.threadId === selectedThreadId ? "bg-primary/[0.08]" : "",
            ].join(" ")}
          >
            <span className="max-w-[220px] truncate font-mono text-foreground/80">
              {t.threadId.slice(0, 16)}...
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-muted-foreground">{t.totalTurns} turns</span>
              <span className="font-medium text-foreground">{formatUsd(t.totalCostUsd)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
