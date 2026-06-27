import { create } from "zustand";
import type { EnvironmentId, ExecutionEnvironmentDescriptor } from "@t3tools/contracts";

import { readPreparedConnection } from "../state/session";

interface SavedEnvironmentRegistryEntry {
  readonly id: string;
  readonly environmentId: EnvironmentId;
  readonly label: string;
}

interface SavedEnvironmentRegistryStore {
  readonly byId: Record<string, SavedEnvironmentRegistryEntry>;
}

interface SavedEnvironmentRuntimeEntry {
  readonly id: string;
  readonly descriptor: ExecutionEnvironmentDescriptor | null;
}

interface SavedEnvironmentRuntimeStore {
  readonly byId: Record<string, SavedEnvironmentRuntimeEntry>;
}

export const useSavedEnvironmentRegistryStore = create<SavedEnvironmentRegistryStore>(() => ({
  byId: {},
}));

export const useSavedEnvironmentRuntimeStore = create<SavedEnvironmentRuntimeStore>(() => ({
  byId: {},
}));

interface CompatibleConnection {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly client: any;
}

export function readEnvironmentConnection(
  _environmentId: EnvironmentId,
): CompatibleConnection | null {
  return readPreparedConnection(_environmentId) as CompatibleConnection | null;
}

export function resolveEnvironmentHttpUrl(_input: {
  environmentId: EnvironmentId;
  pathname: string;
}): string | null {
  return null;
}
