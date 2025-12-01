import { useState, useCallback } from "react";
import type { PDFStructure, PDFElement, ParseStatus, ParseBackend } from "@/types/pdf";

/**
 * PDF 结构解析 Hook
 * 管理 PDF 的结构化数据，包括文本块、图片、表格、公式等元素
 */
export function usePDFStructure() {
  const [structure, setStructure] = useState<PDFStructure | null>(null);
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseBackend, setParseBackend] = useState<ParseBackend>('none');

  // 解析 PDF 结构（当前为模拟实现）
  const parseStructure = useCallback(async (_pdfPath: string, backend: ParseBackend = 'none') => {
    setParseStatus('parsing');
    setParseError(null);
    setParseBackend(backend);

    try {
      // TODO: 实际的解析逻辑
      // 目前返回空结构，后续接入 PP-Structure 或其他服务
      
      await new Promise(resolve => setTimeout(resolve, 500)); // 模拟延迟

      // 生成模拟数据用于测试
      const mockStructure = generateMockStructure();
      
      setStructure(mockStructure);
      setParseStatus('done');
    } catch (err) {
      console.error('Failed to parse PDF structure:', err);
      setParseError(err instanceof Error ? err.message : '解析失败');
      setParseStatus('error');
    }
  }, []);

  // 清除结构数据
  const clearStructure = useCallback(() => {
    setStructure(null);
    setParseStatus('idle');
    setParseError(null);
    setParseBackend('none');
  }, []);

  // 获取指定页的元素
  const getPageElements = useCallback((pageIndex: number): PDFElement[] => {
    if (!structure) return [];
    const page = structure.pages.find(p => p.pageIndex === pageIndex);
    return page?.blocks || [];
  }, [structure]);

  // 获取所有元素
  const getAllElements = useCallback((): PDFElement[] => {
    if (!structure) return [];
    return structure.pages.flatMap(p => p.blocks);
  }, [structure]);

  return {
    structure,
    parseStatus,
    parseError,
    parseBackend,
    parseStructure,
    clearStructure,
    getPageElements,
    getAllElements,
  };
}

// 生成模拟结构数据（用于开发测试）
function generateMockStructure(): PDFStructure {
  return {
    pageCount: 1,
    pages: [
      {
        pageIndex: 1,
        width: 595,
        height: 842,
        blocks: [
          {
            id: 'mock-text-1',
            type: 'text',
            bbox: [50, 50, 300, 80],
            pageIndex: 1,
            content: '这是一段模拟的文本内容',
          },
          {
            id: 'mock-text-2',
            type: 'text',
            bbox: [50, 100, 400, 150],
            pageIndex: 1,
            content: '这是另一段更长的模拟文本内容，用于测试元素识别和交互功能。',
          },
          {
            id: 'mock-image-1',
            type: 'image',
            bbox: [50, 200, 250, 350],
            pageIndex: 1,
            caption: '图 1: 示例图片',
          },
        ],
      },
    ],
  };
}
