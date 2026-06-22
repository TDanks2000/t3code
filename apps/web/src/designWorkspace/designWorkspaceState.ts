import type { EnvironmentId, ModelSelection, ThreadId } from "@t3tools/contracts";

export interface DesignContextSource {
  kind: "design-system" | "screenshot" | "figma";
  label: string;
  value: string;
}

export interface DesignArtifact {
  id: string;
  path: string;
  html: string;
  title: string;
  createdAt: string;
  turnId: string;
}

export interface DesignWorkspaceDraft {
  prompt: string;
  attachments: ReadonlyArray<{ name: string; dataUrl: string }>;
}

export type GenerationState =
  | { status: "idle" }
  | { status: "generating" }
  | { status: "loading-artifact" }
  | { status: "error"; message: string };

export interface DesignWorkspaceState {
  workspaceTitle: string;
  threadId: ThreadId | null;
  environmentId: EnvironmentId | null;
  contextSources: ReadonlyArray<DesignContextSource>;
  draft: DesignWorkspaceDraft;
  modelSelection: ModelSelection | null;
  artifacts: ReadonlyArray<DesignArtifact>;
  selectedArtifactId: string | null;
  generationState: GenerationState;
}

export function createInitialDesignWorkspaceState(): DesignWorkspaceState {
  return {
    workspaceTitle: "Untitled",
    threadId: null,
    environmentId: null,
    contextSources: [],
    draft: { prompt: "", attachments: [] },
    modelSelection: null,
    artifacts: [],
    selectedArtifactId: null,
    generationState: { status: "idle" },
  };
}

export function setWorkspaceTitle(
  state: DesignWorkspaceState,
  title: string,
): DesignWorkspaceState {
  return { ...state, workspaceTitle: title };
}

export function addContextSource(
  state: DesignWorkspaceState,
  source: DesignContextSource,
): DesignWorkspaceState {
  const existing = state.contextSources.find((s) => s.kind === source.kind);
  if (existing) {
    return {
      ...state,
      contextSources: state.contextSources.map((s) => (s.kind === source.kind ? source : s)),
    };
  }
  return { ...state, contextSources: [...state.contextSources, source] };
}

export function removeContextSource(
  state: DesignWorkspaceState,
  kind: DesignContextSource["kind"],
): DesignWorkspaceState {
  return {
    ...state,
    contextSources: state.contextSources.filter((s) => s.kind !== kind),
  };
}

export function setDraftPrompt(state: DesignWorkspaceState, prompt: string): DesignWorkspaceState {
  return { ...state, draft: { ...state.draft, prompt } };
}

export function setModelSelection(
  state: DesignWorkspaceState,
  modelSelection: ModelSelection | null,
): DesignWorkspaceState {
  return { ...state, modelSelection };
}

export function addArtifact(
  state: DesignWorkspaceState,
  artifact: DesignArtifact,
): DesignWorkspaceState {
  const existing = state.artifacts.find((a) => a.id === artifact.id);
  if (existing) {
    return {
      ...state,
      artifacts: state.artifacts.map((a) => (a.id === artifact.id ? artifact : a)),
    };
  }
  return { ...state, artifacts: [...state.artifacts, artifact] };
}

export function selectArtifact(
  state: DesignWorkspaceState,
  artifactId: string | null,
): DesignWorkspaceState {
  return { ...state, selectedArtifactId: artifactId };
}

export function setGenerationState(
  state: DesignWorkspaceState,
  generationState: GenerationState,
): DesignWorkspaceState {
  return { ...state, generationState };
}

export function getSelectedArtifact(state: DesignWorkspaceState): DesignArtifact | null {
  if (!state.selectedArtifactId) return null;
  return state.artifacts.find((a) => a.id === state.selectedArtifactId) ?? null;
}

export function buildContextSummary(sources: ReadonlyArray<DesignContextSource>): string {
  if (sources.length === 0) return "";
  return sources.map((s) => `[${s.label}]\n${s.value}`).join("\n\n");
}
