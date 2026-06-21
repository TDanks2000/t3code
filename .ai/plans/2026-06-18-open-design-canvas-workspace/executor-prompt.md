---
type: executor-prompt
title: Implement Open Design Canvas Workspace
slug: open-design-canvas-workspace
created: 2026-06-18
status: ready
target: apps/web dedicated Open Design-style canvas workspace
related:
  - plan.html
---

# Task

Implement a dedicated Open Design / Claude Design-style canvas workspace in T3 Code. Do not implement the earlier side-panel version. Build a route/surface that visually matches the supplied screenshot: left context rail, bottom-left composer, full grid canvas, top file/share bar, and artifact frames.

# Context

T3 Code already has provider sessions, thread state, model selection, composer draft state, attachments, project file handling, and WebSocket orchestration. Reuse those behavioral seams, but do not reuse the existing chat layout as the visual surface. The design workspace should feel like Open Design/Claude Design while still being powered by T3 Code's provider/thread infrastructure.

Relevant files to inspect before editing:

- `apps/web/src/router.ts`
- `apps/web/src/routes/*`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/chat/ChatComposer.tsx`
- `apps/web/src/components/chat/ComposerPrimaryActions.tsx`
- `apps/web/src/composerDraftStore.ts`
- `apps/web/src/store.ts`
- `apps/web/src/storeSelectors.ts`
- `apps/web/src/components/ui/*`
- `packages/contracts/src/project.ts`
- server project file APIs if artifact reads require a typed endpoint

# Implementation Plan

1. Create design workspace state and helpers.
   - Add a module such as `apps/web/src/designWorkspace/designWorkspaceState.ts`.
   - Define workspace title, context source state, prompt draft, artifact metadata, selected file, and generation state.
   - Add pure helper functions for state transitions.

2. Add Open Design-style prompt construction.
   - Add `buildDesignWorkspacePrompt`.
   - Include selected context, design-system text, screenshot notes, Figma link/import notes, target artifact path, and output rules.
   - Require the agent to create or update a single-file HTML artifact under a stable project-relative path and mention that path in its final response.

3. Add a dedicated design route.
   - Create `apps/web/src/routes/design.tsx` or a project-scoped equivalent.
   - Render the new canvas workspace directly.
   - Do not embed the existing `ChatView`.

4. Build `DesignWorkspaceShell`.
   - Two-column layout: approximately 300-316px left rail and flexible canvas.
   - Warm off-white visual style, subtle shadows, rounded canvas container, and grid canvas background.
   - Ensure responsive behavior at desktop, laptop, and narrow widths.

5. Build `DesignContextRail`.
   - Header: logo button, workspace title "Untitled", dropdown caret.
   - Center: "Start with context" title, supporting copy, and three pill actions: Design system, Screenshot, Figma.
   - Bottom: compact prompt composer pinned to the rail bottom.

6. Build `DesignPromptComposer`.
   - Textarea placeholder: "Describe what you want to create..."
   - Include attach button, secondary tool/voice placeholder button, model selector, and Send button.
   - Reuse model selection behavior where possible, but keep the visual design close to the screenshot.
   - Send should show pending state on the Send button itself.

7. Build `DesignCanvasArea`.
   - Top bar: file selector showing "No file open" or selected artifact path, Share button, avatar.
   - Canvas: large grid background with empty state before first artifact.
   - After generation, show one or more artifact frames on the canvas.

8. Build `DesignArtifactFrame`.
   - Render generated HTML in a sandboxed iframe.
   - Include a minimal artifact toolbar for Preview, Export HTML, and Open in editor.
   - Never use `dangerouslySetInnerHTML` for generated artifact HTML.

9. Connect to existing agent dispatch.
   - Use `ChatView` as behavior reference for provider/thread dispatch.
   - Prefer creating/reusing a real T3 Code thread behind the design workspace so runs remain tracked in session history.
   - The design route should hide chat messages by default and surface progress/artifact state instead.

10. Implement artifact discovery and safe file reads.
   - Rank generated `.html` files using latest turn diff paths and explicit target path.
   - Read artifacts from the active project/worktree.
   - If no existing typed read method exists, add a minimal schema-backed endpoint with path normalization and traversal rejection.

11. Add context dialogs.
   - Design system: textarea or file picker for `DESIGN.md`-style context.
   - Screenshot: image attachment path using existing attachment behavior if practical.
   - Figma: URL/context dialog or disabled setup state for Slice 1 if real import is not available.

12. Add tests.
   - Prompt construction.
   - Artifact candidate ranking.
   - Context source state transitions.
   - Target path validation.
   - Component smoke tests for the workspace shell if existing test tooling supports it.

# Constraints

- Do not build the side-panel design from the earlier plan.
- Do not replace the existing T3 Code chat UI.
- Do not create a parallel untracked execution path.
- Reuse provider/session/thread infrastructure.
- Do not add a plugin marketplace, full Figma integration, video rendering, HyperFrames, PPTX/PDF export, model router, or MCP server in this slice.
- Do not add external UI dependencies.
- Keep generated HTML sandboxed.

# TypeScript Rules

- Do not use `any`.
- Avoid unsafe casts.
- Keep prompt, artifact, and path logic in pure helpers.
- Use existing contracts and schemas before creating new ones.

# UI Rules

- Match the supplied screenshot closely: warm off-white surfaces, left context rail, full grid canvas, top file/share bar, bottom-left composer.
- Use lucide-react icons.
- Use existing UI primitives.
- Text must not overlap or overflow at desktop, laptop, and narrow widths.
- Empty canvas should remain visually quiet, not filled with generic cards.

# Validation

Before finishing:

- Run `vp check`.
- Run `vp run typecheck`.
- Run focused web tests for changed helpers/components.
- Run `vp test` if focused selection is unclear.
- Manually verify at 1920x1080 that the page visually matches the screenshot.
- Manually verify the context → prompt → generation → artifact preview → refine loop.
- Manually verify generated HTML is only rendered in a sandboxed iframe.

# Final Response

When done, respond with:

1. Summary of changes
2. Files changed
3. Commands run
4. Tests/checks completed
5. Any blockers, assumptions, or follow-up recommendations
