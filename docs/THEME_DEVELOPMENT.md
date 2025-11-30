# Lumina Note 主题开发指南

> 版本: 1.0.0 | 最后更新: 2025-06-01

本文档面向社区开发者，详细说明如何为 Lumina Note 开发自定义主题。

---

## 📖 目录

1. [概述](#概述)
2. [快速开始](#快速开始)
3. [主题文件规范](#主题文件规范)
4. [颜色变量参考](#颜色变量参考)
5. [CodeMirror 编辑器主题](#codemirror-编辑器主题)
6. [完整示例](#完整示例)
7. [调试与测试](#调试与测试)
8. [发布主题](#发布主题)

---

## 概述

Lumina Note 使用 **CSS 变量（CSS Custom Properties）** 实现主题系统。开发者只需要定义一组颜色值，即可创建完整的主题。

### 主题系统特点

- ✅ 支持亮色/暗色两种模式
- ✅ 基于 HSL 颜色空间（便于调整）
- ✅ 热重载，修改后即时生效
- ✅ 可扩展 CodeMirror 编辑器主题

### 技术栈

- **UI 框架**: React + TailwindCSS
- **编辑器**: CodeMirror 6
- **颜色格式**: HSL（色相 饱和度% 亮度%）

---

## 快速开始

### 1. 创建主题文件

在笔记库的 `.lumina/themes/` 目录下创建主题文件：

```
你的笔记库/
└── .lumina/
    └── themes/
        └── my-theme.theme.json
```

### 2. 编写基本结构

```json
{
  "name": "My Theme",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "A beautiful custom theme",
  "colors": {
    "light": {
      "background": "0 0% 100%",
      "foreground": "0 0% 10%",
      "primary": "220 80% 50%"
    },
    "dark": {
      "background": "0 0% 10%",
      "foreground": "0 0% 90%",
      "primary": "220 80% 60%"
    }
  }
}
```

### 3. 在设置中选择主题

打开设置 → 外观 → 主题 → 选择你的主题

---

## 主题文件规范

### 文件格式

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 主题名称（显示在设置中） |
| `author` | string | ❌ | 作者名称 |
| `version` | string | ❌ | 版本号（语义化版本） |
| `description` | string | ❌ | 主题描述 |
| `colors` | object | ✅ | 颜色定义 |
| `colors.light` | ColorScheme | ✅ | 亮色模式颜色 |
| `colors.dark` | ColorScheme | ✅ | 暗色模式颜色 |
| `editor` | EditorTheme | ❌ | CodeMirror 编辑器主题 |

### ColorScheme 对象

```typescript
interface ColorScheme {
  // === 必填颜色 ===
  background: string;         // 主背景色
  foreground: string;         // 主文字色
  muted: string;              // 次要背景（侧边栏、面板）
  mutedForeground: string;    // 次要文字
  accent: string;             // 强调背景（悬浮、选中）
  accentForeground: string;   // 强调文字
  primary: string;            // 主色（按钮、链接、用户消息气泡）
  primaryForeground: string;  // 主色上的文字
  border: string;             // 边框、分割线

  // === 可选颜色 ===
  destructive?: string;       // 危险色（删除按钮）
  destructiveForeground?: string;
  success?: string;           // 成功色
  warning?: string;           // 警告色
  info?: string;              // 信息色
}
```

### 颜色值格式

颜色使用 **HSL 格式**，但不需要 `hsl()` 函数包裹：

```
格式: "色相 饱和度% 亮度%"
示例: "220 80% 50%"
     ↑    ↑    ↑
    色相  饱和  亮度
    0-360 0-100 0-100
```

**常见颜色 HSL 值：**

| 颜色 | HSL 值 |
|------|--------|
| 白色 | `0 0% 100%` |
| 黑色 | `0 0% 0%` |
| 红色 | `0 100% 50%` |
| 绿色 | `120 100% 50%` |
| 蓝色 | `220 100% 50%` |
| 灰色 | `0 0% 50%` |
| 暖白 | `45 10% 98%` |
| 冷白 | `210 10% 98%` |

---

## 颜色变量参考

### 核心颜色（必须定义）

| 变量名 | 用途 | 应用位置 |
|--------|------|----------|
| `background` | 主背景 | 整个应用背景 |
| `foreground` | 主文字 | 正文、标题 |
| `muted` | 次要背景 | 侧边栏、面板、代码块背景 |
| `mutedForeground` | 次要文字 | 占位符、注释、次要信息 |
| `accent` | 强调背景 | 悬浮状态、选中项背景 |
| `accentForeground` | 强调文字 | 悬浮/选中时的文字 |
| `primary` | 主色 | 按钮、链接、发送消息气泡 |
| `primaryForeground` | 主色文字 | 按钮文字、消息文字 |
| `border` | 边框 | 所有边框、分割线 |

### UI 组件对应关系

```
┌─────────────────────────────────────────────────────────┐
│  标题栏                                    [background] │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│  侧边栏      │     编辑器区域                           │
│  [muted]     │     [background]                         │
│              │                                          │
│  文件列表    │     # 标题 [foreground]                  │
│  [foreground]│                                          │
│              │     正文内容 [foreground]                │
│  悬浮项      │                                          │
│  [accent]    │     `代码` [muted]                       │
│              │                                          │
│              │     [[链接]] [primary]                   │
│              │                                          │
├──────────────┼──────────────────────────────────────────┤
│              │  ┌────────────────────────────────────┐  │
│  会话列表    │  │  用户消息气泡 [primary]            │  │
│  [muted]     │  │  文字 [primaryForeground]          │  │
│              │  └────────────────────────────────────┘  │
│              │  ┌────────────────────────────────────┐  │
│              │  │  AI 消息 [muted]                   │  │
│              │  └────────────────────────────────────┘  │
│              │                                          │
│              │  ┌────────────────────────────────────┐  │
│              │  │  输入框 [background] [border]      │  │
│              │  │                        [发送 primary]│ │
│              │  └────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────┘
```

### 扩展颜色（可选）

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| `destructive` | 删除、错误 | 红色系 |
| `destructiveForeground` | 危险按钮文字 | 白色 |
| `success` | 成功提示 | 绿色系 |
| `warning` | 警告提示 | 黄色系 |
| `info` | 信息提示 | 蓝色系 |

---

## CodeMirror 编辑器主题

编辑器使用 CodeMirror 6，需要单独定义语法高亮颜色。

### 编辑器主题结构

```json
{
  "editor": {
    "syntax": {
      "comment": "0 0% 50%",        // 注释
      "keyword": "280 80% 60%",     // 关键字
      "string": "120 60% 50%",      // 字符串
      "number": "30 80% 55%",       // 数字
      "function": "200 80% 60%",    // 函数名
      "variable": "0 0% 80%",       // 变量
      "operator": "0 0% 70%"        // 运算符
    },
    "markdown": {
      "heading": "220 80% 55%",     // 标题 #
      "bold": "0 0% 90%",           // 粗体 **
      "italic": "0 0% 85%",         // 斜体 *
      "link": "200 80% 60%",        // 链接 []()
      "code": "150 50% 50%",        // 行内代码 ``
      "blockquote": "0 0% 60%",     // 引用 >
      "list": "30 70% 55%"          // 列表 - *
    },
    "ui": {
      "cursor": "0 0% 90%",         // 光标颜色
      "selection": "220 50% 40%",   // 选中背景
      "lineNumber": "0 0% 45%",     // 行号
      "activeLine": "0 0% 15%"      // 当前行背景
    }
  }
}
```

### Markdown 语法颜色

| 元素 | 变量 | 示例 |
|------|------|------|
| 标题 | `heading` | `# 标题` |
| 粗体 | `bold` | `**粗体**` |
| 斜体 | `italic` | `*斜体*` |
| 链接 | `link` | `[[WikiLink]]` `[text](url)` |
| 代码 | `code` | `` `code` `` |
| 引用 | `blockquote` | `> 引用` |
| 列表 | `list` | `- 项目` |
| 任务 | `checkbox` | `- [ ] 任务` |

---

## 完整示例

### 示例 1: Nord 主题

```json
{
  "name": "Nord",
  "author": "Arctic Ice Studio",
  "version": "1.0.0",
  "description": "An arctic, north-bluish color palette",
  "colors": {
    "light": {
      "background": "220 16% 96%",
      "foreground": "220 16% 22%",
      "muted": "220 16% 90%",
      "mutedForeground": "220 10% 50%",
      "accent": "220 16% 85%",
      "accentForeground": "220 16% 22%",
      "primary": "213 32% 52%",
      "primaryForeground": "220 16% 96%",
      "border": "220 16% 84%"
    },
    "dark": {
      "background": "220 16% 18%",
      "foreground": "218 27% 88%",
      "muted": "220 16% 22%",
      "mutedForeground": "219 28% 65%",
      "accent": "220 16% 26%",
      "accentForeground": "218 27% 92%",
      "primary": "213 32% 52%",
      "primaryForeground": "220 16% 96%",
      "border": "220 16% 28%"
    }
  },
  "editor": {
    "syntax": {
      "comment": "220 16% 50%",
      "keyword": "311 22% 65%",
      "string": "92 28% 65%",
      "number": "311 22% 65%",
      "function": "179 25% 65%"
    },
    "markdown": {
      "heading": "213 32% 60%",
      "link": "179 25% 65%",
      "code": "92 28% 65%"
    }
  }
}
```

### 示例 2: Dracula 主题

```json
{
  "name": "Dracula",
  "author": "Zeno Rocha",
  "version": "1.0.0",
  "description": "A dark theme for vampires",
  "colors": {
    "light": {
      "background": "231 15% 95%",
      "foreground": "231 15% 18%",
      "muted": "231 15% 90%",
      "mutedForeground": "231 10% 45%",
      "accent": "231 15% 85%",
      "accentForeground": "231 15% 18%",
      "primary": "265 89% 66%",
      "primaryForeground": "231 15% 95%",
      "border": "231 15% 82%"
    },
    "dark": {
      "background": "231 15% 18%",
      "foreground": "60 30% 96%",
      "muted": "232 14% 22%",
      "mutedForeground": "228 8% 60%",
      "accent": "232 14% 26%",
      "accentForeground": "60 30% 96%",
      "primary": "265 89% 66%",
      "primaryForeground": "231 15% 18%",
      "border": "232 14% 28%"
    }
  },
  "editor": {
    "syntax": {
      "comment": "225 27% 51%",
      "keyword": "326 100% 74%",
      "string": "65 92% 76%",
      "number": "265 89% 78%",
      "function": "135 94% 65%"
    },
    "markdown": {
      "heading": "265 89% 78%",
      "link": "191 97% 77%",
      "code": "135 94% 65%"
    }
  }
}
```

### 示例 3: 极简白主题

```json
{
  "name": "Minimal White",
  "author": "Community",
  "version": "1.0.0",
  "description": "A clean, minimal white theme",
  "colors": {
    "light": {
      "background": "0 0% 100%",
      "foreground": "0 0% 15%",
      "muted": "0 0% 97%",
      "mutedForeground": "0 0% 50%",
      "accent": "0 0% 95%",
      "accentForeground": "0 0% 15%",
      "primary": "0 0% 25%",
      "primaryForeground": "0 0% 100%",
      "border": "0 0% 90%"
    },
    "dark": {
      "background": "0 0% 8%",
      "foreground": "0 0% 90%",
      "muted": "0 0% 12%",
      "mutedForeground": "0 0% 55%",
      "accent": "0 0% 16%",
      "accentForeground": "0 0% 92%",
      "primary": "0 0% 75%",
      "primaryForeground": "0 0% 8%",
      "border": "0 0% 20%"
    }
  }
}
```

---

## 调试与测试

### 开发者工具调试

1. 打开开发者工具（`Ctrl+Shift+I` 或 `F12`）
2. 在 Console 中执行：

```javascript
// 查看当前所有 CSS 变量
const styles = getComputedStyle(document.documentElement);
console.log('background:', styles.getPropertyValue('--background'));
console.log('primary:', styles.getPropertyValue('--primary'));

// 实时修改颜色测试
document.documentElement.style.setProperty('--primary', '280 80% 60%');
```

### 颜色对比度检查

确保文字和背景有足够的对比度：

| 场景 | 最低对比度 |
|------|-----------|
| 正文 | 4.5:1 |
| 大标题 | 3:1 |
| UI 组件 | 3:1 |

推荐工具：
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)

### 测试清单

- [ ] 亮色模式下所有文字清晰可读
- [ ] 暗色模式下所有文字清晰可读
- [ ] 按钮、链接状态明显
- [ ] 选中状态可见
- [ ] 边框、分割线可见
- [ ] 代码块语法高亮正常
- [ ] Markdown 渲染正常

---

## 发布主题

### 文件命名规范

```
主题名-作者.theme.json

示例:
- nord-arctic.theme.json
- dracula-zeno.theme.json
- minimal-white-community.theme.json
```

### 发布到社区

1. **GitHub**: 在 Lumina Note 仓库提交 PR，添加到 `community-themes/` 目录
2. **论坛**: 在社区论坛分享你的主题文件
3. **自托管**: 提供下载链接，用户手动放入 `.lumina/themes/`

### 主题元数据

建议在主题文件中包含：

```json
{
  "name": "My Theme",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "Theme description",
  "homepage": "https://github.com/yourname/my-theme",
  "license": "MIT",
  "tags": ["dark", "colorful", "minimal"]
}
```

---

## 附录

### HSL 颜色速查

| 色相 | 颜色 |
|------|------|
| 0° | 红色 |
| 30° | 橙色 |
| 60° | 黄色 |
| 120° | 绿色 |
| 180° | 青色 |
| 220° | 蓝色 |
| 280° | 紫色 |
| 330° | 粉色 |

### 饱和度参考

| 饱和度 | 效果 |
|--------|------|
| 0% | 纯灰色 |
| 10-20% | 非常淡，近似灰色 |
| 30-50% | 柔和、高级感 |
| 60-80% | 正常彩色 |
| 90-100% | 非常鲜艳 |

### 亮度参考

| 亮度 | 效果 |
|------|------|
| 0% | 纯黑 |
| 10-20% | 深色背景 |
| 40-60% | 正常颜色 |
| 80-90% | 浅色背景 |
| 100% | 纯白 |

---

## 联系与支持

- **GitHub Issues**: 提交问题或建议
- **社区论坛**: 分享主题、交流设计
- **开发者群组**: 加入主题开发者社区

---

> 💡 **提示**: 好的主题不仅仅是换颜色，更要考虑整体的视觉平衡和用户体验。建议参考专业的配色方案，如 Nord、Dracula、One Dark 等。

