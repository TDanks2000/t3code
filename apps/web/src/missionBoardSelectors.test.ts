import {
  EnvironmentId,
  OrchestrationLatestTurn,
  ProjectId,
  ProviderDriverKind,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  getMissionColumnForThread,
  getMissionNeedsReviewReason,
  getMissionIsEffectivelyUnreviewed,
  hasMissionChangedSinceReview,
  getMissionMoveResult,
  getMissionEffectiveColumn,
  isMissionSystemControlled,
  isMissionManualColumn,
  sortMissionCardsForColumn,
  selectMissionBoardColumns,
  selectMissionBoardSummary,
} from "./missionBoardSelectors";
import type { MissionBoardCard, MissionBoardColumnId, MissionBoardManualState } from "./missionBoardTypes";
import type { AppState, EnvironmentState } from "./store";
import type { MissionReviewState } from "./reviewStateStore";
import type { SidebarThreadSummary } from "./types";
import { DEFAULT_INTERACTION_MODE } from "./types";

const envId = EnvironmentId.make("env-test");
const projectId = ProjectId.make("project-1");

function makeThreadSummary(
  overrides: Partial<SidebarThreadSummary> & Pick<SidebarThreadSummary, "id">,
): SidebarThreadSummary {
  return {
    environmentId: envId,
    projectId,
    title: "Test thread",
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    archivedAt: null,
    updatedAt: "2026-06-01T00:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  };
}

function makeEmptyAppState(): AppState {
  return {
    activeEnvironmentId: envId,
    environmentStateById: {},
  };
}

function makeAppStateWithThreads(threads: SidebarThreadSummary[]): AppState {
  const sidebarThreadSummaryById: Record<ThreadId, SidebarThreadSummary> = {};
  const threadIds: ThreadId[] = [];
  for (const thread of threads) {
    sidebarThreadSummaryById[thread.id] = thread;
    threadIds.push(thread.id);
  }
  const envState: EnvironmentState = {
    projectIds: [projectId],
    projectById: {
      [projectId]: {
        id: projectId,
        environmentId: envId,
        name: "Test Project",
        cwd: "/tmp/test",
        defaultModelSelection: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        scripts: [],
      },
    },
    threadIds,
    threadIdsByProjectId: { [projectId]: threadIds },
    threadShellById: {},
    threadSessionById: {},
    threadTurnStateById: {},
    messageIdsByThreadId: {},
    messageByThreadId: {},
    activityIdsByThreadId: {},
    activityByThreadId: {},
    proposedPlanIdsByThreadId: {},
    proposedPlanByThreadId: {},
    turnDiffIdsByThreadId: {},
    turnDiffSummaryByThreadId: {},
    sidebarThreadSummaryById,
    bootstrapComplete: true,
  };
  return {
    activeEnvironmentId: envId,
    environmentStateById: { [envId]: envState },
  };
}

function makeCompletedTurn(): OrchestrationLatestTurn {
  return {
    turnId: "turn-1" as TurnId,
    state: "completed",
    requestedAt: "2026-06-01T00:00:00.000Z",
    startedAt: "2026-06-01T00:00:00.000Z",
    completedAt: "2026-06-01T00:01:00.000Z",
    assistantMessageId: null,
    sourceProposedPlan: undefined,
  };
}

function makeRunningTurn(): OrchestrationLatestTurn {
  return {
    turnId: "turn-1" as TurnId,
    state: "running",
    requestedAt: "2026-06-01T00:00:00.000Z",
    startedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    assistantMessageId: null,
    sourceProposedPlan: undefined,
  };
}

function makeErrorTurn(): OrchestrationLatestTurn {
  return {
    turnId: "turn-1" as TurnId,
    state: "error",
    requestedAt: "2026-06-01T00:00:00.000Z",
    startedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    assistantMessageId: null,
    sourceProposedPlan: undefined,
  };
}

function makeReviewState(
  threadId: ThreadId,
  overrides: Partial<MissionReviewState> = {},
): MissionReviewState {
  return {
    threadId,
    status: "reviewed",
    reviewedAt: "2026-06-01T02:00:00.000Z",
    updatedAt: "2026-06-01T02:00:00.000Z",
    ...overrides,
  };
}

// ── getMissionColumnForThread ──────────────────────────────────────────

describe("getMissionColumnForThread", () => {
  it("maps failed turn to failed column", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId, latestTurn: makeErrorTurn() });
    expect(getMissionColumnForThread(thread)).toBe("failed");
  });

  it("maps needs_human to needs_human column (takes priority over completed)", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
      hasPendingApprovals: true,
    });
    expect(getMissionColumnForThread(thread)).toBe("needs_human");
  });

  it("maps running turn to running column", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId, latestTurn: makeRunningTurn() });
    expect(getMissionColumnForThread(thread)).toBe("running");
  });

  it("maps completed unreviewed turn to needs_review", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId, latestTurn: makeCompletedTurn() });
    expect(getMissionColumnForThread(thread)).toBe("needs_review");
  });

  it("maps completed reviewed turn to done", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId, latestTurn: makeCompletedTurn() });
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, { status: "reviewed" }),
    };
    expect(getMissionColumnForThread(thread, reviewStates)).toBe("done");
  });

  it("maps completed unreviewed (explicitly) turn to needs_review", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId, latestTurn: makeCompletedTurn() });
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, { status: "unreviewed" }),
    };
    expect(getMissionColumnForThread(thread, reviewStates)).toBe("needs_review");
  });

  it("maps completed with new activity after review to needs_review", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
      updatedAt: "2026-06-01T03:00:00.000Z",
    });
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, {
        status: "reviewed",
        reviewedAt: "2026-06-01T02:00:00.000Z",
      }),
    };
    expect(getMissionColumnForThread(thread, reviewStates)).toBe("needs_review");
  });

  it("needs_human takes priority over needs_review", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
      hasPendingUserInput: true,
    });
    expect(getMissionColumnForThread(thread)).toBe("needs_human");
  });

  it("failed takes priority over needs_review", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
      session: {
        provider: ProviderDriverKind.make("codex"),
        status: "error",
        orchestrationStatus: "error",
        lastError: "Something broke",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    });
    expect(getMissionColumnForThread(thread)).toBe("failed");
  });

  it("maps no turn to backlog", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    expect(getMissionColumnForThread(thread)).toBe("backlog");
  });
});

