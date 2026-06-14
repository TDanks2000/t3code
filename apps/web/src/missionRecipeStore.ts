import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { create } from "zustand";
import type { MissionDraftMetadata, MissionRecipeId } from "./missionComposerTypes";

const RECIPE_STORAGE_KEY = "t3code:mission-recipe-state:v1";

function readPersistedRecipeData(): Record<ThreadId, MissionDraftMetadata> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(RECIPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const data: Record<ThreadId, MissionDraftMetadata> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        if (typeof v.threadId === "string" && typeof v.title === "string") {
          const entry: MissionDraftMetadata = {
            threadId: v.threadId as ThreadId,
            draftId: typeof v.draftId === "string" ? v.draftId : (v.threadId as string),
            environmentId: (typeof v.environmentId === "string"
              ? v.environmentId
              : "") as EnvironmentId,
            projectId: (typeof v.projectId === "string" ? v.projectId : "") as ProjectId,
            recipeId: (typeof v.recipeId === "string" ? v.recipeId : "feature") as MissionRecipeId,
            title: v.title as string,
            description: typeof v.description === "string" ? v.description : "",
            generatedPrompt: typeof v.generatedPrompt === "string" ? v.generatedPrompt : "",
            createdFromMissionComposer: v.createdFromMissionComposer === true,
            pendingPromotion: v.pendingPromotion !== false,
            createdAt: typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
            updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date().toISOString(),
          };
          data[key as ThreadId] = entry;
        }
      }
    }
    return data;
  } catch {
    return {};
  }
}

function writePersistedRecipeData(data: Record<ThreadId, MissionDraftMetadata>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors to avoid breaking the UI.
  }
}

let _currentRecipeData = readPersistedRecipeData();

export function getMissionDraftMetadata(threadId: ThreadId): MissionDraftMetadata | undefined {
  return _currentRecipeData[threadId];
}

export function getAllMissionDraftMetadata(): Record<ThreadId, MissionDraftMetadata> {
  return _currentRecipeData;
}

interface MissionRecipeStore {
  recipeData: Record<ThreadId, MissionDraftMetadata>;
  registerMissionDraft: (params: {
    threadId: ThreadId;
    draftId: string;
    environmentId: EnvironmentId;
    projectId: ProjectId;
    recipeId: MissionRecipeId;
    title: string;
    description: string;
    generatedPrompt: string;
  }) => void;
  markMissionPromoted: (threadId: ThreadId) => void;
  removeMissionDraft: (threadId: ThreadId) => void;
}

export const useMissionRecipeStore = create<MissionRecipeStore>((set) => ({
  recipeData: _currentRecipeData,
  registerMissionDraft: ({
    threadId,
    draftId,
    environmentId,
    projectId,
    recipeId,
    title,
    description,
    generatedPrompt,
  }) =>
    set(() => {
      const now = new Date().toISOString();
      const entry: MissionDraftMetadata = {
        threadId,
        draftId,
        environmentId,
        projectId,
        recipeId,
        title,
        description,
        generatedPrompt,
        createdFromMissionComposer: true,
        pendingPromotion: true,
        createdAt: now,
        updatedAt: now,
      };
      _currentRecipeData = { ..._currentRecipeData, [threadId]: entry };
      writePersistedRecipeData(_currentRecipeData);
      return { recipeData: _currentRecipeData };
    }),
  markMissionPromoted: (threadId) =>
    set(() => {
      const existing = _currentRecipeData[threadId];
      if (!existing) return {};
      const updated: MissionDraftMetadata = {
        ...existing,
        pendingPromotion: false,
        updatedAt: new Date().toISOString(),
      };
      _currentRecipeData = { ..._currentRecipeData, [threadId]: updated };
      writePersistedRecipeData(_currentRecipeData);
      return { recipeData: _currentRecipeData };
    }),
  removeMissionDraft: (threadId) =>
    set(() => {
      const { [threadId]: _, ...rest } = _currentRecipeData;
      _currentRecipeData = rest;
      writePersistedRecipeData(_currentRecipeData);
      return { recipeData: _currentRecipeData };
    }),
}));
