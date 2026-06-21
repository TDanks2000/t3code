// @effect-diagnostics nodeBuiltinImport:off - tests create temporary package.json fixtures.
import * as Fs from "node:fs/promises";
import * as Os from "node:os";
import * as Path from "node:path";
import { afterEach, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/unstable/process";
import { vi } from "vite-plus/test";

import { ProcessRunner, type ProcessRunnerShape } from "../../processRunner.ts";
import { makeDiagnosticsService, resolveDiagnosticCommandConfig } from "./DiagnosticsService.ts";

const runMock = vi.fn<ProcessRunnerShape["run"]>();

const ProcessRunnerTest = Layer.succeed(
  ProcessRunner,
  ProcessRunner.of({
    run: (input) => runMock(input),
  }),
);

const successfulRun = {
  stdout: "",
  stderr: "",
  code: ChildProcessSpawner.ExitCode(0),
  timedOut: false,
  stdoutTruncated: false,
  stderrTruncated: false,
};

afterEach(() => {
  runMock.mockReset();
});

async function makePackageJsonWorkspace(packageJson: unknown): Promise<string> {
  const workspace = await Fs.mkdtemp(Path.join(Os.tmpdir(), "t3-diagnostics-"));
  await Fs.writeFile(Path.join(workspace, "package.json"), JSON.stringify(packageJson), "utf8");
  return workspace;
}

describe("DiagnosticsService", () => {
  it.effect("runs the package typecheck script", () =>
    Effect.gen(function* () {
      runMock.mockReturnValueOnce(Effect.succeed(successfulRun));
      const workspace = yield* Effect.promise(() =>
        makePackageJsonWorkspace({
          packageManager: "pnpm@10.24.0",
          scripts: { typecheck: "tsgo --noEmit" },
        }),
      );

      const service = yield* makeDiagnosticsService();
      const result = yield* service.run({ kind: "typecheck" }, workspace);

      expect(result.status).toBe("passed");
      expect(result.commandLabel).toBe("pnpm run typecheck");
      expect(runMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "pnpm",
          args: ["run", "typecheck"],
          cwd: workspace,
        }),
      );
    }).pipe(Effect.provide(ProcessRunnerTest)),
  );

  it.effect("prefers check over lint for project checks", () =>
    Effect.gen(function* () {
      runMock.mockReturnValueOnce(Effect.succeed(successfulRun));
      const workspace = yield* Effect.promise(() =>
        makePackageJsonWorkspace({
          packageManager: "bun@1.2.0",
          scripts: { check: "biome check", lint: "eslint ." },
        }),
      );

      const service = yield* makeDiagnosticsService();
      const result = yield* service.run({ kind: "lint" }, workspace);

      expect(result.status).toBe("passed");
      expect(result.commandLabel).toBe("bun run check");
      expect(runMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "bun",
          args: ["run", "check"],
          cwd: workspace,
        }),
      );
    }).pipe(Effect.provide(ProcessRunnerTest)),
  );

  it.effect("runs the package test script", () =>
    Effect.gen(function* () {
      runMock.mockReturnValueOnce(Effect.succeed(successfulRun));
      const workspace = yield* Effect.promise(() =>
        makePackageJsonWorkspace({
          scripts: { test: "vitest" },
        }),
      );

      const service = yield* makeDiagnosticsService();
      const result = yield* service.run({ kind: "test" }, workspace);

      expect(result.status).toBe("passed");
      expect(result.commandLabel).toBe("npm run test");
      expect(runMock).toHaveBeenCalledWith(
        expect.objectContaining({
          command: "npm",
          args: ["run", "test"],
          cwd: workspace,
        }),
      );
    }).pipe(Effect.provide(ProcessRunnerTest)),
  );

  it.effect("returns unsupported when the target script is missing", () =>
    Effect.gen(function* () {
      const workspace = yield* Effect.promise(() =>
        makePackageJsonWorkspace({
          packageManager: "pnpm@10.24.0",
          scripts: { dev: "vite" },
        }),
      );

      const service = yield* makeDiagnosticsService();
      const result = yield* service.run({ kind: "typecheck" }, workspace);

      expect(result.status).toBe("unsupported");
      expect(result.outputPreview).toContain("No typecheck script");
      expect(runMock).not.toHaveBeenCalled();
    }).pipe(Effect.provide(ProcessRunnerTest)),
  );

  it("resolves check scripts without running them", async () => {
    const workspace = await makePackageJsonWorkspace({
      packageManager: "yarn@4.0.0",
      scripts: { lint: "eslint ." },
    });

    await expect(resolveDiagnosticCommandConfig(workspace, "lint")).resolves.toEqual({
      command: "yarn",
      args: ["run", "lint"],
      label: "yarn run lint",
    });
  });
});
