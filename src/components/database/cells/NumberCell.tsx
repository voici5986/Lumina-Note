import { useState, useRef, useEffect } from "react";
import type { DatabaseColumn } from "@/types/database";

interface NumberCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
  isEditing: boolean;
  onBlur: () => void;
  column: DatabaseColumn;
}

export function NumberCell({ value, onChange, isEditing, onBlur, column }: NumberCellProps) {
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  useEffect(() => {
    setEditValue(value?.toString() || '');
  }, [value]);
  
  const handleBlur = () => {
    const numValue = editValue === '' ? null : parseFloat(editValue);
    if (!isNaN(numValue as number) && numValue !== value) {
      onChange(numValue);
    }
    onBlur();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setEditValue(value?.toString() || '');
      onBlur();
    }
  };
  
  // 格式化显示值
  const formatValue = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    
    switch (column.numberFormat) {
      case 'percent':
        return `${(val * 100).toFixed(0)}%`;
      case 'currency':
        return `¥${val.toLocaleString()}`;
      default:
        return val.toLocaleString();
    }
  };
  
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="db-input h-9 border-transparent bg-transparent px-2 text-right focus-visible:border-transparent focus-visible:shadow-none"
      />
    );
  }
  
  return (
    <div className="h-9 px-2 flex items-center justify-end text-sm">
      {value != null ? formatValue(value) : <span className="text-muted-foreground">-</span>}
    </div>
  );
}
