export {
  createInitialDesignWorkspaceState,
  setWorkspaceTitle,
  addContextSource,
  removeContextSource,
  setDraftPrompt,
  setModelSelection,
  addArtifact,
  selectArtifact,
  setGenerationState,
  getSelectedArtifact,
  buildContextSummary,
  type DesignWorkspaceState,
  type DesignContextSource,
  type DesignArtifact,
  type DesignWorkspaceDraft,
  type GenerationState,
} from "./designWorkspaceState";

export {
  buildDesignWorkspacePrompt,
  type BuildDesignPromptInput,
} from "./buildDesignWorkspacePrompt";

export {
  rankCandidateArtifact,
  validateTargetPath,
  deriveTargetPath,
  type PathValidationResult,
} from "./designArtifactDiscovery";

export { DesignWorkspaceShell } from "./DesignWorkspaceShell";
export { DesignContextRail } from "./DesignContextRail";
export { DesignPromptComposer } from "./DesignPromptComposer";
export { DesignCanvasArea } from "./DesignCanvasArea";
export { DesignArtifactFrame } from "./DesignArtifactFrame";
export { renderContextDialog } from "./DesignContextDialogs";
