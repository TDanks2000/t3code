import type { EnvironmentApi, EnvironmentId } from "@t3tools/contracts";

import { readPreparedConnection } from "./state/session";

export function createEnvironmentApi(_rpcClient: unknown): EnvironmentApi | undefined {
  return undefined;
}

export function readEnvironmentApi(environmentId: EnvironmentId): EnvironmentApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (!environmentId) {
    return undefined;
  }

  const _connection = readPreparedConnection(environmentId);
  if (!_connection) {
    return undefined;
  }

  return undefined;
}

export function ensureEnvironmentApi(environmentId: EnvironmentId): EnvironmentApi {
  const api = readEnvironmentApi(environmentId);
  if (!api) {
    throw new Error(`Environment API not found for environment ${environmentId}`);
  }
  return api;
}
