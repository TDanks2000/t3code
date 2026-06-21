import * as Schema from "effect/Schema";

export const DiagnosticSeverity = Schema.Literals(["error", "warning", "info"]);
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type;

export const DiagnosticSource = Schema.Literals([
  "typescript",
  "lint",
  "test",
  "runtime",
  "agent",
  "security",
]);
export type DiagnosticSource = typeof DiagnosticSource.Type;

export const DiagnosticProblem = Schema.Struct({
  id: Schema.String,
  severity: DiagnosticSeverity,
  source: DiagnosticSource,
  message: Schema.String,
  filePath: Schema.optional(Schema.String),
  line: Schema.optional(Schema.Number),
  column: Schema.optional(Schema.Number),
  code: Schema.optional(Schema.String),
});
export type DiagnosticProblem = typeof DiagnosticProblem.Type;

export const DiagnosticRunKind = Schema.Literals(["typecheck", "lint", "test"]);
export type DiagnosticRunKind = typeof DiagnosticRunKind.Type;

export const DiagnosticRunStatus = Schema.Literals([
  "passed",
  "failed",
  "error",
  "timed_out",
  "unsupported",
]);
export type DiagnosticRunStatus = typeof DiagnosticRunStatus.Type;

export const DiagnosticsRunInput = Schema.Struct({
  kind: DiagnosticRunKind,
  cwd: Schema.optional(Schema.String),
});
export type DiagnosticsRunInput = typeof DiagnosticsRunInput.Type;

export const DiagnosticsRunResult = Schema.Struct({
  kind: DiagnosticRunKind,
  status: DiagnosticRunStatus,
  startedAt: Schema.String,
  finishedAt: Schema.String,
  durationMs: Schema.Number,
  commandLabel: Schema.String,
  problems: Schema.Array(DiagnosticProblem),
  outputPreview: Schema.String,
  exitCode: Schema.optional(Schema.Number),
});
export type DiagnosticsRunResult = typeof DiagnosticsRunResult.Type;

export class DiagnosticsRunError extends Schema.TaggedErrorClass<DiagnosticsRunError>()(
  "DiagnosticsRunError",
  {
    kind: DiagnosticRunKind,
    message: Schema.String,
  },
) {}
