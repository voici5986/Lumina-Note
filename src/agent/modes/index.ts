/**
 * Agent 模式定义
 */

import { AgentMode, AgentModeSlug } from "../types";

export const MODES: Record<AgentModeSlug, AgentMode> = {
  editor: {
    slug: "editor",
    name: "📝 编辑助手",
    icon: "pencil",
    roleDefinition: "你是一个专业的笔记编辑助手，擅长优化 Markdown 格式、改进文章结构、修正错误、润色文字。你也可以管理数据库中的记录，还可以从笔记内容生成闪卡帮助用户记忆。",
    tools: [
      "read_note", "edit_note",
      "list_notes", "search_notes", "grep_search",
      "query_database", "add_database_row",
      "generate_flashcards", "create_flashcard",
      "get_backlinks", "read_cached_output"
    ],
  },

  organizer: {
    slug: "organizer",
    name: "📁 整理大师",
    icon: "folder",
    roleDefinition: "你是一个笔记整理专家，擅长分析笔记结构、建议分类方案、执行批量重组、优化目录组织。你也可以管理数据库。",
    tools: [
      "read_note", "delete_note", "move_file", "rename_file", "create_folder",
      "list_notes", "search_notes", "grep_search",
      "query_database", "add_database_row",
      "get_backlinks", "read_cached_output"
    ],
  },

  researcher: {
    slug: "researcher",
    name: "🔍 研究助手",
    icon: "search",
    roleDefinition: "你是一个研究助手，擅长在笔记库中发现关联、提取知识、生成摘要、回答基于笔记内容的问题。使用搜索功能来精准定位相关内容。你还可以从研究内容生成闪卡帮助用户记忆关键知识点。",
    tools: [
      "read_note", "list_notes",
      "search_notes", "grep_search", "semantic_search",
      "query_database",
      "generate_flashcards", "create_flashcard",
      "get_backlinks", "read_cached_output"
    ],
  },

  writer: {
    slug: "writer",
    name: "✍️ 写作助手",
    icon: "pen-tool",
    roleDefinition: "你是一个创意写作助手，帮助用户扩展想法、完善草稿、润色文字、生成新内容。对于生成的长文本内容（如文章、计划、大纲），你应该优先将其保存为新的笔记文件，而不是直接在对话中输出。你还可以从内容生成闪卡。",
    tools: [
      "read_note", "create_note", "create_folder",
      "list_notes", "search_notes", "grep_search",
      "generate_flashcards", "create_flashcard", "read_cached_output"
    ],
  },
};

export function getMode(slug: AgentModeSlug): AgentMode {
  return MODES[slug];
}

export function getModeList(): AgentMode[] {
  return Object.values(MODES);
}
