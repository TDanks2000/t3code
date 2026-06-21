---
type: executor-prompt
title: Implement Open Design Workspace Slice
slug: open-design-workspace
created: 2026-06-18
status: ready
target: apps/web chat composer, right panel, design artifact preview
related:
  - plan.html
---

# Task

Implement the Open Design workspace slice exactly. Do not redesign the approach unless you find a real blocker.

# Context

T3 Code is a React/Vite TypeScript workspace for local coding-agent sessions. The relevant UI is in `apps/web/src/components/ChatView.tsx`, with composer controls in `apps/web/src/components/chat/ChatComposer.tsx`, compact composer controls in `apps/web/src/components/chat/CompactComposerControlsMenu.tsx`, and responsive right-panel behavior through `apps/web/src/components/RightPanelSheet.tsx` plus `apps/web/src/rightPanelLayout.ts`.

The requested feature is inspired by `https://github.com/nexu-io/open-design/`, but the first slice must be smaller: add a design-artifact mode inside the existing chat workspace. Do not clone Open Design's daemon, marketplace, model router, video pipeline, or MCP server.

# Implementation Plan

1. Create client-only design workflow types.
   - Add a small helper module such as `apps/web/src/designWorkspace.ts` or `apps/web/src/lib/designWorkspace.ts`.
   - Define `DesignArtifactType`, `DesignDraft`, `DesignArtifactCandidate`, defaults, and pure helper functions.
   - Keep runtime logic out of `packages/contracts` unless a server method is required.

2. Build prompt composition as pure logic.
   - Add `buildDesignPrompt(input)`.
   - Include artifact type, design-system hint, target path, preview contract, and safety rules.
   - The prompt must tell the provider to write a project-local single-file HTML artifact and mention the path in the final response.

3. Add artifact detection helpers.
   - Parse assistant text and turn diff summaries for likely project-relative `.html` files.
   - Prefer user-selected target paths and files changed in the latest turn.
   - Avoid brittle regex-only logic where existing diff summaries provide structured file paths.

4. Add `DesignPreviewPanel`.
   - Match the density of `PlanSidebar` and `DiffPanel`.
   - Include header, artifact controls, empty/loading/error states, iframe preview, and footer actions.
   - Render generated HTML only inside a restrictive sandboxed iframe. Do not use `dangerouslySetInnerHTML`.

5. Wire panel state into `ChatView`.
   - Add `designMode`, `designPanelOpen`, `designDraft`, and `activeDesignArtifact` state near the existing Plan sidebar state.
   - Use the existing media query and `RightPanelSheet` pattern for responsive behavior.
   - Keep Plan sidebar and Design panel behavior understandable; one active right panel at a time is acceptable for the first slice.

6. Add the composer Design button.
   - Put the primary button in `ComposerFooterModeControls`.
   - Put the compact equivalent in `CompactComposerControlsMenu`.
   - Use a lucide icon such as `PaletteIcon`.
   - Add an accessible label and active styling consistent with the existing Plan toggle.

7. Intercept send composition, not transport.
   - When `designMode` is active, transform the outgoing prompt with `buildDesignPrompt` before the existing send path dispatches it.
   - Preserve image attachments, terminal contexts, selected model, runtime mode, approvals, and current error handling.

8. Load artifact contents safely.
   - First look for an existing typed local/project file API.
   - If no typed read method exists, add a minimal schema-backed file-read contract near existing project file APIs.
   - Server-side reads must be confined to the active project or worktree. Normalize paths and reject traversal or arbitrary absolute paths.

9. Add export/open actions.
   - Implement Copy Path, Open in Editor, and Download HTML.
   - Download can use a Blob from loaded HTML.
   - Open in Editor should reuse `openInPreferredEditor` or existing local API patterns.

10. Add focused tests.
   - Test prompt construction.
   - Test artifact candidate ranking.
   - Test target path validation.
   - Test compact control visibility if the component has existing test coverage.
   - Test send prompt transformation as pure logic where possible.

11. Manual QA the loop.
   - Generate a simple landing page artifact.
   - Confirm the file is written.
   - Confirm the panel opens.
   - Confirm the iframe shows the result.
   - Refine the artifact in a follow-up prompt.
   - Confirm export/open actions work.

# Constraints

- Follow existing project patterns.
- Keep the change focused.
- Do not perform unrelated refactors.
- Preserve existing behavior unless explicitly changed by the plan.
- Reuse existing types, schemas, utilities, services, and components before creating new ones.
- Avoid adding dependencies unless explicitly allowed.
- Do not implement a plugin marketplace, Open Design daemon, MCP server, model router, video renderer, or PDF/PPTX export in this slice.
- Do not render generated artifact HTML directly into React markdown or the app DOM.

# TypeScript Rules

- Do not use `any`.
- Avoid weakening type safety.
- Keep prompt building and artifact detection in pure helper functions.
- Use explicit names for design workflow state and candidates.

# UI Rules

- Use existing design tokens and components.
- Use lucide-react icons for buttons.
- Include loading, empty, error, and success states where relevant.
- Keep the UI compact and consistent with the existing T3 Code chat surface.
- The Design button belongs in the composer footer first; a header duplicate is optional only after the core behavior works.
- The Design Preview panel should behave like the Plan sidebar: inline on wide layouts and sheet-style on narrow layouts.

# Validation

Before finishing:

- Run `vp check`.
- Run `vp run typecheck`.
- Run focused tests for changed helpers/components.
- Run `vp test` if focused test routing is unclear.
- Manually verify the affected flow at desktop and narrow widths.
- Manually verify generated HTML is only rendered inside the sandboxed iframe.

# Final Response

When done, respond with:

1. Summary of changes
2. Files changed
3. Commands run
4. Tests/checks completed
5. Any blockers, assumptions, or follow-up recommendations
