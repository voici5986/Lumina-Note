import { useState, useRef, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import type { DatabaseColumn } from "@/types/database";
import { useLocaleStore } from "@/stores/useLocaleStore";

interface UrlCellProps {
  value: string | null;
  onChange: (value: string) => void;
  isEditing: boolean;
  onBlur: () => void;
  column: DatabaseColumn;
}

export function UrlCell({ value, onChange, isEditing, onBlur }: UrlCellProps) {
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
  
  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      window.open(value, '_blank');
    }
  };
  
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="url"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="https://"
        className="w-full h-9 px-2 bg-transparent border-none outline-none text-sm"
      />
    );
  }
  
  if (!value) {
    return (
      <div className="h-9 px-2 flex items-center text-sm text-muted-foreground">
        {t.common.empty}
      </div>
    );
  }
  
  return (
    <div className="h-9 px-2 flex items-center gap-1 text-sm group">
      <span className="truncate text-slate-500 hover:underline cursor-pointer" onClick={handleOpenUrl}>
        {value.replace(/^https?:\/\//, '')}
      </span>
      <button
        onClick={handleOpenUrl}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-opacity"
      >
        <ExternalLink className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}