// ── getMissionNeedsReviewReason ──────────────────────────────────────

describe("getMissionNeedsReviewReason", () => {
  it("returns reason for unreviewed mission", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    expect(getMissionNeedsReviewReason(thread, undefined)).toBe(
      "Agent finished this mission. Check the changes before marking it done.",
    );
  });

  it("returns reason for unreviewed status", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    const reviewState = makeReviewState(thread.id, { status: "unreviewed" });
    expect(getMissionNeedsReviewReason(thread, reviewState)).toBe(
      "Agent finished this mission. Check the changes before marking it done.",
    );
  });

  it("returns reason for new activity after review", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T03:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(getMissionNeedsReviewReason(thread, reviewState)).toBe(
      "New activity after review. Check the latest changes.",
    );
  });

  it("returns undefined for reviewed with no new activity", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T01:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(getMissionNeedsReviewReason(thread, reviewState)).toBeUndefined();
  });
});

// ── getMissionIsEffectivelyUnreviewed ─────────────────────────────────

describe("getMissionIsEffectivelyUnreviewed", () => {
  it("returns true when no review state exists", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    expect(getMissionIsEffectivelyUnreviewed(thread, undefined)).toBe(true);
  });

  it("returns true for unreviewed status", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    const reviewState = makeReviewState(thread.id, { status: "unreviewed" });
    expect(getMissionIsEffectivelyUnreviewed(thread, reviewState)).toBe(true);
  });

  it("returns false for reviewed with no new activity", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T01:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(getMissionIsEffectivelyUnreviewed(thread, reviewState)).toBe(false);
  });

  it("returns true for reviewed with new activity after review date", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T03:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(getMissionIsEffectivelyUnreviewed(thread, reviewState)).toBe(true);
  });

  it("returns false for dismissed status", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    const reviewState = makeReviewState(thread.id, { status: "dismissed" });
    expect(getMissionIsEffectivelyUnreviewed(thread, reviewState)).toBe(false);
  });
});

// ── hasMissionChangedSinceReview ──────────────────────────────────────

