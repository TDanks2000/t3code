import type { DiagnosticProblem } from "@t3tools/contracts";

export type IdeProblemSeverity = "error" | "warning" | "info";

export type IdeProblemSource = "typescript" | "lint" | "test" | "runtime" | "agent" | "security";

export type IdeProblem = {
  readonly id: string;
  readonly severity: IdeProblemSeverity;
  readonly source: IdeProblemSource;
  readonly message: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly column?: number;
  readonly code?: string;
};

export const toIdeProblem = (problem: DiagnosticProblem): IdeProblem => ({
  id: problem.id,
  severity: problem.severity,
  source: problem.source,
  message: problem.message,
  ...(problem.filePath !== undefined ? { filePath: problem.filePath } : {}),
  ...(problem.line !== undefined ? { line: problem.line } : {}),
  ...(problem.column !== undefined ? { column: problem.column } : {}),
  ...(problem.code !== undefined ? { code: problem.code } : {}),
});

export type IdeMissionEvidenceKind = "typecheck" | "lint" | "test" | "manual" | "agent";

export type IdeMissionEvidenceStatus =
  | "passed"
  | "failed"
  | "error"
  | "timed_out"
  | "unsupported"
  | "unknown";

export type IdeMissionEvidenceItem = {
  readonly id: string;
  readonly kind: IdeMissionEvidenceKind;
  readonly status: IdeMissionEvidenceStatus;
  readonly title: string;
  readonly detail?: string | undefined;
  readonly problemCount?: number | undefined;
  readonly startedAt?: string | undefined;
  readonly finishedAt?: string | undefined;
  readonly durationMs?: number | undefined;
};
