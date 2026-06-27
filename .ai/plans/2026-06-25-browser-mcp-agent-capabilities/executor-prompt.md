---
type: executor-prompt
title: Browser MCP Agent Capabilities — Hover, Select, Click Extension, Multi-tab
slug: browser-mcp-agent-capabilities
created: 2026-06-25
status: ready
related:
  - plan.html
---

You are implementing new AI agent capabilities for the in-app browser preview MCP toolkit in T3 Code. The codebase uses Effect-TS 4.0 beta throughout. Do not use `any`. Follow existing patterns exactly. This is a purely additive change — nothing is removed or renamed.

## Context

The preview automation system works like this:

1. An AI agent calls an MCP tool (e.g. `preview_click`)
2. The MCP server's handler calls `broker.invoke({ scope, operation, input })`
3. The broker enqueues a `PreviewAutomationRequest` to the renderer owner
4. `PreviewAutomationOwner.tsx` dispatches on `request.operation` in a `switch`
5. For desktop operations: calls `previewBridge.automation.*` IPC
6. Desktop IPC handler calls `PreviewManager.automation*()` in main process
7. Manager uses CDP / Playwright injected runtime to drive Chromium

Every new operation requires changes across 6 files. Follow all 7 steps below sequentially.

---

## Step 1 — Extend contracts

**File**: `packages/contracts/src/previewAutomation.ts`

### 1a. Add 5 new literals to `PreviewAutomationOperation`

```ts
export const PreviewAutomationOperation = Schema.Literals([
  "status", "open", "navigate", "snapshot",
  "click", "type", "press", "scroll", "evaluate", "waitFor",
  "recordingStart", "recordingStop",
  // ADD:
  "hover", "select", "tabList", "tabSwitch", "tabClose",
]);
```

### 1b. Extend `PreviewAutomationClickInput`

Add these two optional fields to the `Schema.Struct(...)` **before** the `.check()` refinement:

```ts
button: Schema.optional(
  Schema.Literals(["left", "right", "middle"]).annotate({
    description: "Mouse button to press. Defaults to 'left'.",
  }),
),
clickCount: Schema.optional(
  Schema.Literals([1, 2]).annotate({
    description: "Number of successive clicks. Use 2 for double-click. Defaults to 1.",
  }),
),
```

Update the `.annotate({ description: "..." })` at the bottom of `PreviewAutomationClickInput` to mention the new options.

### 1c. Add `PreviewAutomationHoverInput`

Copy the `LegacySelector` and `Locator` references from `PreviewAutomationClickInput`. Paste this after `PreviewAutomationClickInput`:

```ts
export const PreviewAutomationHoverInput = Schema.Struct({
  selector: Schema.optional(LegacySelector).annotate({
    description: "Legacy CSS selector for the hover target. Prefer locator.",
  }),
  locator: Schema.optional(Locator).annotate({
    description: "Playwright selector for the hover target.",
  }),
  x: Schema.optional(
    Schema.Finite.annotate({ description: "Viewport-relative X coordinate in CSS pixels. Must be paired with y." }),
  ),
  y: Schema.optional(
    Schema.Finite.annotate({ description: "Viewport-relative Y coordinate in CSS pixels. Must be paired with x." }),
  ),
  dwellMs: Schema.optional(
    Schema.Int
      .check(Schema.isGreaterThanOrEqualTo(0))
      .check(Schema.isLessThanOrEqualTo(2_000))
      .annotate({ description: "Milliseconds to hold the hover. Defaults to 300. Increase for slow tooltip animations." }),
  ),
})
  .check(
    Schema.makeFilter((input) => {
      const selectorModes =
        Number(input.selector !== undefined) + Number(input.locator !== undefined);
      const hasX = input.x !== undefined;
      const hasY = input.y !== undefined;
      if (hasX !== hasY) return "Coordinates require both x and y.";
      const coordinateModes = hasX && hasY ? 1 : 0;
      return selectorModes + coordinateModes === 1 || "Provide exactly one hover target.";
    }),
  )
  .annotate({
    description:
      "Moves the cursor to a target and holds to trigger CSS :hover state and reveal tooltips or hover-menus.",
  });
export type PreviewAutomationHoverInput = typeof PreviewAutomationHoverInput.Type;
```

