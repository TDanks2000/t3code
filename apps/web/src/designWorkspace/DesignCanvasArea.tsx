import { ChevronDownIcon, Share2Icon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { DesignArtifactFrame } from "./DesignArtifactFrame";
import type { DesignArtifact, GenerationState } from "./designWorkspaceState";

interface DesignCanvasAreaProps {
  artifacts: ReadonlyArray<DesignArtifact>;
  selectedArtifact: DesignArtifact | null;
  generationState: GenerationState;
  onSelectArtifact: ((artifactId: string | null) => void) | undefined;
  onOpenInEditor: ((path: string) => void) | undefined;
  onShare: (() => void) | undefined;
}

export function DesignCanvasArea({
  artifacts,
  selectedArtifact,
  generationState,
  onSelectArtifact,
  onOpenInEditor,
  onShare,
}: DesignCanvasAreaProps) {
  const isGenerating = generationState.status === "generating";
  const isLoadingArtifact = generationState.status === "loading-artifact";
  const isBusy = isGenerating || isLoadingArtifact;
  const hasError = generationState.status === "error";

  return (
    <section className="grid min-w-0 flex-1 grid-rows-[3.5rem_1fr] rounded-l-xl bg-[#fbfaf7]">
      <header className="flex items-center justify-between border-b border-[#e4dfd6] bg-[#fffdfa] px-5">
        <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[#191713]">
          {selectedArtifact ? (
            <span className="max-w-[300px] truncate">{selectedArtifact.path}</span>
          ) : (
            <>
              <span className="text-[#756f65]">No file open</span>
              <ChevronDownIcon className="size-3 text-[#756f65]" />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {artifacts.length > 1 && (
            <div className="flex gap-1">
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => onSelectArtifact?.(artifact.id)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    artifact.id === selectedArtifact?.id
                      ? "bg-[#c47a58]"
                      : "bg-[#ddd6ca] hover:bg-[#c4b8a6]"
                  }`}
                  aria-label={`Select ${artifact.path}`}
                />
              ))}
            </div>
          )}

          {onShare && (
            <Button size="sm" className="bg-[#111] text-white hover:bg-[#333]" onClick={onShare}>
              <Share2Icon className="size-3.5" />
              Share
            </Button>
          )}

          <div className="grid size-[30px] place-items-center rounded-full bg-[#e3d9c8] text-sm font-semibold text-[#4f473b]">
            T
          </div>
        </div>
      </header>

      <div
        className="relative overflow-auto"
        style={{
          backgroundImage:
            "linear-gradient(rgba(238,233,223,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(238,233,223,0.5) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          backgroundColor: "#fbfaf7",
        }}
      >
        {/* Busy overlay — shown on top of existing artifact or on empty canvas */}
        {isBusy && !selectedArtifact && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="size-8 animate-spin rounded-full border-2 border-[#e4dfd6] border-t-[#c47a58]" />
              <span className="text-sm text-[#756f65]">
                {isLoadingArtifact ? "Loading artifact…" : "Generating design…"}
              </span>
            </div>
          </div>
        )}

        {/* Busy progress bar when we have an artifact already */}
        {isBusy && selectedArtifact && (
          <div className="absolute inset-x-0 top-0 h-[2px] animate-pulse bg-[#c47a58]/60" />
        )}

        {/* Error state */}
        {hasError && !selectedArtifact && (
          <div className="absolute inset-0 flex items-center justify-center p-10">
            <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <p className="text-sm font-medium text-red-700">Generation failed</p>
              <p className="mt-1 text-xs text-red-500">
                {generationState.status === "error" ? generationState.message : ""}
              </p>
            </div>
          </div>
        )}

        {/* Error banner on top of existing artifact */}
        {hasError && selectedArtifact && (
          <div className="absolute inset-x-0 top-0 bg-red-50 px-4 py-2 text-xs text-red-600 border-b border-red-200">
            {generationState.status === "error" ? generationState.message : ""}
          </div>
        )}

        {/* Artifact frame */}
        {selectedArtifact && (
          <div className="p-8">
            <DesignArtifactFrame artifact={selectedArtifact} onOpenInEditor={onOpenInEditor} />
          </div>
        )}

        {/* Empty idle state */}
        {!selectedArtifact && !isBusy && !hasError && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[#b0a89d]">
              Describe what you want to create and press Send.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
