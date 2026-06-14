import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShallow } from "zustand/react/shallow";
import {
  PlusIcon,
  LayoutDashboardIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  ArchiveIcon,
  ClipboardCopyIcon,
  MessageSquareTextIcon,
  PlayIcon,
  XIcon,
  CheckCircleIcon,
  EyeIcon,
  Undo2Icon,
  GripVerticalIcon,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";

let _activeDragId: string | null = null;
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useStore } from "../store";
import {
  selectMissionBoardColumns,
  getColumnMeta,
  selectMissionBoardSummary,
  getMissionMoveResult,
  isMissionManualColumn,
} from "../missionBoardSelectors";
import type {
  MissionBoardAction,
  MissionBoardCard,
  MissionBoardColumnId,
  MissionManualColumnId,
} from "../missionBoardTypes";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useThreadActions } from "../hooks/useThreadActions";
import { formatRelativeTimeLabel } from "../timestampFormat";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { SidebarInset, SidebarTrigger } from "./ui/sidebar";
import { cn } from "../lib/utils";
import { stackedThreadToast, toastManager } from "./ui/toast";
import { useReviewStateStore, getAllReviewStates } from "../reviewStateStore";
import {
  useMissionBoardManualStateStore,
  type SortOrderUpdate,
} from "../missionBoardManualStateStore";
import { useMissionRecipeStore } from "../missionRecipeStore";
import { MissionComposer } from "./MissionComposer";

type FilterMode = "all" | "active" | "needs_human" | "failed" | "needs_review";
const FILTER_OPTIONS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "needs_human", label: "Needs Human" },
  { id: "needs_review", label: "Needs Review" },
  { id: "failed", label: "Failed" },
];

const COLUMN_ORDER: MissionBoardColumnId[] = [
  "backlog",
  "running",
  "needs_human",
  "needs_review",
  "failed",
  "done",
];

const EMPTY_COLUMN_MESSAGES: Record<MissionBoardColumnId, { title: string; description: string }> =
  {
    backlog: {
      title: "Nothing queued",
      description: "Threads with no agent activity yet will appear here.",
    },
    running: {
      title: "Nothing running",
      description: "Active agent sessions will appear here.",
    },
    needs_human: {
      title: "No missions need you",
      description: "Agents will appear here when they need approval, input, or attention.",
    },
    needs_review: {
      title: "Nothing needs review",
      description: "Completed agent work will appear here until you mark it reviewed.",
    },
    failed: {
      title: "No failed missions",
      description: "Agent runs that hit errors will appear here.",
    },
    done: {
      title: "No reviewed missions yet",
      description: "Mark completed missions as reviewed to move them here.",
    },
  };

function ColumnDot({ columnId }: { columnId: MissionBoardColumnId }) {
  const colors: Record<MissionBoardColumnId, string> = {
    backlog: "bg-muted-foreground/40",
    running: "bg-blue-500",
    needs_human: "bg-purple-500",
    needs_review: "bg-amber-500",
    failed: "bg-red-500",
    done: "bg-emerald-500",
  };
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", colors[columnId])} />;
}

function EmptyMissionBoard() {
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();
  const handleNewMission = useCallback(() => {
    if (defaultProjectRef) {
      handleNewThread(defaultProjectRef);
    }
  }, [handleNewThread, defaultProjectRef]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-sm">
        <LayoutDashboardIcon className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">No missions yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground/70">
        Start your first mission to plan a feature, fix a bug, or review a codebase.
      </p>
      <Button size="sm" onClick={handleNewMission}>
        <PlusIcon className="size-4" />
        New mission
      </Button>
    </div>
  );
}

function EmptyColumn({ columnId }: { columnId: MissionBoardColumnId }) {
  const msg = EMPTY_COLUMN_MESSAGES[columnId];
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <span className="text-xs text-muted-foreground/40">{msg.title}</span>
      <p className="max-w-[14rem] text-[11px] leading-relaxed text-muted-foreground/30">
        {msg.description}
      </p>
    </div>
  );
}

