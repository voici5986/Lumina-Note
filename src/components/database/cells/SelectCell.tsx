import { useState, useRef, useEffect } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import type { DatabaseColumn, SelectColor } from "@/types/database";
import { SELECT_COLORS } from "@/types/database";
import { ChevronDown, Plus, X } from "lucide-react";
import { useLocaleStore } from "@/stores/useLocaleStore";

interface SelectCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
  isEditing: boolean;
  onBlur: () => void;
  column: DatabaseColumn;
  dbId: string;
}

export function SelectCell({ value, onChange, isEditing, onBlur, column, dbId }: SelectCellProps) {
  const { t } = useLocaleStore();
  const { addSelectOption } = useDatabaseStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const options = column.options || [];
  const selectedOption = options.find(opt => opt.id === value);
  
  useEffect(() => {
    if (isEditing) {
      setShowDropdown(true);
    }
  }, [isEditing]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        onBlur();
      }
    };
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown, onBlur]);
  
  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setShowDropdown(false);
    onBlur();
  };
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };
  
  const handleAddOption = () => {
    if (newOptionName.trim()) {
      const colors: SelectColor[] = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink'];
      const color = colors[options.length % colors.length];
      const optionId = addSelectOption(dbId, column.id, { name: newOptionName.trim(), color });
      onChange(optionId);
      setNewOptionName('');
      setShowDropdown(false);
      onBlur();
    }
  };
  
  return (
    <div className="relative h-9" ref={dropdownRef}>
      <div
        className="h-full px-2 flex items-center gap-1 cursor-pointer"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {selectedOption ? (
          <>
            <span className={`px-2 py-0.5 rounded text-sm ${SELECT_COLORS[selectedOption.color].bg} ${SELECT_COLORS[selectedOption.color].text}`}>
              {selectedOption.name}
            </span>
            <button
              onClick={handleClear}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{t.database.selectPlaceholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
      </div>
      
      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-popover border border-border rounded-md shadow-lg py-1 z-50">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent ${
                value === option.id ? 'bg-accent' : ''
              }`}
            >
              <span className={`px-2 py-0.5 rounded ${SELECT_COLORS[option.color].bg} ${SELECT_COLORS[option.color].text}`}>
                {option.name}
              </span>
            </button>
          ))}
          
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t.database.noOptions}
            </div>
          )}
          
          <div className="border-t border-border mt-1 pt-1 px-2">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddOption();
                }}
                placeholder={t.database.newOption}
                className="flex-1 px-2 py-1 text-sm bg-transparent border-none outline-none"
              />
              <button
                onClick={handleAddOption}
                disabled={!newOptionName.trim()}
                className="p-1 rounded hover:bg-accent disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
