import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { TerminalIcon } from "lucide-react";
import { workspaceTerminalThreadRef } from "@t3tools/client-runtime/workspaceTerminal";
import type { EnvironmentId } from "@t3tools/contracts";
import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { IdeTerminalPanel } from "../components/ide/IdeTerminalPanel";
import { usePrimaryEnvironmentId } from "../state/environments";
import { useTerminalUiStateStore } from "../terminalUiStateStore";

export interface TerminalRouteSearch {
  environmentId?: string;
  workspaceRoot?: string;
}

function parseTerminalRouteSearch(search: Record<string, unknown>): TerminalRouteSearch {
  const result: TerminalRouteSearch = {};
  if (typeof search.environmentId === "string" && search.environmentId.length > 0) {
    result.environmentId = search.environmentId;
  }
  if (typeof search.workspaceRoot === "string" && search.workspaceRoot.length > 0) {
    result.workspaceRoot = search.workspaceRoot;
  }
  return result;
}

function TerminalRoute() {
  const { environmentId: envIdParam, workspaceRoot } = Route.useSearch();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentId = (envIdParam ?? primaryEnvironmentId) as EnvironmentId | null;

  const contentRef = useRef<HTMLDivElement>(null);
  const setTerminalHeight = useTerminalUiStateStore((s) => s.setTerminalHeight);

  const terminalThreadRef = useMemo(
    () =>
      environmentId && workspaceRoot
        ? workspaceTerminalThreadRef({ environmentId, workspaceRoot })
        : null,
    [environmentId, workspaceRoot],
  );

  useEffect(() => {
    const el = contentRef.current;
    if (!el || !terminalThreadRef) return;
    const observer = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height;
      if (h && h > 0) {
        setTerminalHeight(terminalThreadRef, h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [terminalThreadRef, setTerminalHeight]);

  return (
    <SidebarInset className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card/50 px-3 py-2 sm:px-5 sm:py-3 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
        <div className="flex items-center gap-2">
          <TerminalIcon className="size-4 text-muted-foreground/60" />
          <span className="text-sm font-medium text-foreground/90">Terminal</span>
        </div>
        {workspaceRoot && (
          <>
            <div className="mx-2 h-4 w-px bg-border/60" />
            <span className="hidden truncate text-xs text-muted-foreground/60 sm:inline">
              {workspaceRoot}
            </span>
          </>
        )}
      </header>
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
        <IdeTerminalPanel environmentId={environmentId} workspaceRoot={workspaceRoot ?? null} />
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/terminal")({
  validateSearch: parseTerminalRouteSearch,
  component: TerminalRoute,
});