const ACTION_ICONS: Record<MissionBoardAction, typeof ExternalLinkIcon> = {
  open: ExternalLinkIcon,
  continue: PlayIcon,
  retry: RefreshCwIcon,
  archive: ArchiveIcon,
  copy_diagnostics: ClipboardCopyIcon,
  respond: MessageSquareTextIcon,
  mark_reviewed: CheckCircleIcon,
  mark_unreviewed: Undo2Icon,
  dismiss: XIcon,
};

const ACTION_LABELS: Record<MissionBoardAction, string> = {
  open: "Open",
  continue: "Continue",
  retry: "Retry",
  archive: "Dismiss",
  copy_diagnostics: "Copy error",
  respond: "Respond",
  mark_reviewed: "Mark reviewed",
  mark_unreviewed: "Mark unreviewed",
  dismiss: "Dismiss",
};

function ReviewSignals({ card }: { card: MissionBoardCard }) {
  const signals: { label: string; passed: boolean }[] = [
    { label: "Agent completed", passed: true },
    { label: "No pending approvals", passed: true },
    { label: "Not reviewed yet", passed: false },
  ];

  if (card.hasNewActivityAfterReview) {
    signals[2] = { label: "New activity after review", passed: false };
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-tight text-muted-foreground/60">
      {signals.map((signal) => (
        <span
          key={signal.label}
          className={cn(
            "inline-flex items-center gap-0.5",
            signal.passed ? "text-emerald-500/70" : "text-amber-500/70",
          )}
        >
          {signal.passed ? "✓" : "!"} {signal.label}
        </span>
      ))}
    </div>
  );
}

