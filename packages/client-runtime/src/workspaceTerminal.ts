import { ThreadId, type EnvironmentId, type ScopedThreadRef } from "@t3tools/contracts";

const WORKSPACE_TERMINAL_THREAD_PREFIX = "workspace-terminal:";

export function workspaceTerminalThreadId(workspaceRoot: string): ThreadId {
  return ThreadId.make(`${WORKSPACE_TERMINAL_THREAD_PREFIX}${workspaceRoot}`);
}

export function workspaceTerminalThreadRef(input: {
  readonly environmentId: EnvironmentId;
  readonly workspaceRoot: string;
}): ScopedThreadRef {
  return {
    environmentId: input.environmentId,
    threadId: workspaceTerminalThreadId(input.workspaceRoot),
  };
}

export function isWorkspaceTerminalThreadId(threadId: string): boolean {
  return threadId.startsWith(WORKSPACE_TERMINAL_THREAD_PREFIX);
}