### 1d. Add `PreviewAutomationSelectInput`

```ts
export const PreviewAutomationSelectInput = Schema.Struct({
  selector: Schema.optional(LegacySelector).annotate({
    description: "Legacy CSS selector for the <select> element. Prefer locator.",
  }),
  locator: Schema.optional(Locator).annotate({
    description: "Playwright selector for the <select> element.",
  }),
  value: Schema.optional(
    Schema.String.annotate({ description: "Option value attribute to select." }),
  ),
  label: Schema.optional(
    Schema.String.annotate({
      description: "Visible option text to select. Case-sensitive substring match after trimming whitespace.",
    }),
  ),
  index: Schema.optional(
    Schema.Int
      .check(Schema.isGreaterThanOrEqualTo(0))
      .annotate({ description: "Zero-based option index." }),
  ),
  timeoutMs: OptionalTimeoutMs,
})
  .check(
    Schema.makeFilter((input) => {
      if (input.selector !== undefined && input.locator !== undefined) {
        return "Provide at most one of selector or locator.";
      }
      const valueModes =
        Number(input.value !== undefined) +
        Number(input.label !== undefined) +
        Number(input.index !== undefined);
      return valueModes === 1 || "Provide exactly one of value, label, or index.";
    }),
  )
  .annotate({ description: "Selects an option from a native <select> element." });
export type PreviewAutomationSelectInput = typeof PreviewAutomationSelectInput.Type;
```

### 1e. Add tab schemas

```ts
export const PreviewAutomationTabEntry = Schema.Struct({
  tabId: PreviewTabId,
  url: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  loading: Schema.Boolean,
  active: Schema.Boolean,
});
export type PreviewAutomationTabEntry = typeof PreviewAutomationTabEntry.Type;

export const PreviewAutomationTabList = Schema.Struct({
  tabs: Schema.Array(PreviewAutomationTabEntry),
  activeTabId: Schema.NullOr(PreviewTabId),
});
export type PreviewAutomationTabList = typeof PreviewAutomationTabList.Type;

export const PreviewAutomationTabSwitchInput = Schema.Struct({
  tabId: PreviewTabId.annotate({ description: "Tab to make active." }),
}).annotate({ description: "Switches the active browser tab." });
export type PreviewAutomationTabSwitchInput = typeof PreviewAutomationTabSwitchInput.Type;

export const PreviewAutomationTabCloseInput = Schema.Struct({
  tabId: PreviewTabId.annotate({ description: "Tab to close." }),
}).annotate({ description: "Closes a browser tab." });
export type PreviewAutomationTabCloseInput = typeof PreviewAutomationTabCloseInput.Type;
```

Make sure all 7 new types are exported from the package's barrel/index file if one exists.

---

## Step 2 — Add MCP tools

**File**: `apps/server/src/mcp/toolkits/preview/tools.ts`

Import the new schema types at the top. Then add 5 new tools after `PreviewScrollTool`:

