import type { AppState, EnvironmentState } from "./store";
import type {
  MissionBoardAction,
  MissionBoardCard,
  MissionBoardColumn,
  MissionBoardColumnId,
  MissionBoardManualState,
  MissionBoardSummary,
  MissionManualColumnId,
  MissionMoveResult,
} from "./missionBoardTypes";
import type { SidebarThreadSummary } from "./types";
import type { MissionReviewState, MissionReviewStatus } from "./reviewStateStore";
import { selectProjectsAcrossEnvironments } from "./store";

const COLUMN_META: Record<MissionBoardColumnId, { label: string; description: string }> = {
  backlog: { label: "Backlog", description: "Ideas and tasks not yet started" },
  running: { label: "Running", description: "Actively being worked on" },
  needs_human: { label: "Needs Human", description: "Blocked — waiting for you" },
  needs_review: { label: "Needs Review", description: "Agent finished, review output" },
  failed: { label: "Failed", description: "Ran into an error" },
  done: { label: "Done", description: "Completed successfully" },
};

export function getColumnMeta(columnId: MissionBoardColumnId): {
  label: string;
  description: string;
} {
  return COLUMN_META[columnId];
}

export const ALL_COLUMN_IDS: MissionBoardColumnId[] = [
  "backlog",
  "running",
  "needs_human",
  "needs_review",
  "failed",
  "done",
];

export const SYSTEM_CONTROLLED_COLUMN_IDS: MissionBoardColumnId[] = [
  "running",
  "needs_human",
  "needs_review",
  "failed",
];

export const MANUAL_COLUMN_IDS: MissionManualColumnId[] = ["backlog", "done"];

export function isMissionSystemControlled(columnId: MissionBoardColumnId): boolean {
  return (SYSTEM_CONTROLLED_COLUMN_IDS as MissionBoardColumnId[]).includes(columnId);
}

export function isMissionManualColumn(
  columnId: MissionBoardColumnId,
): columnId is MissionManualColumnId {
  return MANUAL_COLUMN_IDS.includes(columnId as MissionManualColumnId);
}

export function getMissionMoveResult(params: {
  card: MissionBoardCard;
  fromColumnId: MissionBoardColumnId;
  toColumnId: MissionBoardColumnId;
}): MissionMoveResult {
  const { card, fromColumnId, toColumnId } = params;

  if (fromColumnId === toColumnId) {
    return { allowed: true };
  }

  if (fromColumnId === "running") {
    return {
      allowed: false,
      reason: "This mission is currently running. Stop or finish the run before moving it.",
    };
  }

  if (fromColumnId === "needs_human") {
    return {
      allowed: false,
      reason: "This mission needs your input. Open it to respond.",
    };
  }

  if (fromColumnId === "failed") {
    return {
      allowed: false,
      reason: "This mission failed. Use Retry to restart it or dismiss it.",
    };
  }

  if (fromColumnId === "needs_review") {
    return {
      allowed: false,
      reason: "Review this mission before moving it to Done.",
    };
  }

  if (toColumnId === "running") {
    return {
      allowed: false,
      reason: "Start the mission from the thread view to run it.",
    };
  }

  if (toColumnId === "needs_human") {
    return {
      allowed: false,
      reason: "Cannot manually set a mission as needing human input.",
    };
  }

  if (toColumnId === "needs_review") {
    return {
      allowed: false,
      reason: "A mission enters review automatically when the agent finishes.",
    };
  }

  if (toColumnId === "failed") {
    return {
      allowed: false,
      reason: "Cannot manually set a mission as failed.",
    };
  }

  if (isMissionManualColumn(fromColumnId) && isMissionManualColumn(toColumnId)) {
    return { allowed: true } as MissionMoveResult;
  }

  return {
    allowed: false,
    reason: "Cannot move this mission to the target column.",
  };
}

export function getMissionEffectiveColumn(
  systemColumnId: MissionBoardColumnId,
  manualState?: MissionBoardManualState | undefined,
): MissionBoardColumnId {
  if (systemColumnId === "running") return "running";
  if (systemColumnId === "needs_human") return "needs_human";
  if (systemColumnId === "needs_review") return "needs_review";
  if (systemColumnId === "failed") return "failed";

  if (systemColumnId === "backlog" || systemColumnId === "done") {
    if (manualState?.manualColumnId && isMissionManualColumn(manualState.manualColumnId)) {
      return manualState.manualColumnId;
    }
    return systemColumnId;
  }

  return systemColumnId;
}

