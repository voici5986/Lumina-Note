//! Fast Search 子代理 - 类似 Windsurf Fast Context
//! 通过并行 grep 快速搜索笔记库，不经过 LLM

use std::path::Path;
use walkdir::WalkDir;
use rayon::prelude::*;

/// 搜索结果
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub files: Vec<FileMatch>,
    pub files_scanned: usize,
    pub duration_ms: u64,
    pub keywords_used: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct FileMatch {
    pub path: String,
    pub keyword_hits: usize,
    pub lines: Vec<LineMatch>,
}

#[derive(Debug, Clone)]
pub struct LineMatch {
    pub line_number: usize,
    pub content: String,
    pub keyword: String,
}

/// Fast Search 子代理
pub struct FastSearch {
    workspace_path: String,
}

impl FastSearch {
    pub fn new(workspace_path: &str) -> Self {
        Self { workspace_path: workspace_path.to_string() }
    }

    /// 使用 LLM 提取的关键词执行快速搜索
    pub fn search_keywords(&self, keywords: &[String]) -> SearchResult {
        let start = std::time::Instant::now();
        
        if keywords.is_empty() {
            return SearchResult {
                files: vec![],
                files_scanned: 0,
                duration_ms: start.elapsed().as_millis() as u64,
                keywords_used: vec![],
            };
        }

        // 1. 收集所有 .md 文件
        let md_files = self.collect_md_files();
        let files_scanned = md_files.len();

        // 2. 并行搜索（使用 rayon）
        let file_matches: Vec<FileMatch> = md_files.par_iter()
            .filter_map(|file_path| {
                self.search_file(file_path, keywords)
            })
            .collect();

        // 3. 排序：按关键词命中数降序
        let mut sorted: Vec<_> = file_matches.into_iter()
            .filter(|m| !m.lines.is_empty())
            .collect();
        sorted.sort_by(|a, b| b.keyword_hits.cmp(&a.keyword_hits));
        sorted.truncate(20);

        SearchResult {
            files: sorted,
            files_scanned,
            duration_ms: start.elapsed().as_millis() as u64,
            keywords_used: keywords.to_vec(),
        }
    }

    /// 执行快速搜索（自动提取关键词，备用）
    #[allow(dead_code)]
    pub fn search(&self, query: &str) -> SearchResult {
        let keywords = extract_keywords(query);
        self.search_keywords(&keywords)
    }

    fn collect_md_files(&self) -> Vec<String> {
        WalkDir::new(&self.workspace_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                let path = e.path();
                let path_str = path.to_string_lossy();
                path.extension().map(|e| e == "md").unwrap_or(false)
                    && !path_str.contains(".obsidian")
                    && !path_str.contains(".lumina")
                    && !path_str.contains("/.")
                    && !path_str.contains("\\.")
            })
            .map(|e| e.path().to_string_lossy().to_string())
            .collect()
    }

    fn search_file(&self, file_path: &str, keywords: &[String]) -> Option<FileMatch> {
        let content = std::fs::read_to_string(file_path).ok()?;
        let mut lines = Vec::new();
        let mut keyword_set = std::collections::HashSet::new();

        for (i, line) in content.lines().enumerate() {
            for kw in keywords {
                if line.to_lowercase().contains(&kw.to_lowercase()) {
                    keyword_set.insert(kw.clone());
                    lines.push(LineMatch {
                        line_number: i + 1,
                        content: line.chars().take(200).collect(),
                        keyword: kw.clone(),
                    });
                    if lines.len() >= 10 { break; }
                }
            }
            if lines.len() >= 10 { break; }
        }

        if lines.is_empty() { return None; }

        let relative = Path::new(file_path)
            .strip_prefix(&self.workspace_path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| file_path.to_string());

        Some(FileMatch {
            path: relative,
            keyword_hits: keyword_set.len(),
            lines,
        })
    }
}

/// 从查询中提取关键词
fn extract_keywords(query: &str) -> Vec<String> {
    // 中文停用词（单字）- 用于分割
    let chinese_stopwords: std::collections::HashSet<char> = [
        '的', '了', '是', '在', '我', '有', '和', '就', '不', '都', '一', '个',
        '这', '那', '你', '他', '她', '它', '们', '与', '及', '或', '等', '把',
        '被', '让', '给', '向', '从', '到', '为', '以', '于', '而', '且', '但',
    ].into_iter().collect();
    
    // 多字停用词
    let stopwords: std::collections::HashSet<&str> = [
        "搜索", "查找", "找到", "相关", "关于", "全部", "所有", "帮我", "请问",
        "什么", "怎么", "如何", "哪些", "哪个", "可以", "能够", "需要",
        "the", "a", "an", "is", "are", "for", "all", "search", "find",
    ].into_iter().collect();

    let mut keywords = Vec::new();
    let mut current = String::new();
    
    for c in query.chars() {
        let is_chinese = c >= '\u{4e00}' && c <= '\u{9fff}';
        
        // 中文停用词字符作为分隔符
        if is_chinese && chinese_stopwords.contains(&c) {
            if !current.is_empty() && current.chars().count() > 1 {
                if !stopwords.contains(current.as_str()) {
                    keywords.push(current.clone());
                }
            }
            current.clear();
        } else if c.is_alphanumeric() || is_chinese {
            current.push(c);
        } else {
            // 非字母数字非中文作为分隔符
            if !current.is_empty() && current.chars().count() > 1 {
                if !stopwords.contains(current.as_str()) {
                    keywords.push(current.clone());
                }
            }
            current.clear();
        }
    }
    
    // 处理最后一个词
    if !current.is_empty() && current.chars().count() > 1 {
        if !stopwords.contains(current.as_str()) {
            keywords.push(current);
        }
    }

    // 去重并限制数量
    let mut unique: Vec<String> = Vec::new();
    for kw in keywords {
        if !unique.contains(&kw) {
            unique.push(kw);
        }
    }
    
    unique.into_iter().take(8).collect()
}

impl SearchResult {
    /// 格式化为工具返回格式
    pub fn format(&self) -> String {
        if self.files.is_empty() {
            return format!(
                "No matches found (scanned {} files in {}ms, keywords: {:?})",
                self.files_scanned, self.duration_ms, self.keywords_used
            );
        }

        let mut output = format!(
            "Found {} files (scanned {} files in {}ms, keywords: {:?}):\n\n",
            self.files.len(), self.files_scanned, self.duration_ms, self.keywords_used
        );

        for file in &self.files {
            output.push_str(&format!("📄 {} ({}个关键词命中)\n", file.path, file.keyword_hits));
            for line in &file.lines {
                output.push_str(&format!("  L{}: {}\n", line.line_number, line.content));
            }
            output.push('\n');
        }

        output
    }
}
