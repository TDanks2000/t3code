// @effect-diagnostics nodeBuiltinImport:off - diagnostics inspect workspace package metadata.
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type {
  DiagnosticProblem,
  DiagnosticRunKind,
  DiagnosticsRunResult,
} from "@t3tools/contracts";

import { ProcessRunner } from "../processRunner.ts";
import { DiagnosticsService, type DiagnosticsServiceShape } from "./Services/DiagnosticsService.ts";

const DIAGNOSTICS_TIMEOUT = Duration.seconds(120);
const DIAGNOSTICS_OUTPUT_PREVIEW_MAX_BYTES = 256 * 1024;

type DiagnosticCommandConfig = {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly label: string;
};

type PackageJson = {
  readonly packageManager?: string;
  readonly scripts?: Record<string, string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePackageJson(value: string): PackageJson | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed)) return null;
    const scriptsValue = parsed.scripts;
    const scripts: Record<string, string> = {};
    if (isObject(scriptsValue)) {
      for (const [key, scriptValue] of Object.entries(scriptsValue)) {
        if (typeof scriptValue === "string") {
          scripts[key] = scriptValue;
        }
      }
    }

    return {
      ...(typeof parsed.packageManager === "string"
        ? { packageManager: parsed.packageManager }
        : {}),
      ...(Object.keys(scripts).length > 0 ? { scripts } : {}),
    };
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Fs.access(path);
    return true;
  } catch {
    return false;
  }
}

function packageManagerFromPackageJson(packageJson: PackageJson): string | null {
  const packageManager = packageJson.packageManager?.split("@")[0]?.trim();
  return packageManager && packageManager.length > 0 ? packageManager : null;
}

