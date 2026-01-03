#![allow(dead_code)]

mod commands;
mod error;
mod fs;
mod vector_db;
mod llm;
pub mod agent;
pub mod langgraph;

pub use commands::*;
pub use error::*;
pub use fs::*;
pub use llm::*;

// Re-export vector_db items explicitly to avoid shadowing
pub use vector_db::{
    VectorChunk, SearchResult, IndexStatus,
    init_vector_db, upsert_vector_chunks, search_vector_chunks,
    delete_file_vectors, delete_vectors, get_vector_index_status,
    check_file_needs_reindex, clear_vector_index,
};

// Re-export agent commands
pub use agent::{
    AgentState, agent_start_task, agent_abort, 
    agent_get_status, agent_continue_with_answer,
    agent_enable_debug, agent_disable_debug, 
    agent_is_debug_enabled, agent_get_debug_log_path,
};
