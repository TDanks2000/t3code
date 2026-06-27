import type { EnvironmentId, ThreadId } from "@t3tools/contracts";

import { useUsageAggregate } from "../../hooks/useUsageAggregate";
import { formatUsd } from "../UsageDisplay";

export function ThreadUsageChip({
  environmentId,
  threadId,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
}) {
  const { usage, loading } = useUsageAggregate({ environmentId, threadId });

  if (loading || !usage) return null;

  const cost = usage.totalCostUsd;
  if (cost <= 0) return null;

  return (
    <span className="shrink-0 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
      {formatUsd(cost)}
    </span>
  );
}
