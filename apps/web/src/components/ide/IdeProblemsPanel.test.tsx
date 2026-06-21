import { describe, it, expect } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeProblemsPanel } from "./IdeProblemsPanel";
import type { IdeProblem } from "./ide-types";
import type { DiagnosticsRunState } from "./IdeShell";

const SAMPLE_PROBLEMS: ReadonlyArray<IdeProblem> = [
  {
    id: "p1",
    severity: "error",
    source: "typescript",
    message: "Type 'X' is not assignable to type 'Y'.",
    filePath: "src/index.ts",
    line: 42,
    column: 10,
    code: "TS2322",
  },
  {
    id: "p2",
    severity: "warning",
    source: "lint",
    message: "Unused variable 'foo'.",
    filePath: "src/utils.ts",
    line: 5,
  },
  {
    id: "p3",
    severity: "info",
    source: "test",
    message: "Test passed.",
  },
];

const IDLE_STATE: DiagnosticsRunState = { status: "idle", problems: [] };

describe("IdeProblemsPanel", () => {
  it("renders run buttons", () => {
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={[]}
        diagnosticsState={IDLE_STATE}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Run Typecheck");
    expect(html).toContain("Run Check");
    expect(html).toContain("Run Tests");
  });

  it("disables run buttons while running", () => {
    const runningState: DiagnosticsRunState = {
      status: "running",
      runningKind: "typecheck",
      lastRun: null,
      problems: [],
    };
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={[]}
        diagnosticsState={runningState}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Run Typecheck");
    expect(html).toContain("Running");
    expect(html).toContain("TypeScript typecheck");
  });

  it("renders clear button", () => {
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={SAMPLE_PROBLEMS}
        diagnosticsState={IDLE_STATE}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Clear");
  });

  it("renders problem rows with severity and source", () => {
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={SAMPLE_PROBLEMS}
        diagnosticsState={IDLE_STATE}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
        onOpenProblemLocation={() => undefined}
      />,
    );

    expect(html).toContain("not assignable to type");
    expect(html).toContain("Unused variable");
    expect(html).toContain("Test passed.");
    expect(html).toContain("TS2322");
    expect(html).toContain("src/index.ts");
    expect(html).toContain(":42:10");
    expect(html).toContain("src/utils.ts");
    expect(html).toContain(":5");
  });

  it("renders output preview when provided", () => {
    const completeState: DiagnosticsRunState = {
      status: "complete",
      lastRun: {
        kind: "lint",
        status: "error",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:05.000Z",
        durationMs: 5000,
        commandLabel: "vp check",
        problems: [],
        outputPreview: "Some raw output with an error.",
      },
      problems: [],
    };
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={[]}
        diagnosticsState={completeState}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Raw diagnostic output preview");
    expect(html).toContain("Some raw output with an error.");
  });

  it("shows problem counts for failed run", () => {
    const completeState: DiagnosticsRunState = {
      status: "complete",
      lastRun: {
        kind: "typecheck",
        status: "failed",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:30.000Z",
        durationMs: 30000,
        commandLabel: "vp run typecheck",
        problems: [],
        outputPreview: "",
      },
      problems: SAMPLE_PROBLEMS,
    };
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={SAMPLE_PROBLEMS}
        diagnosticsState={completeState}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Failed");
    expect(html).toContain("1 error");
    expect(html).toContain("1 warning");
  });

  it("shows run state info for passed run", () => {
    const completeState: DiagnosticsRunState = {
      status: "complete",
      lastRun: {
        kind: "typecheck",
        status: "passed",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:10.000Z",
        durationMs: 10000,
        commandLabel: "vp run typecheck",
        problems: [],
        outputPreview: "",
      },
      problems: [],
    };
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={[]}
        diagnosticsState={completeState}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Passed");
    expect(html).toContain("vp run typecheck");
    expect(html).toContain("10000ms");
  });

  it("disables an unsupported diagnostic action after the workspace reports it missing", () => {
    const completeState: DiagnosticsRunState = {
      status: "complete",
      lastRun: {
        kind: "lint",
        status: "unsupported",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
        commandLabel: "lint",
        problems: [],
        outputPreview: "No check or lint script was found in package.json.",
      },
      problems: [],
    };
    const html = renderToStaticMarkup(
      <IdeProblemsPanel
        problems={[]}
        diagnosticsState={completeState}
        onRunDiagnostics={() => undefined}
        onClearProblems={() => undefined}
      />,
    );

    expect(html).toContain("Unsupported");
    expect(html).toContain("Run Check (unavailable)");
    expect(html).toContain("No check or lint script was found");
  });
});
