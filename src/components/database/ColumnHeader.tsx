import { useState, useRef, useEffect } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import { useLocaleStore } from "@/stores/useLocaleStore";
import type { DatabaseColumn, ColumnType } from "@/types/database";
import {
  Type,
  Hash,
  List,
  Calendar,
  CheckSquare,
  Link,
  Calculator,
  GitBranch,
  ChevronDown,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Copy,
} from "lucide-react";

interface ColumnHeaderProps {
  dbId: string;
  column: DatabaseColumn;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const typeIcons: Record<ColumnType, React.ReactNode> = {
  'text': <Type className="w-4 h-4" />,
  'number': <Hash className="w-4 h-4" />,
  'select': <List className="w-4 h-4" />,
  'multi-select': <List className="w-4 h-4" />,
  'date': <Calendar className="w-4 h-4" />,
  'checkbox': <CheckSquare className="w-4 h-4" />,
  'url': <Link className="w-4 h-4" />,
  'formula': <Calculator className="w-4 h-4" />,
  'relation': <GitBranch className="w-4 h-4" />,
};

export function ColumnHeader({ dbId, column, onDragStart, onDragEnd }: ColumnHeaderProps) {
  const { t } = useLocaleStore();
  const { updateColumn, deleteColumn, addColumn } = useDatabaseStore();
  const typeLabels = t.database.columnTypes;
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowTypeMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // 编辑名称时聚焦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleNameSubmit = () => {
    if (editName.trim() && editName !== column.name) {
      updateColumn(dbId, column.id, { name: editName.trim() });
    } else {
      setEditName(column.name);
    }
    setIsEditing(false);
  };
  
  const handleTypeChange = (type: ColumnType) => {
    updateColumn(dbId, column.id, { type });
    setShowTypeMenu(false);
    setShowMenu(false);
  };
  
  const handleDelete = () => {
    if (confirm(t.database.confirmDeleteColumn.replace("{name}", column.name))) {
      deleteColumn(dbId, column.id);
    }
    setShowMenu(false);
  };
  
  const handleDuplicate = () => {
    addColumn(dbId, {
      name: `${column.name} ${t.database.copySuffix}`,
      type: column.type,
      options: column.options ? [...column.options] : undefined,
    });
    setShowMenu(false);
  };
  
  return (
    <th
      className="p-0 border-b border-r border-border relative group"
      style={{ width: column.width || 180, minWidth: 100 }}
    >
      <div className="flex items-center h-9 px-2 gap-1">
        {/* 拖拽手柄 */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>
        
        {/* 类型图标 */}
        <span className="text-muted-foreground flex-shrink-0">
          {typeIcons[column.type]}
        </span>
        
        {/* 列名 */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') {
                setEditName(column.name);
                setIsEditing(false);
              }
            }}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-medium"
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate text-sm font-medium cursor-pointer"
            onClick={() => setIsEditing(true)}
          >
            {column.name}
          </span>
        )}
        
        {/* 下拉菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px] z-50">
              {/* 类型选择 */}
              <div className="relative">
                <button
                  onClick={() => setShowTypeMenu(!showTypeMenu)}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <span className="flex items-center gap-2">
                    {typeIcons[column.type]}
                    {typeLabels[column.type]}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showTypeMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                    {(Object.keys(typeIcons) as ColumnType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent ${
                          column.type === type ? 'bg-accent' : ''
                        }`}
                      >
                        {typeIcons[type]}
                        {typeLabels[type]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="my-1 border-t border-border" />
              
              {/* 排序 */}
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent">
                <ArrowUp className="w-4 h-4" /> {t.database.sortAsc}
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent">
                <ArrowDown className="w-4 h-4" /> {t.database.sortDesc}
              </button>
              
              <div className="my-1 border-t border-border" />
              
              {/* 操作 */}
              <button
                onClick={handleDuplicate}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Copy className="w-4 h-4" /> {t.database.duplicateColumn}
              </button>
              <button className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent">
                <EyeOff className="w-4 h-4" /> {t.database.hideColumn}
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-red-500"
              >
                <Trash2 className="w-4 h-4" /> {t.database.deleteColumn}
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* 调整列宽手柄 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = column.width || 180;
          
          const onMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(100, startWidth + e.clientX - startX);
            updateColumn(dbId, column.id, { width: newWidth });
          };
          
          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
          };
          
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        }}
      />
    </th>
  );
}
