# Sankey flow

- 用于：同一资源从左到右分流、转化或履约分类，且每条流有数值。
- 不用于：只有顺序、没有流量；任一节点或层间无法守恒。

## B 级输入契约

| 输入 | 程度 | 接受形式 | 缺失或冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- |
| `title` | required | `source`、`placeholder`；或带 `source_ids` 和非空 `derivation` 的 `approved_rewrite` | `approved_rewrite` 不要求伪造来源子串；缺推导说明或未知来源时 `SOURCE_FIDELITY_FAIL` | validator → renderer 标题 |
| `layers` | required | 3–5 层，每层 1–8 个唯一节点；节点含 value 和来源 | 缺层、重复 id、非数值或节点值与流量不守恒时停止 | validator → planner 列布局 → renderer 节点 |
| `flows` | required | 仅连接相邻层；value>0；`kind` 为 `neutral`、`on_time`、`not_on_time`，并兼容历史 `success`、`loss` | 未知语义、跨层连接、端点缺失或层间不守恒时停止；不得用“其他”补差 | validator → planner `flow_semantics` → renderer 流带颜色与层级 |
| SLA 局部核验区 | optional | `display_blocks` 中 `local_verification`；五行，每行含 `monthly_volume`、`fte`、`on_time_rate`、`sla_status` | 缺失时不画；存在但不是五行、字段缺失、数值异常或服务量与第一层节点冲突时 `SANKEY_SLA_BLOCK_FAIL` | validator → planner `sla_rows` → renderer 单一区域 |
| `insights`、`conclusion` | optional | 来源化对象 | 缺失时缩小支持区；来源冲突时停止 | validator → renderer 支持证据与行动区 |

读取顺序固定为 `READ_CONTEXT → DERIVE_IF_STABLE → USE_DECLARED_DEFAULT → DEGRADE_SCOPE → STOP`。SLA 区缺失属于可降级输入；流量、端点、守恒和业务语义属于阻塞输入。

## 视觉语义

- `neutral`：中性灰蓝流带，不暗示成功或损耗。
- `on_time`：蓝色流带，表示按时完成。
- `not_on_time`：橙色流带，标签和对象名保留“未按时”，不得改写为“损耗”。
- 历史 `success/loss` 继续使用蓝色／橙色流带，不改变既有含义。
- 五行 SLA 核验区必须是一个局部表格式区域，完整保留服务量、FTE、准时率、SLA 状态四字段，不能拆成五张卡。
- 每条流使用由上下两条三次贝塞尔曲线闭合而成的原生可编辑流带；带宽与 `value` 保持同一比例尺，源端和目标端分别在节点边缘连续堆叠。
- 节点必须是直角、无边框的原生矩形。禁止圆角、白色描边、灰色描边，以及会在节点与流带之间制造缝隙的任何轮廓线。
- 流带位于白色主框之上、节点和标签之下；交叉时使用透明度和确定性层级，不使用白色断点或桥洞遮罩。每层标题使用完整列宽，不得用节点宽度充当标题宽度。

## QA

- 核对每个节点值、每层合计和相邻层流量守恒。
- 核对 `neutral/on_time/not_on_time` 的对象命名、颜色和流带层级；不得出现把“未按时”写成“损耗”的可见文本。
- 核对 SLA 五行四字段、流带宽度排序、源端／目标端堆叠、节点无边框和局部表格可读性，并在 PowerPoint 中实开。
- OOXML 中自定义几何数量必须等于流量数量，每条流带包含两段三次贝塞尔曲线；但结构检查不能单独证明可读，整页预览和 PowerPoint 常规视图仍须识别中性流、按时流与未按时流，层标题不得挤断数字或被节点遮挡。
