import type { DiagnosticRunKind, DiagnosticsRunResult } from "@t3tools/contracts";
import type { IdeMissionEvidenceKind, IdeProblem } from "./ide-types";

const SOURCE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  lint: "Lint",
  test: "Test",
  runtime: "Runtime",
  agent: "Agent",
  security: "Security",
};

const FIX_ALL_MAX_PROBLEMS = 20;

const FIX_PROMPT_FOOTER = [
  "## Instructions",
  "",
  "- Inspect the referenced file(s) and related code.",
  "- Make the smallest safe fix that addresses the diagnostic message.",
  "- Do not introduce `any`.",
  "- Preserve existing behaviour.",
  "- Run the relevant checks after the fix.",
  "- Report which files were changed and what checks were run.",
].join("\n");

function formatLocation(problem: IdeProblem): string {
  const parts: Array<string> = [];
  if (problem.filePath !== undefined) parts.push(problem.filePath);
  if (problem.line != null) parts.push(`line ${problem.line}`);
  if (problem.column != null) parts.push(`column ${problem.column}`);
  return parts.length > 0 ? parts.join(", ") : "N/A";
}

function formatRunContext(lastRun?: DiagnosticsRunResult | undefined): string {
  if (!lastRun) return "";
  const kindLabel = SOURCE_LABELS[lastRun.kind] ?? lastRun.kind;
  const lines: Array<string> = [];
  lines.push(`Last diagnostics run: ${kindLabel}`);
  lines.push(`Status: ${lastRun.status}`);
  if (lastRun.durationMs != null) {
    lines.push(`Duration: ${lastRun.durationMs}ms`);
  }
  if (lastRun.exitCode != null) {
    lines.push(`Exit code: ${lastRun.exitCode}`);
  }
  if (lastRun.problems.length > 0) {
    lines.push(`Total problems found: ${lastRun.problems.length}`);
  }
  return lines.join("\n");
}

export const buildFixDiagnosticPrompt = (params: {
  readonly problem: IdeProblem;
  readonly lastRun?: DiagnosticsRunResult | undefined;
}): string => {
  const { problem, lastRun } = params;
  const sourceLabel = SOURCE_LABELS[problem.source] ?? problem.source;

  const lines: Array<string> = [
    "Fix this diagnostic from the IDE Problems panel.",
    "",
    "## Diagnostic",
    "",
    `- Source: ${sourceLabel}`,
    `- Severity: ${problem.severity}`,
  ];

  if (problem.code !== undefined) {
    lines.push(`- Code: ${problem.code}`);
  }

  lines.push(`- File: ${formatLocation(problem)}`);
  lines.push(`- Message: ${problem.message}`);

  const runContext = formatRunContext(lastRun);
  if (runContext) {
    lines.push("", runContext);
  }

  lines.push("", FIX_PROMPT_FOOTER);

  return lines.join("\n");
};

export const buildFixAllDiagnosticsPrompt = (params: {
  readonly problems: ReadonlyArray<IdeProblem>;
  readonly lastRun?: DiagnosticsRunResult | undefined;
}): string => {
  const { problems, lastRun } = params;
  const limited = problems.slice(0, FIX_ALL_MAX_PROBLEMS);
  const truncated = problems.length > FIX_ALL_MAX_PROBLEMS;

  const lines: Array<string> = [
    "Fix all diagnostics from the IDE Problems panel.",
    "",
    "## Diagnostics",
    "",
    `Total problems: ${limited.length}`,
    ...(truncated ? [`(Showing first ${FIX_ALL_MAX_PROBLEMS}. Run again for full set.)`] : []),
    "",
  ];

  for (const problem of limited) {
    const sourceLabel = SOURCE_LABELS[problem.source] ?? problem.source;
    const location = formatLocation(problem);
    const code = problem.code !== undefined ? ` [${problem.code}]` : "";
    lines.push(`### ${sourceLabel} ${problem.severity}${code}`);
    lines.push("");
    lines.push(`- ${problem.message}`);
    lines.push(`- ${location}`);
    lines.push("");
  }

  const runContext = formatRunContext(lastRun);
  if (runContext) {
    lines.push(runContext);
    lines.push("");
  }

  lines.push(FIX_PROMPT_FOOTER);

  return lines.join("\n");
};

export const diagnosticKindToEvidenceKind = (kind: DiagnosticRunKind): IdeMissionEvidenceKind => {
  switch (kind) {
    case "typecheck":
      return "typecheck";
    case "lint":
      return "lint";
    case "test":
      return "test";
  }
};
