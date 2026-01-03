//! 工作区目录结构生成器
//!
//! 完全对齐 Windsurf 的 workspace_layout 实现
//! 
//! 输出格式：
//! ```xml
//! <workspace_layout workspace="d:\Desktop\project">
//! - src/
//!   - agent/
//!     - __init__.py
//!     - core.py
//!     - [+35 files (35 py) & 0 dirs]
//!   - components/
//! - docs/
//!   - README.md
//! </workspace_layout>
//! ```

use std::path::Path;
use std::collections::HashMap;
use tokio::fs;

/// 工作区布局配置（对齐 Windsurf）
#[derive(Debug, Clone)]
pub struct WorkspaceLayoutConfig {
    /// 最大深度（Windsurf 约 4-5 层）
    pub max_depth: usize,
    /// 每个目录最多显示的文件数（Windsurf 约 3-4 个）
    pub max_files_per_dir: usize,
    /// 每个目录最多显示的子目录数
    pub max_dirs_per_dir: usize,
    /// 最大总 token 数（Windsurf 约 800-1000）
    pub max_tokens: usize,
    /// 是否显示隐藏文件（Windsurf 不显示）
    pub show_hidden: bool,
}

impl Default for WorkspaceLayoutConfig {
    fn default() -> Self {
        Self {
            max_depth: 5,
            max_files_per_dir: 4,
            max_dirs_per_dir: 10,
            max_tokens: 1000,
            show_hidden: false,
        }
    }
}

/// 目录项
#[derive(Debug, Clone)]
struct DirEntry {
    name: String,
    is_dir: bool,
    extension: Option<String>,  // 文件扩展名，用于分组统计
    children: Vec<DirEntry>,
}

/// 生成工作区布局
///
/// 返回类似 Windsurf 的格式：
/// ```text
/// <workspace_layout>
/// - src/
///   - agent/
///     - [+5 files & 2 dirs]
///   - components/
/// - docs/
///   - README.md
/// </workspace_layout>
/// ```
pub async fn generate_workspace_layout(
    workspace_path: &str,
    config: &WorkspaceLayoutConfig,
) -> Result<String, String> {
    let path = Path::new(workspace_path);
    if !path.exists() {
        return Err("Workspace path does not exist".to_string());
    }

    // 使用 ignore crate 遵守 .gitignore
    let mut entries = Vec::new();
    collect_entries(workspace_path, workspace_path, 0, config, &mut entries).await?;

    // 渲染树形结构
    let mut output = String::new();
    output.push_str(&format!("<workspace_layout workspace=\"{}\">\n", workspace_path));
    
    render_tree(&entries, 0, &mut output, config);
    
    output.push_str("</workspace_layout>");

    // Token 裁剪
    let output = fit_to_token_budget(&output, config.max_tokens);

    Ok(output)
}

/// 递归收集目录条目
async fn collect_entries(
    base_path: &str,
    current_path: &str,
    depth: usize,
    config: &WorkspaceLayoutConfig,
    entries: &mut Vec<DirEntry>,
) -> Result<(), String> {
    if depth > config.max_depth {
        return Ok(());
    }

    let mut read_dir = fs::read_dir(current_path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut dirs = Vec::new();
    let mut files: Vec<(String, Option<String>)> = Vec::new(); // (name, extension)

    while let Some(entry) = read_dir.next_entry().await.map_err(|e| e.to_string())? {
        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // 跳过隐藏文件（除非配置允许）
        if !config.show_hidden && file_name.starts_with('.') {
            continue;
        }

        // 跳过常见的忽略目录
        if should_ignore(&file_name) {
            continue;
        }

        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        
        if file_type.is_dir() {
            dirs.push((file_name, entry.path()));
        } else if file_type.is_file() {
            // 提取扩展名
            let ext = Path::new(&file_name)
                .extension()
                .and_then(|e| e.to_str())
                .map(|s| s.to_lowercase());
            files.push((file_name, ext));
        }
    }

    // 排序
    dirs.sort_by(|a, b| a.0.cmp(&b.0));
    files.sort_by(|a, b| a.0.cmp(&b.0));

    // 添加目录（限制数量）
    let dir_count = dirs.len();
    let shown_dirs: Vec<_> = dirs.into_iter().take(config.max_dirs_per_dir).collect();
    let hidden_dirs = dir_count.saturating_sub(config.max_dirs_per_dir);
    
    for (name, path) in shown_dirs {
        let mut dir_entry = DirEntry {
            name: format!("{}/", name),
            is_dir: true,
            extension: None,
            children: Vec::new(),
        };
        
        // 递归收集子目录
        Box::pin(collect_entries(
            base_path,
            path.to_str().unwrap_or(""),
            depth + 1,
            config,
            &mut dir_entry.children,
        ))
        .await?;
        
        entries.push(dir_entry);
    }

    // 添加文件（限制数量）
    let _file_count = files.len();
    let shown_files: Vec<_> = files.iter().take(config.max_files_per_dir).cloned().collect();
    let hidden_files: Vec<_> = files.iter().skip(config.max_files_per_dir).cloned().collect();

    for (name, ext) in shown_files {
        entries.push(DirEntry {
            name,
            is_dir: false,
            extension: ext,
            children: Vec::new(),
        });
    }

    // 如果有隐藏的文件或目录，添加 Windsurf 风格的摘要
    // 格式：[+N files (分类统计) & M dirs]
    if !hidden_files.is_empty() || hidden_dirs > 0 {
        let summary = format_hidden_summary(&hidden_files, hidden_dirs);
        entries.push(DirEntry {
            name: summary,
            is_dir: false,
            extension: None,
            children: Vec::new(),
        });
    }

    Ok(())
}

/// 格式化隐藏文件/目录的摘要（Windsurf 风格）
/// 
/// 输出格式：`[+N files (分类统计) & M dirs]`
/// 例如：
/// - `[+7 files (7 yml) & 0 dirs]`
/// - `[+35 files (35 py) & 0 dirs]`
/// - `[+6 files (1 py, 1 md, 1 txt, 2 js, 1 lisp) & 0 dirs]`
fn format_hidden_summary(hidden_files: &[(String, Option<String>)], hidden_dirs: usize) -> String {
    let file_count = hidden_files.len();
    
    if file_count == 0 {
        return format!("[+0 files & {} dirs]", hidden_dirs);
    }
    
    // 按扩展名分组统计
    let mut ext_counts: HashMap<String, usize> = HashMap::new();
    for (_, ext) in hidden_files {
        let key = ext.clone().unwrap_or_else(|| "other".to_string());
        *ext_counts.entry(key).or_insert(0) += 1;
    }
    
    // 按数量降序排序，然后按扩展名字母序
    let mut ext_list: Vec<_> = ext_counts.into_iter().collect();
    ext_list.sort_by(|a, b| {
        b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0))
    });
    
    // 格式化扩展名统计
    let ext_summary = if ext_list.len() == 1 {
        // 单一类型：(7 yml)
        let (ext, count) = &ext_list[0];
        format!("{} {}", count, ext)
    } else {
        // 多类型：(1 py, 1 md, 1 txt)
        ext_list.iter()
            .map(|(ext, count)| format!("{} {}", count, ext))
            .collect::<Vec<_>>()
            .join(", ")
    };
    
    format!("[+{} files ({}) & {} dirs]", file_count, ext_summary, hidden_dirs)
}

