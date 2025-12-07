/**
 * 读取已缓存的工具长输出
 */

import { getCachedToolOutput } from "@/agent/core/ToolOutputCache";
import { ToolExecutor, ToolResult } from "../../types";

export const ReadCachedOutputTool: ToolExecutor = {
  name: "read_cached_output",
  requiresApproval: false,
  async execute(params): Promise<ToolResult> {
    const id = typeof params.id === "string" ? params.id.trim() : "";

    if (!id) {
      return {
        success: false,
        content: "",
        error: "缺少 id 参数",
      };
    }

    const cached = getCachedToolOutput(id);

    if (!cached) {
      return {
        success: false,
        content: "",
        error: `未找到缓存的输出，id=${id}，可能已过期或未生成缓存。`,
      };
    }

    return {
      success: true,
      content: cached.content,
    };
  },
};
