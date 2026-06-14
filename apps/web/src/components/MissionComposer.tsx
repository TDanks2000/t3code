import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { stackedThreadToast, toastManager } from "./ui/toast";
import {
  getAllRecipes,
  buildMissionPrompt,
  getMissionPromptQuality,
  decomposeMissionDraft,
} from "../missionComposerHelpers";
import type {
  MissionDraftForm,
  MissionRecipeId,
  DecomposedSuggestion,
} from "../missionComposerTypes";
import { useMissionRecipeStore } from "../missionRecipeStore";
import { scopedProjectKey } from "@t3tools/client-runtime";
import { newDraftId, newThreadId } from "../lib/utils";
import { useComposerDraftStore } from "../composerDraftStore";
import type { ScopedProjectRef } from "@t3tools/contracts";

const DEFAULT_FORM: MissionDraftForm = {
  title: "",
  recipeId: "feature",
  description: "",
  requirements: "",
  constraints: "",
  verification: "",
  outOfScope: "",
};

const RECIPES = getAllRecipes();

function PromptQualityWarnings({
  warnings,
  onFocusField,
}: {
  warnings: { field: keyof MissionDraftForm; label: string; message: string }[];
  onFocusField?: ((field: keyof MissionDraftForm) => void) | undefined;
}) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
      <p className="text-[11px] font-medium text-amber-600/80">This mission could be stronger.</p>
      <p className="text-[10px] text-amber-500/60">Missing:</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {warnings.map((w) => (
          <li key={w.field}>
            <button
              type="button"
              onClick={() => onFocusField?.(w.field)}
              className="inline-flex items-center gap-1 rounded-sm bg-amber-500/8 px-1.5 py-0.5 text-[10px] font-medium text-amber-600/70 transition-colors hover:bg-amber-500/15 hover:text-amber-600"
            >
              {w.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DecomposerSection({
  suggestions,
  onToggleSuggestion,
  onUpdateSuggestionTitle,
  onUpdateSuggestionDescription,
}: {
  suggestions: DecomposedSuggestion[];
  onToggleSuggestion: (id: string) => void;
  onUpdateSuggestionTitle: (id: string, title: string) => void;
  onUpdateSuggestionDescription: (id: string, description: string) => void;
}) {
  if (suggestions.length === 0) return null;

  const selectedCount = suggestions.filter((s) => s.selected).length;

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <span className="text-[11px] font-medium text-foreground/70">Break into missions</span>
        {selectedCount > 0 && (
          <span className="text-[10px] text-muted-foreground/50">{selectedCount} selected</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              id={`suggestion-${suggestion.id}`}
              checked={suggestion.selected}
              onChange={() => onToggleSuggestion(suggestion.id)}
              className="mt-1 size-3.5 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-ring"
              aria-label={`Select: ${suggestion.title}`}
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={suggestion.title}
                onChange={(e) => onUpdateSuggestionTitle(suggestion.id, e.target.value)}
                className="w-full bg-transparent text-[12px] font-medium text-foreground/80 outline-none"
                aria-label={`Title for ${suggestion.title}`}
              />
              <textarea
                value={suggestion.description}
                onChange={(e) => onUpdateSuggestionDescription(suggestion.id, e.target.value)}
                className="mt-0.5 w-full resize-none bg-transparent text-[10px] text-muted-foreground/60 outline-none"
                rows={1}
                aria-label={`Description for ${suggestion.title}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MissionComposer({
  open,
  onOpenChange,
  projectRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectRef: ScopedProjectRef | null;
}) {
  const navigate = useNavigate();

  const [form, setForm] = useState<MissionDraftForm>(DEFAULT_FORM);
  const [showDecomposer, setShowDecomposer] = useState(false);
  const [decomposedSuggestions, setDecomposedSuggestions] = useState<DecomposedSuggestion[]>([]);
  const registerMissionDraft = useMissionRecipeStore((s) => s.registerMissionDraft);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setForm(DEFAULT_FORM);
      setShowDecomposer(false);
      setDecomposedSuggestions([]);
    }
  }, [open]);

  const updateField = useCallback(
    <K extends keyof MissionDraftForm>(field: K, value: MissionDraftForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const warnings = useMemo(() => getMissionPromptQuality(form), [form]);

  const warningsByField = useMemo(() => {
    const map: Partial<Record<keyof MissionDraftForm, string>> = {};
    for (const w of warnings) {
      map[w.field] = w.message;
    }
    return map;
  }, [warnings]);

  const scrollFieldIntoView = useCallback((field: keyof MissionDraftForm) => {
    const el = formRef.current?.querySelector(`[data-field="${field}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = el?.querySelector("input, textarea");
    if (input instanceof HTMLElement) {
      input.focus();
    }
  }, []);

  const handleDecompose = useCallback(() => {
    const suggestions = decomposeMissionDraft(form);
    if (suggestions.length === 0) {
      toastManager.add(
        stackedThreadToast({
          type: "info",
          title: "Already small enough",
          description:
            "This mission already looks small enough. Create it as a single mission, or add more detail to split it.",
        }),
      );
      return;
    }
    setDecomposedSuggestions(suggestions);
    setShowDecomposer(true);
  }, [form]);

  const createDraftAndRegister = useCallback(
    async (formToUse: MissionDraftForm, navigateToDraft: boolean): Promise<string | null> => {
      if (!projectRef) {
        toastManager.add(
          stackedThreadToast({
            type: "warning",
            title: "No project available",
            description: "Create a project first.",
          }),
        );
        return null;
      }

      const draftId = newDraftId();
      const threadId = newThreadId();
      const prompt = buildMissionPrompt(formToUse);
      const title = formToUse.title.trim() || "Untitled mission";

      const { setLogicalProjectDraftThreadId, applyStickyState, setPrompt } =
        useComposerDraftStore.getState();

      const createdAt = new Date().toISOString();
      const logicalProjectKey = scopedProjectKey(projectRef);
      setLogicalProjectDraftThreadId(logicalProjectKey, projectRef, draftId, {
        threadId,
        createdAt,
        branch: null,
        worktreePath: null,
        envMode: "local",
      });
      applyStickyState(draftId);

      setPrompt(draftId, prompt);

      registerMissionDraft({
        threadId,
        draftId,
        environmentId: projectRef.environmentId,
        projectId: projectRef.projectId,
        recipeId: formToUse.recipeId,
        title,
        description: formToUse.description,
        generatedPrompt: prompt,
      });

      if (navigateToDraft) {
        await navigate({ to: "/draft/$draftId", params: { draftId } });
      }

      return draftId;
    },
    [projectRef, navigate, registerMissionDraft],
  );

  const handleCreate = useCallback(async () => {
    const result = await createDraftAndRegister(form, false);
    if (result) {
      onOpenChange(false);
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: "Mission created",
          description: `"${form.title.trim() || "Untitled mission"}" added to Backlog.`,
        }),
      );
    }
  }, [createDraftAndRegister, form, onOpenChange]);

  const handleCreateAndOpen = useCallback(async () => {
    const result = await createDraftAndRegister(form, true);
    if (result) {
      onOpenChange(false);
    }
  }, [createDraftAndRegister, form, onOpenChange]);

  const handleCreateFromDecomposition = useCallback(async () => {
    if (!projectRef) return;

    const selected = decomposedSuggestions.filter((s) => s.selected);
    if (selected.length === 0) {
      toastManager.add(
        stackedThreadToast({
          type: "warning",
          title: "No missions selected",
          description: "Select at least one mission to create.",
        }),
      );
      return;
    }

    for (const suggestion of selected) {
      const subForm: MissionDraftForm = {
        ...form,
        title: suggestion.title,
        description: suggestion.description,
      };
      await createDraftAndRegister(subForm, false);
    }

    onOpenChange(false);
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: `Created ${selected.length} ${selected.length === 1 ? "mission" : "missions"}`,
        description: `"${form.title.trim() || "Mission"}" split into ${selected.length} cards.`,
      }),
    );
  }, [createDraftAndRegister, decomposedSuggestions, form, onOpenChange, projectRef]);

  const selectedCount = decomposedSuggestions.filter((s) => s.selected).length;
  const isFormEmpty = !form.title.trim() && !form.description.trim();
  const hasDecomposerItems = showDecomposer && decomposedSuggestions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup showCloseButton className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New Mission</DialogTitle>
          <DialogDescription>Turn an idea into an agent-ready task.</DialogDescription>
        </DialogHeader>

        <DialogPanel>
          <div ref={formRef} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1" data-field="title">
              <label htmlFor="mission-title" className="text-[11px] font-medium text-foreground/70">
                Title
              </label>
              <input
                id="mission-title"
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Add provider health doctor"
                className={cn(
                  "w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                  warningsByField.title ? "border-amber-500/40" : "border-border/60",
                )}
                autoFocus
              />
              {warningsByField.title && (
                <span className="text-[10px] text-amber-500/70">{warningsByField.title}</span>
              )}
            </div>

            {/* Recipe */}
            <div className="flex flex-col gap-1" data-field="recipeId">
              <label
                htmlFor="mission-recipe"
                className="text-[11px] font-medium text-foreground/70"
              >
                Recipe
              </label>
              <select
                id="mission-recipe"
                value={form.recipeId}
                onChange={(e) => updateField("recipeId", e.target.value as MissionRecipeId)}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
              >
                {RECIPES.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.label} — {recipe.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1" data-field="description">
              <label
                htmlFor="mission-description"
                className="text-[11px] font-medium text-foreground/70"
              >
                Description
              </label>
              <textarea
                id="mission-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Rough task idea..."
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                  warningsByField.description ? "border-amber-500/40" : "border-border/60",
                )}
              />
              {warningsByField.description && (
                <span className="text-[10px] text-amber-500/70">{warningsByField.description}</span>
              )}
            </div>

            {/* Requirements */}
            <div className="flex flex-col gap-1" data-field="requirements">
              <label
                htmlFor="mission-requirements"
                className="text-[11px] font-medium text-foreground/70"
              >
                Requirements
              </label>
              <textarea
                id="mission-requirements"
                value={form.requirements}
                onChange={(e) => updateField("requirements", e.target.value)}
                placeholder="One per line..."
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                  warningsByField.requirements ? "border-amber-500/40" : "border-border/60",
                )}
              />
              {warningsByField.requirements && (
                <span className="text-[10px] text-amber-500/70">
                  {warningsByField.requirements}
                </span>
              )}
            </div>

            {/* Constraints & Verification & Out of Scope */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1" data-field="constraints">
                <label
                  htmlFor="mission-constraints"
                  className="text-[11px] font-medium text-foreground/70"
                >
                  Constraints
                </label>
                <textarea
                  id="mission-constraints"
                  value={form.constraints}
                  onChange={(e) => updateField("constraints", e.target.value)}
                  placeholder="One per line..."
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                    warningsByField.constraints ? "border-amber-500/40" : "border-border/60",
                  )}
                />
                {warningsByField.constraints && (
                  <span className="text-[10px] text-amber-500/70">
                    {warningsByField.constraints}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1" data-field="verification">
                <label
                  htmlFor="mission-verification"
                  className="text-[11px] font-medium text-foreground/70"
                >
                  Verification
                </label>
                <textarea
                  id="mission-verification"
                  value={form.verification}
                  onChange={(e) => updateField("verification", e.target.value)}
                  placeholder="e.g. `vp check`"
                  rows={2}
                  className={cn(
                    "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                    warningsByField.verification ? "border-amber-500/40" : "border-border/60",
                  )}
                />
                {warningsByField.verification && (
                  <span className="text-[10px] text-amber-500/70">
                    {warningsByField.verification}
                  </span>
                )}
              </div>
            </div>

            {/* Out of scope */}
            <div className="flex flex-col gap-1" data-field="outOfScope">
              <label
                htmlFor="mission-outofscope"
                className="text-[11px] font-medium text-foreground/70"
              >
                Out of scope
              </label>
              <textarea
                id="mission-outofscope"
                value={form.outOfScope}
                onChange={(e) => updateField("outOfScope", e.target.value)}
                placeholder="What this mission should NOT do..."
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                  warningsByField.outOfScope ? "border-amber-500/40" : "border-border/60",
                )}
              />
              {warningsByField.outOfScope && (
                <span className="text-[10px] text-amber-500/70">{warningsByField.outOfScope}</span>
              )}
            </div>

            {/* Quality warnings */}
            <PromptQualityWarnings warnings={warnings} onFocusField={scrollFieldIntoView} />

            {/* Decomposer */}
            {hasDecomposerItems ? (
              <DecomposerSection
                suggestions={decomposedSuggestions}
                onToggleSuggestion={(id) =>
                  setDecomposedSuggestions((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)),
                  )
                }
                onUpdateSuggestionTitle={(id, title) =>
                  setDecomposedSuggestions((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, title } : s)),
                  )
                }
                onUpdateSuggestionDescription={(id, description) =>
                  setDecomposedSuggestions((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, description } : s)),
                  )
                }
              />
            ) : null}
          </div>
        </DialogPanel>

        <DialogFooter>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {!showDecomposer ? (
                <button
                  type="button"
                  onClick={handleDecompose}
                  disabled={isFormEmpty}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground/70 hover:bg-accent/50 disabled:opacity-30"
                  aria-label="Break down into sub-missions"
                >
                  Break down idea
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {hasDecomposerItems ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCreateFromDecomposition}
                  disabled={selectedCount === 0}
                >
                  Create {selectedCount} {selectedCount === 1 ? "mission" : "missions"}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={handleCreate} disabled={isFormEmpty}>
                Create mission
              </Button>
              <Button size="sm" onClick={handleCreateAndOpen} disabled={isFormEmpty}>
                Create and open
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
