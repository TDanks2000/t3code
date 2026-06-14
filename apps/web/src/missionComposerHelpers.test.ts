import { describe, expect, it } from "vite-plus/test";

import {
  getAllRecipes,
  getMissionRecipe,
  getMissionRecipeLabel,
  buildMissionPrompt,
  getMissionPromptQuality,
  decomposeMissionDraft,
} from "./missionComposerHelpers";
import type { MissionDraftForm, MissionRecipeId } from "./missionComposerTypes";

function makeForm(overrides: Partial<MissionDraftForm> = {}): MissionDraftForm {
  return {
    title: "Test mission",
    recipeId: "feature",
    description: "Do something useful",
    requirements: "Must work",
    constraints: "Keep it simple",
    verification: "npm test",
    outOfScope: "No UI changes",
    ...overrides,
  };
}

// ── getAllRecipes ─────────────────────────────────────────────────────

describe("getAllRecipes", () => {
  it("returns all 8 recipes", () => {
    const recipes = getAllRecipes();
    expect(recipes).toHaveLength(8);
  });

  it("includes feature recipe", () => {
    const recipes = getAllRecipes();
    expect(recipes.find((r) => r.id === "feature")).toBeDefined();
  });

  it("includes bug_fix recipe", () => {
    const recipes = getAllRecipes();
    expect(recipes.find((r) => r.id === "bug_fix")).toBeDefined();
  });
});

// ── getMissionRecipe ──────────────────────────────────────────────────

describe("getMissionRecipe", () => {
  it("returns recipe for valid id", () => {
    const recipe = getMissionRecipe("feature");
    expect(recipe).toBeDefined();
    expect(recipe!.label).toBe("Feature");
  });

  it("returns undefined for invalid id", () => {
    const recipe = getMissionRecipe("invalid" as MissionRecipeId);
    expect(recipe).toBeUndefined();
  });
});

// ── getMissionRecipeLabel ─────────────────────────────────────────────

describe("getMissionRecipeLabel", () => {
  it("returns correct label for bug_fix", () => {
    expect(getMissionRecipeLabel("bug_fix")).toBe("Bug Fix");
  });

  it("returns default for unknown recipe", () => {
    expect(getMissionRecipeLabel("invalid" as MissionRecipeId)).toBe("Feature");
  });
});

// ── buildMissionPrompt ────────────────────────────────────────────────

describe("buildMissionPrompt", () => {
  it("includes title heading", () => {
    const prompt = buildMissionPrompt(makeForm({ title: "My Feature" }));
    expect(prompt).toContain("# Mission: My Feature");
  });

  it("includes goal section when description is provided", () => {
    const prompt = buildMissionPrompt(makeForm({ description: "Add a new feature" }));
    expect(prompt).toContain("## Goal");
    expect(prompt).toContain("Add a new feature");
  });

  it("omits goal section when description is empty", () => {
    const prompt = buildMissionPrompt(makeForm({ description: "" }));
    expect(prompt).not.toContain("## Goal");
  });

  it("includes requirements section when provided", () => {
    const prompt = buildMissionPrompt(makeForm({ requirements: "Must be fast\nMust be safe" }));
    expect(prompt).toContain("## Requirements");
    expect(prompt).toContain("- Must be fast");
    expect(prompt).toContain("- Must be safe");
  });

  it("includes constraints section when provided", () => {
    const prompt = buildMissionPrompt(makeForm({ constraints: "No new deps" }));
    expect(prompt).toContain("## Constraints");
    expect(prompt).toContain("- No new deps");
  });

  it("includes verification section when provided", () => {
    const prompt = buildMissionPrompt(makeForm({ verification: "vp check" }));
    expect(prompt).toContain("## Verification");
    expect(prompt).toContain("- vp check");
  });

  it("includes out of scope section when provided", () => {
    const prompt = buildMissionPrompt(makeForm({ outOfScope: "No analytics" }));
    expect(prompt).toContain("## Out of scope");
    expect(prompt).toContain("- No analytics");
  });

  it("includes correct recipe scaffold for bug_fix", () => {
    const prompt = buildMissionPrompt(makeForm({ recipeId: "bug_fix" }));
    expect(prompt).toContain("Recipe: Bug Fix");
    expect(prompt).toContain("- Bug:");
    expect(prompt).toContain("- Expected behavior:");
    expect(prompt).toContain("- Actual behavior:");
  });

  it("includes correct recipe scaffold for refactor", () => {
    const prompt = buildMissionPrompt(makeForm({ recipeId: "refactor" }));
    expect(prompt).toContain("Recipe: Refactor");
    expect(prompt).toContain("- Refactor goal:");
  });

  it("uses untitled fallback when title is empty", () => {
    const prompt = buildMissionPrompt(makeForm({ title: "" }));
    expect(prompt).toContain("# Mission: Untitled mission");
  });
});