describe("hasMissionChangedSinceReview", () => {
  it("returns false when no review state", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    expect(hasMissionChangedSinceReview(thread, undefined)).toBe(false);
  });

  it("returns false when review state is not reviewed", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    const reviewState = makeReviewState(thread.id, { status: "unreviewed" });
    expect(hasMissionChangedSinceReview(thread, reviewState)).toBe(false);
  });

  it("returns false when updatedAt is before reviewedAt", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T01:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(hasMissionChangedSinceReview(thread, reviewState)).toBe(false);
  });

  it("returns true when updatedAt is after reviewedAt", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      updatedAt: "2026-06-01T03:00:00.000Z",
    });
    const reviewState = makeReviewState(thread.id, {
      status: "reviewed",
      reviewedAt: "2026-06-01T02:00:00.000Z",
    });
    expect(hasMissionChangedSinceReview(thread, reviewState)).toBe(true);
  });
});

// ── selectMissionBoardColumns ─────────────────────────────────────────

describe("selectMissionBoardColumns", () => {
  it("assigns completed unreviewed to needs_review column", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards).toHaveLength(1);
    expect(needsReviewCol.cards[0]!.threadId).toBe(thread.id);
  });

  it("assigns completed reviewed to done column", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, { status: "reviewed" }),
    };
    const columns = selectMissionBoardColumns(state, reviewStates);
    const doneCol = columns.find((c) => c.id === "done")!;
    expect(doneCol.cards).toHaveLength(1);
    expect(doneCol.cards[0]!.threadId).toBe(thread.id);
  });

  it("assigns failed missions to failed column (not needs_review)", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeErrorTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const failedCol = columns.find((c) => c.id === "failed")!;
    expect(failedCol.cards).toHaveLength(1);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards).toHaveLength(0);
  });

  it("assigns needs_human to needs_human column (not needs_review)", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
      hasPendingApprovals: true,
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsHumanCol = columns.find((c) => c.id === "needs_human")!;
    expect(needsHumanCol.cards).toHaveLength(1);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards).toHaveLength(0);
  });

  it("assigns running to running column", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeRunningTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const runningCol = columns.find((c) => c.id === "running")!;
    expect(runningCol.cards).toHaveLength(1);
  });

  it("assigns backlog to backlog column", () => {
    const thread = makeThreadSummary({ id: "t1" as ThreadId });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const backlogCol = columns.find((c) => c.id === "backlog")!;
    expect(backlogCol.cards).toHaveLength(1);
  });
});

// ── selectMissionBoardSummary ─────────────────────────────────────────

describe("selectMissionBoardSummary", () => {
  it("counts needs_review missions", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const summary = selectMissionBoardSummary(state);
    expect(summary.needsReview).toBe(1);
    expect(summary.total).toBe(1);
  });

  it("counts done missions after review", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, { status: "reviewed" }),
    };
    const summary = selectMissionBoardSummary(state, reviewStates);
    expect(summary.done).toBe(1);
    expect(summary.needsReview).toBe(0);
  });

  it("counts all columns correctly", () => {
    const t1 = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const t2 = makeThreadSummary({
      id: "t2" as ThreadId,
      latestTurn: makeRunningTurn(),
    });
    const t3 = makeThreadSummary({
      id: "t3" as ThreadId,
      latestTurn: makeCompletedTurn(),
      hasPendingApprovals: true,
    });
    const t4 = makeThreadSummary({
      id: "t4" as ThreadId,
      latestTurn: makeErrorTurn(),
    });
    const t5 = makeThreadSummary({ id: "t5" as ThreadId });
    const state = makeAppStateWithThreads([t1, t2, t3, t4, t5]);
    const summary = selectMissionBoardSummary(state);
    expect(summary.total).toBe(5);
    expect(summary.needsReview).toBe(1);
    expect(summary.running).toBe(1);
    expect(summary.needsHuman).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.backlog).toBe(1);
    expect(summary.done).toBe(0);
  });
});

// ── Card metadata ─────────────────────────────────────────────────────

describe("card metadata for needs_review", () => {
  it("sets needsReview to true for needs_review cards", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards[0]!.needsReview).toBe(true);
  });

  it("sets statusLabel to 'Needs review' for needs_review cards", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards[0]!.statusLabel).toBe("Needs review");
  });

  it("sets needsReviewReason for needs_review cards", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards[0]!.needsReviewReason).toBe(
      "Agent finished this mission. Check the changes before marking it done.",
    );
  });

  it("provides mark_reviewed action for needs_review cards", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const columns = selectMissionBoardColumns(state);
    const needsReviewCol = columns.find((c) => c.id === "needs_review")!;
    expect(needsReviewCol.cards[0]!.availableActions).toContain("mark_reviewed");
  });

  it("provides mark_unreviewed and archive for done cards", () => {
    const thread = makeThreadSummary({
      id: "t1" as ThreadId,
      latestTurn: makeCompletedTurn(),
    });
    const state = makeAppStateWithThreads([thread]);
    const reviewStates: Record<string, MissionReviewState> = {
      [thread.id]: makeReviewState(thread.id, { status: "reviewed" }),
    };
    const columns = selectMissionBoardColumns(state, reviewStates);
    const doneCol = columns.find((c) => c.id === "done")!;
    const actions = doneCol.cards[0]!.availableActions;
    expect(actions).toContain("mark_unreviewed");
    expect(actions).toContain("archive");
  });
});

