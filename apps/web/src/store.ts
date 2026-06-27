import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { create } from "zustand";

export interface EnvironmentState {
  readonly projectIds: ProjectId[];
  readonly projectById: Record<ProjectId, EnvironmentProject>;
  readonly threadIdsByProjectId: Record<ProjectId, ThreadId[]>;
  readonly sidebarThreadSummaryById: Record<ThreadId, EnvironmentThreadShell>;
  readonly threadShellById: Record<ThreadId, EnvironmentThreadShell>;
  readonly bootstrapComplete: boolean;
}

export interface AppState {
  readonly environments: Record<EnvironmentId, EnvironmentState>;
  readonly activeEnvironmentId: EnvironmentId | null;
}

export function selectEnvironmentState(
  state: AppState,
  environmentId: EnvironmentId,
): EnvironmentState {
  const envState = state.environments[environmentId];
  if (!envState) {
    return {
      projectIds: [],
      projectById: {},
      threadIdsByProjectId: {},
      sidebarThreadSummaryById: {},
      threadShellById: {},
      bootstrapComplete: false,
    };
  }
  return envState;
}

type AppAction =
  | { type: "SET_ACTIVE_ENVIRONMENT"; environmentId: EnvironmentId }
  | { type: "REMOVE_ENVIRONMENT"; environmentId: EnvironmentId }
  | { type: "SET_ERROR"; threadId: ThreadId; error: string | null };

interface AppStore extends AppState {
  dispatch: (action: AppAction) => void;
}

const initialState: AppState = {
  environments: {},
  activeEnvironmentId: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_ACTIVE_ENVIRONMENT":
      return { ...state, activeEnvironmentId: action.environmentId };
    case "REMOVE_ENVIRONMENT": {
      const next = { ...state.environments };
      delete next[action.environmentId];
      return { ...state, environments: next };
    }
    case "SET_ERROR":
      return state;
    default:
      return state;
  }
}

export const useStore = create<AppStore>((set) => ({
  ...initialState,
  dispatch: (action: AppAction) => set((state) => appReducer(state, action)),
}));

export function selectProjectsAcrossEnvironments(state: AppState): EnvironmentProject[] {
  return Object.values(state.environments).flatMap((env) => Object.values(env.projectById));
}

export function selectThreadsAcrossEnvironments(state: AppState): ThreadId[] {
  return Object.values(state.environments).flatMap((env) =>
    Object.values(env.threadIdsByProjectId).flat(),
  );
}

export function selectSidebarThreadsAcrossEnvironments(state: AppState): EnvironmentThreadShell[] {
  return Object.values(state.environments).flatMap((env) =>
    Object.values(env.sidebarThreadSummaryById),
  );
}

export function selectThreadShellsAcrossEnvironments(state: AppState): EnvironmentThreadShell[] {
  return Object.values(state.environments).flatMap((env) => Object.values(env.threadShellById));
}

export function setActiveEnvironmentId(state: AppState, environmentId: EnvironmentId): AppState {
  return { ...state, activeEnvironmentId: environmentId };
}

export function removeEnvironmentState(state: AppState, environmentId: EnvironmentId): AppState {
  const next = { ...state.environments };
  delete next[environmentId];
  return { ...state, environments: next };
}

export function setError(state: AppState, _threadId: ThreadId, _error: string | null): AppState {
  return state;
}
