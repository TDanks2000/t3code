import type { ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import type { MissionBoardManualState, MissionManualColumnId } from "./missionBoardTypes";

const MANUAL_STATE_STORAGE_KEY = "t3code:mission-board-state:v1";

function readPersistedManualStates(): Record<ThreadId, MissionBoardManualState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MANUAL_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const states: Record<ThreadId, MissionBoardManualState> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        if (typeof v.threadId === "string") {
          const state: MissionBoardManualState = {
            threadId: v.threadId as ThreadId,
            updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
          };
          if (
            typeof v.manualColumnId === "string" &&
            (v.manualColumnId === "backlog" || v.manualColumnId === "done")
          ) {
            state.manualColumnId = v.manualColumnId as MissionManualColumnId;
          }
          if (typeof v.sortOrder === "number") {
            state.sortOrder = v.sortOrder;
          }
          states[key as ThreadId] = state;
        }
      }
    }
    return states;
  } catch {
    return {};
  }
}

function writePersistedManualStates(states: Record<ThreadId, MissionBoardManualState>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MANUAL_STATE_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore quota errors to avoid breaking the UI.
  }
}

let _currentManualStates = readPersistedManualStates();

export function getMissionBoardManualState(
  threadId: ThreadId,
): MissionBoardManualState | undefined {
  return _currentManualStates[threadId];
}

export function getAllManualStates(): Record<ThreadId, MissionBoardManualState> {
  return _currentManualStates;
}

export function setManualStateForThread(
  threadId: ThreadId,
  state: MissionBoardManualState,
): Record<ThreadId, MissionBoardManualState> {
  const nextStates = { ..._currentManualStates, [threadId]: state };
  _currentManualStates = nextStates;
  writePersistedManualStates(nextStates);
  return nextStates;
}

export function clearManualStateForThread(
  threadId: ThreadId,
): Record<ThreadId, MissionBoardManualState> {
  const { [threadId]: _, ...rest } = _currentManualStates;
  _currentManualStates = rest;
  writePersistedManualStates(rest);
  return rest;
}

export function clearAllManualStates(): Record<ThreadId, MissionBoardManualState> {
  _currentManualStates = {};
  writePersistedManualStates({});
  return {};
}

export function setManualColumnForThread(
  threadId: ThreadId,
  manualColumnId: MissionManualColumnId,
): Record<ThreadId, MissionBoardManualState> {
  const existing = _currentManualStates[threadId];
  const now = new Date().toISOString();
  const state: Record<string, unknown> = {
    threadId,
    manualColumnId,
    updatedAt: now,
  };
  if (existing?.sortOrder !== undefined) {
    state.sortOrder = existing.sortOrder;
  }
  return setManualStateForThread(threadId, state as unknown as MissionBoardManualState);
}

export function setManualSortOrderForThread(
  threadId: ThreadId,
  sortOrder: number,
): Record<ThreadId, MissionBoardManualState> {
  const existing = _currentManualStates[threadId];
  const now = new Date().toISOString();
  const state: Record<string, unknown> = {
    threadId,
    sortOrder,
    updatedAt: now,
  };
  if (existing?.manualColumnId !== undefined) {
    state.manualColumnId = existing.manualColumnId;
  }
  return setManualStateForThread(threadId, state as unknown as MissionBoardManualState);
}

export interface SortOrderUpdate {
  threadId: ThreadId;
  sortOrder: number;
  manualColumnId?: MissionManualColumnId;
}

interface MissionBoardManualStateStore {
  manualStates: Record<ThreadId, MissionBoardManualState>;
  moveMissionCard: (params: {
    threadId: ThreadId;
    fromColumnId: MissionManualColumnId;
    toColumnId: MissionManualColumnId;
    targetIndex: number;
  }) => void;
  setManualSortOrders: (updates: SortOrderUpdate[]) => void;
  resetMissionBoardOrder: (threadId?: ThreadId) => void;
}

export const useMissionBoardManualStateStore = create<MissionBoardManualStateStore>((set) => ({
  manualStates: _currentManualStates,
  moveMissionCard: ({ threadId, toColumnId, targetIndex }) =>
    set(() => {
      const now = new Date().toISOString();
      const state: MissionBoardManualState = {
        threadId,
        manualColumnId: toColumnId,
        sortOrder: targetIndex,
        updatedAt: now,
      };
      return { manualStates: setManualStateForThread(threadId, state) };
    }),
  setManualSortOrders: (updates) =>
    set(() => {
      const next = { ..._currentManualStates };
      const now = new Date().toISOString();
      for (const { threadId, sortOrder, manualColumnId } of updates) {
        const existing = next[threadId];
        const mergedColumnId = manualColumnId ?? existing?.manualColumnId;
        const state: MissionBoardManualState = {
          threadId,
          sortOrder,
          updatedAt: now,
        };
        if (mergedColumnId !== undefined) {
          state.manualColumnId = mergedColumnId;
        }
        next[threadId] = state;
      }
      _currentManualStates = next;
      writePersistedManualStates(next);
      return { manualStates: next };
    }),
  resetMissionBoardOrder: (threadId?: ThreadId) =>
    set(() => {
      if (threadId) {
        return { manualStates: clearManualStateForThread(threadId) };
      }
      return { manualStates: clearAllManualStates() };
    }),
}));