```ts
export const PreviewHoverTool = safeBrowserTool(
  Tool.make("preview_hover", {
    description:
      "Move the cursor to a target and hold to trigger CSS :hover state, reveal tooltips, or expose hover-triggered menus. Provide exactly one of locator, selector, or the x/y coordinate pair. Call preview_snapshot first when the target is unknown.",
    parameters: PreviewAutomationHoverInput,
    success: Schema.Null,
    failure: PreviewAutomationError,
    dependencies,
  }).annotate(Tool.Title, "Hover over preview element"),
);

export const PreviewSelectTool = browserTool(
  Tool.make("preview_select", {
    description:
      "Choose an option from a native <select> element. Provide a locator or selector to target the element, and exactly one of: value (option value attribute), label (visible text, trimmed substring match), or index (zero-based).",
    parameters: PreviewAutomationSelectInput,
    success: Schema.Null,
    failure: PreviewAutomationError,
    dependencies,
  }).annotate(Tool.Title, "Select option in preview page"),
);

export const PreviewTabListTool = readonlyBrowserTool(
  Tool.make("preview_tab_list", {
    description:
      "List all open browser tabs for the current thread. Returns each tab's id, URL, title, loading state, and whether it is the active tab.",
    success: PreviewAutomationTabList,
    failure: PreviewAutomationError,
    dependencies,
  }).annotate(Tool.Title, "List browser tabs"),
);

export const PreviewTabSwitchTool = safeBrowserTool(
  Tool.make("preview_tab_switch", {
    description:
      "Make a different browser tab the active tab. The specified tab becomes the target for subsequent preview actions. Use preview_tab_list to find available tab ids.",
    parameters: PreviewAutomationTabSwitchInput,
    success: PreviewAutomationStatus,
    failure: PreviewAutomationError,
    dependencies,
  }).annotate(Tool.Title, "Switch active browser tab"),
);

export const PreviewTabCloseTool = browserTool(
  Tool.make("preview_tab_close", {
    description:
      "Close a browser tab. Closing the active tab leaves no active tab; use preview_tab_switch or preview_open to restore one. Use preview_tab_list to find tab ids.",
    parameters: PreviewAutomationTabCloseInput,
    success: Schema.Null,
    failure: PreviewAutomationError,
    dependencies,
  }).annotate(Tool.Title, "Close browser tab"),
);
```

Then update **both** `PreviewToolkit` and `PreviewStandardToolkit` to include the 5 new tools.

---

## Step 3 — Wire handlers

**File**: `apps/server/src/mcp/toolkits/preview/handlers.ts`

Add to the `handlers` object:

```ts
preview_hover: (input) =>
  invoke<void>("hover", input, input.timeoutMs).pipe(Effect.as(null)),
preview_select: (input) =>
  invoke<void>("select", input, input.timeoutMs).pipe(Effect.as(null)),
preview_tab_list: () =>
  invoke<PreviewAutomationTabList>("tabList", {}),
preview_tab_switch: (input) =>
  invoke<PreviewAutomationStatus>("tabSwitch", input),
preview_tab_close: (input) =>
  invoke<void>("tabClose", input).pipe(Effect.as(null)),
```

Update `PreviewStandardToolkitHandlersLive` and `PreviewToolkitHandlersLive` calls to `Toolkit.toLayer(handlers)` — they should automatically pick up new entries since `handlers` is typed via `satisfies`.

---

## Step 4 — Renderer dispatch

**File**: `apps/web/src/components/preview/PreviewAutomationOwner.tsx`

In the `handleRequest` switch, add these cases **before** the closing `default` or after `recordingStop`:

```ts
case "hover":
  if (!previewBridge || !tabId) {
    throw new PreviewAutomationTargetUnavailableError(unavailableTarget);
  }
  return await previewBridge.automation.hover(
    tabId,
    request.input as PreviewAutomationHoverInput,
  );

case "select":
  if (!previewBridge || !tabId) {
    throw new PreviewAutomationTargetUnavailableError(unavailableTarget);
  }
  return await previewBridge.automation.select(
    tabId,
    request.input as PreviewAutomationSelectInput,
  );

case "tabList": {
  const state = readThreadPreviewState(threadRef);
  // Inspect previewStateStore.ts for the exact field names below
  const activeTabId = state.snapshot?.activeTabId ?? null;
  const sessions = state.snapshot?.sessions ?? {};
  const tabs = Object.values(sessions).map((session) => ({
    tabId: session.tabId,
    url: session.navStatus._tag !== "Idle" ? (session.navStatus.url ?? null) : null,
    title: session.navStatus._tag !== "Idle" ? (session.navStatus.title ?? null) : null,
    loading: session.navStatus._tag === "Loading",
    active: session.tabId === activeTabId,
  }));
  return { tabs, activeTabId };
}

case "tabSwitch": {
  const input = request.input as PreviewAutomationTabSwitchInput;
  useRightPanelStore.getState().openBrowser(threadRef, input.tabId);
  // Report the new active tab to the broker so the next request targets it
  await reportCurrentAutomationOwner();
  return await currentStatus(threadRef, visible);
}

case "tabClose": {
  const input = request.input as PreviewAutomationTabCloseInput;
  if (!previewBridge) {
    throw new PreviewAutomationTargetUnavailableError(unavailableTarget);
  }
  await previewBridge.closeTab(input.tabId);
  return null;
}
```

