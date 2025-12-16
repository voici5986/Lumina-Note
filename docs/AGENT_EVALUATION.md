# Agent 评估体系

本文档定义 Lumina Note Agent 系统的评估指标、测试方法和基准。

## 1. 核心评估指标

### 1.1 任务完成度 (Task Completion)

衡量 Agent 是否成功完成用户给定的任务。

| 指标 | 定义 | 计算方式 |
|------|------|----------|
| **成功率 (Success Rate)** | 完全完成任务的比例 | `完成任务数 / 总任务数` |
| **里程碑完成率 (Milestone KPI)** | 子步骤完成比例 | `完成的步骤数 / 计划总步骤数` |
| **任务推进分 (Action Advancement)** | 每个动作对目标的推进程度 | 每步骤评分 0-1，累计平均 |

**评估方式**：
```python
# 示例：任务完成度评估
def evaluate_task_completion(task_result):
    return {
        "success": task_result.final_status == "completed",
        "milestone_rate": task_result.completed_steps / task_result.total_steps,
        "advancement_score": sum(step.advancement for step in task_result.steps) / len(task_result.steps)
    }
```

### 1.2 工具调用指标 (Tool Utilization)

衡量 Agent 对工具的使用质量。

| 指标 | 定义 | 业界基准 |
|------|------|----------|
| **工具选择准确率** | 选择正确工具的比例 | > 85% |
| **参数准确率** | 工具参数正确的比例 | > 90% |
| **工具执行成功率** | 工具调用成功的比例 | > 95% |
| **工具效能** | 工具调用对任务的实际帮助 | > 80% |

**三层评估**：
1. **Tool Selection** - 是否选择了正确的工具
2. **Input Parameters** - 参数是否正确
3. **Output Accuracy** - 工具输出是否符合预期

```python
# 示例：工具调用评估
def evaluate_tool_usage(tool_calls, expected_tools):
    selection_accuracy = len(set(tool_calls) & set(expected_tools)) / len(expected_tools)
    param_accuracy = sum(1 for tc in tool_calls if tc.params_valid) / len(tool_calls)
    execution_success = sum(1 for tc in tool_calls if tc.success) / len(tool_calls)
    
    return {
        "selection_accuracy": selection_accuracy,
        "parameter_accuracy": param_accuracy,
        "execution_success": execution_success
    }
```

### 1.3 计划质量 (Plan Quality)

衡量 Agent 生成的计划质量。

| 指标 | 定义 |
|------|------|
| **计划合理性** | 步骤是否逻辑清晰、可执行 |
| **计划完整性** | 是否覆盖任务所需的所有操作 |
| **计划效率** | 步骤数是否合理（不冗余、不遗漏） |
| **计划遵循度** | Agent 是否按计划执行 |

### 1.4 效率指标 (Efficiency)

| 指标 | 定义 | 目标 |
|------|------|------|
| **工具调用次数** | 完成任务的工具调用数 | 最小化 |
| **Token 消耗** | 总 Token 使用量 | < 10K/任务 |
| **循环次数** | Agent 内部循环迭代次数 | < 10 |
| **响应时间** | 从输入到完成的时间 | < 30s |

---

## 2. Lumina Note 特定指标

### 2.1 笔记操作指标

| 指标 | 定义 |
|------|------|
| **编辑准确率** | `edit_note` 操作成功匹配 old_string 的比例 |
| **文件定位准确率** | 正确找到目标文件的比例 |
| **内容理解准确率** | 正确理解笔记内容并操作的比例 |

### 2.2 搜索质量指标

| 指标 | 定义 |
|------|------|
| **搜索召回率** | 找到相关笔记的比例 |
| **搜索精确率** | 返回结果中相关的比例 |
| **RAG 质量** | 语义搜索结果的相关性 |

---

## 3. 测试用例设计

### 3.1 基础测试集

