# 分组分布摘要模块

适用：回答“多个组的典型水平、中间 50% 区间、离散程度和异常记录有何差异”。正式模块 ID 为 `box-plot`，`diagram.type` 必须同名。模块只处理同一指标、同一期间、同一单位和同一统计口径下 3–8 个可比组，不替代直方分布、时间趋势或只比较均值的页面。

## 输入契约

- `period`、`unit`、`denominator`：明确期间、单位、统计分母和筛选范围；
- `sample_definition`、`missing_policy`：说明一条观察代表什么、有效样本如何计数、缺失记录如何处理；
- `quartile_method`：备注中的四分位算法，本版本使用 `PERCENTILE.INC（线性插值，等同 Type 7）`；
- `whisker_multiplier`：本版本固定为 `1.5`；
- `whisker_rule`：备注说明“须线端点为 1.5×IQR 围栏内的最远观测，围栏外记录逐点标为异常值”；
- `source_note`：页面底部唯一可见的简短数据来源；
- `groups`：3–8 组，`id` 唯一；每组包含标签、有效 `sample_size`、`missing_count`、`whisker_low`、`q1`、`median`、`q3`、`whisker_high`、显式 `outliers` 和 `source_ids`；
- `insights`：1–3 条由分布摘要支持的发现；可选 `conclusion` 和合成数据 `disclosure`。

## 门禁

- 每组必须满足 `whisker_low ≤ q1 ≤ median ≤ q3 ≤ whisker_high`，且 IQR 大于 0；
- 须线端点不得越过声明的 1.5×IQR 围栏；每个异常值必须位于须线之外，不能只靠颜色暗示；
- 有效样本量至少 5，缺失数必须显式提供且不得为负；
- 期间、单位、分母、样本定义、缺失规则、四分位算法或须线规则缺失时返回 `DATA_CONTRACT_FAIL`；
- 口径冲突、汇总值顺序错误或异常值位置不一致时返回 `BOX_PLOT_RECONCILIATION_FAIL`；不得自动修正来源统计结果。

## 页面与编辑性

主图使用原生 PowerPoint 线条、矩形、椭圆和文本：箱体表达中间 50% 数据，中位数使用明确横线和数值，须线与端点独立可编辑，异常值逐点显示并带“异常值 + 数值”标签。组名下直接显示有效样本量和缺失数；右侧只显示关键发现和结论。期间、样本口径、缺失规则、四分位算法、IQR 和须线规则写入 PowerPoint 备注。页底只显示数据来源，合成数据披露并入该行。

验收必须覆盖完整输入、稀疏自然语言、关键口径缺失、模糊或冲突、非阻塞样式缺失、异常格式、统计顺序错误、异常值误放、渲染、溢出、原生对象和 Microsoft PowerPoint 实际打开。
