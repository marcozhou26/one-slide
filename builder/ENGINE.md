---
name: single-consulting-slide-builder
description: Build one native-editable PowerPoint slide on a locked 16:9 presentation, 9:16 short-video B-roll, or portrait 3:4 knowledge-graphic canvas from an approved handoff or simple unambiguous request. Use for consulting comparisons, processes, matrices, trends, rankings, flows, charts, HR pages, B-roll and knowledge graphics. Return BRIEF_REQUIRED instead of forcing complex material into one page.
---

# Single Consulting Slide Builder V3.7.2

> 本文档中的命令均假定当前工作目录为包含顶层 `SKILL.md` 的 OneSlide Skill 根目录；Builder 脚本使用 `builder/` 前缀执行。

一次只生成一页咨询型 PowerPoint。优先消费已确认的结构化输入包；只加载命中的一个模块。不得调用通用 Presentations Skill 代替本 Skill。

## 核心结果

- 一页、锁定画布、PowerPoint 原生可编辑。
- 来源事实、数字、口径和结论强度可追溯。
- 数据图形使用方角；字段使用真实对象、表格或分块，不用竖线字符模拟列。
- 默认只做一个候选和一次整页渲染；发现确定性缺陷后允许一次修复渲染。

## 输入

接受三种入口：Prompt Architect 包、其他结构化 handoff、简单且无歧义的原始内容。Prompt Architect 包按 `references/prompt-architect-handoff.md` 检查；结构化输入直接路由，不重复生成 page model。复杂、歧义或明显超过一页的原始材料返回 `BRIEF_REQUIRED`。异常时读取 `references/input-contract.md`。

## 执行

### 1. 一次路由

输入保存为 JSON 后运行：

```bash
node builder/scripts/route_v3.mjs input.json
```

按结果继续：

- `deterministic_module`：只读返回的一个 reference；若 `module_input=module_payload`，原样保存载荷并直接运行 validator、planner、renderer。
- `direct_composition`：只读 `visual-grammar.md` 与 `direct-composition.md`，用 `pptx_core.mjs` 生成一页；`preferred_module` 不是可执行载荷。
- `BRIEF_REQUIRED`：交给 Prompt Architect。
- 其他阻断按返回原因停止，不猜测，不绕过地图风险，不复刻退休模块。

Handoff 含 `semantic_icon.enabled=true` 时，额外读取 `references/semantic-icon-library.md`，调用确定性检索器并只使用精选 SVG。`NO_ICON` 时继续无图标构图；不得联网搜索、扩大到完整图标库或要求用户选择文件名。

脚本正常时，不得打开渲染器源码、完整注册表或其他模块 reference。

### 2. 来源与受众

- 已确认 handoff 保持中心思想、内容边界和字段映射，不做第二轮内容判断。
- 简单原始输入执行 `LOSSLESS_TRANSFORMATION`，不新增或删改来源内容。
- 标题和故事必须有来源支持；证据只支持描述时，不补因果或建议。
- 强调默认关闭；仅允许稳定可读性规则或带 `target/reason/method/source_ids` 的业务强调。业务强调只用加粗与底纹，不改文字色或边框。
- 同级对象样式一致；相邻容器共边保持同色同宽，否则返回 `SHARED_EDGE_STYLE_MISMATCH`。
- 明确最终读者及其任务；页面模型、提示词、QA 和内部路径不得进入客户 PPTX。
- 数据单位、期间、范围、合计和计算关系冲突时停止正式生成。

### 3. 绘制

