import { useState, useRef, useEffect } from "react";
import type { DatabaseColumn } from "@/types/database";
import { useLocaleStore } from "@/stores/useLocaleStore";

interface TextCellProps {
  value: string | null;
  onChange: (value: string) => void;
  isEditing: boolean;
  onBlur: () => void;
  column: DatabaseColumn;
}

export function TextCell({ value, onChange, isEditing, onBlur }: TextCellProps) {
  const { t } = useLocaleStore();
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);
  
  useEffect(() => {
    setEditValue(value || '');
  }, [value]);
  
  const handleBlur = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    onBlur();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setEditValue(value || '');
      onBlur();
    }
  };
  
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="db-input h-9 border-transparent bg-transparent px-2 focus-visible:border-transparent focus-visible:shadow-none"
      />
    );
  }
  
  return (
    <div className="h-9 px-2 flex items-center text-sm truncate">
      {value || <span className="text-muted-foreground">{t.common.empty}</span>}
    </div>
  );
}
