import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId, ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";

import type { AppState, EnvironmentState } from "./store";
import { createThreadSelectorAcrossEnvironments } from "./storeSelectors";
import type { SidebarThreadSummary } from "./types";

const providerInstanceId = ProviderInstanceId.make("codex");
const environmentId = EnvironmentId.make("env-local");
const projectId = ProjectId.make("project-1");
const threadId = ThreadId.make("thread-1");

const threadShell: SidebarThreadSummary = {
  id: threadId,
  environmentId,
  projectId,
  title: "Thread 1",
  modelSelection: { instanceId: providerInstanceId, model: "gpt-5" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  latestTurn: null,
  createdAt: "2026-06-25T10:00:00.000Z",
  updatedAt: "2026-06-25T10:00:00.000Z",
  archivedAt: null,
  session: null,
  latestUserMessageAt: null,
  hasPendingApprovals: false,
  hasPendingUserInput: false,
  hasActionableProposedPlan: false,
};

function environmentState(threads: readonly SidebarThreadSummary[]): EnvironmentState {
  return {
    projectIds: [projectId],
    projectById: {},
    threadIdsByProjectId: {
      [projectId]: threads.map((thread) => thread.id),
    },
    sidebarThreadSummaryById: Object.fromEntries(threads.map((thread) => [thread.id, thread])),
    threadShellById: Object.fromEntries(threads.map((thread) => [thread.id, thread])),
    bootstrapComplete: true,
  };
}

describe("createThreadSelectorAcrossEnvironments", () => {
  it("returns the matching thread shell across environments", () => {
    const state: AppState = {
      activeEnvironmentId: environmentId,
      environments: {
        [environmentId]: environmentState([threadShell]),
      },
    };

    expect(createThreadSelectorAcrossEnvironments(threadId)(state)).toBe(threadShell);
  });

  it("returns null for missing or empty thread ids", () => {
    const state: AppState = {
      activeEnvironmentId: environmentId,
      environments: {
        [environmentId]: environmentState([threadShell]),
      },
    };

    expect(createThreadSelectorAcrossEnvironments(null)(state)).toBeNull();
    expect(createThreadSelectorAcrossEnvironments(ThreadId.make("missing"))(state)).toBeNull();
  });
});
