import { describe, expect, it } from "vite-plus/test";
import {
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";

import { selectIdeAgentContext } from "./ide-agent-context";
import type { AppState, EnvironmentState } from "../../store";
import type { Project, SidebarThreadSummary, ThreadShell } from "../../types";

const environmentId = EnvironmentId.make("env-local");
const projectId = ProjectId.make("project-1");
const otherProjectId = ProjectId.make("project-2");
const providerInstanceId = ProviderInstanceId.make("codex");

const baseProject: Project = {
  id: projectId,
  environmentId,
  title: "t3code",
  workspaceRoot: "/repo/t3code",
  defaultModelSelection: null,
  scripts: [],
  createdAt: "2026-06-18T10:00:00.000Z",
  updatedAt: "2026-06-18T10:00:00.000Z",
};

const baseThread = (id: string, overrides: Partial<SidebarThreadSummary> = {}) =>
  ({
    id: ThreadId.make(id),
    environmentId,
    projectId,
    title: id,
    modelSelection: { instanceId: providerInstanceId, model: "gpt-5" },
    runtimeMode: "full-access" as const,
    interactionMode: "default" as const,
    session: null,
    createdAt: "2026-06-18T10:00:00.000Z",
    archivedAt: null,
    updatedAt: "2026-06-18T10:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    latestUserMessageAt: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    ...overrides,
  }) satisfies SidebarThreadSummary;

const threadShell = (thread: SidebarThreadSummary): ThreadShell => ({
  ...thread,
  modelSelection: { instanceId: providerInstanceId, model: "gpt-5" },
});

function appState(input: {
  readonly projects?: readonly Project[];
  readonly threads?: readonly SidebarThreadSummary[];
}): AppState {
  const projects = input.projects ?? [baseProject];
  const threads = input.threads ?? [];
  const environmentState: EnvironmentState = {
    projectIds: projects.map((project) => project.id),
    projectById: Object.fromEntries(projects.map((project) => [project.id, project])),
    threadIdsByProjectId: threads.reduce<Record<ProjectId, ThreadId[]>>((acc, thread) => {
      acc[thread.projectId] = [...(acc[thread.projectId] ?? []), thread.id];
      return acc;
    }, {}),
    threadShellById: Object.fromEntries(threads.map((thread) => [thread.id, threadShell(thread)])),
    sidebarThreadSummaryById: Object.fromEntries(threads.map((thread) => [thread.id, thread])),
    bootstrapComplete: true,
  };
  return {
    activeEnvironmentId: environmentId,
    environments: {
      [environmentId]: environmentState,
    },
  };
}

describe("selectIdeAgentContext", () => {
  it("matches the scoped workspace root before selecting a thread", () => {
    const otherProject: Project = {
      ...baseProject,
      id: otherProjectId,
      title: "other",
      workspaceRoot: "/repo/other",
    };
    const selected = baseThread("selected", {
      title: "Selected workspace thread",
      projectId: otherProjectId,
      session: {
        threadId: ThreadId.make("selected"),
        providerInstanceId,
        providerName: "codex",
        status: "running",
        runtimeMode: "full-access",
        activeTurnId: null,
        lastError: null,
        updatedAt: "2026-06-18T10:00:00.000Z",
      },
    });

    const context = selectIdeAgentContext({
      state: appState({
        projects: [baseProject, otherProject],
        threads: [baseThread("wrong-project"), selected],
      }),
      environmentId,
      workspaceRoot: "/repo/other",
    });

    expect(context?.threadId).toBe(selected.id);
    expect(context?.projectTitle).toBe("other");
  });

  it("prioritizes waiting approval over more recent completed work", () => {
    const completed = baseThread("completed", {
      updatedAt: "2026-06-18T11:00:00.000Z",
      latestTurn: {
        turnId: "turn-complete" as never,
        state: "completed",
        requestedAt: "2026-06-18T10:58:00.000Z",
        startedAt: "2026-06-18T10:59:00.000Z",
        completedAt: "2026-06-18T11:00:00.000Z",
        assistantMessageId: null,
        sourceProposedPlan: undefined,
      },
    });
    const approval = baseThread("approval", {
      updatedAt: "2026-06-18T10:30:00.000Z",
      hasPendingApprovals: true,
    });

    const context = selectIdeAgentContext({
      state: appState({ threads: [completed, approval] }),
      environmentId,
      workspaceRoot: "/repo/t3code",
    });

    expect(context).toMatchObject({
      threadId: approval.id,
      phase: "waiting_for_approval",
      headline: "Approval needed",
    });
  });

  it("falls back to the only project when no workspace root is scoped", () => {
    const thread = baseThread("only-thread");
    const context = selectIdeAgentContext({
      state: appState({ threads: [thread] }),
      environmentId,
      workspaceRoot: null,
    });

    expect(context?.threadId).toBe(thread.id);
    expect(context?.workspaceRoot).toBe("/repo/t3code");
  });
});
