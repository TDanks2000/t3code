import { useCallback, useMemo } from "react";
import type {
  CostAggregate,
  EnvironmentId,
  ThreadId,
  ToolInvocationQueryFilter,
  ToolInvocationRecord,
} from "@t3tools/contracts";

import { usePrimaryEnvironmentId } from "../state/environments";
import { useEnvironmentQuery } from "../state/query";
import { serverEnvironment } from "../state/server";

interface UsageAggregateFilter {
  readonly environmentId?: EnvironmentId | null;
  readonly threadId?: ThreadId;
}

export function useUsageAggregate(filter: UsageAggregateFilter = {}): {
  readonly usage: CostAggregate | null;
  readonly tools: readonly ToolInvocationRecord[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
} {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentId = filter.environmentId ?? primaryEnvironmentId;
  const usageInput = useMemo<ToolInvocationQueryFilter>(
    () => (filter.threadId ? { threadId: filter.threadId } : {}),
    [filter.threadId],
  );
  const toolsInput = useMemo<ToolInvocationQueryFilter>(
    () => ({
      limit: 10,
      ...(filter.threadId ? { threadId: filter.threadId } : {}),
    }),
    [filter.threadId],
  );
  const usageQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.usageSummary({
          environmentId,
          input: usageInput,
        }),
  );
  const toolsQuery = useEnvironmentQuery(
    environmentId === null
      ? null
      : serverEnvironment.toolInvocations({
          environmentId,
          input: toolsInput,
        }),
  );
  const refreshUsage = usageQuery.refresh;
  const refreshTools = toolsQuery.refresh;

  const refetch = useCallback(() => {
    refreshUsage();
    refreshTools();
  }, [refreshTools, refreshUsage]);

  return {
    usage: usageQuery.data,
    tools: toolsQuery.data ?? [],
    loading: usageQuery.isPending || toolsQuery.isPending,
    error: usageQuery.error ?? toolsQuery.error,
    refetch,
  };
}
