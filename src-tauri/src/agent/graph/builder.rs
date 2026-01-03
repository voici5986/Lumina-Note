//! Agent 图构建器
//! 
//! 使用 langgraph-rust 框架构建 Agent 执行图

use std::sync::Arc;
use tauri::AppHandle;

use crate::langgraph::prelude::{StateGraph, CompiledGraph, GraphError};
use crate::langgraph::error::GraphResult;
use crate::agent::types::{
    GraphState, AgentConfig, TaskIntent,
};
use crate::agent::llm_client::LlmClient;
use crate::agent::graph::nodes::*;

/// Agent 执行上下文
/// 
/// 包含节点执行所需的共享资源
#[derive(Clone)]
pub struct AgentContext {
    pub app: AppHandle,
    pub llm: Arc<LlmClient>,
    pub config: AgentConfig,
}

impl AgentContext {
    pub fn new(app: AppHandle, config: AgentConfig) -> Self {
        let llm = Arc::new(LlmClient::new(config.clone()));
        Self { app, llm, config }
    }
}

/// 构建 Agent 图
/// 
/// 返回编译后的图，可以使用 `invoke()` 执行
pub fn build_agent_graph(ctx: AgentContext) -> GraphResult<CompiledGraph<GraphState>> {
    let mut graph = StateGraph::<GraphState>::new();
    
    // ============ 添加节点 ============
    
    // 协调器节点 - 分析用户意图
    let ctx_coordinator = ctx.clone();
    graph.add_node("coordinator", move |state: GraphState| {
        let ctx = ctx_coordinator.clone();
        async move {
            let result = coordinator_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "coordinator".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 规划器节点 - 分解复杂任务
    let ctx_planner = ctx.clone();
    graph.add_node("planner", move |state: GraphState| {
        let ctx = ctx_planner.clone();
        async move {
            let result = planner_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "planner".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 执行器节点 - 执行计划步骤
    let ctx_executor = ctx.clone();
    graph.add_node("executor", move |state: GraphState| {
        let ctx = ctx_executor.clone();
        async move {
            let result = executor_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "executor".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 编辑器节点 - 编辑笔记
    let ctx_editor = ctx.clone();
    graph.add_node("editor", move |state: GraphState| {
        let ctx = ctx_editor.clone();
        async move {
            let result = editor_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "editor".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 研究员节点 - 搜索研究
    let ctx_researcher = ctx.clone();
    graph.add_node("researcher", move |state: GraphState| {
        let ctx = ctx_researcher.clone();
        async move {
            let result = researcher_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "researcher".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 写作者节点 - 创建内容
    let ctx_writer = ctx.clone();
    graph.add_node("writer", move |state: GraphState| {
        let ctx = ctx_writer.clone();
        async move {
            let result = writer_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "writer".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 整理者节点 - 文件组织
    let ctx_organizer = ctx.clone();
    graph.add_node("organizer", move |state: GraphState| {
        let ctx = ctx_organizer.clone();
        async move {
            let result = organizer_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "organizer".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // 报告者节点 - 汇总结果
    let ctx_reporter = ctx.clone();
    graph.add_node("reporter", move |state: GraphState| {
        let ctx = ctx_reporter.clone();
        async move {
            let result = reporter_node(&ctx.app, &ctx.llm, state).await
                .map_err(|e| GraphError::ExecutionError { 
                    node: "reporter".to_string(), 
                    message: e 
                })?;
            let mut state = result.state;
            state.goto = result.next_node.unwrap_or_default();
            Ok(state)
        }
    });
    
    // ============ 定义边 ============
    
    // 入口点
    graph.set_entry_point("coordinator");
    
    // 协调器 -> 根据意图路由
    graph.add_conditional_edges_sync(
        "coordinator",
        |state: &GraphState| {
            // 使用 state.goto 作为路由目标（已在节点中设置）
            if !state.goto.is_empty() {
                state.goto.clone()
            } else {
                // 默认路由逻辑
                match state.intent {
                    TaskIntent::Chat => "reporter".to_string(),
                    TaskIntent::Edit => "editor".to_string(),
                    TaskIntent::Create => "writer".to_string(),
                    TaskIntent::Organize => "organizer".to_string(),
                    TaskIntent::Search => "researcher".to_string(),
                    TaskIntent::Complex => "planner".to_string(),
                }
            }
        },
        None,
    );
    
    // 规划器 -> 执行器
    graph.add_edge("planner", "executor");
    
    // 执行器 -> 根据计划路由到具体节点或报告者
    graph.add_conditional_edges_sync(
        "executor",
        |state: &GraphState| {
            if !state.goto.is_empty() {
                state.goto.clone()
            } else {
                "reporter".to_string()
            }
        },
        None,
    );
    
    // 各专业节点 -> 报告者（或回到执行器继续）
    graph.add_conditional_edges_sync(
        "editor",
        |state: &GraphState| {
            if !state.goto.is_empty() && state.goto != "end" {
                state.goto.clone()
            } else {
                "reporter".to_string()
            }
        },
        None,
    );
    
    graph.add_conditional_edges_sync(
        "researcher",
        |state: &GraphState| {
            if !state.goto.is_empty() && state.goto != "end" {
                state.goto.clone()
            } else {
                "reporter".to_string()
            }
        },
        None,
    );
    
    graph.add_conditional_edges_sync(
        "writer",
        |state: &GraphState| {
            if !state.goto.is_empty() && state.goto != "end" {
                state.goto.clone()
            } else {
                "reporter".to_string()
            }
        },
        None,
    );
    
    graph.add_conditional_edges_sync(
        "organizer",
        |state: &GraphState| {
            if !state.goto.is_empty() && state.goto != "end" {
                state.goto.clone()
            } else {
                "reporter".to_string()
            }
        },
        None,
    );
    
    // 报告者 -> 结束
    graph.set_finish_point("reporter");
    
    // 编译图
    graph.compile()
}

/// 获取图的可视化描述
pub fn describe_graph() -> String {
    r#"
Agent Graph Structure:
======================

    ┌─────────────┐
    │   START     │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ coordinator │ ─── 分析用户意图
    └──────┬──────┘
           │
     ┌─────┴─────┬─────────┬─────────┬─────────┐
     ▼           ▼         ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌────────┐
│ editor │ │ writer │ │research│ │organizer│ │planner │
└────┬───┘ └────┬───┘ └────┬───┘ └────┬────┘ └────┬───┘
     │          │          │          │           │
     │          │          │          │           ▼
     │          │          │          │     ┌──────────┐
     │          │          │          │     │ executor │
     │          │          │          │     └────┬─────┘
     │          │          │          │          │
     └──────────┴──────────┴──────────┴──────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  reporter   │ ─── 汇总结果
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    END      │
                    └─────────────┘
"#.to_string()
}
