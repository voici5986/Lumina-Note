/**
 * 工具 JSON Schema 定义
 * 用于原生 Function Calling 模式
 */

export interface FunctionSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
        items?: { type: string };
      }>;
      required?: string[];
    };
  };
}

/**
 * 所有工具的 JSON Schema
 */
export const TOOL_SCHEMAS: FunctionSchema[] = [
  {
    type: "function",
    function: {
      name: "read_note",
      description: "读取笔记文件的内容，返回带行号的内容",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "笔记路径，相对于笔记库根目录",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_note",
      description: "对笔记进行精确的查找替换修改，可选重命名文件",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要编辑的笔记路径",
          },
          edits: {
            type: "array",
            description: "编辑操作数组，每个操作包含 search 和 replace 字段",
            items: { type: "object" },
          },
          new_name: {
            type: "string",
            description: "新文件名（可选），不包含路径，仅文件名",
          },
        },
        required: ["path", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "创建新的笔记文件",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "笔记路径，相对于笔记库根目录",
          },
          content: {
            type: "string",
            description: "完整的笔记内容",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "列出指定目录下的笔记文件和子目录",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "目录路径，相对于笔记库根目录，默认为根目录",
          },
          recursive: {
            type: "boolean",
            description: "是否递归列出子目录内容，默认 true",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "创建新的目录",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "目录路径，相对于笔记库根目录",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_file",
      description: "移动文件到新位置",
      parameters: {
        type: "object",
        properties: {
          from: {
            type: "string",
            description: "源文件路径",
          },
          to: {
            type: "string",
            description: "目标文件路径",
          },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "重命名文件或文件夹",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "原文件路径",
          },
          new_name: {
            type: "string",
            description: "新名称（不含路径）",
          },
        },
        required: ["path", "new_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "删除指定的笔记文件（移到回收站）",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "要删除的笔记路径",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_notes",
      description: "语义搜索笔记库，基于内容相似性找到相关笔记",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索查询，用自然语言描述",
          },
          directory: {
            type: "string",
            description: "限定搜索范围的目录",
          },
          limit: {
            type: "number",
            description: "返回结果数量，默认 10",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep_search",
      description: "全文搜索笔记库，支持正则表达式",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词或正则表达式",
          },
          directory: {
            type: "string",
            description: "限定搜索范围的目录",
          },
          regex: {
            type: "boolean",
            description: "是否启用正则表达式模式",
          },
          case_sensitive: {
            type: "boolean",
            description: "是否区分大小写",
          },
          limit: {
            type: "number",
            description: "返回结果数量上限",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "semantic_search",
      description: "使用 AI 嵌入进行语义搜索",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "自然语言查询",
          },
          directory: {
            type: "string",
            description: "限定搜索范围的目录",
          },
          limit: {
            type: "number",
            description: "返回结果数量",
          },
          min_score: {
            type: "number",
            description: "最低相似度分数 (0-1)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_database",
      description: "查询数据库结构和行数据",
      parameters: {
        type: "object",
        properties: {
          database_id: {
            type: "string",
            description: "数据库 ID",
          },
          filter_column: {
            type: "string",
            description: "过滤列名",
          },
          filter_value: {
            type: "string",
            description: "过滤值",
          },
          limit: {
            type: "number",
            description: "返回行数上限",
          },
        },
        required: ["database_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_database_row",
      description: "向数据库添加新行",
      parameters: {
        type: "object",
        properties: {
          database_id: {
            type: "string",
            description: "数据库 ID",
          },
          cells: {
            type: "object",
            description: "单元格值，键为列名",
          },
        },
        required: ["database_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_backlinks",
      description: "获取链接到指定笔记的所有笔记（反向链接）",
      parameters: {
        type: "object",
        properties: {
          note_name: {
            type: "string",
            description: "笔记名称（不含 .md 后缀）",
          },
          include_context: {
            type: "boolean",
            description: "是否包含链接上下文",
          },
        },
        required: ["note_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "向用户提问并等待回复",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "要问用户的问题",
          },
          options: {
            type: "array",
            description: "可选的选项列表",
            items: { type: "string" },
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "attempt_completion",
      description: "标记任务完成并提供结果总结",
      parameters: {
        type: "object",
        properties: {
          result: {
            type: "string",
            description: "任务完成的结果描述",
          },
        },
        required: ["result"],
      },
    },
  },
];

/**
 * 根据模式过滤工具
 */
export function getToolSchemas(toolNames: string[]): FunctionSchema[] {
  return TOOL_SCHEMAS.filter((schema) =>
    toolNames.includes(schema.function.name)
  );
}
