/**
 * 工具注册表
 * 
 * 管理所有可用的工具及其执行器
 */

import { ToolExecutor, ToolResult, ToolContext } from "../types";

// 导入工具执行器
import { ReadNoteTool } from "./executors/ReadNoteTool";
import { EditNoteTool } from "./executors/EditNoteTool";
import { CreateNoteTool } from "./executors/CreateNoteTool";
import { ListNotesTool } from "./executors/ListNotesTool";
import { MoveNoteTool } from "./executors/MoveNoteTool";
import { SearchNotesTool } from "./executors/SearchNotesTool";
import { AttemptCompletionTool } from "./executors/AttemptCompletionTool";
import { DeleteNoteTool } from "./executors/DeleteNoteTool";
import { GrepSearchTool } from "./executors/GrepSearchTool";
import { SemanticSearchTool } from "./executors/SemanticSearchTool";
import { QueryDatabaseTool } from "./executors/QueryDatabaseTool";
import { AddDatabaseRowTool } from "./executors/AddDatabaseRowTool";
import { GetBacklinksTool } from "./executors/GetBacklinksTool";
import { AskUserTool } from "./executors/AskUserTool";

// 工具别名映射：错误名称 → 正确名称
const TOOL_ALIASES: Record<string, string> = {
  // 读取类
  "read_file": "read_note",
  "get_note": "read_note",
  "get_file": "read_note",
  "open_note": "read_note",
  "view_note": "read_note",
  
  // 编辑类
  "edit_file": "edit_note",
  "modify_note": "edit_note",
  "update_note": "edit_note",
  "append_note": "edit_note",
  "append_to_note": "edit_note",
  "replace_in_note": "edit_note",
  "write_note": "edit_note",
  
  // 创建类
  "create_file": "create_note",
  "new_note": "create_note",
  "write_file": "create_note",
  "make_note": "create_note",
  
  // 删除类
  "delete_file": "delete_note",
  "remove_note": "delete_note",
  "remove_file": "delete_note",
  
  // 移动类
  "move_file": "move_note",
  "rename_note": "move_note",
  "rename_file": "move_note",
  
  // 列表类
  "list_files": "list_notes",
  "get_files": "list_notes",
  "dir": "list_notes",
  "ls": "list_notes",
  
  // 搜索类
  "search": "search_notes",
  "find": "search_notes",
  "grep": "grep_search",
  "regex_search": "grep_search",
  
  // 完成类
  "complete": "attempt_completion",
  "done": "attempt_completion",
  "finish": "attempt_completion",
};

export class ToolRegistry {
  private tools: Map<string, ToolExecutor> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * 解析工具别名，返回真实工具名
   */
  private resolveAlias(name: string): string {
    return TOOL_ALIASES[name] || name;
  }

  /**
   * 注册默认工具
   */
  private registerDefaultTools(): void {
    // 基础笔记操作
    this.register(ReadNoteTool);
    this.register(EditNoteTool);
    this.register(CreateNoteTool);
    this.register(ListNotesTool);
    this.register(MoveNoteTool);
    this.register(DeleteNoteTool);
    
    // 搜索工具
    this.register(SearchNotesTool);
    this.register(GrepSearchTool);
    this.register(SemanticSearchTool);
    
    // 数据库工具
    this.register(QueryDatabaseTool);
    this.register(AddDatabaseRowTool);
    
    // 知识图谱工具
    this.register(GetBacklinksTool);
    
    // 交互工具
    this.register(AskUserTool);
    this.register(AttemptCompletionTool);
  }

  /**
   * 注册工具
   */
  register(tool: ToolExecutor): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具（支持别名）
   */
  get(name: string): ToolExecutor | undefined {
    const resolvedName = this.resolveAlias(name);
    return this.tools.get(resolvedName);
  }

  /**
   * 检查工具是否存在（支持别名）
   */
  has(name: string): boolean {
    const resolvedName = this.resolveAlias(name);
    return this.tools.has(resolvedName);
  }

  /**
   * 检查工具是否需要审批（支持别名）
   */
  requiresApproval(name: string): boolean {
    const resolvedName = this.resolveAlias(name);
    const tool = this.tools.get(resolvedName);
    return tool?.requiresApproval ?? true; // 默认需要审批
  }

  /**
   * 执行工具（支持别名）
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const resolvedName = this.resolveAlias(name);
    const tool = this.tools.get(resolvedName);

    // 如果使用了别名，记录日志
    if (resolvedName !== name) {
      console.log(`[ToolRegistry] 工具别名映射: ${name} → ${resolvedName}`);
    }

    if (!tool) {
      return {
        success: false,
        content: "",
        error: `未知工具: ${name}

可用的工具列表:
- read_note: 读取笔记内容
- edit_note: 编辑笔记（使用 search/replace）
- create_note: 创建新笔记
- delete_note: 删除笔记
- list_notes: 列出目录下的笔记
- move_note: 移动/重命名笔记
- search_notes: 语义搜索笔记
- grep_search: 全文搜索（支持正则）
- attempt_completion: 完成任务

请使用上述工具名，不要使用其他名称如 append_note、write_note 等。`,
      };
    }

    try {
      return await tool.execute(params, context);
    } catch (error) {
      return {
        success: false,
        content: "",
        error: `工具执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
      };
    }
  }

  /**
   * 获取所有已注册的工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
