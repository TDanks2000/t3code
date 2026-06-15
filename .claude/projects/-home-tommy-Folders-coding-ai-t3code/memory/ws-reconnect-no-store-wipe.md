---
name: ws-reconnect-no-store-wipe
description: Web WS reconnect must NOT wipe the zustand store; the shell snapshot is an authoritative full replacement
metadata:
  type: project
---

On WebSocket session-level reconnect, the web client (`apps/web/src/rpc/wsTransport.ts` `onBeforeReconnect`) must NOT call a store-reset. It previously called `resetStore()`, which synchronously wiped all projects/threads and caused the "projects disappear on reconnect and sometimes don't come back" bug (2026-06).

**Why:** The shell snapshot delivered over the new session (`syncEnvironmentShellSnapshot` in `apps/web/src/store.ts`) already does an authoritative full replacement — it rebuilds `projectIds`/`projectById` and the thread indices from the snapshot and drops anything no longer present. Clearing the store up front only creates an empty window; if the snapshot is delayed or lost (overlapping reconnects), the UI stays empty.

**How to apply:** Keep `clearAllTrackedRpcRequests()` (transport-level) on reconnect, but let the incoming snapshot reconcile state — never pre-clear. The standalone `resetStore()` export was removed; only the (currently unused) store action remains.

Related: the shared `WsTransport` (`packages/client-runtime/src/wsTransport.ts`) escalation now awaits `this.reconnect()` before resetting failure counters, to avoid overlapping reconnects. Reconnect backoff has jitter (`reconnectBackoff.ts`, default `jitterFactor: 0.3`) so timing-sensitive tests must assert windows, not exact delays.
