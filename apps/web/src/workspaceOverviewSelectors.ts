import type { ProviderDriverKind } from "@t3tools/contracts";
import type { AppState, EnvironmentState } from "./store";
import { selectSidebarThreadsAcrossEnvironments } from "./store";
import type { SidebarThreadSummary } from "./types";

export interface OverviewStats {
  totalThreads: number;
  activeRuns: number;
  waitingApproval: number;
  threadsUpdatedToday: number;
  mostUsedProvider: ProviderDriverKind | null;
}

export interface AttentionItem {
  thread: SidebarThreadSummary;
  reason: "pending-approval" | "pending-user-input" | "actionable-plan" | "error";
}

export function selectOverviewStats(state: AppState): OverviewStats {
  const threads = selectSidebarThreadsAcrossEnvironments(state);
  const today = new Date().toISOString().slice(0, 10);

  let activeRuns = 0;
  let waitingApproval = 0;
  let threadsUpdatedToday = 0;
  const providerCount = new Map<ProviderDriverKind, number>();

  for (const thread of threads) {
    const session = thread.session;
    const turn = thread.latestTurn;

    if (
      session?.orchestrationStatus === "running" ||
      session?.orchestrationStatus === "starting" ||
      turn?.state === "running"
    ) {
      activeRuns++;
    }

    if (thread.updatedAt?.startsWith(today) || thread.createdAt.startsWith(today)) {
      threadsUpdatedToday++;
    }

    if (thread.hasPendingApprovals || thread.hasPendingUserInput) {
      waitingApproval++;
    }

    if (session?.provider) {
      providerCount.set(session.provider, (providerCount.get(session.provider) ?? 0) + 1);
    }
  }

  let mostUsedProvider: ProviderDriverKind | null = null;
  let maxCount = 0;
  for (const [provider, count] of providerCount) {
    if (count > maxCount) {
      maxCount = count;
      mostUsedProvider = provider;
    }
  }

  return {
    totalThreads: threads.length,
    activeRuns,
    waitingApproval,
    threadsUpdatedToday,
    mostUsedProvider,
  };
}

export function selectAttentionItems(state: AppState): AttentionItem[] {
  const threads = selectSidebarThreadsAcrossEnvironments(state);
  const items: AttentionItem[] = [];

  for (const thread of threads) {
    if (thread.hasPendingApprovals) {
      items.push({ thread, reason: "pending-approval" });
    }
    if (thread.hasPendingUserInput && !thread.hasPendingApprovals) {
      items.push({ thread, reason: "pending-user-input" });
    }
    if (
      thread.hasActionableProposedPlan &&
      !thread.hasPendingApprovals &&
      !thread.hasPendingUserInput
    ) {
      items.push({ thread, reason: "actionable-plan" });
    }
    if (thread.session?.orchestrationStatus === "error" || thread.session?.status === "error") {
      items.push({ thread, reason: "error" });
    }
  }

  return items;
}

export function selectActiveWorkThreads(state: AppState): SidebarThreadSummary[] {
  const threads = selectSidebarThreadsAcrossEnvironments(state);
  return threads.filter((thread) => {
    const session = thread.session;
    const turn = thread.latestTurn;
    return (
      session?.orchestrationStatus === "running" ||
      session?.orchestrationStatus === "starting" ||
      turn?.state === "running" ||
      turn?.state === "interrupted"
    );
  });
}

export function selectRecentThreads(state: AppState, limit = 10): SidebarThreadSummary[] {
  const threads = selectSidebarThreadsAcrossEnvironments(state);
  return [...threads]
    .sort((a, b) => {
      const aTime = a.updatedAt ?? a.createdAt;
      const bTime = b.updatedAt ?? b.createdAt;
      return bTime.localeCompare(aTime);
    })
    .slice(0, limit);
}

export function selectHasThreads(state: AppState): boolean {
  return selectSidebarThreadsAcrossEnvironments(state).length > 0;
}

export function selectBootstrapCompleteAcrossEnvironments(state: AppState): boolean {
  for (const envState of Object.values(state.environmentStateById) as EnvironmentState[]) {
    if (!envState.bootstrapComplete) {
      return false;
    }
  }
  return Object.keys(state.environmentStateById).length > 0;
}
