import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";

import { type AppState, selectEnvironmentState } from "../../store";
import type { Project, SidebarThreadSummary, ThreadShell } from "../../types";

export type IdeAgentPhase =
  | "starting"
  | "running"
  | "waiting_for_approval"
  | "waiting_for_input"
  | "completed"
  | "failed"
  | "idle";

export interface IdeAgentContext {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly projectTitle: string;
  readonly workspaceRoot: string;
  readonly threadId: ThreadId;
  readonly threadTitle: string;
  readonly modelTitle: string;
  readonly phase: IdeAgentPhase;
  readonly headline: string;
  readonly detail?: string | undefined;
  readonly updatedAt: string;
}

export function selectIdeAgentContext(input: {
  readonly state: AppState;
  readonly environmentId: EnvironmentId | null;
  readonly workspaceRoot: string | null;
}): IdeAgentContext | null {
  if (!input.environmentId) {
    return null;
  }

  const environmentState = selectEnvironmentState(input.state, input.environmentId);
  const project = selectIdeProject(environmentState.projectById, input.workspaceRoot);
  if (!project) {
    return null;
  }

  const threadIds = environmentState.threadIdsByProjectId[project.id] ?? [];
  const threadMatch = threadIds
    .flatMap((threadId) => {
      const summary = environmentState.sidebarThreadSummaryById[threadId];
      const shell = environmentState.threadShellById[threadId];
      return summary && shell && summary.archivedAt === null ? [{ summary, shell }] : [];
    })
    .toSorted(compareIdeThreads)[0];

  if (!threadMatch) {
    return null;
  }

  const { summary, shell } = threadMatch;
  const phase = resolveIdeAgentPhase(summary);
  return {
    environmentId: input.environmentId,
    projectId: project.id,
    projectTitle: project.title,
    workspaceRoot: project.workspaceRoot,
    threadId: summary.id,
    threadTitle: summary.title,
    modelTitle: shell.modelSelection.model,
    phase,
    headline: headlineForPhase(phase),
    detail: detailForPhase(phase, summary, shell),
    updatedAt: summary.updatedAt ?? summary.createdAt,
  };
}

function selectIdeProject(
  projectById: Readonly<Record<ProjectId, Project>>,
  workspaceRoot: string | null,
): Project | null {
  const projects = Object.values(projectById);
  if (workspaceRoot) {
    return projects.find((project) => project.workspaceRoot === workspaceRoot) ?? null;
  }
  return projects.length === 1 ? (projects[0] ?? null) : null;
}

function compareIdeThreads(
  left: { readonly summary: SidebarThreadSummary },
  right: { readonly summary: SidebarThreadSummary },
): number {
  const rankDelta = rankIdeThread(right.summary) - rankIdeThread(left.summary);
  if (rankDelta !== 0) {
    return rankDelta;
  }
  return (
    timestampMs(right.summary.updatedAt ?? right.summary.createdAt) -
    timestampMs(left.summary.updatedAt ?? left.summary.createdAt)
  );
}

function rankIdeThread(thread: SidebarThreadSummary): number {
  if (thread.hasPendingApprovals) return 100;
  if (thread.hasPendingUserInput) return 95;
  if (thread.session?.status === "error" || thread.latestTurn?.state === "error") {
    return 90;
  }
  if (thread.session?.status === "starting") return 80;
  if (thread.session?.status === "running" || thread.latestTurn?.state === "running") {
    return 75;
  }
  if (thread.latestTurn?.state === "completed") return 40;
  if (thread.session?.status === "ready") return 20;
  return 10;
}

function timestampMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function resolveIdeAgentPhase(thread: SidebarThreadSummary): IdeAgentPhase {
  if (thread.hasPendingApprovals) return "waiting_for_approval";
  if (thread.hasPendingUserInput) return "waiting_for_input";
  if (thread.session?.status === "error" || thread.latestTurn?.state === "error") {
    return "failed";
  }
  if (thread.session?.status === "starting") return "starting";
  if (thread.session?.status === "running" || thread.latestTurn?.state === "running") {
    return "running";
  }
  if (thread.latestTurn?.state === "completed") return "completed";
  return "idle";
}

function headlineForPhase(phase: IdeAgentPhase): string {
  switch (phase) {
    case "starting":
      return "Starting agent";
    case "running":
      return "Agent is working";
    case "waiting_for_approval":
      return "Approval needed";
    case "waiting_for_input":
      return "Waiting for input";
    case "completed":
      return "Agent finished";
    case "failed":
      return "Agent failed";
    case "idle":
      return "No active mission";
  }
}

function detailForPhase(
  phase: IdeAgentPhase,
  thread: SidebarThreadSummary,
  shell: ThreadShell,
): string | undefined {
  if (phase === "failed") {
    return thread.session?.lastError ?? "The last turn failed.";
  }
  if (phase === "completed") {
    return "Review the completed task.";
  }
  if ((phase === "running" || phase === "starting") && thread.session?.providerName) {
    return `${thread.session.providerName} on ${shell.modelSelection.model}`;
  }
  if (phase === "waiting_for_approval") {
    return "Review the pending approval in the thread.";
  }
  if (phase === "waiting_for_input") {
    return "Answer the pending agent question in the thread.";
  }
  return undefined;
}