// ── isMissionSystemControlled ──────────────────────────────────────────

describe("isMissionSystemControlled", () => {
  it("returns true for running", () => {
    expect(isMissionSystemControlled("running")).toBe(true);
  });

  it("returns true for needs_human", () => {
    expect(isMissionSystemControlled("needs_human")).toBe(true);
  });

  it("returns true for needs_review", () => {
    expect(isMissionSystemControlled("needs_review")).toBe(true);
  });

  it("returns true for failed", () => {
    expect(isMissionSystemControlled("failed")).toBe(true);
  });

  it("returns false for backlog", () => {
    expect(isMissionSystemControlled("backlog")).toBe(false);
  });

  it("returns false for done", () => {
    expect(isMissionSystemControlled("done")).toBe(false);
  });
});

// ── isMissionManualColumn ─────────────────────────────────────────────

describe("isMissionManualColumn", () => {
  it("returns true for backlog", () => {
    expect(isMissionManualColumn("backlog")).toBe(true);
  });

  it("returns true for done", () => {
    expect(isMissionManualColumn("done")).toBe(true);
  });

  it("returns false for running", () => {
    expect(isMissionManualColumn("running")).toBe(false);
  });

  it("returns false for needs_human", () => {
    expect(isMissionManualColumn("needs_human")).toBe(false);
  });

  it("returns false for needs_review", () => {
    expect(isMissionManualColumn("needs_review")).toBe(false);
  });

  it("returns false for failed", () => {
    expect(isMissionManualColumn("failed")).toBe(false);
  });
});

// ── getMissionMoveResult ──────────────────────────────────────────────

