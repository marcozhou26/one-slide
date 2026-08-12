---
name: single-consulting-slide-builder
description: Build one native-editable 16:9 consulting PowerPoint slide from an approved Consulting Slide Prompt Architect handoff, a structured Synthetic Input Generator package, or a simple unambiguous raw request. Use for consulting comparisons, processes, matrices, trends, rankings, flows, charts, complex organization charts, HR business pages, and composite analytical single slides. Return BRIEF_REQUIRED instead of forcing complex or ambiguous raw material into one page.
---

# Single Consulting Slide Builder V3.4.1

> 本文档中的命令均假定当前工作目录为包含顶层 `SKILL.md` 的 OneSlide Skill 根目录；Builder 脚本使用 `builder/` 前缀执行。

一次只生成一页咨询型 PowerPoint。优先消费已确认的结构化输入包；只加载命中的一个模块。不得调用通用 Presentations Skill 代替本 Skill。

## 核心结果

- 一页、16:9、PowerPoint 原生可编辑。
- 来源事实、数字、口径和结论强度可追溯。
- 数据图形使用方角；字段使用真实对象、表格或分块，不用竖线字符模拟列。
- 默认只做一个候选和一次整页渲染；发现确定性缺陷后允许一次修复渲染。
- 正文只保留结论和主证据；专业术语、口径和计算方法放入讲者备注，页底只显示一行数据来源。

## 输入

接受三种入口：Prompt Architect 包、其他结构化 handoff、简单且无歧义的原始内容。Prompt Architect 包按 `references/prompt-architect-handoff.md` 检查；结构化输入直接路由，不重复生成 page model。复杂、歧义或明显超过一页的原始材料返回 `BRIEF_REQUIRED`。异常时读取 `references/input-contract.md`。

## 执行

### 1. 一次路由

输入保存为 JSON 后运行：

```bash
node builder/scripts/route_v3.mjs input.json
```

按结果继续：

- `deterministic_module`：只读取返回的单个 `reference`。若路由返回 `module_input=module_payload`，把 handoff 中的 `module_payload` 原样写入运行目录的 `internal/module-input.json`，直接运行 validator、planner 和 renderer；不得重新解释或改写。不要读取完整注册表或渲染器源码。
- `direct_composition`：只读取 `references/information-contribution-gate.md`、`references/visual-grammar.md` 和 `references/direct-composition.md`，使用 `scripts/pptx_core.mjs` 的语义组件生成一页。路由返回 `preferred_pattern` 时额外读取 `references/direct-composition-patterns.md`；该文件只提供关系模式和正确性边界，不是确定性模块。`preferred_module` 只是视觉家族提示，不等于已有可执行模块载荷；不得假装命中确定性模块。
- `BRIEF_REQUIRED`：复杂或歧义原始材料交给 Prompt Architect。
- `SOURCE_BASELINE_FAIL` 或 `ROUTE_CONFLICT`：按返回的阻塞原因处理，不猜测。

脚本正常时，不得打开渲染器源码、完整注册表或其他模块 reference。

### 2. 来源与受众

- 已确认 handoff 保持中心思想、内容边界和字段映射，不做第二轮内容判断。
- 简单原始输入执行 `LOSSLESS_TRANSFORMATION`，不新增或删改来源内容。
- 标题和故事必须有来源支持；证据只支持描述时，不补因果或建议。
- 明确最终读者及其任务；页面模型、提示词、QA 和内部路径不得进入客户 PPTX。
- 数据单位、期间、范围、合计和计算关系冲突时停止正式生成。

### 3. 绘制

