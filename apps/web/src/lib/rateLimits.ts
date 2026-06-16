import type { OrchestrationThreadActivity } from "@t3tools/contracts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export interface RateLimitWindowInfo {
  label: string;
  usedPercent: number | null;
  resetsAt: number | null;
}

export interface ProviderRateLimitSnapshot {
  primary: RateLimitWindowInfo | null;
  secondary: RateLimitWindowInfo | null;
  planType: string | null;
  creditsBalance: string | null;
  hasCredits: boolean | null;
  spendLimitRemainingPercent: number | null;
  updatedAt: string;
}

export function deriveLatestRateLimitSnapshot(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ProviderRateLimitSnapshot | null {
  return mergeRateLimitSnapshots(activities);
}

function mergeRateLimitSnapshots(
  activities: ReadonlyArray<OrchestrationThreadActivity>,
): ProviderRateLimitSnapshot | null {
  let primary: RateLimitWindowInfo | null = null;
  let secondary: RateLimitWindowInfo | null = null;
  let planType: string | null = null;
  let creditsBalance: string | null = null;
  let hasCredits: boolean | null = null;
  let spendLimitRemainingPercent: number | null = null;
  let updatedAt = "";

  for (const activity of activities) {
    if (activity.kind !== "account.rate-limits.updated") continue;

    const payload = asRecord(activity.payload);
    if (!payload) continue;

    // Codex: all windows in one event
    const codexOuter = asRecord(payload.rateLimits);
    if (codexOuter) {
      const rateLimits = asRecord(codexOuter.rateLimits);
      if (rateLimits) {
        if (!primary) {
          const raw = asRecord(rateLimits.primary);
          if (raw) {
            primary = {
              label: "Primary",
              usedPercent: asFiniteNumber(raw.usedPercent),
              resetsAt: asFiniteNumber(raw.resetsAt),
            };
          }
        }
        if (!secondary) {
          const raw = asRecord(rateLimits.secondary);
          if (raw) {
            secondary = {
              label: "Secondary",
              usedPercent: asFiniteNumber(raw.usedPercent),
              resetsAt: asFiniteNumber(raw.resetsAt),
            };
          }
        }
        if (!planType) planType = asString(rateLimits.planType);
        const credits = asRecord(rateLimits.credits);
        if (credits) {
          if (creditsBalance === null) creditsBalance = asString(credits.balance);
          if (hasCredits === null) hasCredits = asBoolean(credits.hasCredits);
        }
        const individualLimit = asRecord(rateLimits.individualLimit);
        if (individualLimit && spendLimitRemainingPercent === null) {
          spendLimitRemainingPercent = asFiniteNumber(individualLimit.remainingPercent);
        }
        updatedAt = activity.createdAt;
        continue;
      }
    }

    // Claude: individual window events, merge them
    const rateLimits = asRecord(payload.rateLimits);
    if (!rateLimits) continue;
    const rateLimitInfo = asRecord(rateLimits.rate_limit_info);
    if (!rateLimitInfo) continue;

    const rateLimitType = asString(rateLimitInfo.rateLimitType);
    const utilization = asFiniteNumber(rateLimitInfo.utilization);
    const resetsAtRaw = asFiniteNumber(rateLimitInfo.resetsAt);
    const resetsAt = resetsAtRaw !== null ? resetsAtRaw * 1000 : null;

    if (rateLimitType === "five_hour" || (!primary && !rateLimitType)) {
      primary = { label: "5-hour", usedPercent: utilization, resetsAt };
    } else if (rateLimitType === "seven_day") {
      secondary = { label: "7-day", usedPercent: utilization, resetsAt };
    } else if (rateLimitType === "overage") {
      secondary = { label: "Overage", usedPercent: utilization, resetsAt };
    } else if (rateLimitType?.startsWith("seven_day_")) {
      const modelName = rateLimitType.replace("seven_day_", "");
      if (!secondary) {
        secondary = { label: `${modelName} 7-day`, usedPercent: utilization, resetsAt };
      }
    }

    updatedAt = activity.createdAt;
  }

  if (!primary && !secondary && !planType && creditsBalance === null) return null;

  return {
    primary,
    secondary,
    planType,
    creditsBalance,
    hasCredits,
    spendLimitRemainingPercent,
    updatedAt,
  };
}

export function formatRateLimitPercent(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 10) return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(value)}%`;
}

export function formatResetsAt(timestamp: number | null): string | null {
  if (timestamp === null) return null;
  const now = Date.now();
  const diff = timestamp - now;
  if (diff <= 0) return "Resetting soon";
  if (diff < 60_000) return "Resets in <1m";
  if (diff < 3_600_000) return `Resets in ${Math.ceil(diff / 60_000)}m`;
  if (diff < 86_400_000) return `Resets in ${Math.ceil(diff / 3_600_000)}h`;
  return `Resets in ${Math.ceil(diff / 86_400_000)}d`;
}
