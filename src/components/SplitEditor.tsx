import { useCallback } from "react";
import { useFileStore } from "@/stores/useFileStore";
import { useUIStore } from "@/stores/useUIStore";
import { useSplitStore } from "@/stores/useSplitStore";
import { CodeMirrorEditor } from "@/editor/CodeMirrorEditor";
import { ReadingView } from "@/editor/ReadingView";
import { getFileName, cn } from "@/lib/utils";
import {
  X,
  Columns,
  Rows,
  FileText,
  Loader2,
} from "lucide-react";

interface EditorPaneProps {
  file: string | null;
  content: string;
  isDirty: boolean;
  isLoading: boolean;
  onContentChange: (content: string) => void;
  onClose?: () => void;
  isPrimary?: boolean;
}

function EditorPane({
  file,
  content,
  isDirty,
  isLoading,
  onContentChange,
  onClose,
}: EditorPaneProps) {
  const { editorMode } = useUIStore();

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <FileText size={32} className="opacity-30 mb-2" />
        <p className="text-sm">选择一个文件</p>
        <p className="text-xs opacity-70">从侧边栏拖放或双击打开</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Pane header */}
      <div className="h-9 flex items-center px-3 justify-between border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {getFileName(file)}
          </span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="未保存" />
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
            title="关闭此面板"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-4">
          {editorMode === "reading" ? (
            <ReadingView content={content} />
          ) : (
            <CodeMirrorEditor content={content} onChange={onContentChange} />
          )}
        </div>
      </div>
    </div>
  );
}

export function SplitEditor() {
  const {
    currentFile,
    currentContent,
    isDirty,
    isLoadingFile,
    updateContent,
  } = useFileStore();

  const {
    splitDirection,
    setSplitDirection,
    toggleSplitView,
  } = useUIStore();

  const {
    secondaryFile,
    secondaryContent,
    secondaryIsDirty,
    isLoadingSecondary,
    updateSecondaryContent,
    closeSecondary,
  } = useSplitStore();

  const handlePrimaryChange = useCallback((content: string) => {
    updateContent(content);
  }, [updateContent]);

  const handleSecondaryChange = useCallback((content: string) => {
    updateSecondaryContent(content);
  }, [updateSecondaryContent]);

  const isHorizontal = splitDirection === "horizontal";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Split toolbar */}
      <div className="h-8 flex items-center px-2 gap-1 border-b border-border bg-background shrink-0">
        <button
          onClick={() => setSplitDirection(isHorizontal ? "vertical" : "horizontal")}
          className={cn(
            "p-1.5 rounded transition-colors",
            "hover:bg-accent text-muted-foreground hover:text-foreground"
          )}
          title={isHorizontal ? "垂直分屏" : "水平分屏"}
        >
          {isHorizontal ? <Rows size={14} /> : <Columns size={14} />}
        </button>
        <button
          onClick={toggleSplitView}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="关闭分屏"
        >
          <X size={14} />
        </button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          分屏编辑
        </span>
      </div>

      {/* Split panes */}
      <div className={cn(
        "flex-1 flex overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col"
      )}>
        {/* Primary pane */}
        <div className={cn(
          "flex flex-col overflow-hidden",
          isHorizontal ? "flex-1 min-w-[200px]" : "flex-1 min-h-[100px]"
        )}>
          <EditorPane
            file={currentFile}
            content={currentContent}
            isDirty={isDirty}
            isLoading={isLoadingFile}
            onContentChange={handlePrimaryChange}
            isPrimary
          />
        </div>

        {/* Divider */}
        <div className={cn(
          "bg-border shrink-0",
          isHorizontal ? "w-px" : "h-px"
        )} />

        {/* Secondary pane */}
        <div className={cn(
          "flex flex-col overflow-hidden border-l border-border",
          isHorizontal ? "flex-1 min-w-[200px]" : "flex-1 min-h-[100px]"
        )}>
          <EditorPane
            file={secondaryFile}
            content={secondaryContent}
            isDirty={secondaryIsDirty}
            isLoading={isLoadingSecondary}
            onContentChange={handleSecondaryChange}
            onClose={closeSecondary}
          />
        </div>
      </div>
    </div>
  );
}
