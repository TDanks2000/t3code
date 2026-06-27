import type { ThreadId } from "@t3tools/contracts";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";

import type { AppState } from "./store";

export function createThreadSelectorAcrossEnvironments(
  threadId: ThreadId | null,
): (state: AppState) => EnvironmentThreadShell | null {
  if (threadId === null) return () => null;
  return (state) => {
    for (const env of Object.values(state.environments)) {
      const thread = env.threadShellById[threadId] ?? env.sidebarThreadSummaryById[threadId];
      if (thread) return thread;
    }
    return null;
  };
}