**Important**: Verify the exact property names from `previewStateStore.ts` before writing the `tabList` case. The `sessions`, `activeTabId`, and `navStatus` names are inferred — adjust to match what the store actually provides.

---

## Step 5 — Desktop IPC (hover + select only)

**File**: `apps/desktop/src/ipc/methods/preview.ts`

Tab operations (tabList, tabSwitch, tabClose) are handled entirely in the renderer — no new IPC needed for those.

1. Add two new channel constants wherever the other `PREVIEW_AUTOMATION_*_CHANNEL` strings live:
   ```ts
   PREVIEW_AUTOMATION_HOVER_CHANNEL: "preview:automation:hover",
   PREVIEW_AUTOMATION_SELECT_CHANNEL: "preview:automation:select",
   ```

2. Define payload schemas following the pattern of `DesktopPreviewAutomationClickInputSchema`:
   ```ts
   const DesktopPreviewAutomationHoverInputSchema = Schema.Struct({
     tabId: Schema.String,
     input: PreviewAutomationHoverInput,
   });
   const DesktopPreviewAutomationSelectInputSchema = Schema.Struct({
     tabId: Schema.String,
     input: PreviewAutomationSelectInput,
   });
   ```

3. Add IPC methods:
   ```ts
   export const automationHover = DesktopIpc.makeIpcMethod({
     channel: IpcChannels.PREVIEW_AUTOMATION_HOVER_CHANNEL,
     payload: DesktopPreviewAutomationHoverInputSchema,
     result: Schema.Void,
     handler: Effect.fn("desktop.ipc.preview.automationHover")(function* ({ tabId, input }) {
       const manager = yield* PreviewManager.PreviewManager;
       yield* manager.automationHover(tabId, input);
     }),
   });

   export const automationSelect = DesktopIpc.makeIpcMethod({
     channel: IpcChannels.PREVIEW_AUTOMATION_SELECT_CHANNEL,
     payload: DesktopPreviewAutomationSelectInputSchema,
     result: Schema.Void,
     handler: Effect.fn("desktop.ipc.preview.automationSelect")(function* ({ tabId, input }) {
       const manager = yield* PreviewManager.PreviewManager;
       yield* manager.automationSelect(tabId, input);
     }),
   });
   ```

4. Export both from the IPC catalog (wherever other automation methods are exported).

5. **Expose on the contextBridge preload** — find where `automation.click`, `automation.type`, etc. are added to `window.desktopBridge.preview.automation` and add the two new entries:
   ```ts
   hover: (tabId, input) => ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_HOVER_CHANNEL, { tabId, input }),
   select: (tabId, input) => ipcRenderer.invoke(IpcChannels.PREVIEW_AUTOMATION_SELECT_CHANNEL, { tabId, input }),
   ```

---

## Step 6 — Manager native implementations

**File**: `apps/desktop/src/preview/Manager.ts`

### 6a — Extend `performAutomationClick` for button and clickCount

Locate the two `Input.dispatchMouseEvent` calls in `performAutomationClick` (around line 1990). Replace the hard-coded `button: "left"` and `clickCount: 1`:

