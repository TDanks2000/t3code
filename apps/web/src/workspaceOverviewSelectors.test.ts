import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";

import type { AppState, EnvironmentState } from "./store";
import type { SidebarThreadSummary } from "./types";
import {
  selectActiveWorkThreads,
  selectAttentionItems,
  selectHasThreads,
  selectOverviewStats,
  selectRecentThreads,
} from "./workspaceOverviewSelectors";

const providerInstanceId = ProviderInstanceId.make("codex");
const environmentId = EnvironmentId.make("env-local");
const projectId = ProjectId.make("project-1");

function thread(id: string, overrides: Partial<SidebarThreadSummary> = {}): SidebarThreadSummary {
  return {
    id: ThreadId.make(id),
    environmentId,
    projectId,
    title: id,
    modelSelection: { instanceId: providerInstanceId, model: "gpt-5" },
    runtimeMode: "full-access",
    interactionMode: "default",
    branch: null,
    worktreePath: null,
    latestTurn: null,
    createdAt: "2026-06-24T10:00:00.000Z",
    updatedAt: "2026-06-24T10:00:00.000Z",
    archivedAt: null,
    session: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  };
}

function appState(threads: readonly SidebarThreadSummary[]): AppState {
  const environmentState: EnvironmentState = {
    projectIds: [projectId],
    projectById: {},
    threadIdsByProjectId: {
      [projectId]: threads.map((item) => item.id),
    },
    sidebarThreadSummaryById: Object.fromEntries(threads.map((item) => [item.id, item])),
    threadShellById: Object.fromEntries(threads.map((item) => [item.id, item])),
    bootstrapComplete: true,
  };
  return {
    activeEnvironmentId: environmentId,
    environments: {
      [environmentId]: environmentState,
    },
  };
}

describe("workspace overview selectors", () => {
  it("derives overview groups from the cached cross-environment thread list", () => {
    const running = thread("running", {
      updatedAt: "2026-06-25T11:00:00.000Z",
      session: {
        threadId: ThreadId.make("running"),
        providerInstanceId,
        providerName: "codex",
        status: "running",
        runtimeMode: "full-access",
        activeTurnId: null,
        lastError: null,
        updatedAt: "2026-06-25T11:00:00.000Z",
      },
    });
    const needsApproval = thread("approval", {
      updatedAt: "2026-06-25T12:00:00.000Z",
      hasPendingApprovals: true,
    });
    const older = thread("older", {
      updatedAt: "2026-06-23T09:00:00.000Z",
    });
    const state = appState([older, running, needsApproval]);

    expect(selectHasThreads(state)).toBe(true);
    expect(selectOverviewStats(state)).toMatchObject({
      totalThreads: 3,
      activeRuns: 1,
      waitingApproval: 1,
      mostUsedProvider: "codex",
    });
    expect(selectAttentionItems(state)).toEqual([
      { thread: needsApproval, reason: "pending-approval" },
    ]);
    expect(selectActiveWorkThreads(state)).toEqual([running]);
    expect(selectRecentThreads(state, 2)).toEqual([needsApproval, running]);
  });
});
