import type { ThreadId } from "@t3tools/contracts";
import { create } from "zustand";

export type MissionReviewStatus = "unreviewed" | "reviewed" | "dismissed";

export interface MissionReviewState {
  threadId: ThreadId;
  status: MissionReviewStatus;
  reviewedAt?: string | undefined;
  dismissedAt?: string | undefined;
  updatedAt: string;
}

const REVIEW_STORAGE_KEY = "t3code:mission-review-state:v1";

function readPersistedReviewStates(): Record<ThreadId, MissionReviewState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const states: Record<ThreadId, MissionReviewState> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        if (typeof v.threadId === "string" && typeof v.status === "string") {
          const state: MissionReviewState = {
            threadId: v.threadId as ThreadId,
            status: v.status as MissionReviewStatus,
            updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
          };
          if (typeof v.reviewedAt === "string") {
            state.reviewedAt = v.reviewedAt;
          }
          if (typeof v.dismissedAt === "string") {
            state.dismissedAt = v.dismissedAt;
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

function writePersistedReviewStates(states: Record<ThreadId, MissionReviewState>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore quota errors to avoid breaking the UI.
  }
}

export function getReviewState(threadId: ThreadId): MissionReviewState | undefined {
  return _currentReviewStates[threadId];
}

export function getAllReviewStates(): Record<ThreadId, MissionReviewState> {
  return _currentReviewStates;
}

let _currentReviewStates = readPersistedReviewStates();

export function setReviewStateForThread(
  threadId: ThreadId,
  state: MissionReviewState,
): Record<ThreadId, MissionReviewState> {
  const nextStates = { ..._currentReviewStates, [threadId]: state };
  _currentReviewStates = nextStates;
  writePersistedReviewStates(nextStates);
  return nextStates;
}

export function clearReviewStateForThread(
  threadId: ThreadId,
): Record<ThreadId, MissionReviewState> {
  const { [threadId]: _, ...rest } = _currentReviewStates;
  _currentReviewStates = rest;
  writePersistedReviewStates(rest);
  return rest;
}

interface ReviewStateStore {
  reviewStates: Record<ThreadId, MissionReviewState>;
  markMissionReviewed: (threadId: ThreadId) => void;
  markMissionUnreviewed: (threadId: ThreadId) => void;
  dismissMissionReview: (threadId: ThreadId) => void;
}

export const useReviewStateStore = create<ReviewStateStore>((set) => ({
  reviewStates: _currentReviewStates,
  markMissionReviewed: (threadId) =>
    set(() => {
      const now = new Date().toISOString();
      const reviewState: MissionReviewState = {
        threadId,
        status: "reviewed",
        reviewedAt: now,
        updatedAt: now,
      };
      return { reviewStates: setReviewStateForThread(threadId, reviewState) };
    }),
  markMissionUnreviewed: (threadId) =>
    set(() => {
      const now = new Date().toISOString();
      const reviewState: MissionReviewState = {
        threadId,
        status: "unreviewed",
        updatedAt: now,
      };
      return { reviewStates: setReviewStateForThread(threadId, reviewState) };
    }),
  dismissMissionReview: (threadId) =>
    set(() => {
      const now = new Date().toISOString();
      const reviewState: MissionReviewState = {
        threadId,
        status: "dismissed",
        dismissedAt: now,
        updatedAt: now,
      };
      return { reviewStates: setReviewStateForThread(threadId, reviewState) };
    }),
}));
