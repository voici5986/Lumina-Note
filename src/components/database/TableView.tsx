import { useState, useRef, useCallback, useMemo } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import { useUIStore } from "@/stores/useUIStore";
import { useSplitStore } from "@/stores/useSplitStore";
import { DatabaseCell } from "./cells/DatabaseCell";
import { ColumnHeader } from "./ColumnHeader";
import { DatabaseIconButton, DatabaseMenuSurface } from "./primitives";
import { Plus, MoreHorizontal, Trash2, Copy, FileText } from "lucide-react";
import { useLocaleStore } from "@/stores/useLocaleStore";

interface TableViewProps {
  dbId: string;
}

export function TableView({ dbId }: TableViewProps) {
  const { t } = useLocaleStore();
  const {
    databases,
    addRow,
    addColumn,
    deleteRow,
    duplicateRow,
    editingCell,
    setEditingCell,
    getFilteredSortedRows,
  } = useDatabaseStore();
  
  const db = databases[dbId];
  const rows = useMemo(() => getFilteredSortedRows(dbId), [dbId, getFilteredSortedRows, db?.rows, db?.views]);
  
  // 分栏视图
  const { splitView, toggleSplitView } = useUIStore();
  const { openSecondaryFile } = useSplitStore();
  
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [rowMenuOpen, setRowMenuOpen] = useState<string | null>(null);
  const [, setDraggedColumn] = useState<string | null>(null);
  
  const tableRef = useRef<HTMLDivElement>(null);
  
  const handleAddColumn = useCallback(() => {
    addColumn(dbId, { name: t.database.newColumn, type: 'text' });
  }, [dbId, addColumn, t.database.newColumn]);
  
  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    setEditingCell({ rowId, columnId });
  }, [setEditingCell]);
  
  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);
  
  // 在分栏中打开笔记
  const handleOpenInSplit = useCallback((notePath: string) => {
    if (!splitView) {
      toggleSplitView();
    }
    openSecondaryFile(notePath);
  }, [splitView, toggleSplitView, openSecondaryFile]);
  
  if (!db) return null;
  
  const columns = db.columns;
  
  return (
    <div className="h-full overflow-x-auto overflow-y-auto bg-background/20" ref={tableRef}>
      <table className="border-collapse min-w-max">
        {/* 表头 */}
        <thead className="sticky top-0 z-10 bg-background/70 backdrop-blur-md">
          <tr>
            {/* 行操作列 */}
            <th className="w-10 p-0 border-b border-r border-border" />
            
            {columns.map((column) => (
              <ColumnHeader
                key={column.id}
                dbId={dbId}
                column={column}
                onDragStart={() => setDraggedColumn(column.id)}
                onDragEnd={() => setDraggedColumn(null)}
              />
            ))}
            
            {/* 新增列按钮 */}
            <th className="w-10 p-0 border-b border-border">
              <DatabaseIconButton
                onClick={handleAddColumn}
                className="w-full h-9 rounded-none"
                aria-label={t.database.newColumn}
                title={t.database.newColumn}
              >
                <Plus className="w-4 h-4" />
              </DatabaseIconButton>
            </th>
          </tr>
        </thead>
        
        {/* 表体 */}
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={`group ${hoveredRow === row.id ? 'bg-accent/50' : ''}`}
              onMouseEnter={() => setHoveredRow(row.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              {/* 行操作 */}
              <td className="w-10 p-0 border-b border-r border-border relative">
                <div className="flex items-center justify-center h-9">
                  {hoveredRow === row.id ? (
                    <div className="relative">
                      <DatabaseIconButton
                        onClick={() => setRowMenuOpen(rowMenuOpen === row.id ? null : row.id)}
                        aria-label={t.common.settings}
                        title={t.common.settings}
                      >
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </DatabaseIconButton>
                      
                      {rowMenuOpen === row.id && (
                        <DatabaseMenuSurface className="absolute left-0 top-full mt-1 py-1 min-w-[140px] z-50">
                          <button
                            onClick={() => {
                              duplicateRow(dbId, row.id);
                              setRowMenuOpen(null);
                            }}
                            className="db-menu-item"
                          >
                          <Copy className="w-4 h-4" /> {t.database.copyRow}
                          </button>
                          <button
                            onClick={() => {
                              deleteRow(dbId, row.id);
                              setRowMenuOpen(null);
                            }}
                            className="db-menu-item db-menu-item-danger"
                          >
                          <Trash2 className="w-4 h-4" /> {t.database.deleteRow}
                          </button>
                        </DatabaseMenuSurface>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{rowIndex + 1}</span>
                  )}
                </div>
              </td>
              
              {/* 数据单元格 */}
              {columns.map((column, colIndex) => (
                <td
                  key={column.id}
                  className={`p-0 border-b border-r border-border ${
                    editingCell?.rowId === row.id && editingCell?.columnId === column.id
                      ? 'ring-2 ring-primary ring-inset'
                      : ''
                  }`}
                  style={{ width: column.width || 180, minWidth: 100 }}
                  onClick={() => handleCellClick(row.id, column.id)}
                >
                  <div className="flex items-center">
                    <div className="flex-1">
                      <DatabaseCell
                        dbId={dbId}
                        column={column}
                        rowId={row.id}
                        value={row.cells[column.id]}
                        isEditing={editingCell?.rowId === row.id && editingCell?.columnId === column.id}
                        onBlur={handleCellBlur}
                      />
                    </div>
                    {/* 第一列显示打开笔记按钮 */}
                    {colIndex === 0 && hoveredRow === row.id && row.notePath && (
                      <DatabaseIconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInSplit(row.notePath);
                        }}
                        className="mr-1"
                        aria-label={t.database.openInSplit}
                        title={t.database.openInSplit}
                      >
                        <FileText className="w-4 h-4" />
                      </DatabaseIconButton>
                    )}
                  </div>
                </td>
              ))}
              
              {/* 空列占位 */}
              <td className="w-10 border-b border-border" />
            </tr>
          ))}
          
          {/* 新增行按钮 */}
          <tr>
            <td colSpan={columns.length + 2} className="p-0">
              <button
                onClick={() => addRow(dbId)}
                className="db-toggle-btn w-full h-9 justify-start rounded-none border-0 px-4"
              >
                <Plus className="w-4 h-4" />
                {t.database.newRow}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
