# 流程与阶段路径模块

## 适用

原文明示三至六个步骤、阶段或先后依赖。数组顺序必须由原文关系支持，不能因为版式需要把并列事项强行排成流程。

## 输入结构

`module_id` 为 `stage-process`；`diagram.type` 为 `stage-process`。每个步骤可包含核心动作、活动、交付物、责任与周期、阶段门。相邻步骤必须有带原文锚点的 `transitions`。当来源或计算明确证明某一步是瓶颈时，可设置 `emphasis: "bottleneck"`；不得仅为配色平衡而强调。

## 禁止

- 不根据编号外观之外的猜测创造先后关系。
- 不补写责任方、周期、交付物、里程碑或阶段门。
- 循环反馈只有原文明确时才显示。

运行 `validate_stage_process.mjs`、`plan_stage_process.mjs` 和 `render_stage_process.mjs`，并执行 PowerPoint 输出契约。
