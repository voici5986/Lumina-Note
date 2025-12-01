# PP-Structure PDF 解析服务设置指南

## 概述

PP-Structure 是 PaddleOCR 提供的文档结构分析工具，可以识别 PDF 中的文本、图片、表格等元素。

## 安装步骤

### 1. 安装 Python 依赖

```bash
cd scripts
pip install -r requirements-pp-structure.txt
```

### 2. 启动服务

```bash
python pp_structure_server.py
```

服务将在 `http://localhost:8080` 启动。

### 3. 测试服务

```bash
curl http://localhost:8080/health
```

应返回:
```json
{"status": "ok", "backend": "pp-structure"}
```

## API 接口

### POST /parse

解析 PDF 文件并返回结构化数据。

**请求**:
```json
{
  "pdf_path": "/path/to/document.pdf",
  "layout_analysis": true,
  "table_recognition": true,
  "ocr_engine": "paddleocr"
}
```

**响应**:
```json
{
  "structure": {
    "pageCount": 2,
    "pages": [
      {
        "pageIndex": 1,
        "width": 595,
        "height": 842,
        "blocks": [
          {
            "id": "el_1_0",
            "type": "text",
            "bbox": [50, 50, 300, 80],
            "pageIndex": 1,
            "content": "识别的文本内容"
          }
        ]
      }
    ]
  }
}
```

## 性能优化建议

1. **使用 GPU 加速**: 安装 `paddlepaddle-gpu` 代替 `paddlepaddle`
2. **调整图片 DPI**: 降低 DPI 可提高速度但可能影响识别准确率
3. **启用缓存**: 前端已实现缓存机制，避免重复解析

## 故障排除

### 端口被占用

修改 `pp_structure_server.py` 中的端口号：
```python
app.run(host='0.0.0.0', port=8081, debug=True)
```

并更新前端配置中的 `apiUrl`。

### 内存不足

处理大型 PDF 时可能内存不足，可以：
- 分页处理
- 降低图片渲染 DPI
- 增加系统虚拟内存

## 替代方案

如果 PP-Structure 性能不满足需求，可以考虑：

1. **DeepSeek OCR**: 使用 API 调用，无需本地部署
2. **Azure Document Intelligence**: 云服务，识别准确率高
3. **AWS Textract**: 支持表格和表单识别

修改 `src/hooks/usePDFStructure.ts` 中的 `backend` 参数即可切换。