```yaml
# test_cases/basic.yaml
- id: basic_001
  category: search
  input: "帮我找一下关于 React 的笔记"
  expected_tools: [list_notes, search_notes]
  expected_outcome: "返回包含 React 关键词的笔记列表"
  
- id: basic_002
  category: edit
  input: "在我的日记里加一行'今天天气不错'"
  expected_tools: [read_note, edit_note]
  expected_outcome: "日记文件被正确修改"
  
- id: basic_003
  category: create
  input: "创建一个新笔记，标题是'会议记录'"
  expected_tools: [create_note]
  expected_outcome: "新文件创建成功"
  
- id: basic_004
  category: organize
  input: "把所有 2024 年的笔记移到 archive 文件夹"
  expected_tools: [list_notes, move_note]
  expected_outcome: "文件被正确移动"
```

### 3.2 复杂任务测试集

```yaml
# test_cases/complex.yaml
- id: complex_001
  category: multi_step
  input: "帮我整理一下笔记库，把重复的内容合并"
  expected_plan_steps: 3-5
  expected_tools: [list_notes, read_note, search_notes, edit_note]
  evaluation_criteria:
    - "正确识别重复内容"
    - "合并操作不丢失信息"
    - "保持文件结构清晰"

- id: complex_002
  category: research
  input: "根据我的笔记，总结一下我最近在学什么"
  expected_tools: [list_notes, read_note, read_outline]
  evaluation_criteria:
    - "覆盖主要笔记"
    - "总结准确反映内容"
    - "结构清晰"
```

### 3.3 边界测试集

```yaml
# test_cases/edge_cases.yaml
- id: edge_001
  category: error_handling
  input: "编辑一个不存在的文件"
  expected_behavior: "优雅地报告错误"
  
- id: edge_002
  category: ambiguous
  input: "帮我改一下那个文件"
  expected_behavior: "询问用户澄清"
  
- id: edge_003
  category: large_file
  input: "总结这个 10000 行的笔记"
  expected_behavior: "使用 read_outline 或分段读取"
```

---

## 4. 评估框架实现

### 4.1 评估运行器

```typescript
// src/tests/agent-eval/runner.ts

interface TestCase {
  id: string;
  category: string;
  input: string;
  expectedTools?: string[];
  expectedOutcome?: string;
  evaluationCriteria?: string[];
}

interface EvalResult {
  testId: string;
  success: boolean;
  taskCompletion: number;      // 0-1
  toolSelectionAccuracy: number;
  parameterAccuracy: number;
  executionSuccess: number;
  planQuality: number;
  tokenUsage: number;
  timeMs: number;
  errors: string[];
}

async function runEvaluation(testCases: TestCase[]): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  
  for (const testCase of testCases) {
    const startTime = Date.now();
    const agentResult = await runAgent(testCase.input);
    
    results.push({
      testId: testCase.id,
      success: evaluateSuccess(agentResult, testCase),
      taskCompletion: evaluateTaskCompletion(agentResult),
      toolSelectionAccuracy: evaluateToolSelection(agentResult, testCase.expectedTools),
      parameterAccuracy: evaluateParameters(agentResult),
      executionSuccess: evaluateExecution(agentResult),
      planQuality: evaluatePlanQuality(agentResult),
      tokenUsage: agentResult.totalTokens,
      timeMs: Date.now() - startTime,
      errors: agentResult.errors
    });
  }
  
  return results;
}
```

### 4.2 LLM-as-Judge 评估

对于主观指标，使用 LLM 作为评判者：

```typescript
// src/tests/agent-eval/llm-judge.ts

const JUDGE_PROMPT = `
你是一个 Agent 评估专家。请评估以下 Agent 执行结果：

用户任务：{task}
Agent 计划：{plan}
执行步骤：{steps}
最终结果：{result}

请从以下维度评分（0-10）：
1. 任务完成度：Agent 是否完成了用户的任务？
2. 计划质量：计划是否合理、高效？
3. 执行质量：每个步骤是否正确执行？
4. 结果质量：最终结果是否满足用户需求？

输出 JSON 格式：
{
  "task_completion": <0-10>,
  "plan_quality": <0-10>,
  "execution_quality": <0-10>,
  "result_quality": <0-10>,
  "feedback": "<改进建议>"
}
`;

async function llmJudge(agentResult: AgentResult): Promise<JudgeResult> {
  const response = await callLLM(JUDGE_PROMPT, {
    task: agentResult.task,
    plan: JSON.stringify(agentResult.plan),
    steps: JSON.stringify(agentResult.steps),
    result: agentResult.finalResult
  });
  
  return JSON.parse(response);
}
```