export function sortMissionCardsForColumn(
  cards: MissionBoardCard[],
  manualStates: Record<string, MissionBoardManualState>,
  columnId: MissionBoardColumnId,
): MissionBoardCard[] {
  const manualColumnId = isMissionManualColumn(columnId) ? columnId : null;

  return [...cards].sort((a, b) => {
    if (manualColumnId) {
      const aState = manualStates[a.threadId];
      const bState = manualStates[b.threadId];

      const aOrder = aState?.sortOrder ?? -1;
      const bOrder = bState?.sortOrder ?? -1;

      if (aOrder >= 0 && bOrder >= 0) {
        return aOrder - bOrder;
      }

      if (aOrder >= 0) return -1;
      if (bOrder >= 0) return 1;
    }

    return b.lastActivityAt.localeCompare(a.lastActivityAt);
  });
}

export function getMissionNeedsHumanReason(thread: SidebarThreadSummary): string | undefined {
  if (thread.hasPendingApprovals) return "Waiting for approval";
  if (thread.hasPendingUserInput) return "Waiting for your input";
  if (thread.hasActionableProposedPlan) return "Plan ready for your decision";
  if (thread.session?.orchestrationStatus === "error" && thread.session.lastError) {
    return thread.session.lastError;
  }
  return undefined;
}

export function getMissionReviewStatus(
  thread: SidebarThreadSummary,
  reviewStates: Record<string, MissionReviewState>,
): MissionReviewStatus | undefined {
  const reviewState = reviewStates[thread.id];
  if (!reviewState) return undefined;
  return reviewState.status;
}

export function hasMissionChangedSinceReview(
  thread: SidebarThreadSummary,
  reviewState: MissionReviewState | undefined,
): boolean {
  if (!reviewState) return false;
  if (reviewState.status !== "reviewed") return false;
  if (!reviewState.reviewedAt) return false;
  const lastActivity = thread.updatedAt ?? thread.createdAt;
  return lastActivity > reviewState.reviewedAt;
}

export function getMissionIsEffectivelyUnreviewed(
  thread: SidebarThreadSummary,
  reviewState: MissionReviewState | undefined,
): boolean {
  if (!reviewState) return true;
  if (reviewState.status === "unreviewed") return true;
  if (reviewState.status === "dismissed") return false;
  return hasMissionChangedSinceReview(thread, reviewState);
}

export function getMissionNeedsReviewReason(
  thread: SidebarThreadSummary,
  reviewState: MissionReviewState | undefined,
): string | undefined {
  if (!reviewState || reviewState.status === "unreviewed") {
    return "Agent finished this mission. Check the changes before marking it done.";
  }
  if (reviewState.status === "reviewed" && hasMissionChangedSinceReview(thread, reviewState)) {
    return "New activity after review. Check the latest changes.";
  }
  return undefined;
}

export function getMissionColumnForThread(
  thread: SidebarThreadSummary,
  reviewStates?: Record<string, MissionReviewState>,
): MissionBoardColumnId {
  const session = thread.session;
  const turn = thread.latestTurn;
  const needsHuman =
    thread.hasPendingApprovals || thread.hasPendingUserInput || thread.hasActionableProposedPlan;

  if (turn?.state === "error" || session?.orchestrationStatus === "error") {
    return "failed";
  }

  if (needsHuman) {
    return "needs_human";
  }

  const isActive =
    turn?.state === "running" ||
    session?.orchestrationStatus === "running" ||
    session?.orchestrationStatus === "starting" ||
    session?.orchestrationStatus === "ready";

  if (isActive) {
    return "running";
  }

  const isCompleted = turn?.state === "completed";

  if (isCompleted) {
    const reviewState = reviewStates?.[thread.id];
    if (getMissionIsEffectivelyUnreviewed(thread, reviewState)) {
      return "needs_review";
    }
    return "done";
  }

  if (turn?.state === "interrupted" || session?.orchestrationStatus === "interrupted") {
    return "running";
  }

  if (session?.orchestrationStatus === "stopped") {
    if (turn) {
      const reviewState = reviewStates?.[thread.id];
      if (getMissionIsEffectivelyUnreviewed(thread, reviewState)) {
        return "needs_review";
      }
      return "done";
    }
    return "backlog";
  }

  if (session?.orchestrationStatus === "idle" && turn) {
    if (turn.state === "completed") {
      const reviewState = reviewStates?.[thread.id];
      if (getMissionIsEffectivelyUnreviewed(thread, reviewState)) {
        return "needs_review";
      }
      return "done";
    }
    return "backlog";
  }

  return "backlog";
}

