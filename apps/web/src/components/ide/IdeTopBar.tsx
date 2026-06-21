import { CheckIcon, CodeIcon, GitBranchIcon, BotIcon, FolderOpenIcon } from "lucide-react";
import { SidebarTrigger } from "../ui/sidebar";
import { cn } from "~/lib/utils";

interface IdeTopBarProps {
  className?: string;
  fixCopiedLabel?: string | null;
  workspaceLabel?: string | null;
}

export const IdeTopBar = ({ className, fixCopiedLabel, workspaceLabel }: IdeTopBarProps) => {
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-border bg-card/50 px-3 py-2 sm:px-5 sm:py-3 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]",
        className,
      )}
    >
      <SidebarTrigger className="size-7 shrink-0 md:hidden" />
      <div className="flex items-center gap-2">
        <CodeIcon className="size-4 text-muted-foreground/60" />
        <span className="text-sm font-medium text-foreground/90">T3Code IDE</span>
      </div>
      <div className="mx-2 h-4 w-px bg-border/60" />
      <div className="hidden items-center gap-1.5 sm:flex">
        <FolderOpenIcon className="size-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/60">
          {workspaceLabel ?? "Current workspace"}
        </span>
      </div>
      <div className="mx-1.5 hidden h-3 w-px bg-border/40 sm:block" />
      <div className="hidden items-center gap-1.5 md:flex">
        <GitBranchIcon className="size-3.5 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/60">main</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {fixCopiedLabel ? (
          <span className="flex items-center gap-1 text-[11px] text-green-400/80">
            <CheckIcon className="size-3" aria-hidden />
            {fixCopiedLabel}
          </span>
        ) : (
          <>
            <BotIcon className="size-3.5 text-muted-foreground/50" />
            <span className="hidden text-xs text-muted-foreground/60 sm:inline">Agent ready</span>
          </>
        )}
      </div>
    </header>
  );
};
