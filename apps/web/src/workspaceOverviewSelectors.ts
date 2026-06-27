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

interface WorkspaceOverviewSelectorCache {
  readonly environments: AppState["environments"];
  readonly threads: SidebarThreadSummary[];
  readonly recentThreads: SidebarThreadSummary[];
}

let selectorCache: WorkspaceOverviewSelectorCache | null = null;

function selectCachedWorkspaceOverviewThreads(state: AppState): SidebarThreadSummary[] {
  if (selectorCache?.environments !== state.environments) {
    const threads = selectSidebarThreadsAcrossEnvironments(state);
    selectorCache = {
      environments: state.environments,
      threads,
      recentThreads: [...threads].sort(compareRecentThreads),
    };
  }
  return selectorCache.threads;
}

function selectCachedRecentWorkspaceOverviewThreads(state: AppState): SidebarThreadSummary[] {
  if (selectorCache?.environments !== state.environments) {
    selectCachedWorkspaceOverviewThreads(state);
  }
  return selectorCache?.recentThreads ?? [];
}

function compareRecentThreads(a: SidebarThreadSummary, b: SidebarThreadSummary): number {
  const aTime = a.updatedAt ?? a.createdAt;
  const bTime = b.updatedAt ?? b.createdAt;
  return bTime.localeCompare(aTime);
}

export function selectOverviewStats(state: AppState): OverviewStats {
  const threads = selectCachedWorkspaceOverviewThreads(state);
  const today = new Date().toISOString().slice(0, 10);

  let activeRuns = 0;
  let waitingApproval = 0;
  let threadsUpdatedToday = 0;
  const providerCount = new Map<ProviderDriverKind, number>();

  for (const thread of threads) {
    const session = thread.session;
    const turn = thread.latestTurn;

    if (
      session?.status === "running" ||
      session?.status === "starting" ||
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

    if (session?.providerName) {
      const p = session.providerName as ProviderDriverKind;
      providerCount.set(p, (providerCount.get(p) ?? 0) + 1);
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
  const threads = selectCachedWorkspaceOverviewThreads(state);
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
    if (thread.session?.status === "error") {
      items.push({ thread, reason: "error" });
    }
  }

  return items;
}

export function selectActiveWorkThreads(state: AppState): SidebarThreadSummary[] {
  const threads = selectCachedWorkspaceOverviewThreads(state);
  return threads.filter((thread) => {
    const session = thread.session;
    const turn = thread.latestTurn;
    return (
      session?.status === "running" ||
      session?.status === "starting" ||
      turn?.state === "running" ||
      turn?.state === "interrupted"
    );
  });
}

export function selectRecentThreads(state: AppState, limit = 10): SidebarThreadSummary[] {
  return selectCachedRecentWorkspaceOverviewThreads(state).slice(0, limit);
}

export function selectHasThreads(state: AppState): boolean {
  return selectCachedWorkspaceOverviewThreads(state).length > 0;
}

export function selectBootstrapCompleteAcrossEnvironments(state: AppState): boolean {
  const envValues = Object.values(state.environments);
  if (envValues.length === 0) return false;
  return envValues.every((env) => env.bootstrapComplete);
}
