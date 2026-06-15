/**
 * Configuration for exponential reconnect backoff.
 */
export interface ReconnectBackoffConfig {
  /** Base delay in milliseconds before the first retry. */
  readonly initialDelayMs: number;
  /** Multiplier applied per retry (exponential factor). */
  readonly backoffFactor: number;
  /** Hard upper bound on delay in milliseconds. */
  readonly maxDelayMs: number;
  /** Maximum number of retries (0-based). `null` means unlimited. */
  readonly maxRetries: number | null;
  /**
   * Jitter factor (0-1) to add randomness to the delay.
   * 0 = no jitter, 0.5 = delay varies by ±50%, 1 = delay varies by ±100%.
   * @default 0.3
   */
  readonly jitterFactor?: number;
}

/**
 * Sensible defaults for WebSocket reconnect backoff.
 *
 * - 1 s initial delay, doubling each retry, capped at 64 s, up to 7 retries.
 */
export const DEFAULT_RECONNECT_BACKOFF: ReconnectBackoffConfig = {
  initialDelayMs: 1_000,
  backoffFactor: 2,
  maxDelayMs: 64_000,
  maxRetries: 7,
};

/**
 * Calculate the reconnect delay for a given retry index using exponential
 * backoff. Returns `null` when `retryIndex` exceeds the configured maximum.
 */
export function getReconnectDelayMs(
  retryIndex: number,
  config: ReconnectBackoffConfig = DEFAULT_RECONNECT_BACKOFF,
): number | null {
  if (!Number.isInteger(retryIndex) || retryIndex < 0) {
    return null;
  }

  if (config.maxRetries !== null && retryIndex >= config.maxRetries) {
    return null;
  }

  const baseDelay = Math.min(
    Math.round(config.initialDelayMs * config.backoffFactor ** retryIndex),
    config.maxDelayMs,
  );

  const jitterFactor = config.jitterFactor ?? 0.3;
  if (jitterFactor > 0) {
    const jitterRange = Math.round(baseDelay * jitterFactor);
    const random =
      typeof crypto !== "undefined" && typeof crypto.getRandomValues !== "undefined"
        ? (crypto.getRandomValues(new Uint32Array(1))[0] as number) / 0xffffffff
        : 0.5;
    return baseDelay + Math.round((random * 2 - 1) * jitterRange);
  }

  return baseDelay;
}