```ts
const button = (input as { button?: string }).button ?? "left";
const clickCount = (input as { clickCount?: number }).clickCount ?? 1;

yield* expectAgentInput(tabId, { kind: "pointer", ...point, button: button === "left" ? 0 : button === "right" ? 2 : 1 });

yield* send("Input.dispatchMouseEvent", {
  type: "mousePressed",
  ...point,
  button,
  clickCount,
});
yield* send("Input.dispatchMouseEvent", {
  type: "mouseReleased",
  ...point,
  button,
  clickCount,
});
// For double-click, send a second press+release
if (clickCount === 2) {
  yield* send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...point,
    button,
    clickCount,
  });
  yield* send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...point,
    button,
    clickCount,
  });
}
```

Use the proper typed input: update the `performAutomationClick` parameter type to `PreviewAutomationClickInput` (which already extends with `button` and `clickCount` after Step 1).

### 6b — Add `performAutomationHover` and `automationHover`

Add after `automationClick`:

```ts
const performAutomationHover = Effect.fn("PreviewManager.performAutomationHover")(function* (
  tabId: string,
  input: PreviewAutomationHoverInput,
  send: SendCommand,
) {
  yield* Effect.all(
    [send("Runtime.enable"), send("Input.setIgnoreInputEvents", { ignore: false })],
    { concurrency: 2, discard: true },
  );
  // Reuse the same point-resolution logic as click
  const point = yield* resolveClickPoint(tabId, send, input);
  const viewport = yield* evaluateWithDebugger<{ width: number; height: number }>(
    tabId,
    send,
    "({ width: window.innerWidth, height: window.innerHeight })",
    true,
  );
  if (point.x < 0 || point.y < 0 || point.x > viewport.width || point.y > viewport.height) {
    return yield* new PreviewAutomationCoordinatesOutsideViewportError({
      tabId,
      x: point.x,
      y: point.y,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    });
  }
  // Animate cursor move
  const moveSequence = yield* nextCounter(pointerSequenceRef);
  const moveCreatedAt = yield* currentIso;
  yield* emitPointerEvent({ tabId, phase: "move", ...point, sequence: moveSequence, createdAt: moveCreatedAt });
  yield* Effect.sleep(AGENT_CURSOR_MOVE_MS);
  // Dispatch mouse move to trigger :hover
  yield* send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...point,
    button: "none",
  });
  // Hold for tooltip / hover-menu animation
  const dwellMs = input.dwellMs ?? 300;
  if (dwellMs > 0) yield* Effect.sleep(dwellMs);
  // Do NOT send mousePressed/mouseReleased
});

const automationHover = Effect.fn("PreviewManager.automationHover")(function* (
  tabId: string,
  input: PreviewAutomationHoverInput,
) {
  const wc = yield* requireWebContents(tabId);
  yield* withControlSession(tabId, wc, "hover", (send) =>
    performAutomationHover(tabId, input, send),
  );
});
```

### 6c — Add `performAutomationSelect` and `automationSelect`

Add after `automationHover`:

