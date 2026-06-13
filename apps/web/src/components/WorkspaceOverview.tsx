import { useRouter } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  HistoryIcon,
  LoaderIcon,
  MessageSquarePlusIcon,
  PlusIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useStore } from "../store";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { isElectron } from "../env";
import { APP_BASE_NAME } from "../branding";
import { cn } from "../lib/utils";
import {
  selectActiveWorkThreads,
  selectAttentionItems,
  selectOverviewStats,
  selectRecentThreads,
} from "../workspaceOverviewSelectors";

function useWorkspaceOverview() {
  const stats = useStore(useShallow(selectOverviewStats));
  const attentionItems = useStore(useShallow(selectAttentionItems));
  const activeWorkThreads = useStore(useShallow(selectActiveWorkThreads));
  const recentThreads = useStore(useShallow((state) => selectRecentThreads(state)));

  return { stats, attentionItems, activeWorkThreads, recentThreads };
}

export function WorkspaceOverview() {
  const router = useRouter();
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();
  const { stats, attentionItems, activeWorkThreads, recentThreads } = useWorkspaceOverview();

  const navigateToThread = (environmentId: string, threadId: string) => {
    router.navigate({
      to: "/$environmentId/$threadId",
      params: { environmentId, threadId },
    });
  };

  const handleNewThreadClick = () => {
    if (defaultProjectRef) {
      handleNewThread(defaultProjectRef);
    }
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "border-b border-border px-3 sm:px-5",
            isElectron
              ? "drag-region flex h-[52px] items-center wco:h-[env(titlebar-area-height)]"
              : "py-2 sm:py-3",
          )}
        >
          {isElectron ? (
            <span className="text-xs text-muted-foreground/50 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
              Workspace
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
                Workspace overview
              </span>
            </div>
          )}
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-4xl p-6">
            {/* Hero section */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back to {APP_BASE_NAME}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {stats.activeRuns > 0
                  ? `${stats.activeRuns} active run${stats.activeRuns > 1 ? "s" : ""} across ${stats.totalThreads} thread${stats.totalThreads > 1 ? "s" : ""}`
                  : `${stats.totalThreads} thread${stats.totalThreads > 1 ? "s" : ""} — ${stats.waitingApproval} pending ${stats.waitingApproval === 1 ? "action" : "actions"}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={handleNewThreadClick}>
                  <PlusIcon className="size-4" />
                  New thread
                </Button>
              </div>
            </div>

            {/* Needs attention */}
            {attentionItems.length > 0 && (
              <Section
                title="Needs attention"
                icon={<AlertTriangleIcon className="size-4 text-warning-foreground" />}
              >
                <div className="space-y-1">
                  {attentionItems.slice(0, 5).map((item) => (
                    <OverviewThreadRow
                      key={item.thread.id}
                      thread={item.thread}
                      onClick={() => navigateToThread(item.thread.environmentId, item.thread.id)}
                    >
                      <AttentionBadge reason={item.reason} />
                    </OverviewThreadRow>
                  ))}
                  {attentionItems.length > 5 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      +{attentionItems.length - 5} more
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Active work */}
            {activeWorkThreads.length > 0 && (
              <Section
                title="Active work"
                icon={<LoaderIcon className="size-4 text-info-foreground" />}
              >
                <div className="space-y-1">
                  {activeWorkThreads.slice(0, 5).map((thread) => (
                    <OverviewThreadRow
                      key={thread.id}
                      thread={thread}
                      onClick={() => navigateToThread(thread.environmentId, thread.id)}
                    >
                      <SessionStatusBadge session={thread.session} latestTurn={thread.latestTurn} />
                    </OverviewThreadRow>
                  ))}
                  {activeWorkThreads.length > 5 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      +{activeWorkThreads.length - 5} more
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Today / stats */}
            <Section title="Today" icon={<HistoryIcon className="size-4 text-muted-foreground" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Active runs" value={stats.activeRuns} />
                <StatCard label="Waiting for you" value={stats.waitingApproval} />
                <StatCard label="Updated today" value={stats.threadsUpdatedToday} />
                <StatCard label="Top provider" value={stats.mostUsedProvider ?? "—"} />
              </div>
            </Section>

            {/* Recent threads */}
            {recentThreads.length > 0 && (
              <Section
                title="Recent threads"
                icon={<MessageSquarePlusIcon className="size-4 text-muted-foreground" />}
              >
                <div className="space-y-1">
                  {recentThreads.map((thread) => (
                    <OverviewThreadRow
                      key={thread.id}
                      thread={thread}
                      onClick={() => navigateToThread(thread.environmentId, thread.id)}
                    />
                  ))}
                </div>
              </Section>
            )}
          </div>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}

/* ---------- sub-components ---------- */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function OverviewThreadRow({
  thread,
  onClick,
  children,
}: {
  thread: { title: string; id: string; environmentId: string };
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
    >
      <span className="min-w-0 flex-1 truncate text-foreground">{thread.title}</span>
      {children}
    </button>
  );
}

function AttentionBadge({ reason }: { reason: string }) {
  const labels: Record<string, { label: string; variant: "warning" | "error" | "info" }> = {
    "pending-approval": { label: "Approval", variant: "warning" },
    "pending-user-input": { label: "Input", variant: "info" },
    "actionable-plan": { label: "Plan", variant: "info" },
    error: { label: "Error", variant: "error" },
  };
  const config = labels[reason] ?? { label: reason, variant: "info" as const };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function SessionStatusBadge({
  session,
}: {
  session: { orchestrationStatus: string; status: string } | null;
  latestTurn: { state: string } | null;
}) {
  const isRunning =
    session?.orchestrationStatus === "running" || session?.orchestrationStatus === "starting";

  if (isRunning) return <Badge variant="info">Running</Badge>;
  return null;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
