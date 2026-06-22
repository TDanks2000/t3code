import { type ComponentProps, useRef } from "react";
import { DownloadIcon, ExternalLinkIcon, EyeIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { DesignArtifact } from "./designWorkspaceState";

interface DesignArtifactFrameProps {
  artifact: DesignArtifact;
  onOpenInEditor: ((path: string) => void) | undefined;
}

export function DesignArtifactFrame({ artifact, onOpenInEditor }: DesignArtifactFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleExportHtml = () => {
    const blob = new Blob([artifact.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = artifact.path.split("/").pop() ?? "artifact.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const srcdoc = artifact.html;

  return (
    <div className="grid min-h-[410px] w-full grid-rows-[42px_1fr] rounded-xl border border-[#d7d0c5] bg-white shadow-[0_24px_70px_rgba(34,27,18,0.15)]">
      <header className="flex items-center justify-between border-b border-[#e4dfd6] px-3 text-xs text-[#756f65]">
        <span className="truncate font-medium">{artifact.path}</span>
        <span className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Preview"
                  onClick={() => iframeRef.current?.contentWindow?.focus()}
                />
              }
            >
              <EyeIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>Preview</TooltipPopup>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Export HTML"
                  onClick={handleExportHtml}
                />
              }
            >
              <DownloadIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>Export HTML</TooltipPopup>
          </Tooltip>

          {onOpenInEditor && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Open in editor"
                    onClick={() => onOpenInEditor(artifact.path)}
                  />
                }
              >
                <ExternalLinkIcon className="size-3.5" />
              </TooltipTrigger>
              <TooltipPopup>Open in editor</TooltipPopup>
            </Tooltip>
          )}
        </span>
      </header>

      <div className="relative overflow-hidden rounded-b-xl">
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          title={artifact.title}
          srcDoc={srcdoc}
          className="h-full w-full border-0"
          style={{ minHeight: "368px" }}
        />
      </div>
    </div>
  );
}
