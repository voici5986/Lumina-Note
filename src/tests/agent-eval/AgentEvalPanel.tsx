/**
 * Agent 评估面板
 * 用于运行和查看 Agent 评估结果
 */

import { useState } from 'react';
import { useAgentEvalStore } from './useAgentEvalStore';
import { allTestCases } from './testCases';
import { 
  Play, 
  Square, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
} from 'lucide-react';

export function AgentEvalPanel() {
  const {
    isRunning,
    currentTestId,
    progress,
    results,
    summary,
    selectedCategories,
    runAllTests,
    stopTests,
    clearResults,
    setSelectedCategories,
  } = useAgentEvalStore();

  const [workspacePath, setWorkspacePath] = useState('');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = (testId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(testId)) {
      newExpanded.delete(testId);
    } else {
      newExpanded.add(testId);
    }
    setExpandedResults(newExpanded);
  };

  const categories = ['basic', 'complex', 'edge-case'];

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleRun = () => {
    if (!workspacePath) {
      alert('请先设置测试笔记库路径');
      return;
    }
    runAllTests(workspacePath);
  };

  const filteredTestCases = allTestCases.filter(tc => 
    selectedCategories.includes(tc.category)
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* 头部 */}
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold mb-4">🧪 Agent 评估面板</h1>
        
        {/* 配置 */}
        <div className="space-y-3">
          {/* 笔记库路径 */}
          <div>
            <label className="text-sm text-muted-foreground">测试笔记库路径</label>
            <input
              type="text"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="例如: D:\test-vault"
              className="w-full mt-1 px-3 py-2 bg-muted rounded border border-border"
              disabled={isRunning}
            />
          </div>

          {/* 类别选择 */}
          <div>
            <label className="text-sm text-muted-foreground">测试类别</label>
            <div className="flex gap-2 mt-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  disabled={isRunning}
                  className={`px-3 py-1 rounded text-sm ${
                    selectedCategories.includes(cat)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {cat} ({allTestCases.filter(tc => tc.category === cat).length})
                </button>
              ))}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={isRunning || selectedCategories.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Play size={16} />
              运行测试 ({filteredTestCases.length} 个)
            </button>
            
            {isRunning && (
              <button
                onClick={stopTests}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Square size={16} />
                停止
              </button>
            )}
            
            <button
              onClick={clearResults}
              disabled={isRunning || results.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-muted rounded hover:bg-muted/80 disabled:opacity-50"
            >
              <Trash2 size={16} />
              清除结果
            </button>
          </div>
        </div>
      </div>

      {/* 进度 */}
      {isRunning && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="animate-spin" size={16} />
            <span>
              正在测试: {currentTestId} ({progress.current}/{progress.total})
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 汇总 */}
      {summary && (
        <div className="p-4 bg-muted/30 border-b border-border">
          <h2 className="font-semibold mb-2">📊 评估结果</h2>
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">
                {summary.passed}/{summary.total}
              </div>
              <div className="text-sm text-muted-foreground">通过/总数</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                summary.passRate >= 0.8 ? 'text-green-500' : 
                summary.passRate >= 0.6 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {(summary.passRate * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">通过率</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {(summary.avgTaskCompletion * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">任务完成度</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {(summary.avgToolCorrectness * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-muted-foreground">工具正确率</div>
            </div>
            <div>
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                {summary.passRate >= 0.8 ? (
                  <CheckCircle className="text-green-500" size={24} />
                ) : (
                  <AlertCircle className="text-yellow-500" size={24} />
                )}
              </div>
              <div className="text-sm text-muted-foreground">状态</div>
            </div>
          </div>
        </div>
      )}

      {/* 结果列表 */}
      <div className="flex-1 overflow-auto p-4">
        {results.length === 0 && !isRunning && (
          <div className="text-center text-muted-foreground py-8">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p>点击"运行测试"开始评估</p>
          </div>
        )}

        <div className="space-y-2">
          {results.map(result => (
            <div 
              key={result.testId}
              className={`border rounded p-3 ${
                result.passed ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'
              }`}
            >
              {/* 标题行 */}
              <div 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => toggleExpanded(result.testId)}
              >
                {expandedResults.has(result.testId) ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
                
                {result.passed ? (
                  <CheckCircle className="text-green-500" size={16} />
                ) : (
                  <XCircle className="text-red-500" size={16} />
                )}
                
                <span className="font-medium">{result.testName}</span>
                <span className="text-sm text-muted-foreground">({result.testId})</span>
                
                <div className="ml-auto flex items-center gap-3 text-sm">
                  <span className={result.overallScore >= 0.7 ? 'text-green-500' : 'text-red-500'}>
                    {(result.overallScore * 100).toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock size={12} />
                    {(result.agentResult.completionTimeMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Zap size={12} />
                    {result.agentResult.tokenUsage.total}
                  </span>
                </div>
              </div>

              {/* 展开详情 */}
              {expandedResults.has(result.testId) && (
                <div className="mt-3 pl-6 space-y-2 text-sm">
                  {/* 输入 */}
                  <div>
                    <span className="text-muted-foreground">输入：</span>
                    <span className="ml-2">{result.agentResult.input}</span>
                  </div>

                  {/* 指标 */}
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(result.metrics).map(([key, metric]) => (
                      <div 
                        key={key}
                        className={`p-2 rounded ${
                          metric.passed ? 'bg-green-500/10' : 'bg-red-500/10'
                        }`}
                      >
                        <div className="font-medium">
                          {key === 'taskCompletion' ? '任务完成' :
                           key === 'toolCorrectness' ? '工具正确' :
                           key === 'planQuality' ? '计划质量' : '效率'}
                        </div>
                        <div className={metric.passed ? 'text-green-500' : 'text-red-500'}>
                          {(metric.score * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {metric.reason}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 工具调用 */}
                  {result.agentResult.toolsCalled.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">工具调用：</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.agentResult.toolsCalled.map((tool, i) => (
                          <span 
                            key={i}
                            className={`px-2 py-0.5 rounded text-xs ${
                              tool.success ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}
                          >
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 错误 */}
                  {result.error && (
                    <div className="text-red-500">
                      错误：{result.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AgentEvalPanel;
