import type { ReactNode } from "react";

interface DesignWorkspaceShellProps {
  contextRail: ReactNode;
  canvasArea: ReactNode;
}

export function DesignWorkspaceShell({ contextRail, canvasArea }: DesignWorkspaceShellProps) {
  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl bg-[#fbfaf7] shadow-[0_18px_45px_rgba(34,27,18,0.11)]">
      {contextRail}
      {canvasArea}
    </div>
  );
}
