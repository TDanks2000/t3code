import type { ActivePlanState } from "~/session-logic";
import type { ProviderDriverKind, RuntimeMode, ProviderInteractionMode } from "@t3tools/contracts";
import type { ProviderRateLimitSnapshot } from "~/lib/rateLimits";
import { formatRateLimitPercent, formatResetsAt } from "~/lib/rateLimits";
import { SquareIcon, GaugeIcon, WrenchIcon } from "lucide-react";
import { memo } from "react";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";

interface StickyRunHeaderProps {
  isWorking: boolean;
  phase: "running" | "ready" | "connecting" | "disconnected";
  provider: ProviderDriverKind;
  interactionMode: ProviderInteractionMode;
  runtimeMode: RuntimeMode;
  activePlan: ActivePlanState | null;
  activePlanCompletedSteps: number;
  activePlanTotalSteps: number;
  rateLimit: ProviderRateLimitSnapshot | null;
  toolCallCount?: number;
  onInterrupt: () => void;
}

export const StickyRunHeader = memo(function StickyRunHeader({
  isWorking,
  phase,
  provider,
  interactionMode,
  runtimeMode,
  activePlan,
  activePlanCompletedSteps,
  activePlanTotalSteps,
  rateLimit,
  toolCallCount = 0,
  onInterrupt,
}: StickyRunHeaderProps) {
  const isRunning = isWorking || phase === "running";
  if (!isRunning && toolCallCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs transition-colors",
        isRunning ? "border-primary/20 bg-primary/[0.04]" : "border-border/40 bg-muted/20",
      )}
    >
      {/* Status indicator — only shown while running */}
      {isRunning && (
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="font-medium tabular-nums text-primary">Running</span>
        </span>
      )}

      {/* Provider */}
      {isRunning && provider && (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-card/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
          {provider}
        </span>
      )}

      {/* Mode */}
      {isRunning && interactionMode && (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
          {interactionMode === "plan" ? "Plan" : "Chat"}
        </span>
      )}

      {/* Runtime mode */}
      {isRunning && runtimeMode && (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
          {runtimeMode}
        </span>
      )}

      {/* Rate limit */}
      {rateLimit && (rateLimit.primary || rateLimit.secondary) && (
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/40 bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
          title={[
            rateLimit.planType ? `Plan: ${rateLimit.planType}` : "",
            rateLimit.creditsBalance ? `Credits: ${rateLimit.creditsBalance}` : "",
            rateLimit.primary
              ? `${rateLimit.primary.label}: ${formatRateLimitPercent(rateLimit.primary.usedPercent) ?? "?"} ${rateLimit.primary.resetsAt ? `(${formatResetsAt(rateLimit.primary.resetsAt)})` : ""}`
              : "",
            rateLimit.secondary
              ? `${rateLimit.secondary.label}: ${formatRateLimitPercent(rateLimit.secondary.usedPercent) ?? "?"} ${rateLimit.secondary.resetsAt ? `(${formatResetsAt(rateLimit.secondary.resetsAt)})` : ""}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <GaugeIcon className="size-2.5 text-muted-foreground/50" />
          <span className="text-muted-foreground/70">
            {rateLimit.primary
              ? `${formatRateLimitPercent(rateLimit.primary.usedPercent) ?? "?"}`
              : rateLimit.secondary
                ? `${formatRateLimitPercent(rateLimit.secondary.usedPercent) ?? "?"}`
                : null}
          </span>
          {rateLimit.planType && (
            <span className="text-muted-foreground/50">{rateLimit.planType}</span>
          )}
        </span>
      )}

      {/* Tool call count */}
      {toolCallCount > 0 && (
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/40 bg-card/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/70">
          <WrenchIcon className="size-2.5 text-muted-foreground/50" />
          <span className="tabular-nums">{toolCallCount}</span>
          <span className="text-muted-foreground/40">tools</span>
        </span>
      )}

      {/* Plan progress */}
      {activePlan && activePlanTotalSteps > 0 && (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 tabular-nums">
            <span className="font-medium text-foreground/70">{activePlanCompletedSteps}</span>
            <span>/</span>
            <span>{activePlanTotalSteps}</span>
            <span>steps</span>
          </span>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-500"
              style={{ width: `${(activePlanCompletedSteps / activePlanTotalSteps) * 100}%` }}
            />
          </div>
        </span>
      )}

      {/* Stop button */}
      {isRunning && (
        <span className="ml-1 flex shrink-0 items-center">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={onInterrupt}
            aria-label="Stop current run"
            className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
          >
            <SquareIcon className="size-3 fill-current" />
          </Button>
        </span>
      )}
    </div>
  );
});