async function detectPackageManager(cwd: string, packageJson: PackageJson): Promise<string> {
  const configured = packageManagerFromPackageJson(packageJson);
  if (configured !== null) return configured;

  if (await fileExists(Path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (
    (await fileExists(Path.join(cwd, "bun.lock"))) ||
    (await fileExists(Path.join(cwd, "bun.lockb")))
  ) {
    return "bun";
  }
  if (await fileExists(Path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function scriptCommandConfig(packageManager: string, scriptName: string): DiagnosticCommandConfig {
  return {
    command: packageManager,
    args: ["run", scriptName],
    label: `${packageManager} run ${scriptName}`,
  };
}

function selectScript(
  scripts: Record<string, string> | undefined,
  kind: DiagnosticRunKind,
): string | null {
  if (!scripts) return null;
  if (kind === "typecheck") {
    return scripts.typecheck !== undefined ? "typecheck" : null;
  }
  if (kind === "lint") {
    if (scripts.check !== undefined) return "check";
    if (scripts.lint !== undefined) return "lint";
    return null;
  }
  return scripts.test !== undefined ? "test" : null;
}

async function readPackageJson(cwd: string): Promise<PackageJson | null> {
  try {
    return parsePackageJson(await Fs.readFile(Path.join(cwd, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function resolveDiagnosticCommandConfig(
  cwd: string,
  kind: DiagnosticRunKind,
): Promise<DiagnosticCommandConfig | null> {
  const packageJson = await readPackageJson(cwd);
  const scriptName = selectScript(packageJson?.scripts, kind);
  if (packageJson && scriptName !== null) {
    return scriptCommandConfig(await detectPackageManager(cwd, packageJson), scriptName);
  }

  return null;
}

function parseTypeScriptOutput(stdout: string, stderr: string): ReadonlyArray<DiagnosticProblem> {
  const combined = `${stdout}\n${stderr}`;
  const problems: Array<DiagnosticProblem> = [];

  const tsLineColRegex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;
  const tsColonRegex = /^(.+?):(\d+):(\d+)\s+[-–—]\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm;

  for (const regex of [tsLineColRegex, tsColonRegex]) {
    let match: RegExpExecArray | null;
    match = regex.exec(combined);
    while (match !== null) {
      const severity = match[4] === "error" ? ("error" as const) : ("warning" as const);
      problems.push({
        id: `ts-${problems.length}`,
        severity,
        source: "typescript",
        message: (match[6] ?? "").trim(),
        filePath: match[1] ?? "",
        line: Number(match[2] ?? 0),
        column: Number(match[3] ?? 0),
        code: match[5] ?? "",
      });
      match = regex.exec(combined);
    }
  }

  return problems;
}

function parseLintOutput(stderr: string): ReadonlyArray<DiagnosticProblem> {
  const problems: Array<DiagnosticProblem> = [];

  const lintRegex = /^(.+?):(\d+):(\d+)\s+(error|warning)\s+(\S+)\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  match = lintRegex.exec(stderr);
  while (match !== null) {
    const severity = match[4] === "error" ? ("error" as const) : ("warning" as const);
    problems.push({
      id: `lint-${problems.length}`,
      severity,
      source: "lint",
      message: (match[6] ?? "").trim(),
      filePath: match[1] ?? "",
      line: Number(match[2] ?? 0),
      column: Number(match[3] ?? 0),
      code: match[5] ?? "",
    });
    match = lintRegex.exec(stderr);
  }

  return problems;
}

function parseTestOutput(stdout: string, stderr: string): ReadonlyArray<DiagnosticProblem> {
  const combined = `${stdout}\n${stderr}`;
  const problems: Array<DiagnosticProblem> = [];

  const failFileRegex = /^ FAIL\s+(.+\.(?:test|spec)\.(?:ts|tsx|js|jsx))$/gm;
  let match: RegExpExecArray | null;

  match = failFileRegex.exec(combined);
  while (match !== null) {
    const filePath = (match[1] ?? "").trim();
    const id = `test-${problems.length}`;
    const afterIndex = match.index + match[0].length;
    const afterText = combined.slice(afterIndex, afterIndex + 500);
    const errorMatch = afterText.match(/×\s+(.+)$/m);
    const message =
      errorMatch !== null && errorMatch[1] !== undefined
        ? errorMatch[1].trim()
        : `Test failed in ${filePath}`;

    problems.push({
      id,
      severity: "error",
      source: "test",
      message,
      filePath,
    });
    match = failFileRegex.exec(combined);
  }

  return problems;
}

function trimOutputPreview(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text;
  return text.slice(0, maxBytes) + "\n... (output truncated)";
}

export const makeDiagnosticsService = Effect.fn("makeDiagnosticsService")(function* () {
  const processRunner = yield* ProcessRunner;

  const run: DiagnosticsServiceShape["run"] = (input, cwd) =>
    Effect.gen(function* () {
      const startTime = yield* DateTime.now;
      const startedAt = DateTime.formatIso(startTime);
      const commandConfig = yield* Effect.promise(() =>
        resolveDiagnosticCommandConfig(cwd, input.kind),
      );

      if (commandConfig === null) {
        const finishTime = yield* DateTime.now;
        return {
          kind: input.kind,
          status: "unsupported",
          startedAt,
          finishedAt: DateTime.formatIso(finishTime),
          durationMs: finishTime.epochMilliseconds - startTime.epochMilliseconds,
          commandLabel: input.kind,
          problems: [],
          outputPreview:
            input.kind === "lint"
              ? "No check or lint script was found in package.json."
              : `No ${input.kind} script was found in package.json.`,
        } satisfies DiagnosticsRunResult;
      }

      const processResult = yield* processRunner
        .run({
          command: commandConfig.command,
          args: commandConfig.args,
          cwd,
          timeout: DIAGNOSTICS_TIMEOUT,
          maxOutputBytes: DIAGNOSTICS_OUTPUT_PREVIEW_MAX_BYTES,
          outputMode: "truncate",
          truncatedMarker: "\n... (output truncated)",
          timeoutBehavior: "timedOutResult",
        })
        .pipe(
          Effect.orElseSucceed(() => ({
            stdout: "",
            stderr: "",
            code: null,
            timedOut: false,
            stdoutTruncated: false,
            stderrTruncated: false,
          })),
        );

      const finishTime = yield* DateTime.now;
      const finishedAt = DateTime.formatIso(finishTime);
      const durationMs = finishTime.epochMilliseconds - startTime.epochMilliseconds;

      if (processResult.timedOut) {
        return {
          kind: input.kind,
          status: "timed_out",
          startedAt,
          finishedAt,
          durationMs,
          commandLabel: commandConfig.label,
          problems: [],
          outputPreview: "Diagnostic run timed out.",
        } satisfies DiagnosticsRunResult;
      }

      const combined = `${processResult.stdout}\n${processResult.stderr}`;
      const outputPreview = trimOutputPreview(combined, DIAGNOSTICS_OUTPUT_PREVIEW_MAX_BYTES);

      let problems: ReadonlyArray<DiagnosticProblem>;
      let status: DiagnosticsRunResult["status"];

      if (input.kind === "typecheck") {
        problems = parseTypeScriptOutput(processResult.stdout, processResult.stderr);
      } else if (input.kind === "lint") {
        problems = parseLintOutput(processResult.stderr);
      } else {
        problems = parseTestOutput(processResult.stdout, processResult.stderr);
      }

      if (problems.length > 0) {
        status = "failed";
      } else if (processResult.code === 0) {
        status = "passed";
      } else {
        status = "error";
      }

      return {
        kind: input.kind,
        status,
        startedAt,
        finishedAt,
        durationMs,
        commandLabel: commandConfig.label,
        problems,
        outputPreview,
        exitCode: processResult.code ?? undefined,
      } satisfies DiagnosticsRunResult;
    });

  return DiagnosticsService.of({ run });
});

export const DiagnosticsServiceLive = Layer.effect(DiagnosticsService, makeDiagnosticsService());
