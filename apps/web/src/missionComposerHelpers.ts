import type {
  MissionDraftForm,
  MissionRecipe,
  MissionRecipeId,
  DecomposedSuggestion,
} from "./missionComposerTypes";

const RECIPES: MissionRecipe[] = [
  { id: "feature", label: "Feature", description: "Add a new capability" },
  { id: "bug_fix", label: "Bug Fix", description: "Resolve an issue or regression" },
  {
    id: "refactor",
    label: "Refactor",
    description: "Improve code structure without changing behavior",
  },
  { id: "ui_polish", label: "UI Polish", description: "Improve visual design or UX" },
  { id: "add_tests", label: "Add Tests", description: "Add or expand test coverage" },
  { id: "code_review", label: "Code Review", description: "Review existing code for issues" },
  { id: "docs", label: "Docs", description: "Write or update documentation" },
  { id: "investigation", label: "Investigation", description: "Research or explore a problem" },
];

export function getAllRecipes(): MissionRecipe[] {
  return RECIPES;
}

export function getMissionRecipe(recipeId: MissionRecipeId): MissionRecipe | undefined {
  return RECIPES.find((r) => r.id === recipeId);
}

export function getMissionRecipeLabel(recipeId: MissionRecipeId): string {
  return getMissionRecipe(recipeId)?.label ?? "Feature";
}

function getRecipeScaffoldInstructions(recipeId: MissionRecipeId): string[] {
  switch (recipeId) {
    case "bug_fix":
      return [
        "Bug:",
        "Expected behavior:",
        "Actual behavior:",
        "Likely area/files:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "feature":
      return [
        "Feature:",
        "User outcome:",
        "Requirements:",
        "Existing patterns to inspect:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "refactor":
      return [
        "Refactor goal:",
        "Why it is needed:",
        "Files/areas to inspect:",
        "Constraints:",
        "Compatibility requirements:",
        "Verification:",
        "Out of scope:",
      ];
    case "ui_polish":
      return [
        "UI problem:",
        "Desired experience:",
        "Existing components/patterns to reuse:",
        "Responsive/accessibility requirements:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "add_tests":
      return [
        "What to test:",
        "Why these tests matter:",
        "Files/areas to cover:",
        "Testing approach:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "code_review":
      return [
        "What to review:",
        "Review focus areas:",
        "Files to inspect:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "docs":
      return [
        "What to document:",
        "Target audience:",
        "Files/areas to cover:",
        "Constraints:",
        "Verification:",
        "Out of scope:",
      ];
    case "investigation":
      return [
        "What to investigate:",
        "Why it matters:",
        "Areas to explore:",
        "Constraints:",
        "Expected output:",
        "Verification:",
        "Out of scope:",
      ];
  }
}

export function buildMissionPrompt(form: MissionDraftForm): string {
  const recipe = getMissionRecipe(form.recipeId);
  const sections: string[] = [];

  sections.push(`# Mission: ${form.title.trim() || "Untitled mission"}`);

  if (form.description.trim()) {
    sections.push("");
    sections.push("## Goal");
    sections.push(form.description.trim());
  }

  if (form.requirements.trim()) {
    sections.push("");
    sections.push("## Requirements");
    form.requirements
      .trim()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        sections.push(`- ${line}`);
      });
  }

  if (form.constraints.trim()) {
    sections.push("");
    sections.push("## Constraints");
    form.constraints
      .trim()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        sections.push(`- ${line}`);
      });
  }

  if (form.verification.trim()) {
    sections.push("");
    sections.push("## Verification");
    form.verification
      .trim()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        sections.push(`- ${line}`);
      });
  }

  if (form.outOfScope.trim()) {
    sections.push("");
    sections.push("## Out of scope");
    form.outOfScope
      .trim()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        sections.push(`- ${line}`);
      });
  }

  if (recipe) {
    sections.push("");
    sections.push("---");
    sections.push(`Recipe: ${recipe.label}`);
    sections.push("");
    sections.push("Scaffold instructions:");
    getRecipeScaffoldInstructions(form.recipeId).forEach((instruction) => {
      sections.push(`- ${instruction}`);
    });
  }

  return sections.join("\n");
}

export interface PromptQualityWarning {
  field: keyof MissionDraftForm;
  label: string;
  message: string;
}

export function getMissionPromptQuality(form: MissionDraftForm): PromptQualityWarning[] {
  const warnings: PromptQualityWarning[] = [];

  if (!form.title.trim()) {
    warnings.push({
      field: "title",
      label: "Title",
      message: "Add a clear mission title.",
    });
  }

  if (!form.description.trim()) {
    warnings.push({
      field: "description",
      label: "Description",
      message: "Describe what this mission should achieve.",
    });
  }

  if (!form.requirements.trim()) {
    warnings.push({
      field: "requirements",
      label: "Requirements",
      message: "List specific requirements or acceptance criteria.",
    });
  }

  if (!form.verification.trim()) {
    warnings.push({
      field: "verification",
      label: "Verification",
      message: "Add a verification command to confirm the mission is done.",
    });
  }

  if (!form.constraints.trim()) {
    warnings.push({
      field: "constraints",
      label: "Constraints",
      message: "Add constraints or guardrails for the agent.",
    });
  }

  if (!form.outOfScope.trim()) {
    warnings.push({
      field: "outOfScope",
      label: "Out of scope",
      message: "Define what the mission should NOT do.",
    });
  }

  return warnings;
}

export function decomposeMissionDraft(form: MissionDraftForm): DecomposedSuggestion[] {
  const title = form.title.trim();
  const description = form.description.trim();

  if (!title && !description) {
    return [];
  }

  const suggestions: DecomposedSuggestion[] = [];
  const recipe = getMissionRecipe(form.recipeId);

  let idCounter = 0;
  const nextId = () => `decomposed-${++idCounter}`;

  const prefix = title || "Mission";

  suggestions.push({
    id: nextId(),
    title: `${prefix} — Core implementation`,
    description: `Implement the main logic for ${prefix.toLowerCase()}.`,
    selected: true,
  });

  if (description || form.requirements.trim()) {
    suggestions.push({
      id: nextId(),
      title: `${prefix} — Tests`,
      description: `Add tests for ${prefix.toLowerCase()}.`,
      selected: true,
    });
  }

  suggestions.push({
    id: nextId(),
    title: `${prefix} — Error handling & edge cases`,
    description: `Handle error states and edge cases for ${prefix.toLowerCase()}.`,
    selected: true,
  });

  if (form.constraints.trim()) {
    suggestions.push({
      id: nextId(),
      title: `${prefix} — Constraint compliance`,
      description: `Ensure ${prefix.toLowerCase()} satisfies constraints.`,
      selected: false,
    });
  }

  if (recipe?.id === "ui_polish" || recipe?.id === "feature") {
    suggestions.push({
      id: nextId(),
      title: `${prefix} — Accessibility pass`,
      description: `Audit and fix accessibility for ${prefix.toLowerCase()}.`,
      selected: false,
    });
  }

  if (suggestions.length > 6) {
    return suggestions.slice(0, 6);
  }

  return suggestions;
}
