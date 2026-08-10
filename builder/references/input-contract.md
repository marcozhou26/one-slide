# V3.3 输入契约

风险等级：B。优先读取当前对话、附件和唯一文件；内部结构完整不等于要求用户补填字段。

| 输入 | 程度 | 接受形式 | 缺失与冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- |
| 单页来源内容 | required | 自然语言、Markdown、Word、PPT、CSV、JSON 或结构化交接包 | 先读当前上下文和唯一对象；仍无内容则 `SOURCE_BASELINE_FAIL` | 来源基线 |
| Prompt Architect 交接包 | optional / preferred | manifest、Builder Prompt、Builder handoff 和按需数据文件 | 检查批准状态、相对路径、字段和文件引用；失败则 `HANDOFF_PACKAGE_FAIL` | Handoff 快速路径 |
| 结构化交接包 | derived / optional | `subject`、`story`、`source_ids`、`display_blocks`、`structure`、`datasets` 或等价字段 | 存在时直接走快速路径；不得重复编译 page model；指定已产品化模块时必须同时提供完整 `module_payload` | V3 路由 |
| 实际读者与任务 | derived / conditional | 用户原话、项目语境或 `audience_task` | 可稳定推导时继续；不同读者会改变故事时才问一个问题 | 标题、密度、信息隔离 |
| 数据和口径 | conditional | 数值、单位、期间、范围、公式、来源 | 缺少非核心值可降级为结构草图；核心值冲突则停止正式生成 | 数据门禁与图表 |
| 图形类型 | derived / optional | 用户指定或由信息关系推导 | 用户指定与数据关系冲突时停止；混合结构进入 `direct_composition` | 路由 |
| 组织关系方向 | conditional（组织架构图） | 正式汇报的上级→下级、职能指导的来源→目标，可从原文、表格或 handoff 推导 | 同一虚线关系方向不清时不得为了排版猜测；先读上下文，仍有两个可能方向则返回 `BRIEF_REQUIRED` 或 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` | 组织模型、虚线分组与连接线门禁 |
| 模板与风格 | optional | `.pptx`、字体、颜色、边距 | 缺失时使用方角、白底、三色以内默认咨询风格 | 视觉生成 |
| 输出位置 | optional | 目录或文件名 | 使用版本化输出且不覆盖同名文件 | 交付 |

处理顺序固定为：

```text
READ_CONTEXT
→ DERIVE_IF_STABLE
→ USE_DECLARED_DEFAULT
→ PROCEED_WITH_REVERSIBLE_ASSUMPTION
→ DEGRADE_SCOPE
→ ASK_ONE_BLOCKING_QUESTION
→ STOP
```

## 结构化快速路径

满足以下条件时不得要求用户改填字段：

- `subject` 和 `story` 非空；
- `source_ids` 至少一个；
- 存在 `display_blocks`、`structure`、`dataset`、`datasets`，或同时存在明确的 `requested_module` 与完整 `module_payload`。

路由脚本只返回命中模块或 `direct_composition` 所需的最小文件清单。模型不得读取完整模块注册表。

结构化交接包只声明已产品化 `requested_module`、但没有 `module_payload` 时，返回 `MODULE_PAYLOAD_INCOMPLETE`。这条门禁不适用于原始自然语言输入：用户可以直接指定一种图形，Builder 仍需从原始内容建立输入并运行命中模块的 validator。

## 原始输入路径

原始内容足以识别主体、一个主要结论和一个主要信息关系时，采用默认风格继续。以下情况不再由 Builder 自行消化，返回 `BRIEF_REQUIRED`：

- 两个以上可能的中心思想或竞争性主图；
- 同时要求多个独立分析主题、洞察区域和行动区域；
- 内容取舍会改变用户原意；
- 需要决定哪些材料进入本页、哪些拆到下一页；
- 页面目标或读者任务不清，且不同答案会改变结构；
- 明显超过一页但用户没有给出优先级。

其他阻塞情况：

- 多个同等候选来源且选错会改变页面；
- 结论强度或因果方向无法从来源判断；
- 核心数字的单位、期间或范围冲突；
- 用户指定图形与数据关系不兼容；
- 不删内容无法在一页中保持可读。

乱码、截断、损坏文件或错误版本返回稳定错误码，不生成正式客户 PPTX。

`BRIEF_REQUIRED` 不是生成失败。它表示内容设计尚未完成，应由 Prompt Architect 形成预填 Brief 并与用户确认。
