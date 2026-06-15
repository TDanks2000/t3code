import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  getWsConnectionStatus,
  getWsConnectionUiState,
  recordWsConnectionAttempt,
  recordWsConnectionClosed,
  recordWsConnectionErrored,
  recordWsConnectionOpened,
  resetWsConnectionStateForTests,
  setBrowserOnlineStatus,
  WS_RECONNECT_INITIAL_DELAY_MS,
  WS_RECONNECT_MAX_ATTEMPTS,
} from "./wsConnectionState";

// Mirror of the reconnect backoff jitter factor (see reconnectBackoff.ts).
// The scheduled delay is randomized by ±JITTER_FACTOR, so assertions check the
// window rather than an exact value.
const RECONNECT_JITTER_FACTOR = 0.3;

describe("wsConnectionState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T20:30:00.000Z"));
    resetWsConnectionStateForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats a disconnected browser as offline once the websocket drops", () => {
    recordWsConnectionAttempt("ws://localhost:3020/ws");
    recordWsConnectionOpened();
    recordWsConnectionClosed({ code: 1006, reason: "offline" });
    setBrowserOnlineStatus(false);

    expect(getWsConnectionUiState(getWsConnectionStatus())).toBe("offline");
  });

  it("stays in the initial connecting state until the first disconnect", () => {
    recordWsConnectionAttempt("ws://localhost:3020/ws");

    expect(getWsConnectionStatus()).toMatchObject({
      attemptCount: 1,
      hasConnected: false,
      phase: "connecting",
    });
    expect(getWsConnectionUiState(getWsConnectionStatus())).toBe("connecting");
  });

  it("schedules the next retry after a failed websocket attempt", () => {
    recordWsConnectionAttempt("ws://localhost:3020/ws", {
      connectionLabel: "Remote Mac",
    });
    recordWsConnectionErrored("Unable to connect to the T3 server WebSocket.");

    const status = getWsConnectionStatus();
    expect(status).toMatchObject({
      connectionLabel: "Remote Mac",
      reconnectAttemptCount: 1,
      reconnectPhase: "waiting",
    });

    // Time is frozen by fake timers, so the delta is exactly the jittered
    // delay the state machine scheduled. The first retry uses the initial
    // delay, randomized within ±RECONNECT_JITTER_FACTOR.
    expect(status.nextRetryAt).not.toBeNull();
    const scheduledDelayMs = new Date(status.nextRetryAt!).getTime() - Date.now();
    const minDelayMs = Math.round(WS_RECONNECT_INITIAL_DELAY_MS * (1 - RECONNECT_JITTER_FACTOR));
    const maxDelayMs = Math.round(WS_RECONNECT_INITIAL_DELAY_MS * (1 + RECONNECT_JITTER_FACTOR));
    expect(scheduledDelayMs).toBeGreaterThanOrEqual(minDelayMs);
    expect(scheduledDelayMs).toBeLessThanOrEqual(maxDelayMs);
  });

  it("adds a version mismatch hint to websocket errors when metadata includes one", () => {
    recordWsConnectionAttempt("ws://localhost:3020/ws", {
      connectionLabel: "Remote Mac",
    });
    recordWsConnectionErrored("Unable to connect to the T3 server WebSocket.", {
      versionMismatchHint: "Version mismatch. Try syncing the client and server.",
    });

    expect(getWsConnectionStatus()).toMatchObject({
      lastError:
        "Unable to connect to the T3 server WebSocket. Hint: Version mismatch. Try syncing the client and server.",
    });
  });

  it("adds a version mismatch hint to websocket close reasons when metadata includes one", () => {
    recordWsConnectionAttempt("ws://localhost:3020/ws");
    recordWsConnectionOpened();
    recordWsConnectionClosed(
      { code: 1006, reason: "socket closed" },
      {
        versionMismatchHint: "Version mismatch. Try syncing the client and server.",
      },
    );

    expect(getWsConnectionStatus()).toMatchObject({
      closeReason: "socket closed Hint: Version mismatch. Try syncing the client and server.",
    });
  });

  it("marks the reconnect cycle as exhausted after the final attempt fails", () => {
    for (let attempt = 0; attempt < WS_RECONNECT_MAX_ATTEMPTS; attempt += 1) {
      recordWsConnectionAttempt("ws://localhost:3020/ws");
      recordWsConnectionErrored("Unable to connect to the T3 server WebSocket.");
    }

    expect(getWsConnectionStatus()).toMatchObject({
      nextRetryAt: null,
      reconnectAttemptCount: WS_RECONNECT_MAX_ATTEMPTS,
      reconnectPhase: "exhausted",
    });
  });
});