// ── getMissionPromptQuality ───────────────────────────────────────────

describe("getMissionPromptQuality", () => {
  it("returns no warnings when all fields are filled", () => {
    const warnings = getMissionPromptQuality(makeForm());
    expect(warnings).toHaveLength(0);
  });

  it("warns when title is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ title: "" }));
    expect(warnings.some((w) => w.field === "title")).toBe(true);
  });

  it("warns when description is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ description: "" }));
    expect(warnings.some((w) => w.field === "description")).toBe(true);
  });

  it("warns when requirements is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ requirements: "" }));
    expect(warnings.some((w) => w.field === "requirements")).toBe(true);
  });

  it("warns when verification is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ verification: "" }));
    expect(warnings.some((w) => w.field === "verification")).toBe(true);
  });

  it("warns when constraints is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ constraints: "" }));
    expect(warnings.some((w) => w.field === "constraints")).toBe(true);
  });

  it("warns when outOfScope is empty", () => {
    const warnings = getMissionPromptQuality(makeForm({ outOfScope: "" }));
    expect(warnings.some((w) => w.field === "outOfScope")).toBe(true);
  });

  it("returns multiple warnings for empty form", () => {
    const warnings = getMissionPromptQuality(
      makeForm({
        title: "",
        description: "",
        requirements: "",
        constraints: "",
        verification: "",
        outOfScope: "",
      }),
    );
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

// ── decomposeMissionDraft ─────────────────────────────────────────────

describe("decomposeMissionDraft", () => {
  it("returns empty array when title and description are empty", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "", description: "" }));
    expect(suggestions).toHaveLength(0);
  });

  it("returns suggestions when title is provided", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "Build dashboard" }));
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it("includes core implementation suggestion", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "Add auth" }));
    const core = suggestions.find((s) => s.title.includes("Core"));
    expect(core).toBeDefined();
    expect(core!.selected).toBe(true);
  });

  it("includes tests suggestion when description is present", () => {
    const suggestions = decomposeMissionDraft(
      makeForm({ title: "Add auth", description: "Add login" }),
    );
    const tests = suggestions.find((s) => s.title.includes("Tests"));
    expect(tests).toBeDefined();
    expect(tests!.selected).toBe(true);
  });

  it("allows editing of suggestion titles", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "Build" }));
    suggestions[0]!.title = "Edited title";
    expect(suggestions[0]!.title).toBe("Edited title");
  });

  it("allows toggling suggestion selection", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "Build" }));
    suggestions[0]!.selected = false;
    expect(suggestions[0]!.selected).toBe(false);
  });

  it("does not exceed 6 suggestions", () => {
    const suggestions = decomposeMissionDraft(
      makeForm({
        title: "Large mission",
        description: "Big project",
        requirements: "Many requirements",
        constraints: "Tight constraints",
      }),
    );
    expect(suggestions.length).toBeLessThanOrEqual(6);
  });

  it("returns unique ids for each suggestion", () => {
    const suggestions = decomposeMissionDraft(makeForm({ title: "Build" }));
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
