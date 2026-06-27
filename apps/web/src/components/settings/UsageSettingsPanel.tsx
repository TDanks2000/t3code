import { useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleIcon,
  GaugeIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import type { CostAggregate, ServerProvider, ToolInvocationRecord } from "@t3tools/contracts";

import { SettingsPageContainer, SettingsSection } from "./settingsLayout";
import { useUsageAggregate } from "../../hooks/useUsageAggregate";
import {
  UsageStatCards,
  ModelCostChart,
  ProviderBreakdown,
  ThreadUsageList,
} from "../UsageDisplay";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { primaryServerProvidersAtom } from "../../state/server";
import {
  deriveRateLimitSnapshotFromAccountLimit,
  deriveRateLimitSnapshotFromProviderUsageLimits,
  formatRateLimitPercent,
  formatResetsAt,
  type ProviderRateLimitSnapshot,
} from "../../lib/rateLimits";

function statusClass(status: string | undefined): string {
  if (status === "completed") return "text-emerald-500";
  if (status === "failed" || status === "declined") return "text-red-500";
  return "text-muted-foreground/50";
}

function RecentToolsList({ tools }: { tools: readonly ToolInvocationRecord[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:px-5">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border/55 bg-background/40 text-muted-foreground">
          <WrenchIcon className="size-4" />
        </div>
        <p className="text-sm font-medium text-foreground/80">No recent tool activity</p>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground/65">
          Tool calls will appear here after agents run commands, edit files, or query external
          context.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/55">
      {tools.slice(0, 10).map((tool) => (
        <div
          key={tool.id}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-xs sm:px-5"
        >
          <span className="shrink-0 rounded-md border border-border/45 bg-background/45 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {tool.toolType}
          </span>
          {tool.toolName ? (
            <span className="truncate font-medium text-foreground/85">{tool.toolName}</span>
          ) : (
            <span className="truncate text-muted-foreground/65">Unnamed tool call</span>
          )}
          {tool.status ? (
            <Badge
              size="sm"
              variant={
                tool.status === "completed"
                  ? "success"
                  : tool.status === "failed" || tool.status === "declined"
                    ? "error"
                    : "outline"
              }
              className={`shrink-0 ${statusClass(tool.status)}`}
            >
              {tool.status}
            </Badge>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function authStatusBadge(status: ServerProvider["auth"]["status"]) {
  if (status === "authenticated") {
    return (
      <Badge size="sm" variant="success" className="gap-1">
        <CheckCircle2Icon className="size-2.5" />
        Authenticated
      </Badge>
    );
  }
  if (status === "unauthenticated") {
    return (
      <Badge size="sm" variant="error" className="gap-1">
        <CircleIcon className="size-2.5" />
        Not signed in
      </Badge>
    );
  }
  return (
    <Badge size="sm" variant="outline">
      Unknown
    </Badge>
  );
}

function normalizeLimitKey(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function buildPersistedLimitMap(
  accountLimits: NonNullable<CostAggregate["accountLimits"]>,
): Map<string, ProviderRateLimitSnapshot> {
  const limits = new Map<string, ProviderRateLimitSnapshot>();
  for (const accountLimit of accountLimits) {
    const key = normalizeLimitKey(accountLimit.provider);
    if (!key || limits.has(key)) continue;
    const snapshot = deriveRateLimitSnapshotFromAccountLimit(accountLimit);
    if (snapshot) {
      limits.set(key, snapshot);
    }
  }
  return limits;
}

function findPersistedLimit(
  provider: ServerProvider,
  persistedLimits: Map<string, ProviderRateLimitSnapshot>,
): ProviderRateLimitSnapshot | null {
  for (const candidate of [provider.instanceId, provider.driver, provider.displayName]) {
    const key = normalizeLimitKey(candidate);
    if (!key) continue;
    const snapshot = persistedLimits.get(key);
    if (snapshot) return snapshot;
  }
  return null;
}

function LimitMetric({ window }: { window: NonNullable<ProviderRateLimitSnapshot["primary"]> }) {
  return (
    <div className="min-w-0 rounded-md border border-border/45 bg-background/35 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/45">
          {window.label}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-foreground/75">
          {formatRateLimitPercent(window.usedPercent) ?? "-"}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground/45">
        {formatResetsAt(window.resetsAt) ?? "Reset unavailable"}
      </p>
    </div>
  );
}

function RateLimitSnapshotView({ snapshot }: { snapshot: ProviderRateLimitSnapshot }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {snapshot.primary ? <LimitMetric window={snapshot.primary} /> : null}
        {snapshot.secondary ? <LimitMetric window={snapshot.secondary} /> : null}
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground/55">
        {snapshot.planType ? (
          <span className="rounded-md border border-border/40 px-1.5 py-0.5">
            {snapshot.planType}
          </span>
        ) : null}
        {snapshot.creditsBalance ? (
          <span className="rounded-md border border-border/40 px-1.5 py-0.5">
            credits {snapshot.creditsBalance}
          </span>
        ) : null}
        {snapshot.spendLimitRemainingPercent !== null ? (
          <span className="rounded-md border border-border/40 px-1.5 py-0.5">
            spend {formatRateLimitPercent(snapshot.spendLimitRemainingPercent)} remaining
          </span>
        ) : null}
        <span className="rounded-md border border-border/40 px-1.5 py-0.5">
          updated {new Date(snapshot.updatedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatTokenCount(value: number | null): string | null {
  if (value === null) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function CodexTokenUsageView({ provider }: { provider: ServerProvider }) {
  const tokenUsage = asRecord(provider.usageLimits?.tokenUsage);
  const summary = asRecord(tokenUsage?.summary);
  if (!summary) return null;

  const lifetimeTokens = formatTokenCount(asNumber(summary.lifetimeTokens));
  const peakDailyTokens = formatTokenCount(asNumber(summary.peakDailyTokens));
  if (!lifetimeTokens && !peakDailyTokens) return null;

  return (
    <p className="mt-2 text-[11px] text-muted-foreground/55">
      {lifetimeTokens ? `${lifetimeTokens} lifetime tokens` : null}
      {lifetimeTokens && peakDailyTokens ? " · " : null}
      {peakDailyTokens ? `${peakDailyTokens} peak daily tokens` : null}
    </p>
  );
}

function SubscriptionLimitsSection({
  providers,
  accountLimits,
}: {
  providers: ReadonlyArray<ServerProvider>;
  accountLimits: NonNullable<CostAggregate["accountLimits"]>;
}) {
  const visible = providers.filter((p) => p.enabled && p.installed);
  const persistedLimits = buildPersistedLimitMap(accountLimits);

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:px-5">
        <div className="flex size-9 items-center justify-center rounded-lg border border-border/55 bg-background/40 text-muted-foreground">
          <GaugeIcon className="size-4" />
        </div>
        <p className="text-sm font-medium text-foreground/80">No active providers</p>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground/65">
          Configure a provider in the Providers settings to see subscription info here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/55">
      {visible.map((provider) => {
        const label = provider.auth.label ?? provider.auth.type ?? null;
        const email = provider.auth.email ?? null;
        const name = provider.displayName ?? String(provider.driver);
        const directLimit = deriveRateLimitSnapshotFromProviderUsageLimits(provider.usageLimits);
        const persistedLimit = findPersistedLimit(provider, persistedLimits);
        const rateLimit = directLimit ?? persistedLimit;

        return (
          <div key={provider.instanceId} className="px-4 py-3.5 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground/85">{name}</span>
                  <span className="shrink-0 rounded-md border border-border/45 bg-background/45 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {provider.driver}
                  </span>
                </div>
                {label && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
                    <GaugeIcon className="size-3 shrink-0" />
                    {label}
                  </p>
                )}
                {email && <p className="text-xs text-muted-foreground/55">{email}</p>}
              </div>
              <div className="shrink-0 pt-0.5">{authStatusBadge(provider.auth.status)}</div>
            </div>
            {provider.auth.status === "authenticated" && !label && (
              <p className="mt-1.5 text-[11px] text-muted-foreground/45">
                Subscription info not available for this provider.
              </p>
            )}
            {rateLimit ? <RateLimitSnapshotView snapshot={rateLimit} /> : null}
            <CodexTokenUsageView provider={provider} />
          </div>
        );
      })}
      <div className="px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-4 text-muted-foreground/40">
          Limits come from provider account APIs when available, with live session events used as
          the fallback.
        </p>
      </div>
    </div>
  );
}

export function UsageSettingsPanel() {
  const { usage, tools, loading, error, refetch } = useUsageAggregate();
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>();
  const providers = useAtomValue(primaryServerProvidersAtom);

  const threadUsage = selectedThreadId
    ? usage?.byThread.find((t) => t.threadId === selectedThreadId)
    : undefined;

  if (loading) {
    return (
      <SettingsPageContainer>
        <SettingsSection
          title="Usage"
          description="Cost, token, and tool activity captured from local provider sessions."
        >
          <div className="space-y-3 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </SettingsSection>
      </SettingsPageContainer>
    );
  }

  if (error) {
    return (
      <SettingsPageContainer>
        <SettingsSection
          title="Usage"
          description="Cost, token, and tool activity captured from local provider sessions."
        >
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="max-w-md text-sm text-destructive-foreground">{error}</div>
            <Button size="xs" variant="outline" onClick={() => void refetch()}>
              <RefreshCwIcon className="size-3.5" />
              Retry
            </Button>
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
    byThread: [],
    accountLimits: [],
  };

  const summary = usage ?? emptySummary;
  const threadSummary: CostAggregate | undefined = threadUsage
    ? { ...emptySummary, ...threadUsage }
    : undefined;

  return (
    <SettingsPageContainer>
      <SettingsSection
        title={selectedThreadId ? "Thread Usage" : "Usage Summary"}
        description={
          selectedThreadId
            ? "A focused view of the selected thread's recorded model usage."
            : "Cost, token, and model usage across recorded local provider sessions."
        }
        headerAction={
          <Button size="xs" variant="outline" onClick={() => void refetch()}>
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        }
      >
        <UsageStatCards summary={threadSummary ?? summary} />

        {!selectedThreadId ? (
          <>
            <ModelCostChart byModel={summary.byModel} />

            {summary.byProvider.length > 0 ? (
              <div className="border-b border-border/60 px-4 py-4 sm:px-5">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55">
                  By Provider
                </h4>
                <p className="mt-1 text-xs text-muted-foreground/65">
                  Provider-level totals from recent turn records.
                </p>
                <ProviderBreakdown byProvider={summary.byProvider} />
              </div>
            ) : null}

            <div className="px-4 py-4 sm:px-5">
              <ThreadUsageList
                byThread={summary.byThread}
                selectedThreadId={selectedThreadId}
                onSelect={setSelectedThreadId}
              />
            </div>
          </>
        ) : (
          <div className="border-t border-border/60 px-4 py-4 sm:px-5">
            <Button size="xs" variant="outline" onClick={() => setSelectedThreadId(undefined)}>
              <ArrowLeftIcon className="size-3.5" />
              All threads
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Subscription Limits"
        description="Provider subscription plans and authentication status. Live rate limit usage appears in the chat header during active sessions."
      >
        <SubscriptionLimitsSection
          providers={providers}
          accountLimits={summary.accountLimits ?? []}
        />
      </SettingsSection>

      <SettingsSection
        title="Recent Tool Activity"
        description="The last tool invocations recorded by local agent runs."
      >
        <RecentToolsList tools={tools} />
      </SettingsSection>
    </SettingsPageContainer>
  );
}
