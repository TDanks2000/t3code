import { type FormEvent, useCallback } from "react";
import { ChevronDownIcon, PaperclipIcon, SendHorizonalIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface DesignPromptComposerProps {
  value: string;
  isGenerating: boolean;
  modelLabel: string;
  modelOptionsCount: number;
  onChange: (value: string) => void;
  onSend: () => void;
  onOpenModelPicker: (() => void) | undefined;
  onAttach: (() => void) | undefined;
}

export function DesignPromptComposer({
  value,
  isGenerating,
  modelLabel,
  onChange,
  onSend,
  onOpenModelPicker,
  onAttach,
}: DesignPromptComposerProps) {
  const handleFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (value.trim() && !isGenerating) {
        onSend();
      }
    },
    [value, isGenerating, onSend],
  );

  return (
    <form
      onSubmit={handleFormSubmit}
      className="mx-2 mb-2 grid grid-rows-[1fr_34px] gap-0 rounded-xl border border-[#d8d0c3] bg-[#fffdfa] p-2.5 shadow-[0_7px_22px_rgba(34,27,18,0.12)]"
    >
      <Textarea
        placeholder="Describe what you want to create..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-sizing-content min-h-10 w-full resize-none border-0 bg-transparent p-0 text-sm text-[#191713] outline-none placeholder:text-[#716a61]"
        unstyled
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !isGenerating) {
              onSend();
            }
          }
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {onAttach && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label="Attach file"
                    onClick={onAttach}
                    className="border-[#e4dfd6] bg-[#fffdfa] text-[#756f65]"
                  />
                }
              >
                <PaperclipIcon className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup>Attach</TooltipPopup>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  aria-label="Tools"
                  className="border-[#e4dfd6] bg-[#fffdfa] text-[#756f65]"
                />
              }
            >
              <span className="text-xs font-medium">/</span>
            </TooltipTrigger>
            <TooltipPopup>Tools</TooltipPopup>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          {onOpenModelPicker && (
            <button
              type="button"
              onClick={onOpenModelPicker}
              className="inline-flex items-center gap-1 text-[11px] text-[#756f65]"
            >
              {modelLabel}
              <ChevronDownIcon className="size-3" />
            </button>
          )}

          <Button
            type="submit"
            size="sm"
            disabled={!value.trim() || isGenerating}
            className={cn(
              "inline-flex items-center gap-1.5 border border-[#b86848] bg-[#c47a58] text-white shadow-[0_2px_6px_rgba(196,122,88,0.32)] hover:bg-[#b86848]",
              isGenerating && "cursor-wait opacity-80",
            )}
          >
            <SendHorizonalIcon className="size-3.5" />
            {isGenerating ? "Generating..." : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