```ts
const performAutomationSelect = Effect.fn("PreviewManager.performAutomationSelect")(function* (
  tabId: string,
  input: PreviewAutomationSelectInput,
  send: SendCommand,
) {
  yield* send("Runtime.enable");
  const locator = automationLocator(input);
  if (locator) yield* ensurePlaywrightInjected(tabId, send);
  const locatorJson = locator
    ? yield* encodeJson({ operation: "automationSelect.encodeLocator", tabId }, locator)
    : null;

  // Build the selection expression
  let selectionExpr: string;
  if (input.value !== undefined) {
    const valueJson = yield* encodeJson({ operation: "automationSelect.encodeValue", tabId }, input.value);
    selectionExpr = `element.value = ${valueJson}; return { ok: true };`;
  } else if (input.label !== undefined) {
    const labelJson = yield* encodeJson({ operation: "automationSelect.encodeLabel", tabId }, input.label.trim());
    selectionExpr = `
      const opt = Array.from(element.options).find(o => o.text.trim().includes(${labelJson}));
      if (!opt) return { notFound: true };
      element.value = opt.value;
      return { ok: true };
    `;
  } else {
    selectionExpr = `element.selectedIndex = ${input.index!}; return { ok: true };`;
  }

  const result = yield* evaluateWithDebugger<
    { ok: true } | { invalidSelector: true; message: string } | { notFound: true }
  >(
    tabId,
    send,
    `(() => {
      try {
        const element = ${
          locatorJson
            ? `(() => { const injected = globalThis.__t3PlaywrightInjected; return injected.querySelector(injected.parseSelector(${locatorJson}), document, true); })()`
            : "document.activeElement"
        };
        if (!element) return { notFound: true };
        ${selectionExpr}
      } catch (error) {
        return { invalidSelector: true, message: String(error) };
      }
    })()
    // Dispatch events after selection
    .then ? undefined : (() => {
      const element = document.querySelector(...); // already captured above
      element?.dispatchEvent(new Event("input", { bubbles: true }));
      element?.dispatchEvent(new Event("change", { bubbles: true }));
    })()`,
    true,
  );

  // Actually, restructure the evaluate to include event dispatch inside:
  // (The expression above is illustrative — write it as a single IIFE that does
  // element resolution + selection + event dispatch in one call)
```

**Important note**: The `performAutomationSelect` evaluate expression should be structured as a single IIFE that: (1) resolves the element, (2) sets the value, (3) dispatches `input` + `change` events, and returns `{ ok: true }` or an error discriminant. Write it as one clean template string following the style of `performAutomationType`. The pseudo-code above splits it for clarity.

```ts
const automationSelect = Effect.fn("PreviewManager.automationSelect")(function* (
  tabId: string,
  input: PreviewAutomationSelectInput,
) {
  const wc = yield* requireWebContents(tabId);
  yield* withControlSession(tabId, wc, "select", (send) =>
    performAutomationSelect(tabId, input, send),
  );
});
```

Handle the result discriminants the same way `performAutomationScroll` does — check for `{ invalidSelector }` → `PreviewAutomationInvalidSelectorError`, `{ notFound }` → `PreviewAutomationTargetNotFoundError`.

---

## Step 7 — Update PreviewManager service interface and wire-up

**File**: `apps/desktop/src/preview/Manager.ts`

1. In the `PreviewManager` service interface (around line 2650), add:
   ```ts
   readonly automationHover: (
     tabId: string,
     input: PreviewAutomationHoverInput,
   ) => Effect.Effect<void, PreviewManagerError>;
   readonly automationSelect: (
     tabId: string,
     input: PreviewAutomationSelectInput,
   ) => Effect.Effect<void, PreviewManagerError>;
   ```

2. In the `PreviewManager.of({ ... })` call at the bottom of `make`, add:
   ```ts
   automationHover: operations.automationHover,
   automationSelect: operations.automationSelect,
   ```

3. In `makeNativeOperations`, add the two new operations to the returned object (after `automationWaitFor`).

---

## Validation checklist

Run after implementation:
- [ ] `pnpm tsc --noEmit` — no new type errors. The new operation literals in `PreviewAutomationOperation` will surface any switch branches that need updating.
- [ ] `pnpm test` in `apps/server` and `apps/desktop` — no regressions
- [ ] Manual: hover over a tooltip trigger → snapshot shows tooltip visible
- [ ] Manual: `preview_select` by value, label, and index on a `<select>` element
- [ ] Manual: `preview_click` with `{ button: "right" }` → context menu appears
- [ ] Manual: `preview_click` with `{ clickCount: 2 }` → double-click fires
- [ ] Manual: `preview_tab_list` returns entries for all open tabs
- [ ] Manual: `preview_tab_switch` + `preview_snapshot` targets the switched tab
- [ ] Manual: `preview_tab_close` → tab absent from `preview_tab_list`
- [ ] Manual: existing tools (click, type, scroll, snapshot, navigate) unaffected
