import { useState, useEffect } from "react";
import { useDatabaseStore } from "@/stores/useDatabaseStore";
import { useFileStore } from "@/stores/useFileStore";
import { useBrowserStore } from "@/stores/useBrowserStore";
import type { CreateDatabaseOptions } from "@/types/database";
import { Database, ListTodo, FolderKanban, Book, X } from "lucide-react";

interface CreateDatabaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const templates = [
  { id: 'blank', name: '空白数据库', icon: Database, description: '从零开始' },
  { id: 'task', name: '任务管理', icon: ListTodo, description: '跟踪待办事项' },
  { id: 'project', name: '项目管理', icon: FolderKanban, description: '管理项目进度' },
  { id: 'reading', name: '阅读清单', icon: Book, description: '记录阅读进度' },
  { id: 'flashcard', name: '闪卡管理', icon: Book, description: '统一管理与复习所有闪卡' },
] as const;

export function CreateDatabaseDialog({ isOpen, onClose }: CreateDatabaseDialogProps) {
  const { createDatabase } = useDatabaseStore();
  const { openDatabaseTab, refreshFileTree } = useFileStore();
  const { hideAllWebViews, showAllWebViews } = useBrowserStore();
  
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<
    'blank' | 'task' | 'project' | 'reading' | 'flashcard'
  >('blank');
  const [isCreating, setIsCreating] = useState(false);
  
  // 弹窗打开时隐藏 WebView，关闭时恢复
  useEffect(() => {
    if (isOpen) {
      hideAllWebViews();
    } else {
      showAllWebViews();
    }
  }, [isOpen, hideAllWebViews, showAllWebViews]);
  
  if (!isOpen) return null;
  
  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    try {
      const dbId = await createDatabase({
        name: name.trim(),
        template: selectedTemplate,
      });
      
      // 刷新文件树以显示新文件
      await refreshFileTree();
      
      // 打开新创建的数据库
      openDatabaseTab(dbId, name.trim());
      
      // 重置并关闭
      setName('');
      setSelectedTemplate('blank');
      onClose();
    } catch (error) {
      console.error('Failed to create database:', error);
      alert('创建数据库失败');
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* 对话框 */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">新建数据库</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* 名称输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            数据库名称
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入数据库名称..."
            className="w-full px-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                handleCreate();
              }
            }}
          />
        </div>
        
        {/* 模板选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            选择模板
          </label>
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;
              
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`flex flex-col items-start p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm hover:bg-accent"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
            className="px-4 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
