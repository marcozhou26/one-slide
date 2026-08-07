# Gantt dependency

- 用于：2–6 条泳道、8–20 项任务、1–18 个时标槽位的项目评审；既支持普通月份，也支持 `T0`、`T+N` 相对时标。
- 不用于：没有起止槽位、泳道或可核验时间关系的任务清单；没有端点的实施前置条件只能进入说明区，不能伪造成 Gantt 边。

## B 级输入契约

| 输入 | 程度 | 接受形式 | 缺失或冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- |
| `lanes` | required | 2–6 个带来源的泳道对象 | 缺失、重复或任务引用未知泳道时 `DATA_CONTRACT_FAIL` | validator → 泳道布局 |
| `tasks` | required | 8–20 项；含唯一 id、来源化标签/负责人、lane、start/end、progress、critical | 端点、范围、进度或引用冲突时停止，不猜测 | validator → planner 行高/时标 → renderer 任务条 |
| `month_label_map` | optional | 槽位字符串键到 `T0`/`T+N`；键和值均严格递增 | 缺失时保留普通月份；格式异常或与任务范围冲突时 `GANTT_TIME_SCALE_FAIL` | validator → planner `time_axis` → renderer 时标 |
| `dependencies` | conditional | `from`、`to`；可含 `relationship_class` 与 `not_a_prerequisite` | 缺失分类时按历史必要依赖处理；`time_order_only` 必须同时为 `not_a_prerequisite=true`，反向或冲突语义停止 | validator → planner 归一化 → renderer 两套线型 |
| 阶段层级 | optional | `layer_steps`，或 `side_metrics` 中“阶段层级；T0为11层，T+2为10层，T+6为9层” | 无该信息时不画；有信息但时间不递增、层级不逐级下降或时标不在轴内时 `GANTT_LAYER_STEP_FAIL` | validator → planner `layer_steps` → renderer 阶梯线 |
| `milestones`、`side_metrics`、`conclusion` | optional | 来源化对象 | 未提供则缩小支持区；错误月份或来源冲突时停止 | validator → planner → renderer 支持区 |

读取顺序固定为 `READ_CONTEXT → DERIVE_IF_STABLE → USE_DECLARED_DEFAULT → DEGRADE_SCOPE → STOP`。相对时标、关系分类和层级序列一旦提供，不得降级为普通月份、统一“依赖线”或普通说明文字。

## 视觉语义

- `time_order_only + not_a_prerequisite=true`：高对比灰色虚线、无箭头；线必须位于主框之上、任务条之下，在整页预览和 PowerPoint 常规视图中清楚可见；只表示时间先后。
- 历史未分类关系或 `prerequisite`：蓝色实线肘形箭头；表示必要依赖。
- 两种关系在 validator、planner 和 renderer 中使用同一归一化结果，不靠文案猜测。
- 阶段层级在主图下沿用原生折线和节点绘制；`11→10→9` 的时点必须与相对时间轴对齐。
- 输出保留泳道底纹、任务条、进度与负责人、原生连接器、里程碑及支持区。

## QA

- 依赖端点与时序一致；纯时间顺序没有箭头，也不被称为必要条件。
- `T0/T+N` 在渲染后仍为来源时标；不得自动改写为普通月份。
- 层级阶梯节点、任务、时标和右栏均不溢出；连接器、文本与阶梯线保持原生可编辑。
- OOXML 中存在连接器不能单独证明可读；四条时间顺序线必须在整页预览和 PowerPoint 常规视图中逐条可辨。
- 里程碑标签、关系图例和时标说明都属于甘特正文，不得进入页标题的安全区。下方仍有空间时，甘特主框、全部漂浮注释、支持区和来源必须作为一个纵向框架整体下移。
