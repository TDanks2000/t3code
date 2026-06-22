import { describe, it, expect } from "vite-plus/test";
import {
  createInitialDesignWorkspaceState,
  setWorkspaceTitle,
  addContextSource,
  removeContextSource,
  setDraftPrompt,
  addArtifact,
  selectArtifact,
  setGenerationState,
  getSelectedArtifact,
  buildContextSummary,
  type DesignArtifact,
  type DesignContextSource,
} from "./designWorkspaceState";

describe("createInitialDesignWorkspaceState", () => {
  it("creates a default state with Untitled workspace", () => {
    const state = createInitialDesignWorkspaceState();
    expect(state.workspaceTitle).toBe("Untitled");
    expect(state.threadId).toBeNull();
    expect(state.contextSources).toEqual([]);
    expect(state.draft.prompt).toBe("");
    expect(state.generationState.status).toBe("idle");
    expect(state.artifacts).toEqual([]);
  });
});

describe("setWorkspaceTitle", () => {
  it("updates the workspace title", () => {
    const state = createInitialDesignWorkspaceState();
    const next = setWorkspaceTitle(state, "My Design");
    expect(next.workspaceTitle).toBe("My Design");
  });
});

describe("addContextSource", () => {
  it("adds a new context source", () => {
    const state = createInitialDesignWorkspaceState();
    const source: DesignContextSource = {
      kind: "design-system",
      label: "Design system",
      value: "Colors: blue",
    };
    const next = addContextSource(state, source);
    expect(next.contextSources).toHaveLength(1);
    expect(next.contextSources[0]!.kind).toBe("design-system");
  });

  it("replaces an existing source of the same kind", () => {
    const state = createInitialDesignWorkspaceState();
    const source1: DesignContextSource = {
      kind: "figma",
      label: "Figma",
      value: "old",
    };
    const source2: DesignContextSource = {
      kind: "figma",
      label: "Figma",
      value: "new",
    };
    const withOne = addContextSource(state, source1);
    const withTwo = addContextSource(withOne, source2);
    expect(withTwo.contextSources).toHaveLength(1);
    expect(withTwo.contextSources[0]!.value).toBe("new");
  });
});

describe("removeContextSource", () => {
  it("removes a context source by kind", () => {
    const state = createInitialDesignWorkspaceState();
    const source: DesignContextSource = {
      kind: "screenshot",
      label: "Screenshot",
      value: "image notes",
    };
    const withSource = addContextSource(state, source);
    const without = removeContextSource(withSource, "screenshot");
    expect(without.contextSources).toHaveLength(0);
  });
});

describe("setDraftPrompt", () => {
  it("updates the draft prompt", () => {
    const state = createInitialDesignWorkspaceState();
    const next = setDraftPrompt(state, "Create a landing page");
    expect(next.draft.prompt).toBe("Create a landing page");
  });
});

describe("addArtifact", () => {
  const artifact: DesignArtifact = {
    id: "a1",
    path: "design/landing.html",
    html: "<html></html>",
    title: "Landing page",
    createdAt: "2026-01-01T00:00:00Z",
    turnId: "t1",
  };

  it("adds a new artifact", () => {
    const state = createInitialDesignWorkspaceState();
    const next = addArtifact(state, artifact);
    expect(next.artifacts).toHaveLength(1);
    expect(next.artifacts[0]!.id).toBe("a1");
  });

  it("replaces an existing artifact with the same id", () => {
    const state = createInitialDesignWorkspaceState();
    const updated = { ...artifact, path: "design/v2.html" };
    const withFirst = addArtifact(state, artifact);
    const withSecond = addArtifact(withFirst, updated);
    expect(withSecond.artifacts).toHaveLength(1);
    expect(withSecond.artifacts[0]!.path).toBe("design/v2.html");
  });
});

describe("selectArtifact", () => {
  it("sets the selected artifact id", () => {
    const state = createInitialDesignWorkspaceState();
    const next = selectArtifact(state, "a1");
    expect(next.selectedArtifactId).toBe("a1");
  });

  it("clears the selection with null", () => {
    const state = { ...createInitialDesignWorkspaceState(), selectedArtifactId: "a1" };
    const next = selectArtifact(state, null);
    expect(next.selectedArtifactId).toBeNull();
  });
});

describe("setGenerationState", () => {
  it("sets generation state to generating", () => {
    const state = createInitialDesignWorkspaceState();
    const next = setGenerationState(state, { status: "generating" });
    expect(next.generationState.status).toBe("generating");
  });

  it("sets generation state to error", () => {
    const state = createInitialDesignWorkspaceState();
    const next = setGenerationState(state, { status: "error", message: "fail" });
    expect(next.generationState.status).toBe("error");
    if (next.generationState.status === "error") {
      expect(next.generationState.message).toBe("fail");
    }
  });
});

describe("getSelectedArtifact", () => {
  it("returns null when no artifact is selected", () => {
    const state = createInitialDesignWorkspaceState();
    expect(getSelectedArtifact(state)).toBeNull();
  });

  it("returns the selected artifact", () => {
    const artifact: DesignArtifact = {
      id: "a1",
      path: "test.html",
      html: "<html></html>",
      title: "Test",
      createdAt: "2026-01-01T00:00:00Z",
      turnId: "t1",
    };
    const state = selectArtifact(addArtifact(createInitialDesignWorkspaceState(), artifact), "a1");
    expect(getSelectedArtifact(state)?.id).toBe("a1");
  });

  it("returns null when selected id does not match any artifact", () => {
    const state = selectArtifact(createInitialDesignWorkspaceState(), "nonexistent");
    expect(getSelectedArtifact(state)).toBeNull();
  });
});

describe("buildContextSummary", () => {
  it("returns empty string for no sources", () => {
    expect(buildContextSummary([])).toBe("");
  });

  it("builds a summary from context sources", () => {
    const sources: ReadonlyArray<DesignContextSource> = [
      { kind: "design-system", label: "Design system", value: "Colors: blue" },
      { kind: "figma", label: "Figma", value: "https://figma.com/file/abc" },
    ];
    const summary = buildContextSummary(sources);
    expect(summary).toContain("[Design system]");
    expect(summary).toContain("Colors: blue");
    expect(summary).toContain("[Figma]");
    expect(summary).toContain("https://figma.com/file/abc");
  });
});
