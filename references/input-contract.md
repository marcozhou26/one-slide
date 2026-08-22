# OneSlide 输入契约

风险等级：B。它处理文件、数据、内容生产和多步骤 PowerPoint 工作流。内部完整性不能变成用户问卷。

## 输入登记

| 输入 | 程度 | 接受形式 | 缺失处理 | 歧义或冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- | --- |
| 单页主题、任务或材料 | required | 自然语言，或可读取的 TXT、MD、CSV、XLSX、DOCX、PPTX、PDF、图片、JSON | 先读当前对话、附件和唯一对象；仍无法识别主题或读者任务时，只问一个阻塞问题 | 保留竞争解释；能推荐时先给推荐方向 | 来源基线和单页范围 |
| effective_page_spec | conditional / source-locked | 报告页必须为`effective-page-spec-1.0`且只含一页 | 缺失时返回`EFFECTIVE_PAGE_SPEC_REQUIRED`给slide-spec | 与导演继承值冲突时返回`EFFECTIVE_PAGE_SPEC_CONFLICT`，不得自由规划 | 报告页规格校验 |
| 输出意图 | derived / optional | “提示词、Brief、交接包”或“创建、绘制、生成 PPT” | 默认 `PROMPT_ONLY` 并说明 | 最新明确请求优先 | 输出模式 |
| 使用场景与画布 | derived / optional | 演示汇报、短视频/B-roll、知识图文或明确比例 | 短视频/B-roll 推导原生 `9:16`；知识图文推导原生竖版 `3:4`；否则默认 `16:9` | 用户明确尺寸优先；“高4宽3/4:3竖版”规范化为 `3:4`；短视频与知识图文同时出现且会改变输出时才问一个场景问题 | `canvas_profile`、内容预算和 Builder 路由 |
| 受众及其任务 | derived / conditional | 用户原话、附件、项目语境 | 稳定推导；必要时采用可撤销假设 | 不同受众会改变中心结论或主图时才问 | 页面目标 |
| 用户事实、数字、定义和结论 | optional / source-locked | 用户文字或来源文件 | 使用现有证据；允许定向补全的只补缺口 | 不修改冲突值；停止受影响的计算 | 内容与来源标注 |
| 是否允许补全 | derived / conditional | 调用 OneSlide 默认授权“明确标注的可撤销补全”；用户可明确禁止 | 禁止补全时使用 `SOURCE_ONLY` 或 `EVIDENCE_BLOCKED` | 要求真实事实时，事实要求覆盖默认补全 | 内容模式 |
| 中心结论 | derived / conditional | 一句由来源或计算支持的话 | 从材料推导；合成数据场景先生成数据再计算 | 两个不兼容结论需要不同主图时才问 | 标题与故事 |
| 主要关系 | derived / conditional | 对象、维度、指标、方向 | 从读者任务和证据推导 | 信息关系优先于不兼容的图形偏好 | 主图与 Builder 路由 |
| 输出目录 | optional | 可写目录 | 当前工作区创建新版本目录 | 不覆盖现有运行目录 | 交付位置 |
| PowerPoint 运行能力 | derived / conditional | `PPT_DRAFT` 时需要 Node.js、内置 Builder 及其渲染依赖 | 降级交付已验证提示词包，返回 `PPT_RENDERING_BLOCKED` | 不替换为通用渲染器 | 绘制阶段 |
| 模板或品牌 | optional | PPTX、颜色、字体、Logo、明确规则 | 使用内置中性咨询风格 | 与可读性或单页逻辑冲突时说明并采用安全边界 | Builder 视觉实现 |
| 语义图标与`icon_handoff` | derived / optional；报告页为source-locked | 用户明确要求、页面存在语义识别需求，或`effective_page_spec.icon_handoff` | 默认不使用；收到handoff时逐项校验并确定性解析；无匹配时按声明返回文字降级、`NO_ICON`或精确阻断 | 不得改写`concept`以命中图标库；`required`项不得静默省略；装饰、填空、业务强调或数据编码用途直接禁用 | Producer可选`semantic_icon`交接；slide-spec的`icon_handoff`进入Builder路由、目标绑定和产物审计 |
| 强调授权 | derived / optional | 用户原话、来源数据、计算规则或上游 `allowed_emphasis` | 默认只用加粗与底纹；`emphasis_border=false`；允许中性奇偶行/列底色 | 目标、理由、方法或来源不完整时不得强调；强调不得改变边框 | Producer 交接与 Builder QA |
| 正文、备注与数据来源分配 | derived | 用户原文、读者任务、专业术语、计算和来源记录 | 默认按统一传播规则自动分配，不向用户追问模式 | 用户明确要求某项口径进入正文时保留，但仍计入可见预算 | Producer 内容分配与 Builder 备注 |

