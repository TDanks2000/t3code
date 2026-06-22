import { CheckIcon, ChevronDownIcon, ImageIcon, PaintbrushIcon, PaletteIcon, FigmaIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { DesignPromptComposer } from "./DesignPromptComposer";
import type {
  DesignContextSource,
  DesignWorkspaceDraft,
  GenerationState,
} from "./designWorkspaceState";

interface DesignContextRailProps {
  workspaceTitle: string;
  contextSources: ReadonlyArray<DesignContextSource>;
  draft: DesignWorkspaceDraft;
  generationState: GenerationState;
  modelLabel: string;
  onOpenContextDialog: (kind: string) => void;
  onDraftChange: (prompt: string) => void;
  onSend: () => void;
  onOpenModelPicker: (() => void) | undefined;
}

const CONTEXT_ACTIONS = [
  { kind: "design-system", label: "Design system", Icon: PaintbrushIcon, color: "bg-[#c47a58]" },
  { kind: "screenshot", label: "Screenshot", Icon: ImageIcon, color: "bg-[#667f55]" },
  { kind: "figma", label: "Figma", Icon: FigmaIcon, color: "bg-[#a45570]" },
] as const;

export function DesignContextRail({
  workspaceTitle,
  contextSources,
  draft,
  generationState,
  modelLabel,
  onOpenContextDialog,
  onDraftChange,
  onSend,
  onOpenModelPicker,
}: DesignContextRailProps) {
  const addedKinds = new Set(contextSources.map((s) => s.kind));
  const isBusy =
    generationState.status === "generating" || generationState.status === "loading-artifact";

  return (
    <aside className="grid h-full w-[19.5rem] min-w-0 grid-rows-[3.5rem_1fr_auto] border-r border-[#e4dfd6] bg-[#f8f5ee]">
      <header className="flex items-center gap-2.5 px-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Open workspace menu"
          className="border-[#d8d0c3] bg-[#fffdfa]"
        >
          <PaletteIcon className="size-4 text-[#c47a58]" />
        </Button>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#191713]"
        >
          {workspaceTitle}
          <ChevronDownIcon className="size-3 text-[#756f65]" />
        </button>
      </header>

      <section className="flex flex-col justify-center px-8 text-center">
        <div className="grid gap-4">
          <div>
            <h1 className="font-serif text-2xl font-normal text-[#191713]">Start with context</h1>
            <p className="mt-1 text-xs text-[#756f65]">
              Designs grounded in real context turn out better.
            </p>
          </div>

          <div className="grid gap-2.5">
            {CONTEXT_ACTIONS.map(({ kind, label, Icon, color }) => {
              const isAdded = addedKinds.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onOpenContextDialog(kind)}
                  className={`flex h-10 items-center gap-2.5 rounded-full border px-3 text-sm text-[#191713] transition-all ${
                    isAdded
                      ? "border-[#c47a58]/30 bg-[#c47a58]/5 shadow-none"
                      : "border-[#ddd6ca] bg-[#fffdfa] shadow-[0_2px_8px_rgba(34,27,18,0.05)] hover:shadow-[0_2px_12px_rgba(34,27,18,0.1)]"
                  }`}
                >
                  <span
                    className={`grid size-6 place-items-center rounded-full text-white transition-colors ${isAdded ? "bg-[#667f55]" : color}`}
                  >
                    {isAdded ? <CheckIcon className="size-3.5" /> : <Icon className="size-3.5" />}
                  </span>
                  <span className="flex-1 text-left">{label}</span>
                  {isAdded && (
                    <span className="text-[10px] text-[#667f55]">added</span>
                  )}
                </button>
              );
            })}
          </div>

          {contextSources.length > 0 && (
            <p className="text-[11px] text-[#9e9587]">
              {contextSources.length === 1
                ? "1 context source added"
                : `${contextSources.length} context sources added`}
              {" — click to update"}
            </p>
          )}
        </div>
      </section>

      <DesignPromptComposer
        value={draft.prompt}
        isGenerating={isBusy}
        modelLabel={modelLabel}
        modelOptionsCount={0}
        onChange={onDraftChange}
        onSend={onSend}
        onAttach={undefined}
        onOpenModelPicker={onOpenModelPicker}
      />
    </aside>
  );
}