function MissionCard({
  card,
  onArchive,
  onMarkReviewed,
  filter,
  isDragOverlay,
}: {
  card: MissionBoardCard;
  onArchive?: ((card: MissionBoardCard) => void) | undefined;
  onMarkReviewed?: ((card: MissionBoardCard) => void) | undefined;
  filter: FilterMode;
  isDragOverlay?: boolean;
}) {
  const navigate = useNavigate();

  const handleOpen = useCallback(() => {
    if (_activeDragId !== null) return;
    if (card.draftId) {
      navigate({
        to: "/draft/$draftId",
        params: { draftId: card.draftId },
      });
    } else {
      navigate({
        to: "/$environmentId/$threadId",
        params: { environmentId: card.environmentId, threadId: card.threadId },
      });
    }
  }, [navigate, card.draftId, card.environmentId, card.threadId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
    },
    [handleOpen],
  );

  const handleAction = useCallback(
    (action: MissionBoardAction, e: React.MouseEvent) => {
      e.stopPropagation();

      if (action === "open" || action === "continue" || action === "respond") {
        if (card.draftId) {
          navigate({
            to: "/draft/$draftId",
            params: { draftId: card.draftId },
          });
        } else {
          navigate({
            to: "/$environmentId/$threadId",
            params: { environmentId: card.environmentId, threadId: card.threadId },
          });
        }
        return;
      }

      if (action === "archive" && onArchive) {
        onArchive(card);
        return;
      }

      if (action === "mark_reviewed" && onMarkReviewed) {
        onMarkReviewed(card);
        return;
      }

      if (action === "mark_unreviewed" && onMarkReviewed) {
        onMarkReviewed(card);
        return;
      }

      if (action === "copy_diagnostics") {
        const errorText = card.errorMessage ?? "No error details available";
        void navigator.clipboard.writeText(
          `Mission: ${card.title}\nError: ${errorText}\nThread: ${card.threadId}`,
        );
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: "Copied",
            description: "Error diagnostics copied to clipboard.",
          }),
        );
        return;
      }
    },
    [navigate, card, onArchive, onMarkReviewed],
  );

  const actionButtons = card.availableActions.filter((a) => a !== "open");

  return (
    <div className="group/card">
      <button
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-label={`Open mission: ${card.title}`}
        className="flex w-full flex-col gap-1.5 rounded-lg border border-border/50 bg-card px-3 py-2.5 text-left text-sm shadow-sm/3 transition-all hover:border-border/80 hover:shadow-sm/8 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground/90">
            {card.title}
          </span>
          {card.isActive && (
            <span className="relative flex size-2 shrink-0 mt-0.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
            </span>
          )}
          <span
            className="inline-flex cursor-grab active:cursor-grabbing rounded-sm p-0.5 text-muted-foreground/30 transition-opacity hover:text-muted-foreground/60 group-hover/card:opacity-50"
            aria-label="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVerticalIcon className="size-3.5" />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/60">
          {card.providerName && (
            <span className="font-medium text-muted-foreground/70">{card.providerName}</span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium",
              card.columnId === "failed" && "bg-red-500/8 text-red-500",
              card.columnId === "running" && "bg-blue-500/8 text-blue-500",
              card.columnId === "needs_human" && "bg-purple-500/8 text-purple-500",
              card.columnId === "needs_review" && "bg-amber-500/8 text-amber-500",
              card.columnId === "done" && "bg-emerald-500/8 text-emerald-500",
              card.columnId === "backlog" && "bg-muted-foreground/8 text-muted-foreground/60",
            )}
          >
            {card.statusLabel}
          </span>
          <span>{formatRelativeTimeLabel(card.lastActivityAt)}</span>
        </div>
        {card.needsHumanReason && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/60">
            {card.needsHumanReason}
          </p>
        )}
        {card.needsReviewReason && (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-amber-500/70">
            {card.needsReviewReason}
          </p>
        )}
        {!card.needsHumanReason && !card.needsReviewReason && card.preview && (
          <p className="line-clamp-1 text-[11px] text-muted-foreground/50">{card.preview}</p>
        )}
        {card.errorMessage && (
          <p className="line-clamp-1 text-[11px] text-red-400/70">{card.errorMessage}</p>
        )}
        {card.columnId === "needs_review" && <ReviewSignals card={card} />}
      </button>
      {actionButtons.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1 px-2 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
          {actionButtons.map((action) => {
            const Icon = ACTION_ICONS[action];
            return (
              <button
                key={action}
                type="button"
                onClick={(e) => handleAction(action, e)}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground/80 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                aria-label={ACTION_LABELS[action]}
              >
                <Icon className="size-3" />
                {ACTION_LABELS[action]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortableMissionCard({
  card,
  onArchive,
  onMarkReviewed,
  filter,
}: {
  card: MissionBoardCard;
  onArchive?: ((card: MissionBoardCard) => void) | undefined;
  onMarkReviewed?: ((card: MissionBoardCard) => void) | undefined;
  filter: FilterMode;
}) {
  const sortable = useSortable({
    id: card.id,
    data: { type: "card", card, columnId: card.columnId },
    disabled: !isMissionManualColumn(card.columnId),
  });

  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <div ref={sortable.setNodeRef} style={style} {...sortable.attributes} {...sortable.listeners}>
      <MissionCard
        card={card}
        onArchive={onArchive}
        onMarkReviewed={onMarkReviewed}
        filter={filter}
      />
    </div>
  );
}

function DroppableColumnWrapper({
  columnId,
  children,
}: {
  columnId: MissionBoardColumnId;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${columnId}`,
    data: { type: "column", columnId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[18rem] shrink-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors",
        isOver && "border-primary/40 bg-primary/[0.02]",
      )}
    >
      {children}
    </div>
  );
}

function MissionBoardColumnView({
  columnId,
  cards,
  onArchive,
  onMarkReviewed,
  filter,
}: {
  columnId: MissionBoardColumnId;
  cards: MissionBoardCard[];
  onArchive?: (card: MissionBoardCard) => void;
  onMarkReviewed?: (card: MissionBoardCard) => void;
  filter: FilterMode;
}) {
  const meta = getColumnMeta(columnId);
  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);

  return (
    <DroppableColumnWrapper columnId={columnId}>
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2.5">
        <ColumnDot columnId={columnId} />
        <span className="text-xs font-semibold text-foreground/80">{meta.label}</span>
        <Badge
          variant="outline"
          size="sm"
          className="ml-auto text-[10px] tabular-nums text-muted-foreground/50"
        >
          {cards.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2 p-2">
            {cards.length > 0 ? (
              cards.map((card) => (
                <SortableMissionCard
                  key={card.id}
                  card={card}
                  onArchive={onArchive}
                  onMarkReviewed={onMarkReviewed}
                  filter={filter}
                />
              ))
            ) : (
              <EmptyColumn columnId={columnId} />
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </DroppableColumnWrapper>
  );
}

function BoardSummaryHeader() {
  const state = useStore();
  const reviewStates = useReviewStateStore((s) => s.reviewStates);
  const summary = selectMissionBoardSummary(state, reviewStates);

  if (summary.total === 0) return null;

  const parts: { label: string; count: number; className: string }[] = [];
  if (summary.running > 0) {
    parts.push({ label: "running", count: summary.running, className: "text-blue-500" });
  }
  if (summary.needsHuman > 0) {
    parts.push({ label: "need human", count: summary.needsHuman, className: "text-purple-500" });
  }
  if (summary.needsReview > 0) {
    parts.push({ label: "need review", count: summary.needsReview, className: "text-amber-500" });
  }
  if (summary.failed > 0) {
    parts.push({ label: "failed", count: summary.failed, className: "text-red-500" });
  }

  const needsReviewCount = summary.needsReview;

  return (
    <span className="text-[11px] text-muted-foreground/60">
      {needsReviewCount > 0 ? (
        <>
          <span className="text-amber-500 font-medium">
            {needsReviewCount} {needsReviewCount === 1 ? "mission" : "missions"} need review
          </span>
          <span className="mx-1.5 text-muted-foreground/30">&middot;</span>
        </>
      ) : null}
      {summary.total} missions
      {parts.map((p) => (
        <span key={p.label} className={cn("ml-3", p.className)}>
          {p.count} {p.label}
        </span>
      ))}
    </span>
  );
}

function FilterBar({
  filter,
  onChange,
}: {
  filter: FilterMode;
  onChange: (f: FilterMode) => void;
}) {
  const state = useStore();
  const reviewStates = useReviewStateStore((s) => s.reviewStates);
  const summary = selectMissionBoardSummary(state, reviewStates);

  const visibleFilters = FILTER_OPTIONS.filter((opt) => {
    if (opt.id === "all") return true;
    if (opt.id === "active") return summary.running > 0 || summary.needsHuman > 0;
    if (opt.id === "needs_human") return summary.needsHuman > 0;
    if (opt.id === "needs_review") return summary.needsReview > 0;
    if (opt.id === "failed") return summary.failed > 0;
    return true;
  });

  if (visibleFilters.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      {visibleFilters.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id === filter ? "all" : opt.id)}
          className={cn(
            "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            filter === opt.id
              ? "bg-accent text-foreground"
              : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-accent/50",
          )}
        >
          {opt.label}
        </button>
      ))}
      {filter !== "all" && (
        <button
          type="button"
          onClick={() => onChange("all")}
          className="ml-1 rounded-md p-1 text-muted-foreground/40 hover:text-foreground/60 hover:bg-accent/50"
          aria-label="Clear filter"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}

export function MissionBoard() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [activeDragCard, setActiveDragCard] = useState<MissionBoardCard | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const state = useStore();
  const reviewStates = useReviewStateStore((s) => s.reviewStates);
  const manualStates = useMissionBoardManualStateStore((s) => s.manualStates);
  const recipeData = useMissionRecipeStore((s) => s.recipeData);
  const setManualSortOrders = useMissionBoardManualStateStore((s) => s.setManualSortOrders);
  const resetMissionBoardOrder = useMissionBoardManualStateStore((s) => s.resetMissionBoardOrder);
  const columns = useMemo(
    () => selectMissionBoardColumns(state, reviewStates, manualStates, recipeData),
    [state, reviewStates, manualStates, recipeData],
  );
  const { handleNewThread, defaultProjectRef } = useHandleNewThread();
  const { archiveThread } = useThreadActions();
  const markMissionReviewed = useReviewStateStore((s) => s.markMissionReviewed);
  const markMissionUnreviewed = useReviewStateStore((s) => s.markMissionUnreviewed);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0);

  const handleOpenComposer = useCallback(() => {
    setComposerOpen(true);
  }, []);

  const handleArchive = useCallback(
    (card: MissionBoardCard) => {
      archiveThread({
        environmentId: card.environmentId,
        threadId: card.threadId,
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Failed to archive thread";
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Archive failed",
            description: message,
          }),
        );
      });
    },
    [archiveThread],
  );

  const handleMarkReviewed = useCallback(
    (card: MissionBoardCard) => {
      if (card.missionReviewStatus === "reviewed") {
        markMissionUnreviewed(card.threadId);
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: "Marked unreviewed",
            description: `"${card.title}" needs review again.`,
          }),
        );
      } else {
        markMissionReviewed(card.threadId);
        toastManager.add(
          stackedThreadToast({
            type: "success",
            title: "Marked reviewed",
            description: `"${card.title}" moved to Done.`,
          }),
        );
      }
    },
    [markMissionReviewed, markMissionUnreviewed],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    _activeDragId = String(event.active.id);
    const data = event.active.data.current;
    if (data?.type === "card" && data.card) {
      setActiveDragCard(data.card as MissionBoardCard);
    }
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // DroppableColumnWrapper handles visual feedback via useDroppable isOver.
    // Full cross-column SortableContext transition is handled in handleDragEnd.
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragCard(null);

      const { active, over } = event;
      if (!over) {
        setTimeout(() => {
          _activeDragId = null;
        }, 0);
        return;
      }

      const activeData = active.data.current;
      if (!activeData || activeData.type !== "card") {
        setTimeout(() => {
          _activeDragId = null;
        }, 0);
        return;
      }

      const activeCard = activeData.card as MissionBoardCard;
      if (!activeCard) {
        setTimeout(() => {
          _activeDragId = null;
        }, 0);
        return;
      }

      const fromColumnId = activeCard.columnId;

      let toColumnId: MissionBoardColumnId | null = null;
      let targetIndex = 0;

      const overData = over.data.current;

      if (overData?.type === "card") {
        const overCard = overData.card as MissionBoardCard;
        toColumnId = overCard.columnId;

        const targetColumn = columns.find((c) => c.id === toColumnId);
        const targetCards = targetColumn?.cards ?? [];
        targetIndex = targetCards.findIndex((c) => c.id === over.id);
        if (targetIndex < 0) targetIndex = targetCards.length;
      } else if (overData?.type === "column") {
        toColumnId = overData.columnId as MissionBoardColumnId;
        targetIndex = 0;
      }

      if (!toColumnId || !fromColumnId) {
        setTimeout(() => {
          _activeDragId = null;
        }, 0);
        return;
      }

      const moveResult = getMissionMoveResult({
        card: activeCard,
        fromColumnId,
        toColumnId,
      });

      if (!moveResult.allowed) {
        toastManager.add(
          stackedThreadToast({
            type: "warning",
            title: "Cannot move mission",
            description: moveResult.reason,
          }),
        );
        setTimeout(() => {
          _activeDragId = null;
        }, 0);
        return;
      }

      if (fromColumnId === toColumnId) {
        const targetColumn = columns.find((c) => c.id === toColumnId);
        const targetCards = targetColumn?.cards ?? [];
        const currentIndex = targetCards.findIndex((c) => c.id === activeCard.id);
        if (currentIndex < 0) {
          setTimeout(() => {
            _activeDragId = null;
          }, 0);
          return;
        }

        if (currentIndex !== targetIndex) {
          const reordered = targetCards.filter((c) => c.id !== activeCard.id);
          reordered.splice(targetIndex, 0, activeCard);
          const updates: SortOrderUpdate[] = reordered.map((c, i) => ({
            threadId: c.threadId,
            sortOrder: i,
          }));
          setManualSortOrders(updates);
        }
      } else if (isMissionManualColumn(fromColumnId) && isMissionManualColumn(toColumnId)) {
        const targetColumn = columns.find((c) => c.id === toColumnId);
        const sourceColumn = columns.find((c) => c.id === fromColumnId);
        const targetCards = targetColumn?.cards ?? [];
        const sourceCards = sourceColumn?.cards ?? [];

        const updates: SortOrderUpdate[] = [];

        // Move the dragged card to the target column
        updates.push({
          threadId: activeCard.threadId,
          sortOrder: targetIndex,
          manualColumnId: toColumnId,
        });

        // Re-index remaining cards in the target column
        const reordered = [...targetCards];
        reordered.splice(targetIndex, 0, activeCard);
        reordered.forEach((c, i) => {
          if (c.id !== activeCard.id) {
            updates.push({
              threadId: c.threadId,
              sortOrder: i,
              manualColumnId: toColumnId,
            });
          }
        });

        // Re-index remaining cards in the source column
        const remainingSource = sourceCards.filter((c) => c.id !== activeCard.id);
        remainingSource.forEach((c, i) => {
          updates.push({
            threadId: c.threadId,
            sortOrder: i,
            manualColumnId: fromColumnId,
          });
        });

        setManualSortOrders(updates);
      }

      setTimeout(() => {
        _activeDragId = null;
      }, 0);
    },
    [columns],
  );

  const hasManualOrder = useMemo(() => {
    return Object.keys(manualStates).length > 0;
  }, [manualStates]);

  const handleResetOrder = useCallback(() => {
    resetMissionBoardOrder();
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: "Order reset",
        description: "Manual board order has been cleared.",
      }),
    );
  }, [resetMissionBoardOrder]);

  if (totalCards === 0) {
    return (
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-5 sm:py-3 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
            <SidebarTrigger className="size-7 shrink-0 md:hidden" />
            <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
              Mission Board
            </span>
          </header>
          <EmptyMissionBoard />
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2 sm:px-5 sm:py-3 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
          <SidebarTrigger className="size-7 shrink-0 md:hidden" />
          <LayoutDashboardIcon className="size-4 text-muted-foreground/60" />
          <span className="text-sm font-medium text-foreground/90">Mission Board</span>
          <div className="ml-2 hidden sm:block">
            <BoardSummaryHeader />
          </div>
          <div className="ml-2 hidden md:block">
            <FilterBar filter={filter} onChange={setFilter} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hasManualOrder && (
              <button
                type="button"
                onClick={handleResetOrder}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground/50 transition-colors hover:text-foreground/70 hover:bg-accent/50"
                aria-label="Reset order"
              >
                Reset order
              </button>
            )}
            <Button size="sm" onClick={handleOpenComposer}>
              <PlusIcon className="size-4" />
              <span className="hidden sm:inline">New mission</span>
            </Button>
          </div>
        </header>

        <div className="px-4 pt-1.5 pb-0 sm:px-5">
          <span className="text-[10px] text-muted-foreground/30">
            Drag idle missions to organize your board. Live agent states move automatically.
          </span>
        </div>

        <MissionComposer
          open={composerOpen}
          onOpenChange={setComposerOpen}
          projectRef={defaultProjectRef}
        />

        <ScrollArea className="flex-1">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-3 p-4 sm:p-5">
              {COLUMN_ORDER.map((columnId) => {
                const column = columns.find((c) => c.id === columnId);
                const cards = column?.cards ?? [];

                const filteredCards =
                  filter === "all"
                    ? cards
                    : cards.filter((c) => {
                        if (filter === "active")
                          return c.columnId === "running" || c.columnId === "needs_human";
                        return c.columnId === filter;
                      });

                return (
                  <MissionBoardColumnView
                    key={columnId}
                    columnId={columnId}
                    cards={filteredCards}
                    onArchive={handleArchive}
                    onMarkReviewed={handleMarkReviewed}
                    filter={filter}
                  />
                );
              })}
            </div>
            <DragOverlay>
              {activeDragCard ? (
                <div className="rotate-2 opacity-90">
                  <MissionCard card={activeDragCard} filter={filter} isDragOverlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