export function getMissionStatusLabel(
  thread: SidebarThreadSummary,
  columnId: MissionBoardColumnId,
): string {
  const turn = thread.latestTurn;
  const session = thread.session;

  if (thread.hasPendingApprovals) return "Pending approval";
  if (thread.hasPendingUserInput) return "Needs input";
  if (thread.hasActionableProposedPlan) return "Plan proposed";

  if (turn?.state === "running") return "Running";
  if (turn?.state === "error") return "Failed";
  if (turn?.state === "interrupted") return "Interrupted";
  if (turn?.state === "completed" && columnId === "done") return "Completed";
  if (turn?.state === "completed" && columnId === "needs_review") return "Needs review";

  if (session?.orchestrationStatus === "starting") return "Starting";
  if (session?.orchestrationStatus === "running") return "Running";
  if (session?.orchestrationStatus === "ready") return "Ready";
  if (session?.orchestrationStatus === "stopped") return "Stopped";
  if (session?.orchestrationStatus === "error") return "Error";
  if (session?.orchestrationStatus === "interrupted") return "Interrupted";

  if (columnId === "backlog") return "Draft";
  if (columnId === "done") return "Done";
  if (columnId === "failed") return "Failed";
  if (columnId === "needs_review") return "Needs review";

  return "Idle";
}

function getMissionLastActivity(thread: SidebarThreadSummary): string {
  return thread.updatedAt ?? thread.createdAt;
}

function getMissionPreview(
  thread: SidebarThreadSummary,
  reviewState?: MissionReviewState,
): string | undefined {
  const turn = thread.latestTurn;
  const session = thread.session;

  if (thread.hasPendingApprovals) return "Changes pending review";
  if (thread.hasPendingUserInput) return "Awaiting your response";
  if (thread.hasActionableProposedPlan) return "Plan ready for review";

  if (turn?.state === "running") return undefined;
  if (turn?.state === "error" && session?.lastError) {
    return session.lastError;
  }
  if (turn?.state === "completed") {
    if (reviewState && hasMissionChangedSinceReview(thread, reviewState)) {
      return "New activity after review";
    }
    return "Completed";
  }
  if (turn?.state === "interrupted") return "Interrupted";
  if (session?.orchestrationStatus === "error" && session.lastError) {
    return session.lastError;
  }
  return undefined;
}

export function getMissionAvailableActions(card: MissionBoardCard): MissionBoardAction[] {
  const actions: MissionBoardAction[] = ["open"];

  if (
    card.columnId === "backlog" ||
    card.columnId === "running" ||
    card.columnId === "needs_human"
  ) {
    actions.push("continue");
  }

  if (card.columnId === "failed") {
    actions.push("retry");
    actions.push("copy_diagnostics");
  }

  if (card.columnId === "needs_human") {
    actions.push("respond");
  }

  if (card.columnId === "needs_review") {
    actions.push("mark_reviewed");
  }

  if (card.columnId === "done") {
    actions.push("mark_unreviewed");
    actions.push("archive");
  }

  return actions;
}

