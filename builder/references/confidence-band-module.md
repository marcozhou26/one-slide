# 中心估计与区间带模块

适用：沿 5–12 个有序时期或序列比较中心估计与区间宽度，识别不确定性扩大、收窄、越过业务阈值或方向不稳的时期。正式模块 ID 与 `diagram.type` 均为 `confidence-band`。

## 读者任务与边界

- 主图只回答一个问题：中心估计如何变化，同时其不确定性如何变化；
- `confidence_interval`、`credible_interval` 和 `other_interval` 必须按来源原义命名，不得互换；
- 置信区间不能自动称为预测区间或风险区间，也不能把“区间包含阈值”写成因果、风险或必然结果；
- 页面若还需要独立的驱动归因、情景预测或第二个主图，省略模块字段并进入 `direct_composition`。

## 输入契约

- `metric`、`unit`：指标和单位；
- `periods`：5–12 个标签唯一、`order` 严格递增的时期；每期提供 `estimate`、`lower`、`upper`，并满足 `lower ≤ estimate ≤ upper`；
- `interval_type`、`interval_label`、`interval_definition`：完整说明区间类型和含义；置信区间另需 0–100 之间的 `confidence_level`；
- `estimation_method`：中心估计和区间的计算方法；
- `sample_definition`、`population_definition`：样本/总体口径；每期可提供正整数 `sample_size`；
- `source_note`：页底来源与期间说明；
- 可选 `threshold`：数值、可见标签和语义，必须说明它是业务线、统计线或其他边界；
- `insights`：1–3 条由数值支持、不过度推断的读图结论；
- 可选 `missing_value_note`、`conclusion`、`disclosure`。

## 缺失和冲突处理

- 单期三个数必须全部存在或全部为 `null`；部分缺失返回 `MISSING_VALUE_CONTRACT_FAIL`；
- 存在缺失期时必须提供可见说明，折线和区间带在缺失处断开，不插值、不补 0；
- 时期重复、倒序或 `order` 冲突返回 `PERIOD_ORDER_FAIL`；
- 区间上下界包不住中心估计返回 `INTERVAL_ORDER_FAIL`；
- 区间定义或置信水平缺失返回 `INTERVAL_DEFINITION_FAIL`；
- 样式、配色和阈值缺失不是阻塞项，不应转嫁为用户字段问卷。

## 页面与编辑性

页面使用 PowerPoint 原生折线、圆点、坐标轴、虚线阈值，以及相邻时期之间的可编辑半透明四边形区间带。颜色不是唯一通道：中心估计用实线和圆点、区间用填充带、阈值用虚线并附文字。右侧只保留最多两条关键发现和克制结论；区间定义、估计方法、样本/总体、阈值语义和缺失说明写入讲者备注。页底只显示来源，合成披露并入同一行。

验收覆盖完整输入、稀疏输入、关键定义缺失、时期冲突、非阻塞样式缺失、缺失值、区间顺序错误、异常 JSON、自然语言路由、原生对象、渲染、溢出和 Microsoft PowerPoint 实机打开。
