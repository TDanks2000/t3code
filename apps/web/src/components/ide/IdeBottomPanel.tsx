import { useCallback, type ComponentType, type KeyboardEvent } from "react";
import { TerminalIcon, TriangleAlertIcon, FlaskConicalIcon, GitBranchIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { IdeProblemsPanel } from "./IdeProblemsPanel";
import { IdeGitPanel } from "./IdeGitPanel";
import type { DiagnosticRunKind, EnvironmentId } from "@t3tools/contracts";
import type { IdeProblem, IdeMissionEvidenceItem } from "./ide-types";
import type { DiagnosticsRunState } from "./IdeShell";

export type IdeBottomTab = "terminal" | "problems" | "tests" | "git";

interface IdeBottomPanelProps {
  activeTab: IdeBottomTab;
  onTabChange: (tab: IdeBottomTab) => void;
  problems?: ReadonlyArray<IdeProblem>;
  diagnosticsState?: DiagnosticsRunState;
  onRunDiagnostics?: (kind: DiagnosticRunKind) => void;
  onClearProblems?: () => void;
  onOpenProblemLocation?: (problem: IdeProblem) => void;
  onAskAgentToFix?: (problem: IdeProblem) => void;
  onAskAgentToFixAll?: () => void;
  environmentId?: EnvironmentId | null;
  workspaceRoot?: string | null;
  evidenceItems?: ReadonlyArray<IdeMissionEvidenceItem>;
  onAddEvidence?: (item: IdeMissionEvidenceItem) => void;
  onOpenFile?: (path: string) => void;
  className?: string;
}

interface TabDefinition {
  id: IdeBottomTab;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  placeholder: string;
}

const TABS: Array<TabDefinition> = [
  {
    id: "terminal",
    label: "Terminal",
    Icon: TerminalIcon,
    placeholder: "Terminal output will appear here.",
  },
  {
    id: "problems",
    label: "Problems",
    Icon: TriangleAlertIcon,
    placeholder: "Problems from TypeScript, lint, and tests will appear here.",
  },
  {
    id: "tests",
    label: "Tests",
    Icon: FlaskConicalIcon,
    placeholder: "Test runs will appear here.",
  },
  {
    id: "git",
    label: "Git",
    Icon: GitBranchIcon,
    placeholder: "",
  },
];

const PANEL_ID = "ide-bottom-tabpanel";

export const IdeBottomPanel = ({
  activeTab,
  onTabChange,
  problems,
  diagnosticsState,
  onRunDiagnostics,
  onClearProblems,
  onOpenProblemLocation,
  onAskAgentToFix,
  onAskAgentToFixAll,
  environmentId,
  workspaceRoot,
  evidenceItems,
  onAddEvidence,
  onOpenFile,
  className,
}: IdeBottomPanelProps) => {
  const activeTabDef = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentIndex = TABS.findIndex((t) => t.id === activeTab);
      if (currentIndex === -1) return;

      let nextIndex: number | undefined;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (currentIndex + 1) % TABS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = TABS.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextTab = TABS[nextIndex];
      if (nextTab) onTabChange(nextTab.id);
    },
    [activeTab, onTabChange],
  );

  return (
    <div
      role="region"
      aria-label="Bottom Panel"
      className={cn("flex h-40 shrink-0 flex-col border-t border-border bg-card/10", className)}
    >
      <div
        role="tablist"
        aria-label="Panel tabs"
        onKeyDown={handleKeyDown}
        className="flex h-8 shrink-0 items-center gap-0 border-b border-border/50 bg-card/30 px-1"
      >
        {TABS.map((tab) => (
          <BottomTabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            panelId={PANEL_ID}
            onSelect={onTabChange}
          />
        ))}
      </div>
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-label={activeTabDef?.label}
        tabIndex={0}
        className="flex min-h-0 flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {activeTab === "problems" ? (
          <IdeProblemsPanel
            problems={problems ?? []}
            diagnosticsState={diagnosticsState}
            onRunDiagnostics={onRunDiagnostics}
            onClearProblems={onClearProblems}
            onOpenProblemLocation={onOpenProblemLocation}
            onAskAgentToFix={onAskAgentToFix}
            onAskAgentToFixAll={onAskAgentToFixAll}
            className="flex-1"
          />
        ) : activeTab === "git" ? (
          <IdeGitPanel
            environmentId={environmentId ?? null}
            workspaceRoot={workspaceRoot ?? null}
            evidenceItems={evidenceItems ?? []}
            onAddEvidence={onAddEvidence ?? (() => {})}
            onOpenFile={onOpenFile ?? (() => {})}
            className="flex-1"
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <p className="text-[11px] text-muted-foreground/40">{activeTabDef?.placeholder}</p>
          </div>
        )}
      </div>
    </div>
  );
};

interface BottomTabButtonProps {
  tab: TabDefinition;
  isActive: boolean;
  panelId: string;
  onSelect: (id: IdeBottomTab) => void;
}

const BottomTabButton = ({ tab, isActive, panelId, onSelect }: BottomTabButtonProps) => {
  const { Icon } = tab;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      onClick={() => onSelect(tab.id)}
      className={cn(
        "flex h-full items-center gap-1.5 border-b-2 px-3 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isActive
          ? "border-primary text-foreground/90"
          : "border-transparent text-muted-foreground/50 hover:text-muted-foreground/80",
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span>{tab.label}</span>
    </button>
  );
};
