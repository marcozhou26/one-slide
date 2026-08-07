# 雷达能力模块

适用：用一个 6–12 维雷达比较 `current`、`benchmark`、`target` 三个序列。雷达是唯一主图；业务单元排序等证据只能作为邻接支持区，不得扩大为第二主图或表格墙。

## B 级输入契约

| 输入 | 程度 | 接受形式与质量要求 | 缺失、歧义或冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- |
| 标题与来源锚点 | required | 非空标题、`origin`、至少一个真实 `source_id`；标题必须是来源原文子串 | 先读 handoff 和来源锚点；仍缺失则 `SOURCE_FIDELITY_FAIL` | 标题与来源审计 |
| 量表 | required | `scale.min`、`scale.max`、`scale.unit`；上下界为有限数字且 `min < max`。支持 0–10，也支持输入明确声明的其他连续量表 | 不猜测、不把 0–10 折算为 1–5；缺失或矛盾返回 `SCALE_CONTRACT_FAIL` | validator、雷达环线、刻度、三序列归一化 |
| 雷达维度 | required | 6–12 项；每项含来源支持的名称，以及数值型 `current`、`benchmark`、`target` | 缺项返回 `DATA_CONTRACT_FAIL`；字符串数字、空值或越界值返回 `SCALE_RANGE_FAIL` / `ABNORMAL_FORMAT_FAIL` | 三个原生可编辑雷达多边形与轴标签 |
| 三序列名称 | required | `series_labels.current / benchmark / target`，均带来源 | 缺失不自行补写业务名称，返回 `SOURCE_FIDELITY_FAIL` | 图例 |
| 能力群与群组卡 | optional | 维度可带 `group`；`group_cards` 存在时为非空数组 | 不再强制三个群，也不强制三张卡；提供时按来源校验 | 无业务单元排序时的可选支持区 |
| 业务单元排序 | optional | `supporting_evidence.type=business-unit-ranking`；2–10 个单元，含名称、指数、营收适用性、人数、来源；声明降序时必须实际降序 | 排序冲突返回 `RANKING_ORDER_FAIL`；营收“不适用”必须显式声明，不得写成 0 | 依附雷达的紧凑支持证据区 |
| 试点条件区 | optional | 1–3 个来源支持的条件项 | 缺失不阻断雷达；提供但结构异常时返回 `DATA_CONTRACT_FAIL` | 阅读链末端的单一条件区 |
| 文件型 handoff | conditional | Prompt Architect `builder-handoff.json`，D01 雷达 CSV 与 D02 排序 CSV 使用相对路径；UTF-8、表头唯一、行列数一致 | 先按 JSON 所在目录解析；缺文件、乱码、重复表头、列数异常或非数字字段停止，不生成 PPTX | `loadR3ModuleInput` 标准化后进入同一 validator/planner/renderer |

处理顺序固定为：读取当前 handoff 与相对数据文件 → 验证量表和来源 → 验证三序列与 6–12 维 → 按需验证排序和条件区 → 规划一个主雷达及附属证据 → 渲染原生对象。

## 视觉与语义门禁

- 三序列共享同一圆心、轴顺序和输入声明的量表；归一化只用于绘图坐标，不改变可见分值。
- 排序区面积和视觉权重必须小于雷达区；不得把排序复制成独立主图、整页表格或卡片阵列。
- 业务单元排序不是能力群卡片的同义替代；两类支持证据按输入选择。
- 标题、轴标签、图例、排序标签、条件和脚注均为 PowerPoint 原生文本或矢量形状；不得用图片承载主图。
- 越界、量表冲突、异常 CSV、核心来源缺失时停止；不折算量表、不删序列、不把雷达改成普通表格。
