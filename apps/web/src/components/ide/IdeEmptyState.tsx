import { FolderOpenIcon, MonitorIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useSavedEnvironmentRegistryStore } from "../../environments/runtime/catalog";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import type { EnvironmentId } from "@t3tools/contracts";

interface IdeEmptyStateProps {
  onSelectEnvironment: (environmentId: EnvironmentId) => void;
}

export function IdeEmptyState({ onSelectEnvironment }: IdeEmptyStateProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelect = useCallback(
    (environmentId: EnvironmentId) => {
      setDialogOpen(false);
      onSelectEnvironment(environmentId);
    },
    [onSelectEnvironment],
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-8">
      <div className="flex size-14 items-center justify-center rounded-xl border border-border/50 bg-card shadow-xs">
        <FolderOpenIcon className="size-6 text-muted-foreground/40" />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-base font-medium text-foreground/50">No workspace open</p>
        <p className="max-w-[20rem] text-[12px] leading-relaxed text-muted-foreground/40">
          Choose a workspace to browse and edit files in the built-in IDE.
        </p>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger render={<Button variant="default" size="sm" />}>
          Choose workspace
        </DialogTrigger>
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose a workspace</DialogTitle>
          </DialogHeader>
          <DialogPanel className="space-y-1 px-2 pb-2">
            <WorkspaceList onSelect={handleSelect} />
          </DialogPanel>
          <DialogFooter variant="bare">
            <DialogClose render={<Button variant="ghost" size="sm" />}>Cancel</DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

function WorkspaceList({ onSelect }: { onSelect: (environmentId: EnvironmentId) => void }) {
  const environments = useSavedEnvironmentRegistryStore((s) =>
    Object.values(s.byId).toSorted((a, b) => a.label.localeCompare(b.label)),
  );

  if (environments.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[11px] text-muted-foreground/40">
        No environments configured. Add one in Settings.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {environments.map((env) => (
        <button
          key={env.environmentId}
          type="button"
          onClick={() => onSelect(env.environmentId)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <MonitorIcon className="size-4 shrink-0 text-muted-foreground/50" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-foreground/80">{env.label}</p>
            <p className="truncate text-[11px] text-muted-foreground/40">{env.environmentId}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