/// 检查是否应该忽略
fn should_ignore(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".svn"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".idea"
            | ".vscode"
            | "*.pyc"
            | ".DS_Store"
            | "Thumbs.db"
    )
}

/// 渲染树形结构（Windsurf 风格）
/// 
/// 格式：
/// - 2 空格缩进
/// - 每行以 `- ` 开头
/// - 目录以 `/` 结尾
fn render_tree(
    entries: &[DirEntry],
    depth: usize,
    output: &mut String,
    config: &WorkspaceLayoutConfig,
) {
    // Windsurf 使用 2 空格缩进
    let indent = "  ".repeat(depth);
    
    for entry in entries {
        output.push_str(&format!("{}- {}\n", indent, entry.name));
        
        // 递归渲染子目录
        if entry.is_dir && !entry.children.is_empty() && depth < config.max_depth {
            render_tree(&entry.children, depth + 1, output, config);
        }
    }
}

/// 裁剪到 token 预算
fn fit_to_token_budget(content: &str, max_tokens: usize) -> String {
    let estimated_tokens = estimate_tokens(content);
    
    if estimated_tokens <= max_tokens {
        return content.to_string();
    }

    // 简单截断策略：保留前面的内容
    let lines: Vec<&str> = content.lines().collect();
    let mut output = String::new();
    let mut current_tokens = 0;
    
    for line in lines {
        let line_tokens = estimate_tokens(line);
        if current_tokens + line_tokens > max_tokens - 50 {
            // 留一些空间给结尾
            output.push_str("  - [...more...]\n");
            break;
        }
        output.push_str(line);
        output.push('\n');
        current_tokens += line_tokens;
    }
    
    // 确保有结束标签
    if !output.contains("</workspace_layout>") {
        output.push_str("</workspace_layout>");
    }
    
    output
}

/// 估算 token 数
fn estimate_tokens(text: &str) -> usize {
    // 简化估算：英文约 4 字符 = 1 token，中文 1 字符 = 1 token
    let mut tokens = 0;
    let mut ascii_chars = 0;
    
    for c in text.chars() {
        if c.is_ascii() {
            ascii_chars += 1;
        } else {
            tokens += 1;
        }
    }
    
    tokens + ascii_chars / 4
}

/// 生成简化的文件列表（用于 coordinator）
pub async fn generate_file_list(
    workspace_path: &str,
    max_files: usize,
) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    
    collect_files_recursive(workspace_path, workspace_path, &mut files, max_files).await?;
    
    Ok(files)
}

/// 递归收集文件列表
async fn collect_files_recursive(
    base_path: &str,
    current_path: &str,
    files: &mut Vec<String>,
    max_files: usize,
) -> Result<(), String> {
    if files.len() >= max_files {
        return Ok(());
    }

    let mut read_dir = fs::read_dir(current_path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    while let Some(entry) = read_dir.next_entry().await.map_err(|e| e.to_string())? {
        if files.len() >= max_files {
            break;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        
        // 跳过隐藏文件和忽略目录
        if file_name.starts_with('.') || should_ignore(&file_name) {
            continue;
        }

        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        let path = entry.path();
        
        if file_type.is_dir() {
            Box::pin(collect_files_recursive(
                base_path,
                path.to_str().unwrap_or(""),
                files,
                max_files,
            ))
            .await?;
        } else if file_type.is_file() {
            // 获取相对路径
            let rel_path = path
                .strip_prefix(base_path)
                .unwrap_or(&path)
                .to_str()
                .unwrap_or("")
                .replace('\\', "/");
            
            files.push(rel_path);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_should_ignore() {
        assert!(should_ignore("node_modules"));
        assert!(should_ignore(".git"));
        assert!(!should_ignore("src"));
        assert!(!should_ignore("README.md"));
    }

    #[test]
    fn test_estimate_tokens() {
        assert!(estimate_tokens("Hello world") < 10);
        assert!(estimate_tokens("你好世界") == 4);
    }
}
