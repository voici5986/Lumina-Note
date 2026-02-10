/**
 * 统一的消息发送 Hook
 * 处理 @ 引用文件的读取、显示消息构建、发送逻辑
 */

import { useCallback } from "react";
import { readFile } from "@/lib/tauri";
import { getCurrentTranslations } from "@/stores/useLocaleStore";
import type { FileAttachment } from "@/services/llm";

export interface ReferencedFile {
  path: string;
  name: string;
  isFolder: boolean;
}

export interface SendOptions {
  message: string;
  referencedFiles: ReferencedFile[];
}

export interface ProcessedMessage {
  displayMessage: string;  // 用于前端显示（仅用户输入文本）
  fullMessage: string;     // 发送给 AI（包含文件完整内容）
  fileContext: string;     // 引用文件的内容（用于上下文）
  attachments: FileAttachment[];
}

/**
 * 处理消息和引用文件，构建显示消息和完整消息
 */
export async function processMessageWithFiles(
  message: string,
  referencedFiles: ReferencedFile[]
): Promise<ProcessedMessage> {
  const t = getCurrentTranslations();
  // 构建文件附件（在气泡里独立展示，不再拼到文本里）
  const attachments: FileAttachment[] = referencedFiles
    .filter(f => !f.isFolder)
    .map(f => ({
      type: "file",
      name: f.name,
      path: f.path,
    }));
  
  const trimmedMessage = message.trim();
  const displayMessage = trimmedMessage;

  // 读取引用文件的内容（用于发送给 AI）
  let fileContext = "";
  for (const file of referencedFiles) {
    if (!file.isFolder) {
      try {
        const content = await readFile(file.path);
        const fileHeader = t.ai.fileContextLabel.replace("{name}", file.name);
        fileContext += `\n\n--- ${fileHeader} ---\n${content}`;
      } catch (e) {
        console.error(`Failed to read file ${file.path}:`, e);
      }
    }
  }

  // 完整消息（包含文件内容，发送给 AI）
  const fullMessage = fileContext
    ? `${trimmedMessage}\n\n${t.ai.fileContextTag}${fileContext}`
    : trimmedMessage;

  return {
    displayMessage,
    fullMessage,
    fileContext: fileContext.trim(),
    attachments,
  };
}

/**
 * Hook: 提供统一的消息处理函数
 */
export function useChatSend() {
  const processMessage = useCallback(async (
    message: string,
    referencedFiles: ReferencedFile[]
  ): Promise<ProcessedMessage> => {
    return processMessageWithFiles(message, referencedFiles);
  }, []);

  return { processMessage };
}
