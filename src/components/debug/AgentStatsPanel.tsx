/**
 * Agent 统计面板
 * 显示工具调用成功率和任务完成度
 */
import { useRustAgentStore } from "@/stores/useRustAgentStore";
import { BarChart3, CheckCircle, XCircle, Zap, Target } from "lucide-react";
import { useLocaleStore } from "@/stores/useLocaleStore";

// 简单进度条组件
function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 ${className}`}>
      <div
        className="bg-blue-500 h-2 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function AgentStatsPanel() {
  const taskStats = useRustAgentStore((s) => s.taskStats);
  const totalTokensUsed = useRustAgentStore((s) => s.totalTokensUsed);
  const { t } = useLocaleStore();
  
  // 计算百分比
  const toolSuccessRate = taskStats.totalToolCalls > 0
    ? (taskStats.totalToolSuccesses / taskStats.totalToolCalls) * 100
    : 0;
  
  const taskCompletionRate = taskStats.totalTasks > 0
    ? (taskStats.completedTasks / taskStats.totalTasks) * 100
    : 0;
  
  // 当前任务成功率
  const currentSuccessRate = taskStats.toolCalls > 0
    ? (taskStats.toolSuccesses / taskStats.toolCalls) * 100
    : 0;

  return (
    <div className="p-4 space-y-4 text-sm">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        {t.debug.agentStats.title}
      </h2>
      
      {/* 当前任务 */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.debug.agentStats.currentTask}</div>
        <div className="flex justify-between">
          <span>{t.debug.agentStats.toolCalls}</span>
          <span className="font-mono">
            <span className="text-green-600 dark:text-green-400">{taskStats.toolSuccesses}</span>
            {" / "}
            {taskStats.toolCalls}
            {taskStats.toolFailures > 0 && (
              <span className="text-red-500 ml-1">
                {t.debug.agentStats.failureCount.replace("{count}", String(taskStats.toolFailures))}
              </span>
            )}
          </span>
        </div>
        <ProgressBar value={currentSuccessRate} />
        <div className="text-xs text-gray-500 text-right">
          {t.debug.agentStats.successRate}: {currentSuccessRate.toFixed(1)}%
        </div>
      </div>
      
      {/* 累计统计 */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t.debug.agentStats.cumulativeStats}</div>
        
        {/* 任务完成度 */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {t.debug.agentStats.taskCompletion}
            </span>
            <span className="font-mono">
              {taskStats.completedTasks} / {taskStats.totalTasks}
            </span>
          </div>
          <ProgressBar value={taskCompletionRate} />
          <div className="text-xs text-gray-500 text-right mt-1">
            {taskCompletionRate.toFixed(1)}%
          </div>
        </div>
        
        {/* 工具成功率 */}
        <div>
          <div className="flex justify-between mb-1">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {t.debug.agentStats.toolSuccessRate}
            </span>
            <span className="font-mono">
              {taskStats.totalToolSuccesses} / {taskStats.totalToolCalls}
            </span>
          </div>
          <ProgressBar value={toolSuccessRate} />
          <div className="text-xs text-gray-500 text-right mt-1">
            {toolSuccessRate.toFixed(1)}%
          </div>
        </div>
        
        {/* 数字摘要 */}
        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span>{t.debug.agentStats.completed}: {taskStats.completedTasks}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" />
            <span>{t.debug.agentStats.failed}: {taskStats.failedTasks}</span>
          </div>
        </div>
        
        {/* Token 使用 */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
          {t.debug.agentStats.tokens}: <span className="font-mono">{totalTokensUsed.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
