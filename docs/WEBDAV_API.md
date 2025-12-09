# WebDAV 同步模块 API 文档

本文档描述 Lumina Note 的 WebDAV 同步功能的完整接口设计。

## 目录

- [架构概览](#架构概览)
- [后端 API (Rust/Tauri)](#后端-api-rusttauri)
- [前端 API (TypeScript)](#前端-api-typescript)
- [数据类型](#数据类型)
- [使用示例](#使用示例)
- [扩展指南](#扩展指南)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  useWebDAVStore.ts     │  WebDAVSettings.tsx                │
│  (状态管理)             │  (设置 UI)                         │
├─────────────────────────────────────────────────────────────┤
│              src/services/webdav/index.ts                    │
│              (服务层 - Tauri invoke 封装)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tauri IPC
┌───────────────────────────▼─────────────────────────────────┐
│                    Backend (Rust)                            │
├─────────────────────────────────────────────────────────────┤
│  webdav/commands.rs    │  暴露给前端的 Tauri 命令            │
│  webdav/client.rs      │  WebDAV HTTP 客户端                │
│  webdav/sync.rs        │  同步引擎 (本地优先策略)            │
│  webdav/types.rs       │  共享数据类型                       │
└─────────────────────────────────────────────────────────────┘
```

### 设计原则

1. **本地优先 (Local-First)**：所有操作先在本地完成，后台静默同步
2. **解耦设计**：客户端、同步引擎、命令层分离，便于测试和扩展
3. **类型安全**：前后端共享类型定义，TypeScript + Rust 双重保障
4. **可复用**：核心模块可独立使用，不依赖 UI 层

---

## 后端 API (Rust/Tauri)

### 文件结构

```
src-tauri/src/webdav/
├── mod.rs          # 模块入口
├── types.rs        # 类型定义
├── client.rs       # WebDAV HTTP 客户端
├── sync.rs         # 同步引擎
└── commands.rs     # Tauri 命令
```

### Tauri 命令列表

#### 配置管理

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `webdav_set_config` | `config: WebDAVConfig` | `()` | 设置 WebDAV 配置 |
| `webdav_get_config` | - | `Option<WebDAVConfig>` | 获取当前配置 |

#### 连接测试

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `webdav_test_connection` | `config: WebDAVConfig` | `bool` | 测试连接是否成功 |

#### 文件操作

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `webdav_list_remote` | `config`, `path: String` | `Vec<RemoteEntry>` | 列出远程目录 |
| `webdav_list_all_remote` | `config` | `Vec<RemoteEntry>` | 递归列出所有远程文件 |
| `webdav_download` | `config`, `remote_path: String` | `String` | 下载文件内容 |
| `webdav_upload` | `config`, `remote_path`, `content` | `()` | 上传文件 |
| `webdav_create_dir` | `config`, `remote_path` | `()` | 创建远程目录 |
| `webdav_delete` | `config`, `remote_path` | `()` | 删除远程文件/目录 |

#### 同步操作

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `webdav_scan_local` | `config`, `vault_path` | `Vec<LocalFileInfo>` | 扫描本地文件 |
| `webdav_compute_sync_plan` | `config`, `vault_path` | `SyncPlan` | 计算同步计划 |
| `webdav_execute_sync` | `config`, `vault_path`, `plan` | `SyncResult` | 执行同步计划 |
| `webdav_quick_sync` | `config`, `vault_path` | `SyncResult` | 快速同步（跳过冲突） |

### WebDAVClient 类 (client.rs)

```rust
pub struct WebDAVClient {
    client: reqwest::Client,
    config: WebDAVConfig,
}

impl WebDAVClient {
    /// 创建新客户端
    pub fn new(config: WebDAVConfig) -> Result<Self, AppError>;
    
    /// 测试连接
    pub async fn test_connection(&self) -> Result<bool, AppError>;
    
    /// 列出目录 (PROPFIND)
    pub async fn list_dir(&self, path: &str) -> Result<Vec<RemoteEntry>, AppError>;
    
    /// 递归列出所有文件
    pub async fn list_all_recursive(&self, path: &str) -> Result<Vec<RemoteEntry>, AppError>;
    
    /// 下载文件 (GET)
    pub async fn download(&self, path: &str) -> Result<Vec<u8>, AppError>;
    pub async fn download_text(&self, path: &str) -> Result<String, AppError>;
    
    /// 上传文件 (PUT)
    pub async fn upload(&self, path: &str, content: &[u8]) -> Result<(), AppError>;
    pub async fn upload_text(&self, path: &str, content: &str) -> Result<(), AppError>;
    
    /// 创建目录 (MKCOL)
    pub async fn create_dir(&self, path: &str) -> Result<(), AppError>;
    
    /// 确保目录存在（递归创建）
    pub async fn ensure_dir(&self, path: &str) -> Result<(), AppError>;
    
    /// 删除文件/目录 (DELETE)
    pub async fn delete(&self, path: &str) -> Result<(), AppError>;
}
```

### SyncEngine 类 (sync.rs)

```rust
pub struct SyncEngine {
    client: WebDAVClient,
    vault_path: String,
    state: Option<SyncState>,
}

impl SyncEngine {
    /// 创建同步引擎
    pub fn new(config: WebDAVConfig, vault_path: String) -> Result<Self, AppError>;
    
    /// 加载/保存同步状态
    pub fn load_state(&mut self) -> Result<(), AppError>;
    pub fn save_state(&self) -> Result<(), AppError>;
    
    /// 测试连接
    pub async fn test_connection(&self) -> Result<bool, AppError>;
    
    /// 扫描本地文件
    pub fn scan_local_files(&self) -> Result<Vec<LocalFileInfo>, AppError>;
    
    /// 扫描远程文件
    pub async fn scan_remote_files(&self) -> Result<Vec<RemoteEntry>, AppError>;
    
    /// 计算同步计划
    pub async fn compute_sync_plan(&mut self) -> Result<SyncPlan, AppError>;
    
    /// 执行同步
    pub async fn execute_sync(&mut self, plan: &SyncPlan) -> Result<SyncResult, AppError>;
    
    /// 快速同步（跳过冲突）
    pub async fn quick_sync(&mut self) -> Result<SyncResult, AppError>;
}
```

---

## 前端 API (TypeScript)

### 文件结构

```
src/services/webdav/
├── index.ts        # 服务类 + 导出
└── types.ts        # 类型定义

src/stores/
└── useWebDAVStore.ts   # Zustand 状态管理

src/components/settings/
└── WebDAVSettings.tsx  # 设置 UI 组件
```

### WebDAVService 类

```typescript
import { webdavService } from '@/services/webdav';

// 设置配置
webdavService.setConfig({
  server_url: 'https://dav.example.com',
  username: 'user',
  password: 'pass',
  remote_base_path: '/notes',
  auto_sync: true,
  sync_interval_secs: 300,
});

// 测试连接
const connected = await webdavService.testConnection();

// 列出远程文件
const files = await webdavService.listRemote('/');
const allFiles = await webdavService.listAllRemote();

// 文件操作
const content = await webdavService.download('note.md');
await webdavService.upload('note.md', '# Hello');
await webdavService.createDir('subfolder');
await webdavService.delete('old-file.md');

// 同步操作
const plan = await webdavService.computeSyncPlan('/path/to/vault');
const result = await webdavService.executeSync('/path/to/vault', plan);
// 或快速同步
const result = await webdavService.quickSync('/path/to/vault');
```

### useWebDAVStore Hook

```typescript
import { useWebDAVStore, useSyncStatusText } from '@/stores/useWebDAVStore';

function MyComponent() {
  const {
    // 状态
    config,
    isConfigured,
    isConnected,
    connectionError,
    syncProgress,
    lastSyncResult,
    lastSyncTime,
    pendingSyncPlan,
    
    // Actions
    setConfig,
    resetConfig,
    testConnection,
    computeSyncPlan,
    executeSync,
    quickSync,
    cancelSync,
    clearError,
  } = useWebDAVStore();
  
  // 获取状态文本
  const statusText = useSyncStatusText();
  
  // 使用示例
  const handleSync = async () => {
    setConfig({ server_url: 'https://...', username: '...', password: '...' });
    const connected = await testConnection();
    if (connected) {
      await quickSync('/path/to/vault');
    }
  };
}
```

### 便捷函数

```typescript
import { 
  testWebDAVConnection, 
  saveWebDAVConfig, 
  loadWebDAVConfig 
} from '@/services/webdav';

// 直接测试连接（不需要实例化服务）
const ok = await testWebDAVConnection(config);

// 保存/加载配置到后端状态
await saveWebDAVConfig(config);
const savedConfig = await loadWebDAVConfig();
```

---

## 数据类型

### WebDAVConfig

```typescript
interface WebDAVConfig {
  server_url: string;        // WebDAV 服务器 URL
  username: string;          // 用户名
  password: string;          // 密码
  remote_base_path: string;  // 远程根目录 (默认 "/")
  auto_sync: boolean;        // 是否自动同步
  sync_interval_secs: number; // 同步间隔（秒）
}
```

### RemoteEntry

```typescript
interface RemoteEntry {
  path: string;              // 相对路径
  name: string;              // 文件名
  is_dir: boolean;           // 是否为目录
  size: number;              // 文件大小（字节）
  modified: number;          // 修改时间（Unix 时间戳）
  etag: string | null;       // ETag
  content_type: string | null; // MIME 类型
}
```

### LocalFileInfo

```typescript
interface LocalFileInfo {
  relative_path: string;     // 相对路径
  absolute_path: string;     // 绝对路径
  is_dir: boolean;           // 是否为目录
  size: number;              // 文件大小
  modified: number;          // 修改时间
}
```

### SyncAction

```typescript
type SyncAction = 
  | 'Upload'       // 上传到远程
  | 'Download'     // 从远程下载
  | 'DeleteRemote' // 删除远程文件
  | 'DeleteLocal'  // 删除本地文件
  | 'Conflict'     // 冲突
  | 'Skip';        // 跳过
```

### SyncPlan

```typescript
interface SyncPlan {
  items: SyncPlanItem[];     // 同步条目列表
  upload_count: number;      // 待上传数量
  download_count: number;    // 待下载数量
  conflict_count: number;    // 冲突数量
}

interface SyncPlanItem {
  path: string;              // 文件路径
  action: SyncAction;        // 同步动作
  local: LocalFileInfo | null;
  remote: RemoteEntry | null;
  reason: string;            // 原因说明
}
```

### SyncResult

```typescript
interface SyncResult {
  success: boolean;          // 是否成功
  uploaded: number;          // 上传成功数
  downloaded: number;        // 下载成功数
  deleted: number;           // 删除数
  conflicts: number;         // 冲突数
  errors: SyncError[];       // 错误列表
  duration_ms: number;       // 耗时（毫秒）
}

interface SyncError {
  path: string;
  action: SyncAction;
  message: string;
}
```

### SyncProgress

```typescript
interface SyncProgress {
  stage: SyncStage;
  total: number;
  processed: number;
  current_file: string | null;
  error: string | null;
}

type SyncStage = 
  | 'Idle'
  | 'Connecting'
  | 'ScanningRemote'
  | 'ScanningLocal'
  | 'ComputingDiff'
  | 'Syncing'
  | 'Completed'
  | 'Error';
```

---

## 使用示例

### 基本同步流程

```typescript
import { useWebDAVStore } from '@/stores/useWebDAVStore';
import { useFileStore } from '@/stores/useFileStore';

function SyncButton() {
  const { vaultPath } = useFileStore();
  const { setConfig, testConnection, quickSync, syncProgress } = useWebDAVStore();
  
  const handleSync = async () => {
    // 1. 配置
    setConfig({
      server_url: 'https://dav.jianguoyun.com/dav',
      username: 'your@email.com',
      password: 'app-password',
      remote_base_path: '/Lumina Notes',
    });
    
    // 2. 测试连接
    const ok = await testConnection();
    if (!ok) {
      console.error('Connection failed');
      return;
    }
    
    // 3. 执行同步
    const result = await quickSync(vaultPath!);
    console.log(`Synced: ${result?.uploaded} up, ${result?.downloaded} down`);
  };
  
  return (
    <button onClick={handleSync} disabled={syncProgress.stage === 'Syncing'}>
      {syncProgress.stage === 'Syncing' ? 'Syncing...' : 'Sync Now'}
    </button>
  );
}
```

### 预览同步计划

```typescript
const { computeSyncPlan, executeSync, pendingSyncPlan } = useWebDAVStore();

// 先计算计划
const plan = await computeSyncPlan(vaultPath);

// 显示给用户
console.log(`Will upload ${plan.upload_count} files`);
console.log(`Will download ${plan.download_count} files`);
console.log(`${plan.conflict_count} conflicts`);

// 用户确认后执行
if (confirm('Proceed with sync?')) {
  await executeSync(vaultPath, plan);
}
```

---

## 扩展指南

### 添加新的 WebDAV 操作

1. **后端**：在 `client.rs` 添加方法
2. **命令**：在 `commands.rs` 添加 Tauri 命令
3. **注册**：在 `main.rs` 注册命令
4. **前端**：在 `services/webdav/index.ts` 添加方法

### 自定义同步策略

修改 `sync.rs` 中的 `determine_action` 方法：

```rust
fn determine_action(
    &self,
    local: Option<&LocalFileInfo>,
    remote: Option<&RemoteEntry>,
    last_record: Option<&FileRecord>,
) -> (SyncAction, String) {
    // 自定义逻辑
}
```

### 添加同步过滤器

在 `SyncEngine::should_skip` 中添加过滤规则：

```rust
fn should_skip(name: &str) -> bool {
    name.starts_with('.')
        || name == "node_modules"
        || name.ends_with(".tmp")
        // 添加更多规则
}
```

### 支持的 WebDAV 服务器

已测试兼容：
- **坚果云** (jianguoyun.com)
- **Nextcloud**
- **ownCloud**
- **Synology WebDAV**
- **Apache mod_dav**

---

## 错误处理

所有 WebDAV 操作可能抛出 `AppError::WebDAV(String)` 错误。

常见错误：
- `Connection failed` - 网络问题或 URL 错误
- `Authentication failed` - 用户名/密码错误
- `PROPFIND failed` - 目录不存在或权限不足
- `Upload failed` - 上传失败（可能是配额不足）

---

## 安全注意事项

1. **密码存储**：当前密码不持久化到 localStorage，每次启动需重新输入
2. **HTTPS**：强烈建议使用 HTTPS 连接
3. **应用密码**：部分服务（如坚果云）需要使用应用专用密码

---

## 版本历史

- **v0.1.0** (2024-12) - 初始实现
  - 基本 WebDAV 操作（PROPFIND, GET, PUT, MKCOL, DELETE）
  - 本地优先双向同步
  - 冲突检测与处理
  - 设置 UI 集成
