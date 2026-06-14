import type { DraftId } from "./composerDraftStore";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";

export type MissionRecipeId =
  | "feature"
  | "bug_fix"
  | "refactor"
  | "ui_polish"
  | "add_tests"
  | "code_review"
  | "docs"
  | "investigation";

export interface MissionRecipe {
  id: MissionRecipeId;
  label: string;
  description: string;
}

export interface MissionDraftForm {
  title: string;
  recipeId: MissionRecipeId;
  description: string;
  requirements: string;
  constraints: string;
  verification: string;
  outOfScope: string;
}

export interface MissionDraftMetadata {
  threadId: ThreadId;
  draftId: string;
  environmentId: EnvironmentId;
  projectId: ProjectId;
  recipeId: MissionRecipeId;
  title: string;
  description: string;
  generatedPrompt: string;
  createdFromMissionComposer: boolean;
  pendingPromotion: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DecomposedSuggestion {
  id: string;
  title: string;
  description: string;
  selected: boolean;
}
