---
type: executor-prompt
title: Fix wsTransport bugs and enable adapter logging
slug: bugs-and-improvements
created: 2026-06-14
status: ready
target: packages/client-runtime/src/wsTransport.ts, apps/server/src/ws.ts, apps/server/src/provider/Layers/
related:
  - audit.html
---

# Executor Prompt: Fix Transport Bugs and Enable Adapter Logging

Fix the following bugs found during a codebase audit. Each fix is independent and can be done in any order.

## 1. Fix `onResubscribe` double-firing in `subscribe()`

**File:** `packages/client-runtime/src/wsTransport.ts`

**What to do:** The `onResubscribe` callback is called from TWO places during resubscribe:

1. Line ~152 in the `onStreamRequestStart` listener
2. Line ~168 in the retry loop

This causes state-reset logic to fire twice per reconnect. Remove the `onResubscribe()` call from the `onStreamRequestStart` listener (location 1). The retry loop is the canonical place for resubscribe logic.

**Verify:** After the fix, `onResubscribe` should fire exactly once per reconnection attempt.

---

## 2. Fix `intentionalCloseDepth` underflow on concurrent closeSession

**File:** `packages/client-runtime/src/wsTransport.ts`

**What to do:** Replace the shared `intentionalCloseDepth` counter with per-session tracking so concurrent `closeSession()` calls don't corrupt each other's state.

Currently:

```typescript
private intentionalCloseDepth = 0;

private closeSession(session: TransportSession) {
  this.intentionalCloseDepth += 1;
  return session.runtime.runPromise(...).finally(() => {
    this.intentionalCloseDepth = Math.max(0, this.intentionalCloseDepth - 1);
    session.runtime.dispose();
  });
}
```

Replace with a `Set<number>` tracking session IDs that have intentional closes:

```typescript
private intentionalCloseSessionIds = new Set<number>();

private closeSession(session: TransportSession) {
  this.intentionalCloseSessionIds.add(this.activeSessionId);
  return session.runtime.runPromise(...).finally(() => {
    this.intentionalCloseSessionIds.delete(this.activeSessionId);
    session.runtime.dispose();
  });
}
```

Then update `isCloseIntentional` (passed via lifecycleHandlers) to check the Set instead of the depth counter.

**Verify:** Rapid `reconnect()` -> `closeSession()` -> `reconnect()` cycles should not underflow.

---

## 3. Enable logging on silent `Effect.ignoreCause`

**File:** `apps/server/src/ws.ts`

- Line ~560: Change `Effect.ignoreCause({ log: false })` to `Effect.ignoreCause({ log: true })`

**File:** `apps/server/src/textGeneration/CursorTextGeneration.ts`

- Line ~107: Change `Effect.ignore(...)` to `Effect.ignoreCause({ log: true })`

**Files:** `apps/server/src/provider/Layers/CodexAdapter.ts`, `CursorAdapter.ts`, `GrokAdapter.ts`, `OpenCodeAdapter.ts`

- Search for all bare `Effect.ignore(` usages (i.e., without `{ log: true }`) and replace with `Effect.ignoreCause({ log: true })`. These are typically wrapping `Scope.close(...)` calls.

**Verify:** `git grep "Effect\.ignore(" -- apps/server/src/` should show no bare `Effect.ignore` calls (all should have `{ log: true }` or explicit error handling).
