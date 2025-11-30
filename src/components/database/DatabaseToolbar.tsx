import { useState, useRef, useEffect } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import type { ViewType, SortRule } from "@/types/database";
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

interface DatabaseToolbarProps {
  dbId: string;
}

export function DatabaseToolbar({ dbId }: DatabaseToolbarProps) {
  const { databases, addView, setActiveView, addRow, setSorts } = useDatabaseStore();
  const db = databases[dbId];
  
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  if (!db) return null;
  
  const activeView = db.views.find(v => v.id === db.activeViewId);
  const sorts = activeView?.sorts || [];
  
  const viewIcons: Record<ViewType, React.ReactNode> = {
    table: <Table className="w-4 h-4" />,
    kanban: <Kanban className="w-4 h-4" />,
    calendar: <Calendar className="w-4 h-4" />,
    gallery: <LayoutGrid className="w-4 h-4" />,
  };
  
  const handleAddView = (type: ViewType) => {
    const names: Record<ViewType, string> = {
      table: '表格',
      kanban: '看板',
      calendar: '日历',
      gallery: '画廊',
    };
    addView(dbId, { type, name: names[type] });
    setShowViewMenu(false);
  };
  
  const handleAddSort = (columnId: string) => {
    if (!activeView) return;
    const newSort: SortRule = { columnId, direction: 'asc' };
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
      i === index ? { ...s, direction: s.direction === 'asc' ? 'desc' as const : 'asc' as const } : s
    );
    setSorts(dbId, activeView.id, newSorts);
  };
  
  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center gap-2 flex-wrap">
      {/* 视图切换 */}
      <div className="relative" ref={viewMenuRef}>
        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {db.views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(dbId, view.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-colors ${
                view.id === db.activeViewId
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {viewIcons[view.type]}
              <span>{view.name}</span>
            </button>
          ))}
          <button
            onClick={() => setShowViewMenu(!showViewMenu)}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {showViewMenu && (
          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px] z-50">
            <button
              onClick={() => handleAddView('table')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Table className="w-4 h-4" /> 表格视图
            </button>
            <button
              onClick={() => handleAddView('kanban')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent"
            >
              <Kanban className="w-4 h-4" /> 看板视图
            </button>
            <button
              onClick={() => handleAddView('calendar')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
              disabled
            >
              <Calendar className="w-4 h-4" /> 日历视图
            </button>
            <button
              onClick={() => handleAddView('gallery')}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
              disabled
            >
              <LayoutGrid className="w-4 h-4" /> 画廊视图
            </button>
          </div>
        )}
      </div>
      
      <div className="w-px h-5 bg-border" />
      
      {/* 筛选 */}
      <button
        onClick={() => setShowFilterMenu(!showFilterMenu)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
          activeView?.filters?.rules?.length
            ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
            : 'hover:bg-accent text-muted-foreground'
        }`}
      >
        <Filter className="w-4 h-4" />
        筛选
        {activeView?.filters?.rules?.length ? (
          <span className="bg-slate-500 text-white text-xs px-1.5 rounded-full">
            {activeView.filters.rules.length}
          </span>
        ) : null}
      </button>
      
      {/* 排序 */}
      <div className="relative" ref={sortMenuRef}>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
            sorts.length > 0
              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
              : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          排序
          {sorts.length > 0 && (
            <span className="bg-purple-500 text-white text-xs px-1.5 rounded-full">
              {sorts.length}
            </span>
          )}
        </button>
        
        {showSortMenu && (
          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-2 min-w-[240px] z-50">
            {sorts.length > 0 && (
              <div className="px-3 pb-2 mb-2 border-b border-border space-y-1">
                {sorts.map((sort, index) => {
                  const column = db.columns.find(c => c.id === sort.columnId);
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{column?.name || '未知列'}</span>
                      <button
                        onClick={() => handleToggleSortDirection(index)}
                        className="p-1 hover:bg-accent rounded"
                      >
                        {sort.direction === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemoveSort(index)}
                        className="p-1 hover:bg-accent rounded text-muted-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-2">
              <p className="px-1 text-xs text-muted-foreground mb-1">添加排序</p>
              {db.columns.map((column) => (
                <button
                  key={column.id}
                  onClick={() => handleAddSort(column.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded"
                >
                  {column.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* 搜索 */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none text-sm w-32"
        />
      </div>
      
      <div className="flex-1" />
      
      {/* 新建行 */}
      <button
        onClick={() => addRow(dbId)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        新建
      </button>
      
      {/* 更多操作 */}
      <button className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
        <MoreHorizontal className="w-4 h-4" />
      </button>
    </div>
  );
}
