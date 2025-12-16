/**
 * Agent 评估 Store
 * 管理评估状态、运行测试、收集结果
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { TestCase, allTestCases } from './testCases';

// ============ 类型定义 ============

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
  success: boolean;
  output?: string;
}

interface PlanStep {
  id: string;
  description: string;
  completed: boolean;
}

interface AgentResult {
  input: string;
  actualOutput: string;
  finalStatus: 'completed' | 'error' | 'aborted';
  plan?: { steps: PlanStep[] };
  toolsCalled: ToolCall[];
  tokenUsage: { prompt: number; completion: number; total: number };
  completionTimeMs: number;
  loopIterations: number;
}

interface MetricResult {
  name: string;
  score: number;
  passed: boolean;
  reason?: string;
}

interface EvalResult {
  testId: string;
  testName: string;
  category: string;
  passed: boolean;
  overallScore: number;
  metrics: {
    taskCompletion: MetricResult;
    toolCorrectness: MetricResult;
    planQuality: MetricResult;
    efficiency: MetricResult;
  };
  agentResult: AgentResult;
  timestamp: string;
  error?: string;
}

interface EvalState {
  // 状态
  isRunning: boolean;
  currentTestId: string | null;
  progress: { current: number; total: number };
  
  // 结果
  results: EvalResult[];
  
  // 配置
  selectedCategories: string[];
  
  // 统计
  summary: {
    total: number;
    passed: number;
    passRate: number;
    avgTaskCompletion: number;
    avgToolCorrectness: number;
  } | null;
}

interface EvalActions {
  // 运行测试
  runAllTests: (workspacePath: string) => Promise<void>;
  runTestsByCategory: (category: string, workspacePath: string) => Promise<void>;
  runSingleTest: (testCase: TestCase, workspacePath: string) => Promise<EvalResult>;
  
  // 控制
  stopTests: () => void;
  clearResults: () => void;
  
  // 配置
  setSelectedCategories: (categories: string[]) => void;
}

// ============ 指标计算 ============

function evaluateTaskCompletion(_testCase: TestCase, result: AgentResult): MetricResult {
  let score = 0;
  
  // 状态检查 (40%)
  if (result.finalStatus === 'completed') score += 0.4;
  
  // 计划完成率 (40%)
  if (result.plan && result.plan.steps.length > 0) {
    const completed = result.plan.steps.filter(s => s.completed).length;
    score += (completed / result.plan.steps.length) * 0.4;
  } else {
    score += 0.4; // 没有计划视为完成
  }
  
  // attempt_completion 调用 (20%)
  if (result.toolsCalled.some(t => t.name === 'attempt_completion')) {
    score += 0.2;
  }
  
  return {
    name: 'task_completion',
    score,
    passed: score >= 0.7,
    reason: score >= 0.7 ? '任务完成' : `完成度不足 (${(score * 100).toFixed(0)}%)`,
  };
}

function evaluateToolCorrectness(testCase: TestCase, result: AgentResult): MetricResult {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const expected = testCase.expectedTools || [];
  const actual = result.toolsCalled.map(t => t.name);
  
  // 如果没有预期工具，只检查执行成功率
  if (expected.length === 0) {
    const successRate = result.toolsCalled.length > 0
      ? result.toolsCalled.filter(t => t.success).length / result.toolsCalled.length
      : 1;
    return {
      name: 'tool_correctness',
      score: successRate,
      passed: successRate >= 0.8,
      reason: successRate >= 0.8 ? '工具执行正常' : '工具执行失败率过高',
    };
  }
  
  // 集合匹配 (50%)
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  let covered = 0;
  for (const tool of expectedSet) {
    if (actualSet.has(tool)) covered++;
  }
  const selectionScore = covered / expectedSet.size;
  
  // 执行成功率 (50%)
  const successRate = result.toolsCalled.length > 0
    ? result.toolsCalled.filter(t => t.success).length / result.toolsCalled.length
    : 1;
  
  const score = selectionScore * 0.5 + successRate * 0.5;
  
  return {
    name: 'tool_correctness',
    score,
    passed: score >= 0.7,
    reason: score >= 0.7 
      ? '工具调用正确' 
      : `选择=${(selectionScore * 100).toFixed(0)}%, 成功=${(successRate * 100).toFixed(0)}%`,
  };
}

function evaluatePlanQuality(testCase: TestCase, result: AgentResult): MetricResult {
  // 检查是否创建了计划
  const hasCreatePlan = result.toolsCalled.some(t => t.name === 'create_plan');
  const hasPlan = hasCreatePlan || (result.plan && result.plan.steps.length > 0);
  
  if (!hasPlan) {
    // 简单任务不需要计划
    if (testCase.category === 'basic') {
      return { name: 'plan_quality', score: 1, passed: true, reason: '简单任务无需计划' };
    }
    return { name: 'plan_quality', score: 0.3, passed: false, reason: '未创建计划' };
  }
  
  let score = 0.5; // 基础分
  
  const steps = result.plan?.steps || [];
  
  // 步骤数合理性
  if (steps.length >= 1 && steps.length <= 5) {
    score += 0.2;
  } else if (steps.length > 5) {
    score += 0.1; // 步骤过多扣分
  }
  
  // 完成率
  if (steps.length > 0) {
    const completed = steps.filter(s => s.completed).length;
    score += (completed / steps.length) * 0.3;
  }
  
  return {
    name: 'plan_quality',
    score,
    passed: score >= 0.6,
    reason: score >= 0.6 ? '计划质量良好' : '计划执行不完整',
  };
}

function evaluateEfficiency(_testCase: TestCase, result: AgentResult): MetricResult {
  let score = 1;
  const issues: string[] = [];
  
  // Token 消耗
  if (result.tokenUsage.total > 10000) {
    score -= 0.2;
    issues.push('Token 过多');
  }
  
  // 响应时间
  if (result.completionTimeMs > 60000) {
    score -= 0.2;
    issues.push('耗时过长');
  }
  
  // 循环次数
  if (result.loopIterations > 10) {
    score -= 0.2;
    issues.push('循环过多');
  }
  
  // 工具调用次数
  if (result.toolsCalled.length > 20) {
    score -= 0.2;
    issues.push('调用过多');
  }
  
  score = Math.max(0, score);
  
  return {
    name: 'efficiency',
    score,
    passed: score >= 0.6,
    reason: issues.length > 0 ? issues.join(', ') : '效率良好',
  };
}

// ============ Store 实现 ============

export const useAgentEvalStore = create<EvalState & EvalActions>((set, get) => {
  let stopRequested = false;

  return {
    // 初始状态
    isRunning: false,
    currentTestId: null,
    progress: { current: 0, total: 0 },
    results: [],
    selectedCategories: ['basic', 'complex'],
    summary: null,

    // 运行单个测试
    runSingleTest: async (testCase: TestCase, workspacePath: string): Promise<EvalResult> => {
      set({ currentTestId: testCase.id });
      
      const startTime = Date.now();
      const toolsCalled: ToolCall[] = [];
      let plan: { steps: PlanStep[] } | undefined;
      let finalOutput = '';
      let finalStatus: 'completed' | 'error' | 'aborted' = 'error';
      let tokenUsage = { prompt: 0, completion: 0, total: 0 };
      let loopIterations = 0;
      let error: string | undefined;

      // 监听 Agent 事件
      const unlisteners: UnlistenFn[] = [];
      
      try {
        unlisteners.push(await listen('agent-event', (event: any) => {
          const { type, data } = event.payload;
          
          switch (type) {
            case 'tool_call':
              // 先记录调用，success 稍后更新
              toolsCalled.push({
                name: data.tool.name,
                params: data.tool.params,
                success: true, // 默认成功，tool_result 会更新
              });
              loopIterations++;
              break;
              
            case 'tool_result':
              // 更新最后一个工具调用的结果
              const lastCall = toolsCalled[toolsCalled.length - 1];
              if (lastCall) {
                lastCall.success = data.result.success;
                lastCall.output = data.result.content;
              }
              break;
              
            case 'plan_created':
              plan = {
                steps: data.plan.steps.map((s: any) => ({
                  id: s.id,
                  description: s.description,
                  completed: s.completed || false,
                })),
              };
              break;
              
            case 'step_completed':
              if (plan) {
                const step = plan.steps.find(s => s.id === data.step.id);
                if (step) step.completed = true;
              }
              break;
              
            case 'token_usage':
              tokenUsage.prompt += data.prompt_tokens || 0;
              tokenUsage.completion += data.completion_tokens || 0;
              tokenUsage.total += data.total_tokens || 0;
              break;
              
            case 'complete':
              finalOutput = data.result;
              finalStatus = 'completed';
              break;
              
            case 'error':
              error = data.message;
              finalStatus = 'error';
              break;
              
            case 'status_change':
              if (data.status === 'aborted') {
                finalStatus = 'aborted';
              }
              break;
          }
        }));

        // 调用 Agent
        await invoke('agent_start_task', {
          task: testCase.input,
          context: {
            workspace_path: workspacePath,
            active_note_path: null,
            active_note_content: null,
            file_tree: null,
            rag_results: [],
            resolved_links: [],
            history: [],
          },
        });

        // 等待完成（简单轮询检查状态）
        let timeout = 120000; // 2 分钟超时
        const pollInterval = 500;
        while (finalStatus === 'error' && timeout > 0) {
          await new Promise(r => setTimeout(r, pollInterval));
          timeout -= pollInterval;
          
          if (stopRequested) {
            await invoke('agent_abort');
            finalStatus = 'aborted';
            break;
          }
        }

        if (timeout <= 0) {
          finalStatus = 'error';
          error = 'Timeout';
        }

      } catch (e) {
        error = String(e);
        finalStatus = 'error';
      } finally {
        // 清理监听器
        for (const unlisten of unlisteners) {
          unlisten();
        }
      }

      const completionTimeMs = Date.now() - startTime;

      // 构建结果
      const agentResult: AgentResult = {
        input: testCase.input,
        actualOutput: finalOutput,
        finalStatus,
        plan,
        toolsCalled,
        tokenUsage,
        completionTimeMs,
        loopIterations,
      };

      // 评估
      const taskCompletion = evaluateTaskCompletion(testCase, agentResult);
      const toolCorrectness = evaluateToolCorrectness(testCase, agentResult);
      const planQuality = evaluatePlanQuality(testCase, agentResult);
      const efficiency = evaluateEfficiency(testCase, agentResult);

      // 综合得分
      const overallScore = 
        taskCompletion.score * 0.35 +
        toolCorrectness.score * 0.25 +
        planQuality.score * 0.25 +
        efficiency.score * 0.15;

      const evalResult: EvalResult = {
        testId: testCase.id,
        testName: testCase.name,
        category: testCase.category,
        passed: overallScore >= 0.7,
        overallScore,
        metrics: { taskCompletion, toolCorrectness, planQuality, efficiency },
        agentResult,
        timestamp: new Date().toISOString(),
        error,
      };

      return evalResult;
    },

    // 运行所有测试
    runAllTests: async (workspacePath: string) => {
      const { runSingleTest, selectedCategories } = get();
      
      const testCases = allTestCases.filter(tc => 
        selectedCategories.includes(tc.category)
      );
      
      set({ 
        isRunning: true, 
        results: [],
        progress: { current: 0, total: testCases.length },
        summary: null,
      });
      
      stopRequested = false;
      const results: EvalResult[] = [];

      for (let i = 0; i < testCases.length; i++) {
        if (stopRequested) break;
        
        set({ progress: { current: i + 1, total: testCases.length } });
        
        const result = await runSingleTest(testCases[i], workspacePath);
        results.push(result);
        
        set({ results: [...results] });
        
        // 稍微等待，避免过于密集
        await new Promise(r => setTimeout(r, 1000));
      }

      // 计算汇总
      const passed = results.filter(r => r.passed).length;
      const summary = {
        total: results.length,
        passed,
        passRate: results.length > 0 ? passed / results.length : 0,
        avgTaskCompletion: average(results.map(r => r.metrics.taskCompletion.score)),
        avgToolCorrectness: average(results.map(r => r.metrics.toolCorrectness.score)),
      };

      set({ 
        isRunning: false, 
        currentTestId: null,
        summary,
      });
    },

    // 按类别运行
    runTestsByCategory: async (category: string, workspacePath: string) => {
      set({ selectedCategories: [category] });
      await get().runAllTests(workspacePath);
    },

    // 停止测试
    stopTests: () => {
      stopRequested = true;
      set({ isRunning: false });
    },

    // 清除结果
    clearResults: () => {
      set({ results: [], summary: null, progress: { current: 0, total: 0 } });
    },

    // 设置类别
    setSelectedCategories: (categories: string[]) => {
      set({ selectedCategories: categories });
    },
  };
});

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