---

## 5. 基准测试套件

### 5.1 测试类别

| 类别 | 测试数量 | 描述 |
|------|----------|------|
| **基础操作** | 20 | 单工具操作（读、写、搜索） |
| **多步骤任务** | 15 | 需要计划的复杂任务 |
| **错误处理** | 10 | 边界情况和异常处理 |
| **性能压力** | 5 | 大文件、多文件操作 |
| **鲁棒性** | 10 | 模糊输入、噪音输入 |

### 5.2 评估报告模板

```markdown
# Agent 评估报告

## 总体指标
- **总测试数**: 60
- **通过率**: 85%
- **平均任务完成度**: 0.92
- **平均工具选择准确率**: 0.88
- **平均 Token 消耗**: 3,200/任务
- **平均响应时间**: 12.5s

## 分类表现
| 类别 | 通过率 | 任务完成度 | 工具准确率 |
|------|--------|------------|------------|
| 基础操作 | 95% | 0.98 | 0.95 |
| 多步骤任务 | 80% | 0.85 | 0.82 |
| 错误处理 | 90% | 0.90 | 0.88 |
| 性能压力 | 60% | 0.75 | 0.80 |
| 鲁棒性 | 70% | 0.82 | 0.78 |

## 主要问题
1. edit_note 的 old_string 匹配失败率较高 (15%)
2. 复杂任务的计划步骤偏多，平均 4.2 步
3. 大文件处理时 Token 消耗过高

## 改进建议
1. 优化编辑提示，强调精确匹配
2. 引入 read_outline 减少全文读取
3. 添加 Token 预算控制
```

---

## 6. 持续评估流程

### 6.1 CI/CD 集成

```yaml
# .github/workflows/agent-eval.yml
name: Agent Evaluation

on:
  push:
    paths:
      - 'src-tauri/src/agent/**'
  schedule:
    - cron: '0 0 * * 0'  # 每周日运行

jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Agent Evaluation
        run: npm run test:agent-eval
        
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: eval-results
          path: eval-results/
          
      - name: Check Threshold
        run: |
          PASS_RATE=$(cat eval-results/summary.json | jq '.passRate')
          if (( $(echo "$PASS_RATE < 0.80" | bc -l) )); then
            echo "Pass rate below threshold: $PASS_RATE"
            exit 1
          fi
```

### 6.2 评估仪表盘

建议追踪的关键指标趋势：
- 周/月任务完成率变化
- 工具调用分布
- Token 消耗趋势
- 常见失败模式

---

## 7. 业界基准对比

### 7.1 参考基准

| Benchmark | 描述 | 我们的关注点 |
|-----------|------|--------------|
| **AgentBench** | 8 种环境的 Agent 能力测试 | 任务完成度评估方法 |
| **T-Eval** | 工具调用评估 | 工具选择和参数准确率 |
| **MARBLE** | 多智能体协作评估 | 里程碑追踪方法 |
| **SWE-Bench** | 代码修复任务 | 编辑类任务评估 |

### 7.2 业界标准

根据业界最佳实践，Agent 系统应达到：

| 指标 | 及格线 | 良好 | 优秀 |
|------|--------|------|------|
| 任务完成率 | > 70% | > 85% | > 95% |
| 工具选择准确率 | > 75% | > 85% | > 95% |
| 参数准确率 | > 80% | > 90% | > 98% |
| 计划遵循度 | > 80% | > 90% | > 95% |

---

## 8. 附录

### 8.1 评估工具推荐

- **DeepEval** - LLM 评估框架，支持 Tool Correctness 等指标
- **LangSmith** - LangChain 官方追踪和评估平台
- **Weights & Biases** - 实验追踪和可视化

### 8.2 参考资料

- [LLM Agent Evaluation: Complete Guide](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)
- [Evaluating LLM-based Agents: Metrics, Benchmarks, and Best Practices](https://samiranama.com/posts/Evaluating-LLM-based-Agents-Metrics,-Benchmarks,-and-Best-Practices/)
- [AgentBench: Evaluating LLMs as Agents](https://github.com/THUDM/AgentBench)