## 固定判断顺序

```text
READ_CONTEXT
→ DERIVE_IF_STABLE
→ USE_DECLARED_DEFAULT
→ PROCEED_WITH_DISCLOSED_ASSUMPTION
→ DEGRADE_SCOPE
→ ASK_ONE_BLOCKING_QUESTION
→ STOP / HANDOFF / REFUSE
```

不得因为用户没有给样本量、时间范围、图形类型、颜色、模板、模块、坐标或精细度而阻塞。能生成诚实、可撤销的第一版时，直接继续并标明假设。

## 允许追问的情况

- 两个以上同样合理的页面问题会产生不同中心结论或主图；
- 必含内容超过单页预算，且无法给出不删内容的安全焦点；
- 两个权威版本的核心数字冲突，页面计算必须使用其中一个；
- 用户要求真实公司事实，但没有足够证据且禁止匿名示例；
- 多个同等候选文件或版本，选错会明显改变结果。

## B 级文件和数据规则

- 给每个使用的附件记录文件名、SHA-256、读取状态和版本判断。
- 乱码、加密、损坏、缺页、扫描件或截断文件必须标明，不假装读取成功。
- 保留单位、期间、粒度、分母、筛选范围、缺失值含义和计算口径。
- 原文基线默认不删减；读者理解结论必需的信息留在正文，专业术语解释、口径、代号翻译、公式和方法拆分保留到 PowerPoint 备注，并在内容映射中记录。
- 不把客户敏感信息、真实个人数据或内部协作记录放进公开示例和发布 ZIP。

## 最小行为矩阵

- 完整输入：走 `SOURCE_ONLY`，不无故增加内容或追问。
- 稀疏自然语言：推导单页方向，定向补全并标注。
- 缺少关键主题：只问“这一页要让读者看懂或决定什么”。
- 模糊或冲突目标：推荐最强焦点；确实不能共同推进时才问。
- 非阻塞偏好缺失：不问颜色、模块、坐标和卡片数量。
- 异常文件：记录问题，能用现有文字继续时降级继续。
- 真实公司无数据：不生成该公司名下的事实指标。
- 多页请求：锁定一页；推荐单页焦点或返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`。
- 整套报告输入：若是director_package或旧大纲handoff，返回`EFFECTIVE_PAGE_SPEC_REQUIRED`；若是多个effective_page_spec，逐页分别运行，不在一次运行生成多页。
- 短视频/B-roll：不追问比例；使用原生 `9:16` 画布、纵向分层和一图一观点，禁止裁切或拉伸 16:9 页面。
- 知识图文：使用原生竖版 `3:4`；用户写“4:3 竖版”但同时说明高4宽3时按 `3:4` 执行。
- 竖版复杂宽图：不缩小或横向挤压；返回 `SINGLE_SLIDE_SCOPE_OVERLOAD` 并推荐下一张图的焦点，不在同一次运行暗中生成多页。
- PPT 依赖不可用：保留提示词包，不伪造 PPT 完成状态。
- 专业术语或计算口径：不增加模式选择；正文改为普通中文，完整解释写入备注，页底只保留数据来源。