- `presentation_16_9` 使用 `1280×720 px` 坐标和既有确定性模块。
- `short_video_broll_9_16` 使用 `720×1280 px` 原生竖版画布；`knowledge_graphic_3_4` 使用 `720×960 px` 原生竖版画布。两者只走纵向直接编排，直到对应模块拥有独立的竖版 planner/renderer。
- 一图一观点的竖版页面优先调用 `scripts/render_portrait_one_point.mjs`；需要其他纵向关系时使用同一组语义组件直接编排并遵守当前画布坐标。
- 竖版页面必须从空白目标画布重新构图，不得裁切、拉伸、截图、嵌入完整横版页或复用 `1280×720` 坐标。
- B-roll 页面只承载一个核心论点和一个主图，优先上下分层、核心概念居中；禁止宽幅长流程、多列密表和“一页承载完整课件”。超出范围返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`。

- 先确定主要信息关系和主证据区，再绘制对象。
- 数据编码和普通容器用方角；圆角只用于状态标签。三行以上共享字段使用真实列或稳定槽位。
- 连续分布、桑基和其他专门关系遵守命中模块 reference；不绘制地图，地域比较改用无边界表达的排序、矩阵或小多图。
- 连接线只表达真实关系或唯一引线；先画线再画节点。
- 2–6 个大图标作为实体主角、页面核心是实体间传递或循环时，读取 `references/semantic-relationship-connectors.md`，使用语义关系连接线 MVP；双向循环使用上下两条原生曲线，不用折线或拼接线段冒充。
- 标题使用 `addPageHeading` 和完整容器宽度。一行标题可以带副标题；两行标题不得再堆副标题。常规正文 14/16 pt；局部小标题 16/18 pt；12 pt 仅用于密集局部、次要标签、来源和图注。
- 内容不删字仍放不下一页时返回 `SINGLE_SLIDE_FIT_FAIL`。
- 不用缩字号、删证据或改中心思想修复上游 Brief；内容范围问题退回 Prompt Architect。
- 图标仅作为可替换 SVG 视觉资产，不要求路径级原生可编辑。它不能替代文字、数据图形或关系线，也不得用于装饰、填空、业务强调或数据编码。
- `position` 只使用当前 `canvas_profile` 的像素坐标；不得混入英寸或其他画布坐标。
- 编号、短列名、状态标签和数据标签必须单行，分别使用 `addIndexBadge`、`addStatusTag` 或显式 `singleLine: true`。
- 合成定性内容可见标为 `模型补全，待确认`。正文只留结论、主证据和必要标签；术语、口径、公式与方法进备注。
- 页底只允许一行 `数据来源：...`，合成数据披露并入该行；所有可见内容计入信息预算。
- 标题下留至少 16 px；先分区再布局。移走内容后必须删除空框、放大主证据并重新平衡，否则返回 `CONTENT_REMOVAL_WITHOUT_REFLOW_FAIL`。
- 组织架构图按命中模块 reference 检查同层对齐、直属线垂直和职能虚线路由；`ORG_PEER_ROW_MISALIGNMENT`、`ORG_DIRECT_REPORT_DOGLEG` 或 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` 均阻断。

### 4. QA

生成后运行：

```bash
python3 builder/scripts/audit_pptx_semantics.py final.pptx
node builder/scripts/audit_visual_source.mjs
node builder/scripts/layout_quality.mjs internal/verify/layout.json
node builder/scripts/audit_public_readability.mjs --layout internal/verify/layout.json --pptx final.pptx
```

`exportPresentation` 内置 layout 门禁；所有换行、标题安全区、边缘对齐、画布利用、空容器、视觉平衡、重排和越界失败均阻断。直接编排声明主要区块共线边缘。渲染后人工检查遮挡、连接线、数据编码、可读性、页底唯一来源和备注覆盖；修复确定性缺陷，不做无收益美化。

统一导出层为母版、版式和页面写入一个 8pt、右下角的原生 `slidenum` 字段；缺失、重复、位置或字号错误由语义审计阻断。


组织架构与结构页按命中模块 reference 的专属门禁检查实际对象坐标和语义；主题只替换视觉令牌，不改变白名单、层级或同级语义。

## Token 纪律

- 不读取 `references/module-registry.json`；路由脚本内部读取。
- 不读取未命中的模块 reference。
- 不读取正常执行的脚本源码。
- 结构化输入不重复生成 page model、content mapping 或第二套数据说明。
- 中间计划保存在内部工作区；正常交付只返回最终 PPTX。

## 交付边界

客户目录只放版本化 PPTX。来源、提示词、路由结果、预览和 QA 放内部目录。

分别报告：

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
RENDERED_READABILITY_PASS
PUBLIC_READABILITY_PASS
TERMINOLOGY_ACCESSIBILITY_PASS
VISIBLE_INFORMATION_BUDGET_PASS
DATA_SOURCE_ONLY_FOOTER_PASS
SPEAKER_NOTES_COVERAGE_PASS
REQUIREMENT_COVERAGE_PASS
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

未执行的层级写 `not_tested`。技术测试和 ZIP 完整不能替代真实 PowerPoint 视觉检查或用户验收。

## 扩展

新增模块必须提供一个 reference、validator、planner、renderer、完整输入测试和异常输入测试。新增代码不得扩大常驻上下文；路由结果只返回命中模块的信息。
