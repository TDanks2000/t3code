import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_RECONNECT_BACKOFF,
  getReconnectDelayMs,
  type ReconnectBackoffConfig,
} from "./reconnectBackoff.ts";

// Most assertions pin `jitterFactor: 0` so the deterministic exponential /
// cap / null math can be checked exactly; jitter itself is covered separately.
const NO_JITTER: ReconnectBackoffConfig = { ...DEFAULT_RECONNECT_BACKOFF, jitterFactor: 0 };

describe("getReconnectDelayMs", () => {
  it("returns exponential base delays without jitter", () => {
    expect(getReconnectDelayMs(0, NO_JITTER)).toBe(1_000);
    expect(getReconnectDelayMs(1, NO_JITTER)).toBe(2_000);
    expect(getReconnectDelayMs(2, NO_JITTER)).toBe(4_000);
    expect(getReconnectDelayMs(3, NO_JITTER)).toBe(8_000);
    expect(getReconnectDelayMs(4, NO_JITTER)).toBe(16_000);
    expect(getReconnectDelayMs(5, NO_JITTER)).toBe(32_000);
    expect(getReconnectDelayMs(6, NO_JITTER)).toBe(64_000);
  });

  it("applies jitter within the configured factor by default", () => {
    const jitterFactor = DEFAULT_RECONNECT_BACKOFF.jitterFactor ?? 0.3;
    const baseDelay = 1_000;
    const minDelay = Math.round(baseDelay * (1 - jitterFactor));
    const maxDelay = Math.round(baseDelay * (1 + jitterFactor));
    for (let sample = 0; sample < 50; sample += 1) {
      const delay = getReconnectDelayMs(0);
      expect(delay).not.toBeNull();
      expect(delay!).toBeGreaterThanOrEqual(minDelay);
      expect(delay!).toBeLessThanOrEqual(maxDelay);
    }
  });

  it("returns null when retry index exceeds maxRetries", () => {
    expect(getReconnectDelayMs(7)).toBeNull();
    expect(getReconnectDelayMs(100)).toBeNull();
  });

  it("returns null for negative indices", () => {
    expect(getReconnectDelayMs(-1)).toBeNull();
  });

  it("returns null for non-integer indices", () => {
    expect(getReconnectDelayMs(1.5)).toBeNull();
  });

  it("caps delay at maxDelayMs", () => {
    const config: ReconnectBackoffConfig = {
      initialDelayMs: 10_000,
      backoffFactor: 10,
      maxDelayMs: 30_000,
      maxRetries: 5,
      jitterFactor: 0,
    };

    expect(getReconnectDelayMs(0, config)).toBe(10_000);
    expect(getReconnectDelayMs(1, config)).toBe(30_000); // 100_000 capped to 30_000
    expect(getReconnectDelayMs(2, config)).toBe(30_000); // 1_000_000 capped to 30_000
  });

  it("supports unlimited retries when maxRetries is null", () => {
    const config: ReconnectBackoffConfig = {
      ...DEFAULT_RECONNECT_BACKOFF,
      maxRetries: null,
      jitterFactor: 0,
    };

    expect(getReconnectDelayMs(0, config)).toBe(1_000);
    expect(getReconnectDelayMs(50, config)).toBe(64_000); // capped at maxDelayMs
    expect(getReconnectDelayMs(100, config)).toBe(64_000);
  });
});

describe("DEFAULT_RECONNECT_BACKOFF", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_RECONNECT_BACKOFF.initialDelayMs).toBe(1_000);
    expect(DEFAULT_RECONNECT_BACKOFF.backoffFactor).toBe(2);
    expect(DEFAULT_RECONNECT_BACKOFF.maxDelayMs).toBe(64_000);
    expect(DEFAULT_RECONNECT_BACKOFF.maxRetries).toBe(7);
  });
});
