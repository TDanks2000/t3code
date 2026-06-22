import { describe, expect, it } from "vite-plus/test";
import { EnvironmentId } from "@t3tools/contracts";

import {
  isWorkspaceTerminalThreadId,
  workspaceTerminalThreadId,
  workspaceTerminalThreadRef,
} from "./workspaceTerminal.ts";

describe("workspace terminal identity", () => {
  it("derives a stable synthetic thread id from the workspace root", () => {
    expect(workspaceTerminalThreadId("/repo/app")).toBe(workspaceTerminalThreadId("/repo/app"));
    expect(workspaceTerminalThreadId("/repo/app")).not.toBe(workspaceTerminalThreadId("/repo/api"));
    expect(isWorkspaceTerminalThreadId(workspaceTerminalThreadId("/repo/app"))).toBe(true);
  });

  it("keeps the environment as part of the scoped terminal owner", () => {
    expect(
      workspaceTerminalThreadRef({
        environmentId: EnvironmentId.make("env-local"),
        workspaceRoot: "/repo/app",
      }),
    ).toEqual({
      environmentId: EnvironmentId.make("env-local"),
      threadId: workspaceTerminalThreadId("/repo/app"),
    });
  });
});
