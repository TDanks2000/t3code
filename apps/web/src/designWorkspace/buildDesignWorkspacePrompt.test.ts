import { describe, it, expect } from "vite-plus/test";
import { buildDesignWorkspacePrompt } from "./buildDesignWorkspacePrompt";

describe("buildDesignWorkspacePrompt", () => {
  it("includes the user prompt and target path", () => {
    const result = buildDesignWorkspacePrompt({
      userPrompt: "Create a landing page",
      contextSources: [],
      targetPath: "design-artifacts/landing.html",
    });
    expect(result).toContain("Create a landing page");
    expect(result).toContain("design-artifacts/landing.html");
    expect(result).toContain("# Design Request");
    expect(result).toContain("# Output Rules");
  });

  it("includes context when provided", () => {
    const result = buildDesignWorkspacePrompt({
      userPrompt: "Build a button component",
      contextSources: [
        { kind: "design-system", label: "Design system", value: "Primary: #c47a58" },
      ],
      targetPath: "design-artifacts/button.html",
    });
    expect(result).toContain("# Context");
    expect(result).toContain("[Design system]");
    expect(result).toContain("Primary: #c47a58");
  });

  it("specifies output rules", () => {
    const result = buildDesignWorkspacePrompt({
      userPrompt: "Test",
      contextSources: [],
      targetPath: "test.html",
    });
    expect(result).toContain("single-file HTML artifact");
    expect(result).toContain("sandboxed iframe");
    expect(result).toContain("ARTIFACT: test.html");
  });
});
