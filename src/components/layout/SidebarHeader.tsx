import { cn } from "@/lib/utils";
import { useLocaleStore } from "@/stores/useLocaleStore";
import {
  FilePlus,
  FolderPlus,
  MoreHorizontal,
  RefreshCw,
  Shapes,
} from "lucide-react";

interface SidebarHeaderProps {
  onNewFile: () => void;
  onNewDiagram: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  isLoadingTree: boolean;
  onMoreMenu: (pos: { x: number; y: number }) => void;
}

export function SidebarHeader({
  onNewFile,
  onNewDiagram,
  onNewFolder,
  onRefresh,
  isLoadingTree,
  onMoreMenu,
}: SidebarHeaderProps) {
  const { t } = useLocaleStore();

  return (
    <div className="p-3 flex items-center justify-between text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase">
      <span className="ui-compact-text ui-compact-hide-md">{t.sidebar.files}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={onNewFile}
          className="w-7 h-7 ui-icon-btn"
          title={t.sidebar.newNote}
        >
          <FilePlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNewDiagram}
          className="w-7 h-7 ui-icon-btn"
          title={t.sidebar.newDiagram}
        >
          <Shapes className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNewFolder}
          className="w-7 h-7 ui-icon-btn"
          title={t.sidebar.newFolder}
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRefresh}
          disabled={isLoadingTree}
          className="w-7 h-7 ui-icon-btn disabled:opacity-50 disabled:pointer-events-none"
          title={t.sidebar.refresh}
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", isLoadingTree && "animate-spin")}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoreMenu({ x: e.clientX, y: e.clientY + 20 });
          }}
          className="w-7 h-7 ui-icon-btn"
          title={t.common.settings}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
