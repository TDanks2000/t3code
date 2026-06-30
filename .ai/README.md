# .ai

Machine-readable planning artifacts written by the **strategist** skill.
Each entry is a self-contained plan, audit, or investigation an agent can execute.

## How to consume

1. Read this manifest to find the relevant artifact.
2. Open its folder; read `audit.html` / `plan.html` / `investigation.html` for full context.
3. Hand `executor-prompt.md` to the implementing agent.

## Conventions

- Folders: `<type>/<YYYY-MM-DD>-<slug>/`
- Primary artifacts default to HTML; Markdown versions are optional.
- Every artifact has metadata (`type`, `status`, `target`).
- `status: superseded` means a newer artifact replaces it.

## Artifacts

<!-- newest first; one line per run -->

- 2026-06-25 · plan · [browser-mcp-agent-capabilities](plans/2026-06-25-browser-mcp-agent-capabilities/plan.html) — add hover, select, double/right-click, and multi-tab tools to MCP browser toolkit

- 2026-06-25 · audit · [speed-reliability-performance](audits/2026-06-25-speed-reliability-performance/audit.html) — 7 findings: WAL mode, O(N) read-model scans, unbounded SQL lists, selector memoization, cache-key scans
- 2026-06-25 · plan · [per-thread-usage-stats](plans/2026-06-25-per-thread-usage-stats/plan.html) — fix usage tracking for all providers (5 gaps, 8 fixes) + add per-thread usage stats and settings page
- 2026-06-18 · plan · [open-design-canvas-workspace](plans/2026-06-18-open-design-canvas-workspace/plan.html) — build a dedicated Open Design-style canvas workspace
- 2026-06-18 · plan · [open-design-workspace](plans/2026-06-18-open-design-workspace/plan.html) — add a focused Open Design-style artifact workflow to T3 Code
- 2026-06-14 · audit · [bugs-and-improvements](audits/2026-06-14-bugs-and-improvements/audit.html) — audit of T3 Code for bugs and improvement opportunities
