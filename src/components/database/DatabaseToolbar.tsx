import { useState, useRef, useEffect } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import type { ViewType, SortRule } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  Plus,
  Table,
  Kanban,
  Calendar,
  LayoutGrid,
  Filter,
  ArrowUpDown,
  Search,
  MoreHorizontal,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useLocaleStore } from "@/stores/useLocaleStore";
import {
  DatabaseActionButton,
  DatabaseIconButton,
  DatabaseMenuSurface,
  DatabaseTextInput,
} from "./primitives";

interface DatabaseToolbarProps {
  dbId: string;
}

export function DatabaseToolbar({ dbId }: DatabaseToolbarProps) {
  const { t } = useLocaleStore();
  const { databases, addView, setActiveView, addRow, setSorts } = useDatabaseStore();
  const db = databases[dbId];

  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!db) return null;

  const activeView = db.views.find((v) => v.id === db.activeViewId);
  const sorts = activeView?.sorts || [];
  const hasFilters = Boolean(activeView?.filters?.rules?.length);

  const viewIcons: Record<ViewType, React.ReactNode> = {
    table: <Table className="w-4 h-4" />,
    kanban: <Kanban className="w-4 h-4" />,
    calendar: <Calendar className="w-4 h-4" />,
    gallery: <LayoutGrid className="w-4 h-4" />,
  };

  const handleAddView = (type: ViewType) => {
    const names: Record<ViewType, string> = {
      table: t.database.view.table,
      kanban: t.database.view.kanban,
      calendar: t.database.view.calendar,
      gallery: t.database.view.gallery,
    };
    addView(dbId, { type, name: names[type] });
    setShowViewMenu(false);
  };

  const handleAddSort = (columnId: string) => {
    if (!activeView) return;
    const newSort: SortRule = { columnId, direction: "asc" };
    setSorts(dbId, activeView.id, [...sorts, newSort]);
  };

  const handleRemoveSort = (index: number) => {
    if (!activeView) return;
    const newSorts = sorts.filter((_, i) => i !== index);
    setSorts(dbId, activeView.id, newSorts);
  };

  const handleToggleSortDirection = (index: number) => {
    if (!activeView) return;
    const newSorts = sorts.map((s, i) =>
      i === index ? { ...s, direction: s.direction === "asc" ? ("desc" as const) : ("asc" as const) } : s,
    );
    setSorts(dbId, activeView.id, newSorts);
  };

  return (
    <div className="db-toolbar flex-shrink-0 px-4 py-2 flex items-center gap-2 flex-wrap">
      {/* 视图切换 */}
      <div className="relative" ref={viewMenuRef}>
        <div className="db-panel flex items-center gap-1 p-0.5">
          {db.views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(dbId, view.id)}
              className="db-toggle-btn"
              data-active={view.id === db.activeViewId}
              aria-label={view.name}
              title={view.name}
            >
              {viewIcons[view.type]}
              <span>{view.name}</span>
            </button>
          ))}
          <DatabaseIconButton
            onClick={() => setShowViewMenu(!showViewMenu)}
            aria-label={t.database.newView}
            title={t.database.newView}
          >
            <Plus className="w-4 h-4" />
          </DatabaseIconButton>
        </div>

        {showViewMenu && (
          <DatabaseMenuSurface className="absolute top-full left-0 mt-1 p-1 min-w-[156px] z-50">
            <button onClick={() => handleAddView("table")} className="db-menu-item">
              <Table className="w-4 h-4" /> {t.database.viewMenu.table}
            </button>
            <button onClick={() => handleAddView("kanban")} className="db-menu-item">
              <Kanban className="w-4 h-4" /> {t.database.viewMenu.kanban}
            </button>
            <button
              onClick={() => handleAddView("calendar")}
              className="db-menu-item opacity-60 cursor-not-allowed"
              disabled
            >
              <Calendar className="w-4 h-4" /> {t.database.viewMenu.calendar}
            </button>
            <button
              onClick={() => handleAddView("gallery")}
              className="db-menu-item opacity-60 cursor-not-allowed"
              disabled
            >
              <LayoutGrid className="w-4 h-4" /> {t.database.viewMenu.gallery}
            </button>
          </DatabaseMenuSurface>
        )}
      </div>

      <div className="w-px h-5 bg-border/70" />

      {/* 筛选 */}
      <div className="relative" ref={filterMenuRef}>
        <button
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          className={cn("db-toggle-btn", hasFilters && "border-border/70 bg-background text-foreground shadow-ui-card")}
          aria-label={t.database.filter}
          title={t.database.filter}
        >
          <Filter className="w-4 h-4" />
          {t.database.filter}
          {hasFilters && <span className="db-count-badge">{activeView?.filters?.rules?.length}</span>}
        </button>
      </div>

      {/* 排序 */}
      <div className="relative" ref={sortMenuRef}>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className={cn("db-toggle-btn", sorts.length > 0 && "border-border/70 bg-background text-foreground shadow-ui-card")}
          aria-label={t.database.sort}
          title={t.database.sort}
        >
          <ArrowUpDown className="w-4 h-4" />
          {t.database.sort}
          {sorts.length > 0 && <span className="db-count-badge">{sorts.length}</span>}
        </button>

        {showSortMenu && (
          <DatabaseMenuSurface className="absolute top-full left-0 mt-1 py-2 min-w-[260px] z-50">
            {sorts.length > 0 && (
              <div className="px-3 pb-2 mb-2 border-b border-border/70 space-y-1">
                {sorts.map((sort, index) => {
                  const column = db.columns.find((c) => c.id === sort.columnId);
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{column?.name || t.database.unknownColumn}</span>
                      <DatabaseIconButton
                        variant="subtle"
                        onClick={() => handleToggleSortDirection(index)}
                        aria-label={sort.direction === "asc" ? t.database.sortDesc : t.database.sortAsc}
                        title={sort.direction === "asc" ? t.database.sortDesc : t.database.sortAsc}
                      >
                        {sort.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </DatabaseIconButton>
                      <DatabaseIconButton
                        variant="subtle"
                        onClick={() => handleRemoveSort(index)}
                        aria-label={t.common.delete}
                        title={t.common.delete}
                      >
                        <X className="w-3 h-3" />
                      </DatabaseIconButton>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-2">
              <p className="px-1 text-xs text-muted-foreground mb-1">{t.database.addSort}</p>
              {db.columns.map((column) => (
                <button key={column.id} onClick={() => handleAddSort(column.id)} className="db-menu-item">
                  {column.name}
                </button>
              ))}
            </div>
          </DatabaseMenuSurface>
        )}
      </div>

      {/* 搜索 */}
      <div className="db-panel flex items-center gap-1.5 px-2 py-0.5">
        <Search className="w-4 h-4 text-muted-foreground" />
        <DatabaseTextInput
          type="text"
          placeholder={t.database.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t.common.search}
          className="h-8 w-36 border-transparent bg-transparent px-1.5 focus-visible:border-transparent focus-visible:shadow-none"
        />
      </div>

      <div className="flex-1" />

      {/* 新建行 */}
      <DatabaseActionButton onClick={() => addRow(dbId)}>
        <Plus className="w-4 h-4" />
        {t.database.newRow}
      </DatabaseActionButton>

      {/* 更多操作 */}
      <DatabaseIconButton
        aria-label={t.common.settings}
        title={t.common.settings}
      >
        <MoreHorizontal className="w-4 h-4" />
      </DatabaseIconButton>
    </div>
  );
}