describe("getMissionMoveResult", () => {
  function makeCard(columnId: MissionBoardColumnId): MissionBoardCard {
    return {
      id: "env:t1",
      threadId: "t1" as ThreadId,
      environmentId: envId,
      projectId,
      title: "Test",
      columnId,
      statusLabel: "Test",
      lastActivityAt: "2026-06-01T00:00:00.000Z",
      isActive: false,
      needsReview: false,
      availableActions: ["open"],
    };
  }

  it("allows reorder within same column", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "backlog",
    });
    expect(result.allowed).toBe(true);
  });

  it("allows backlog to done", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "done",
    });
    expect(result.allowed).toBe(true);
  });

  it("allows done to backlog", () => {
    const result = getMissionMoveResult({
      card: makeCard("done"),
      fromColumnId: "done",
      toColumnId: "backlog",
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks running to done", () => {
    const result = getMissionMoveResult({
      card: makeCard("running"),
      fromColumnId: "running",
      toColumnId: "done",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("running");
  });

  it("blocks needs_human to done", () => {
    const result = getMissionMoveResult({
      card: makeCard("needs_human"),
      fromColumnId: "needs_human",
      toColumnId: "done",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("needs your input");
  });

  it("blocks needs_review to done", () => {
    const result = getMissionMoveResult({
      card: makeCard("needs_review"),
      fromColumnId: "needs_review",
      toColumnId: "done",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Review this mission");
  });

  it("blocks failed to running", () => {
    const result = getMissionMoveResult({
      card: makeCard("failed"),
      fromColumnId: "failed",
      toColumnId: "running",
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("failed");
  });

  it("blocks backlog to running", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "running",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks backlog to needs_human", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "needs_human",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks backlog to needs_review", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "needs_review",
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks backlog to failed", () => {
    const result = getMissionMoveResult({
      card: makeCard("backlog"),
      fromColumnId: "backlog",
      toColumnId: "failed",
    });
    expect(result.allowed).toBe(false);
  });
});

// ── getMissionEffectiveColumn ──────────────────────────────────────────

describe("getMissionEffectiveColumn", () => {
  it("returns running for system running state", () => {
    const result = getMissionEffectiveColumn("running", {
      threadId: "t1" as ThreadId,
      manualColumnId: "done",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result).toBe("running");
  });

  it("returns needs_human for system needs_human state", () => {
    const result = getMissionEffectiveColumn("needs_human");
    expect(result).toBe("needs_human");
  });

  it("returns needs_review for system needs_review state", () => {
    const result = getMissionEffectiveColumn("needs_review");
    expect(result).toBe("needs_review");
  });

  it("returns failed for system failed state", () => {
    const result = getMissionEffectiveColumn("failed");
    expect(result).toBe("failed");
  });

  it("returns backlog for system backlog with no manual state", () => {
    const result = getMissionEffectiveColumn("backlog");
    expect(result).toBe("backlog");
  });

  it("returns done for system done with no manual state", () => {
    const result = getMissionEffectiveColumn("done");
    expect(result).toBe("done");
  });

  it("applies manual override for backlog when manual says done", () => {
    const result = getMissionEffectiveColumn("backlog", {
      threadId: "t1" as ThreadId,
      manualColumnId: "done",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result).toBe("done");
  });

  it("applies manual override for done when manual says backlog", () => {
    const result = getMissionEffectiveColumn("done", {
      threadId: "t1" as ThreadId,
      manualColumnId: "backlog",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result).toBe("backlog");
  });

  it("ignores manual override for running", () => {
    const result = getMissionEffectiveColumn("running", {
      threadId: "t1" as ThreadId,
      manualColumnId: "backlog",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result).toBe("running");
  });

  it("ignores manual override for needs_review", () => {
    const result = getMissionEffectiveColumn("needs_review", {
      threadId: "t1" as ThreadId,
      manualColumnId: "done",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result).toBe("needs_review");
  });
});

// ── sortMissionCardsForColumn ──────────────────────────────────────────

describe("sortMissionCardsForColumn", () => {
  function makeCard(id: string, threadId: ThreadId, lastActivityAt: string): MissionBoardCard {
    return {
      id,
      threadId,
      environmentId: envId,
      projectId,
      title: `Card ${threadId}`,
      columnId: "backlog",
      statusLabel: "Draft",
      lastActivityAt,
      isActive: false,
      needsReview: false,
      availableActions: ["open"],
    };
  }

  it("sorts by lastActivityAt when no manual order exists", () => {
    const cards = [
      makeCard("c1", "t1" as ThreadId, "2026-06-02T00:00:00.000Z"),
      makeCard("c2", "t2" as ThreadId, "2026-06-01T00:00:00.000Z"),
      makeCard("c3", "t3" as ThreadId, "2026-06-03T00:00:00.000Z"),
    ];
    const sorted = sortMissionCardsForColumn(cards, {}, "backlog");
    expect(sorted[0]!.id).toBe("c3");
    expect(sorted[1]!.id).toBe("c1");
    expect(sorted[2]!.id).toBe("c2");
  });

  it("applies manual sort order for cards that have it", () => {
    const cards = [
      makeCard("c1", "t1" as ThreadId, "2026-06-01T00:00:00.000Z"),
      makeCard("c2", "t2" as ThreadId, "2026-06-02T00:00:00.000Z"),
      makeCard("c3", "t3" as ThreadId, "2026-06-03T00:00:00.000Z"),
    ];
    const manualStates: Record<string, MissionBoardManualState> = {
      t3: { threadId: "t3" as ThreadId, sortOrder: 0, updatedAt: "2026-06-04T00:00:00.000Z" },
      t1: { threadId: "t1" as ThreadId, sortOrder: 1, updatedAt: "2026-06-04T00:00:00.000Z" },
    };
    const sorted = sortMissionCardsForColumn(cards, manualStates, "backlog");
    expect(sorted[0]!.id).toBe("c3");
    expect(sorted[1]!.id).toBe("c1");
    expect(sorted[2]!.id).toBe("c2");
  });

  it("places cards with manual order above those without", () => {
    const cards = [
      makeCard("c1", "t1" as ThreadId, "2026-06-01T00:00:00.000Z"),
      makeCard("c2", "t2" as ThreadId, "2026-06-02T00:00:00.000Z"),
    ];
    const manualStates: Record<string, MissionBoardManualState> = {
      t2: { threadId: "t2" as ThreadId, sortOrder: 0, updatedAt: "2026-06-04T00:00:00.000Z" },
    };
    const sorted = sortMissionCardsForColumn(cards, manualStates, "backlog");
    expect(sorted[0]!.id).toBe("c2");
    expect(sorted[1]!.id).toBe("c1");
  });
});
