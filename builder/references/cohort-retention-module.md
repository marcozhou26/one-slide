# 分群留存与存续曲线模块

适用：比较多个加入、入职、获客或首次订阅批次在同一组相对周期上的留存或存续变化，识别早期流失、批次差异和异常拐点。正式模块 ID 为 `cohort-retention`，`diagram.type` 必须同名。

## 与既有模块的边界

- 本模块支持 3–8 个 cohort、4–12 个相对周期、不同成熟度和尾部未观察期；
- `curve_mode=survival` 表示“截至该周期仍存续”，数值必须非递增；
- `curve_mode=period_retention` 表示“该周期仍活跃”，允许真实回升，但不得把未观察期填成 0；
- `hr-new-hire-survival` 继续承担固定四条、0–24 月、行业基准和风险因子矩阵的窄口径页面，不被本模块替换；
- 如果页面还需要独立的原因矩阵、渠道归因或第二个主图，省略模块字段并进入 `direct_composition`，或返回单页范围超载。

## 输入契约

- `relative_periods`：4–12 个严格递增的相对周期，每项包含数值、可见标签和 `source_ids`；
- `relative_period_unit`：周、月、季度等相对周期单位；
- `cohort_definition`：cohort 的形成规则；
- `denominator`：初始基数和留存分母口径；
- `measure`：留存人数或比例的定义；
- `curve_mode`：`survival` 或 `period_retention`；
- `cohorts`：3–8 个批次，`id` 唯一，包含标签、正整数 `initial_count`，以及与相对周期等长的 `retained_counts`、`retention_rates` 二者至少一个；
- `insights`：1–3 条由数据支持的洞察；
- `source_note`：页面可见的来源、期间或数据说明；
- 可选 `conclusion`、`disclosure` 和 `censoring_note`。

Producer 不应要求用户重复填写人数与比例。仅提供人数时按 `人数 ÷ 初始基数` 计算比例；仅提供比例时按 `比例 × 初始基数` 计算展示人数。两者都提供时必须对平。

## 缺失、删失与冲突门禁

- 相对周期 0 的人数必须等于初始基数，比例必须等于 100%；
- 未成熟或未观察周期使用尾部连续 `null`，不得写成 0；出现 `null` 后又出现数值时返回 `CENSORING_CONTRACT_FAIL`；
- 存在尾部 `null` 时必须提供可见 `censoring_note`，明确空白不是 0；
- `survival` 曲线回升时返回 `SURVIVAL_CURVE_FAIL`；`period_retention` 可回升，但人数与比例仍须对平；
- 人数不得为负数、超过初始基数或使用小数；比例范围为 0–100；
- 人数与比例的差异超过 0.6 人或 0.2 个百分点时返回 `COHORT_RECONCILIATION_FAIL`；
- 初始基数、分母、相对周期单位、来源或曲线口径缺失时阻断正式模块，不靠版式猜测。

## 页面与编辑性

主图为原生 PowerPoint 线段、圆点、坐标轴、网格线和文本。每个 cohort 显示批次名称、初始基数和最新已观察周期；曲线在最后一个已观察点停止。右侧最多三条数据洞察，并明确“未成熟／未观察为空白，不是 0”。底部保留来源、口径和合成案例披露。

验收至少覆盖：完整人数输入、仅比例输入、稀疏自然语言路由、缺少初始基数、人数与比例冲突、曲线回升、非尾部空值、未成熟尾期、非阻塞样式缺失和异常 JSON 格式。生成 PPTX 后检查一页 16:9、渲染、溢出、0 图片对象、原生可编辑对象和 Microsoft PowerPoint 实际打开。
