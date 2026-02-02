import { useDatabaseStore } from "@/stores/useDatabaseStore";
import { useLocaleStore } from "@/stores/useLocaleStore";
import type { DatabaseColumn, CellValue } from "@/types/database";
import { TextCell } from "./TextCell";
import { NumberCell } from "./NumberCell";
import { SelectCell } from "./SelectCell";
import { MultiSelectCell } from "./MultiSelectCell";
import { DateCell } from "./DateCell";
import { CheckboxCell } from "./CheckboxCell";
import { UrlCell } from "./UrlCell";

interface DatabaseCellProps {
  dbId: string;
  column: DatabaseColumn;
  rowId: string;
  value: CellValue;
  isEditing: boolean;
  onBlur: () => void;
}

export function DatabaseCell({
  dbId,
  column,
  rowId,
  value,
  isEditing,
  onBlur,
}: DatabaseCellProps) {
  const { updateCell } = useDatabaseStore();
  const { t } = useLocaleStore();
  
  const handleChange = (newValue: CellValue) => {
    updateCell(dbId, rowId, column.id, newValue);
  };
  
  const commonProps = {
    value,
    onChange: handleChange,
    isEditing,
    onBlur,
    column,
  };
  
  switch (column.type) {
    case 'text':
      return <TextCell {...commonProps} value={value as string | null} />;
    
    case 'number':
      return <NumberCell {...commonProps} value={value as number | null} />;
    
    case 'select':
      return <SelectCell {...commonProps} dbId={dbId} value={value as string | null} />;
    
    case 'multi-select':
      return <MultiSelectCell {...commonProps} dbId={dbId} value={value as string[] | null} />;
    
    case 'date':
      return <DateCell {...commonProps} value={value as { start: string; end?: string } | null} />;
    
    case 'checkbox':
      return <CheckboxCell {...commonProps} value={value as boolean | null} />;
    
    case 'url':
      return <UrlCell {...commonProps} value={value as string | null} />;
    
    case 'formula':
      return (
        <div className="h-9 px-2 flex items-center text-sm text-muted-foreground">
          {t.database.columnTypes.formula}
        </div>
      );
    
    case 'relation':
      return (
        <div className="h-9 px-2 flex items-center text-sm text-muted-foreground">
          {t.database.columnTypes.relation}
        </div>
      );
    
    default:
      return (
        <div className="h-9 px-2 flex items-center text-sm text-muted-foreground">
          {t.database.unsupportedType}
        </div>
      );
  }
}