function sortMissionsByRecentActivity(cards: MissionBoardCard[]): MissionBoardCard[] {
  return [...cards].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function selectMissionBoardCards(
  state: AppState,
  reviewStates?: Record<string, MissionReviewState>,
  manualStates?: Record<string, MissionBoardManualState>,
): MissionBoardCard[] {
  const projects = selectProjectsAcrossEnvironments(state);
  const projectNameById: Record<string, string> = {};
  for (const project of projects) {
    projectNameById[`${project.environmentId}:${project.id}`] = project.name;
  }

  const cards: MissionBoardCard[] = [];

  for (const envState of Object.values(state.environmentStateById) as EnvironmentState[]) {
    for (const threadId of envState.threadIds) {
      const thread = envState.sidebarThreadSummaryById[threadId];
      if (!thread) continue;

      const systemColumnId = getMissionColumnForThread(thread, reviewStates);
      const manualState = manualStates?.[thread.id];
      const effectiveColumnId = getMissionEffectiveColumn(systemColumnId, manualState);
      const projectKey = `${thread.environmentId}:${thread.projectId}`;
      const reviewState = reviewStates?.[thread.id];

      const card: MissionBoardCard = {
        id: `${thread.environmentId}:${thread.id}`,
        threadId: thread.id,
        environmentId: thread.environmentId,
        projectId: thread.projectId,
        title: thread.title,
        columnId: effectiveColumnId,
        statusLabel: getMissionStatusLabel(thread, effectiveColumnId),
        lastActivityAt: getMissionLastActivity(thread),
        isActive: effectiveColumnId === "running" || effectiveColumnId === "needs_human",
        needsReview: effectiveColumnId === "needs_review",
        availableActions: [],
      };

      if (reviewState) {
        card.missionReviewStatus = reviewState.status;
        if (reviewState.reviewedAt) {
          card.reviewedAt = reviewState.reviewedAt;
        }
        card.hasNewActivityAfterReview = hasMissionChangedSinceReview(thread, reviewState);
      }

      if (thread.session) {
        card.providerName = String(thread.session.provider);
        if (thread.session.providerInstanceId) {
          card.providerInstanceId = thread.session.providerInstanceId;
        }
      }
      if (projectNameById[projectKey]) {
        card.projectName = projectNameById[projectKey];
      }
      if (effectiveColumnId === "needs_human") {
        const humanReason = getMissionNeedsHumanReason(thread);
        if (humanReason) {
          card.needsHumanReason = humanReason;
          card.preview = humanReason;
        }
      } else if (effectiveColumnId === "needs_review") {
        const reviewReason = getMissionNeedsReviewReason(thread, reviewState);
        if (reviewReason) {
          card.needsReviewReason = reviewReason;
          card.preview = reviewReason;
        }
      } else {
        const preview = getMissionPreview(thread, reviewState);
        if (preview) {
          card.preview = preview;
        }
      }
      if (thread.session?.lastError) {
        card.errorMessage = thread.session.lastError;
      }
      card.availableActions = getMissionAvailableActions(card);
      cards.push(card);
    }
  }

  return cards;
}

export function selectMissionBoardColumns(
  state: AppState,
  reviewStates?: Record<string, MissionReviewState>,
  manualStates?: Record<string, MissionBoardManualState>,
): MissionBoardColumn[] {
  const cards = selectMissionBoardCards(state, reviewStates, manualStates);

  return ALL_COLUMN_IDS.map((columnId) => {
    const meta = getColumnMeta(columnId);
    const columnCards = sortMissionCardsForColumn(
      cards.filter((card) => card.columnId === columnId),
      manualStates ?? {},
      columnId,
    );

    return {
      id: columnId,
      label: meta.label,
      description: meta.description,
      cards: columnCards,
    };
  });
}

export function selectMissionBoardSummary(
  state: AppState,
  reviewStates?: Record<string, MissionReviewState>,
  manualStates?: Record<string, MissionBoardManualState>,
): MissionBoardSummary {
  const cards = selectMissionBoardCards(state, reviewStates, manualStates);
  const summary: MissionBoardSummary = {
    total: cards.length,
    running: 0,
    needsHuman: 0,
    needsReview: 0,
    failed: 0,
    done: 0,
    backlog: 0,
  };

  for (const card of cards) {
    if (card.columnId === "running") summary.running++;
    else if (card.columnId === "needs_human") summary.needsHuman++;
    else if (card.columnId === "needs_review") summary.needsReview++;
    else if (card.columnId === "failed") summary.failed++;
    else if (card.columnId === "done") summary.done++;
    else if (card.columnId === "backlog") summary.backlog++;
  }

  return summary;
}
