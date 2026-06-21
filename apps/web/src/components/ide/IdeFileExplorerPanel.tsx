import { useState, useMemo } from "react";
import { FolderIcon, FolderOpenIcon, FileIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "~/lib/utils";
import type { WorkspaceFileTreeEntry } from "@t3tools/contracts";

const EXPLORER_HEADING_ID = "ide-file-explorer-heading";

interface IdeFileExplorerPanelProps {
  entries: ReadonlyArray<WorkspaceFileTreeEntry>;
  truncated: boolean;
  isLoading: boolean;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

interface TreeNode {
  entry: WorkspaceFileTreeEntry;
  children: Array<TreeNode>;
  depth: number;
}

function buildTree(entries: ReadonlyArray<WorkspaceFileTreeEntry>): Array<TreeNode> {
  const nodeByPath = new Map<string, TreeNode>();
  const roots: Array<TreeNode> = [];

  const sorted = [...entries].toSorted((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const entry of sorted) {
    nodeByPath.set(entry.path, { entry, children: [], depth: 0 });
  }

  for (const entry of sorted) {
    const node = nodeByPath.get(entry.path);
    if (!node) continue;
    if (entry.parentPath) {
      const parent = nodeByPath.get(entry.parentPath);
      if (parent) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}

function flattenVisible(
  nodes: Array<TreeNode>,
  expanded: Set<string>,
  depth = 0,
): Array<{ entry: WorkspaceFileTreeEntry; depth: number }> {
  const result: Array<{ entry: WorkspaceFileTreeEntry; depth: number }> = [];
  for (const node of nodes) {
    result.push({ entry: node.entry, depth });
    if (node.entry.kind === "directory" && expanded.has(node.entry.path)) {
      result.push(...flattenVisible(node.children, expanded, depth + 1));
    }
  }
  return result;
}

export const IdeFileExplorerPanel = ({
  entries,
  truncated,
  isLoading,
  selectedFile,
  onSelectFile,
}: IdeFileExplorerPanelProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(entries), [entries]);
  const visible = useMemo(() => flattenVisible(tree, expanded), [tree, expanded]);

  const toggleDir = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <aside
      aria-labelledby={EXPLORER_HEADING_ID}
      className="flex w-52 shrink-0 flex-col border-r border-border bg-card/20"
    >
      <div className="flex items-center border-b border-border/50 px-3 py-2">
        <span
          id={EXPLORER_HEADING_ID}
          className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50"
        >
          Explorer
        </span>
        {isLoading && (
          <Loader2Icon
            className="ml-auto size-3 animate-spin text-muted-foreground/40"
            aria-hidden
          />
        )}
      </div>
      <ScrollArea className="flex-1">
        {visible.length === 0 && !isLoading ? (
          <p className="px-3 py-4 text-[11px] text-muted-foreground/40">No files found.</p>
        ) : (
          <ul role="list" className="py-1">
            {visible.map(({ entry, depth }) => (
              <li key={entry.path}>
                <FileExplorerRow
                  entry={entry}
                  depth={depth}
                  isSelected={selectedFile === entry.path}
                  isExpanded={expanded.has(entry.path)}
                  onSelect={() => {
                    if (entry.kind === "directory") {
                      toggleDir(entry.path);
                    } else {
                      onSelectFile(entry.path);
                    }
                  }}
                />
              </li>
            ))}
            {truncated && (
              <li>
                <p className="px-3 py-1 text-[10px] text-muted-foreground/40">
                  Tree truncated — too many files.
                </p>
              </li>
            )}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
};

interface FileExplorerRowProps {
  entry: WorkspaceFileTreeEntry;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
}

const FileExplorerRow = ({
  entry,
  depth,
  isSelected,
  isExpanded,
  onSelect,
}: FileExplorerRowProps) => {
  const isDir = entry.kind === "directory";
  const FolderIconComponent = isExpanded ? FolderOpenIcon : FolderIcon;

  return (
    <button
      type="button"
      aria-current={isSelected ? "true" : undefined}
      aria-expanded={isDir ? isExpanded : undefined}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm py-0.5 pr-3 text-left text-[12px] transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isSelected && "bg-accent/60 text-foreground",
        !isSelected && "text-muted-foreground/80",
      )}
      style={{ paddingLeft: `${(depth + 1) * 12}px` }}
      onClick={onSelect}
    >
      {isDir ? (
        <>
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground/40 transition-transform",
              isExpanded && "rotate-90",
            )}
            aria-hidden
          />
          <FolderIconComponent className="size-3.5 shrink-0 text-blue-400/70" aria-hidden />
        </>
      ) : (
        <>
          <span className="w-3 shrink-0" aria-hidden />
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
        </>
      )}
      <span className="min-w-0 truncate">{entry.name}</span>
    </button>
  );
};