- 完整读取并执行 `references/information-contribution-gate.md`。每个可见对象必须传递信息、编码证据、表达关系、提供定义来源、说明行动条件或承载用户明确要求的身份；纯装饰对象一律删除。
- 先确定主要信息关系和主证据区，再绘制对象。
- 数据条、图表柱、瀑布柱、表格单元格和普通容器必须方角。
- 连续数值分布必须保留原始观测、单位、期间、分母、样本与缺失值，使用可复现的显式分箱边界和相邻原生矩形；不得用带间距的分类柱状图冒充。
- 圆角只允许显式状态标签；不得用于数据编码、趋势、层级、流程节点或结论带。
- 桑基图使用封闭的原生贝塞尔流带；节点使用直角、无边框矩形。不得退回粗直线、白色节点描边或圆角节点。
- 三行以上共享字段必须使用真实列、表格单元格或稳定槽位。
- 连接线只表达方向、因果、依赖、跨阶段同一对象或唯一注释指向；先画关系线，再画节点。
- 标题使用 `addPageHeading` 和完整容器宽度。一行标题可以带副标题；两行标题不得再堆副标题。常规正文 14/16 pt；局部小标题 16/18 pt；12 pt 仅用于密集局部、次要标签、来源和图注。
- 内容不删字仍放不下一页时返回 `SINGLE_SLIDE_FIT_FAIL`。
- 不用缩字号、删证据或改中心思想修复上游 Brief；内容范围问题退回 Prompt Architect。
- `position` 只使用 `1280×720 px` 坐标；不得混入英寸或 960×540 坐标。
- 编号、短列名、状态标签和数据标签必须单行，分别使用 `addIndexBadge`、`addStatusTag` 或显式 `singleLine: true`。
- 合成定性内容在 PPT 可见面写 `模型补全，待确认`；英文来源 key 留在内部 handoff，不放进窄标签。
- 横向行动带使用 `addActionBand`，不得自行把标签和长句塞入两个未经测量的窄文本框。
- 标题组件的实际下边缘之后至少保留 16 px 安全间距。主图、图例、里程碑标签、注释、数据标签和行动区都属于正文，任何一个都不得伸入标题安全区。不能只检查主图外框。
- 先分配标题区、正文区、行动/结论区和来源区，再在正文区内做纵向布局。若标题附近发生拥挤而页面底部仍有 56 px 以上可移动余量，必须整体下移正文框架；不得把空白留在页底却向上压标题。
- 组织架构图必须把同层普通部门放在同一水平线上；一对一直属关系的父子节点水平中心误差不得超过 1 px，否则标记 `ORG_DIRECT_REPORT_DOGLEG`。为两条以上职能指导提供共同来源的部门可以放在较低的来源行；虚线从该节点朝目标的一侧出发，经下方空白通道，从目标底部进入。虚线穿越无关节点、把相反方向关系合并成同一来源，或同层节点高低不齐，分别按 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` 或 `ORG_PEER_ROW_MISALIGNMENT` 阻断交付。

### 4. QA

生成后运行：

```bash
python3 builder/scripts/audit_pptx_semantics.py final.pptx
node builder/scripts/audit_visual_source.mjs
node builder/scripts/layout_quality.mjs internal/verify/layout.json
```

`exportPresentation` 已内置 layout 质量门禁；`DECORATIVE_ELEMENT_BLOCKED`、`DECORATIVE_TOP_BAND_BLOCKED`、`EYEBROW_BLOCKED`、`SHORT_LABEL_WRAP`、`ORPHAN_LINE`、`UNBREAKABLE_TOKEN_WRAP`、`BAD_LINE_START_PUNCTUATION`、`NUMBER_UNIT_SPLIT`、`TWO_LINE_TITLE_WITH_SUBTITLE`、`HEADING_SAFE_ZONE_INTRUSION`、`CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE`、`EDGE_ALIGNMENT_MISMATCH`、`CANVAS_WIDTH_UNDERUSED`、`CANVAS_HEIGHT_UNDERUSED` 和越界均必须阻断交付。模板出现纯装饰形状时以 `TEMPLATE_DECORATION_BLOCKED` 阻断。直接编排还必须用 `registerEdgeAlignment` 声明主要纵向区块的共线边缘。渲染整页要人工检查信息贡献、标题换行、标题安全区、上下留白平衡、遮挡、连接线、数据编码、字段分块和可读性。已知确定性缺陷必须修复，不受候选预算限制；不得为无明确收益的美化反复迭代。

组织架构模块额外阻断 `ORG_PEER_ROW_MISALIGNMENT`、`ORG_DIRECT_REPORT_DOGLEG` 和 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS`。这些状态必须来自实际节点坐标与关系方向检查，不能只扫描提示词或依赖 PowerPoint 自动路由。

## Token 纪律

- 不读取 `references/module-registry.json`；路由脚本内部读取。
- 不读取未命中的模块 reference。
- 不读取正常执行的脚本源码。
- 结构化输入不重复生成 page model、content mapping 或第二套数据说明。
- 中间计划保存在内部工作区；正常交付只返回最终 PPTX。

## 交付边界

Builder 输出先作为内部初稿交给 `../editorial/ENGINE.md`，不得直接视为最终美观度通过。Editorial QA 只读判断 `PASS_AS_IS`、`BUILDER_LOCAL_REPAIR`、`BUILDER_RECOMPOSE` 或 `EDITORIAL_BLOCKED`。需要修改时 Builder 独立形成执行计划并完成修改，QA 再复审；只有 `PASS_AS_IS` 或复审通过后，客户目录才放版本化 PPTX。来源、提示词、路由结果、前后预览、执行计划和 QA 放内部目录。

分别报告：

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
RENDERED_READABILITY_PASS
REQUIREMENT_COVERAGE_PASS
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

未执行的层级写 `not_tested`。技术测试和 ZIP 完整不能替代真实 PowerPoint 视觉检查或用户验收。

## 扩展

新增模块必须提供一个 reference、validator、planner、renderer、完整输入测试和异常输入测试。新增代码不得扩大常驻上下文；路由结果只返回命中模块的信息。
