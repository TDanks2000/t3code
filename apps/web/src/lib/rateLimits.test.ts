import { describe, expect, it } from "vite-plus/test";
import { ThreadId } from "@t3tools/contracts";

import {
  deriveRateLimitSnapshotFromAccountLimit,
  deriveRateLimitSnapshotFromProviderUsageLimits,
} from "./rateLimits";

describe("rateLimits", () => {
  it("derives limits from direct Codex account rate-limit responses", () => {
    const snapshot = deriveRateLimitSnapshotFromProviderUsageLimits({
      createdAt: "2026-06-26T00:00:00.000Z",
      rateLimits: {
        rateLimits: {
          primary: { usedPercent: 42, resetsAt: 1_800_000_000_000 },
          secondary: { usedPercent: 12.5, resetsAt: 1_800_086_400_000 },
          planType: "pro",
          credits: { balance: "$10.00", hasCredits: true },
          individualLimit: { remainingPercent: 88 },
        },
      },
    });

    expect(snapshot).toMatchObject({
      planType: "pro",
      creditsBalance: "$10.00",
      hasCredits: true,
      spendLimitRemainingPercent: 88,
      primary: { label: "Primary", usedPercent: 42, resetsAt: 1_800_000_000_000 },
      secondary: { label: "Secondary", usedPercent: 12.5, resetsAt: 1_800_086_400_000 },
    });
  });

  it("derives limits from stored Claude rate-limit events", () => {
    const snapshot = deriveRateLimitSnapshotFromAccountLimit({
      provider: "claudeAgent",
      threadId: ThreadId.make("thread-1"),
      createdAt: "2026-06-26T00:00:00.000Z",
      rateLimits: {
        rateLimits: {
          type: "rate_limit_event",
          rate_limit_info: {
            rateLimitType: "five_hour",
            utilization: 71.5,
            resetsAt: 1_800_000_000,
          },
        },
      },
    });

    expect(snapshot).toMatchObject({
      primary: { label: "5-hour", usedPercent: 71.5, resetsAt: 1_800_000_000_000 },
    });
  });
});
