---
name: one-slide
description: "把完整或零散的用户材料整理成恰好一页、来源可追溯、可直接用于制作演示文稿的提示词，并可选生成一页原生可编辑的 PowerPoint。支持演示汇报 16:9、短视频 B-roll 9:16 和知识图文竖版 3:4。适用于用户需要专业单页、竖屏口播配图或知识图文，材料可能不完整，并要求明确标识合成或推导内容的场景。"
license: Apache-2.0
metadata:
  author: "周俊东 Marco"
  version: "1.9.2"
---

# OneSlide

一次只处理一页PPT，并以咨询报告级标准忠实实现已锁定的单页表达规格。独立单页任务仍可直接从用户材料开始；复杂报告页面的唯一直接上游是slide-spec生成的`effective_page_spec`。内部先完成内容与来源校验，需要PPTX时再调用随包附带的Builder引擎。

## 每次运行先读

完整读取：

- `references/input-contract.md`
- `references/effective-page-spec-input.md`
- `producer/references/single-slide-contract.md`

## 阶段性读取

- 开始建立来源记录或补全内容时：读取 `producer/references/provenance-contract.md`。
- 开始生成运行目录和交接包时：读取 `producer/ENGINE.md` 与 `producer/references/output-contract.md`。
- 发生降级、阻断、引擎不可用或职责边界冲突时：读取 `references/suite-contract.md`。
- 进入绘制阶段时：读取 `builder/ENGINE.md` 和路由返回的唯一模块 reference。

不要预读全部 Builder 模块，也不要在尚未进入相应阶段时加载打包、降级或渲染说明。

## 首次互动

自然说明本轮只制作一页，然后根据当前对话、附件和已确认决定预填：

- 这一页要说明什么；
- 谁会看，以及他看完要理解或决定什么；
- 一个主要问题、一个主要关系和一个中心结论；
- 哪些内容由用户提供并必须保留；
- 哪些缺口会被定向补全并标记。

只有两个同样合理的页面方向会改变中心结论或主图时，才问一个阻塞问题。不得要求用户填写内部字段、模块编号、坐标、卡片数量或装饰偏好。

## 两种输出

从用户原话推导：

- `PROMPT_ONLY`：用户要求提示词、Brief、交接包或生成指令。
- `PPT_DRAFT`：用户要求直接创建、绘制、生成或交付 PowerPoint。

未说明载体时默认 `PROMPT_ONLY`，并简短说明。用户随后改为 `PPT_DRAFT` 时，复用已经锁定的来源和页面方向，不要求重述材料。

## 三种原生画布

- `presentation_16_9`：演示汇报，原生横版 `16:9`，默认 `13.333×7.5 英寸`。
- `short_video_broll_9_16`：短视频 B-roll，原生竖版 `9:16`，默认 `7.5×13.333 英寸`。用户提到短视频、口播配图、视频号、抖音、小红书短视频或 B-roll 时稳定推导此模式，不追问比例。
- `knowledge_graphic_3_4`：知识图文，原生竖版 `3:4`，默认 `7.5×10 英寸`。附件或用户把“高4宽3”称为“4:3 竖版”时，内部必须规范化为 `3:4`，不得生成宽4高3的横版画布。

三种模式都必须从空白的目标 PowerPoint 画布直接构图。禁止从 16:9 页面裁切、缩放、拉伸、截图或整页嵌入。短视频模式遵循“一图一核心观点”、纵向分层、核心概念居中、少文字；禁止宽幅长流程、多列密表和横向模块坐标。知识图文模式允许较复杂的矩阵和多栏，但仍受单页可读性门禁约束。未出现明确场景或比例时默认 `presentation_16_9`。

## 复杂报告页面入口

收到`schema_version=effective-page-spec-1.0`的单页规格时，按`references/effective-page-spec-input.md`校验并忠实实现，不重新选择页面任务、中心结论、主要关系、主视觉、阅读顺序、密度、注意力角色、白名单或导演锁定字段。

收到OneDeck的整套`director_package`、旧`oneslide-handoff.json`或只有大纲/任务书而没有`effective_page_spec`时，不得直接施工，返回`EFFECTIVE_PAGE_SPEC_REQUIRED`并交给slide-spec逐页编译。整套文件不得一次生成多页。

`effective_page_spec`包含`icon_handoff`时，必须把该字段原样交给Builder路由消费。`status=requested`的每个项目必须保留`concept`、`role`、`peer_group`、`target_id`、`required`、`style`、`fallback`和`source_ids`；不得为了命中图标库改写业务概念。`required=true`的项目必须在目标对象上正确呈现、明确使用文字降级，或返回精确阻断状态，不得静默省略。图标只作语义识别标记，不承担装饰、业务强调或数据编码。

结构页按`page_type`稳定路由：`cover`与`ending`进入`bookend-page`；`summary`进入`summary-page`；`agenda`、`numbered_overview`与`numbered_recap`进入`navigation-page`；`section_transition`进入`section-transition`。普通内容页继续使用现有关系路由。

`navigation-page`只对上游已声明的`peer_groups`应用内容组布局：同级项目先紧凑成组，再把整组放在画布垂直中心或稍偏下的位置。普通内容页不做自动 bullet 识别。

`summary-page`只消费上游已声明的摘要叙事与段落图标合同。图标像放大的bullet一样位于整段文字左侧，默认高度为正文有效字高的1.5倍，可在1.4—1.6倍内自适应；不得把图标移到段落上方或做成Logo。`navigation-page`的目录编号容器高度为右侧标签有效字高的1.2倍，编号字号比标签小2—4pt，默认小3pt。

单页PPTX完成后交给Deck Control进行页面包检查、顺序组装和跨页执行验收。OneSlide不生成第二页、不重排页面、不修改跨页节奏，也不把整套组装失败改写成单页内容问题。需要跨页修复时返回`DECK_ASSEMBLY_OUT_OF_SCOPE`及上游指定页面。

## 三种内容模式

- `SOURCE_ONLY`：现有信息足以支持这一页，不新增事实。
- `SYNTHETIC_AUGMENTATION`：只补页面必要缺口，不改变用户事实和主逻辑。
- `EVIDENCE_BLOCKED`：目标要求真实事实，但缺少证据且不能诚实补全。

样式、措辞、版式和图表选择不是事实缺口，可以从主要关系推导。

## 正文与备注分工

统一使用一条规则，不增加受众模式或额外路由：

- 正文只放读者第一眼理解结论和主证据所需的信息；所有可见文字、标签、图例和说明都计入信息密度预算。
- PowerPoint 备注保留专业术语解释、口径解释、专业代号翻译、计算公式和计算方法。把这些内容移入备注属于载体分配，不是删减原文。
- 页面底部只允许一行 `数据来源：...`。除数据来源外，不得放方法、口径、样本、期间、缺失值、限制、结论、建议、合成披露或其他讨论信息。
- 合成数据的强制披露并入数据来源行，例如 `数据来源：匿名合成样本；合成示例数据，非真实客户数据`。
- 标题、结论和正文不得出现读者无法识别且来源未定义的专业代号。用户原文已经定义、目标读者通用或用户明确要求保留的代号（例如 RACI）必须原样保留，不得擅自翻译；解释可放备注。

## 强调默认关闭

- 所有视觉差异先分类：`structural_hierarchy`（标题、表头等结构层级）、`readability_pattern`（交替行、共享尺度、固定图例等稳定阅读规则）、`business_emphasis`（来源支持的重点）。只有不属于这三类、或无法解释和重复的差异才是 `ungrounded_emphasis`。
- `structural_hierarchy` 与 `readability_pattern` 可以保留，但必须同类一致、规则稳定、对相同输入产生相同结果，不得暗示不存在的业务优先级。
- `business_emphasis` 必须由用户原话、来源数据、计算规则或完整 `allowed_emphasis` 支持。
- 业务强调的默认方法固定为 `bold=true` 与 `highlight_fill=true`；`emphasis_border=false`、`emphasis_border_width=false`、`emphasis_text_color=false`。浅色强调底纹沿用普通正文文字色。
- 强调不得改变容器边框的颜色、粗细、线型或可见性。相邻表格、矩阵、卡片和分栏容器必须继续使用同一套细边框，避免共边叠加、后绘制覆盖或只剩部分边框。
- 只有底纹较深、普通文字色无法达到可读对比度时，才能以 `readability_pattern` 调整文字颜色；这不是额外业务强调，且仍不得改变边框。
- `allow_ungrounded_emphasis=false`：不得按行号、列号、数组顺序、第一项、最后一项、排名位置或为了视觉平衡自动加粗、改变重点文字颜色、改变重点填充或改变重点边框。
- `allow_random_bold=false`、`allow_random_color=false`、`allow_random_fill=false`、`allow_random_border=false`。
- `allow_zebra_banding=true`：表格或矩阵允许使用两种非常接近的中性底色按奇偶行或奇偶列交替，以帮助横向阅读；交替底色不得伴随字重、文字色、边框或字号变化，也不得表达重点、优先级、风险或状态。
- 同级正文、表格行、矩阵单元格、洞察和卡片默认使用同一字重、文字色、填充和边框。表头、标题等结构层级样式不属于数据强调，但同层对象仍须一致；业务强调只改变字重和底纹，不改变边框。
- 只有用户原话、来源数据、计算规则或上游 handoff 明确给出 `allowed_emphasis`，并同时写明 `target`、`reason`、`method` 和 `source_ids` 时，才允许强调对应对象；缺少任一字段时按 `false` 处理。
- 一个业务状态只能使用一套强调样式；其余对象全部使用统一普通样式。不得为了丰富配色给不同非重点状态分别上色。
- QA 必须逐项检查加粗、文字颜色、填充和边框差异能否回指结构层级规则、稳定可读性规则或完整 `allowed_emphasis`。业务强调一旦改变边框，直接返回 `EMPHASIS_BORDER_FORBIDDEN`；相邻容器共边颜色或粗细不一致时返回 `SHARED_EDGE_STYLE_MISMATCH`。

## 工作流

### 1. 锁定单页边界

保留用户原始请求，给使用的附件建立来源记录和哈希。每次只能有：

```text
1 个受众任务
1 个主要问题
1 个主要关系
1 个中心结论
1 个主图
0-3 个支持证据主题
0-1 个行动或条件区
```

出现竞争性主图或超过三个证据主题时，返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`，推荐最强的单页焦点；不得暗中删掉必需内容或生成第二页。

### 2. 建立来源基线

对用户提供、稳定推导、计算、外部核验和模型补全分别设置稳定 `source_id`。保持用户数字、定义、结论强度、必含项和排除项不变。

用户附件是“用户提供的证据”，不自动等于独立核验事实。权威值冲突时停止受影响的计算，不能暗自选边。

### 3. 定向补全

内容不足时只补主图和已声明证据主题所需的最少内容：

- 合成数据必须定义对象、粒度、期间、单位、分母和计算规则；
- 合计、占比、漏斗、桥接、重复值和标题结论必须能对上；
- 合成定性内容按“假设”“示例”或“待确认”处理；
- 不得编造来源、客户原话、行业基准、法律结论或真实公司业绩。

真实组织缺少真实数据时，不得把虚构指标写在该组织名下。可以改成匿名示例，或返回 `EVIDENCE_BLOCKED`。

### 4. 生成内容包

按 `producer/ENGINE.md` 执行，输出版本化运行目录。每个可见事实、标题、图表数据、洞察和行动项都要有 `source_ids`。

合成数字或数据集必须在页面底部的数据来源行显示：

```text
合成示例数据，非真实客户数据
```

合成定性内容在相邻位置显示“待确认”，或使用能逐项映射的页面图例。用户确认采用某个情景后，它仍是情景假设，不会变成真实事实。

运行：

```bash
python3 producer/scripts/validate_package.py <run-directory> --stage handoff --write-report
```

结构验证通过后仍要完整阅读 Brief、Prompt、交接文件和内容确认清单。脚本不能证明咨询逻辑或 PPT 视觉质量。

### 5. 按输出模式交付

`PROMPT_ONLY` 交付：

- `handoff/builder-prompt.md`
- `handoff/builder-handoff.json`
- `review/content-review.md`

`PPT_DRAFT` 在内容包通过后读取 `builder/ENGINE.md`，将 `handoff/builder-handoff.json` 交给内置 Builder。Builder 负责模块选择、精确几何、PowerPoint 对象、渲染和 PPTX QA；不得再次改写页面目标或来源事实。

Builder 交付后再次运行：

```bash
python3 producer/scripts/validate_package.py <run-directory> --stage final --write-report
```

Builder 不可用、运行依赖缺失或返回 `MODULE_COVERAGE_GAP` 时，保留可用提示词包并返回 `PPT_RENDERING_BLOCKED`。不得偷偷换用普通渲染器后宣称生成了咨询级 PPT。

Producer 只有在一个已产品化模块能覆盖全部必含内容时，才同时写入 `requested_module` 和完整、可通过该模块 validator 的 `module_payload`。只有模块名没有可执行载荷时不得强制命中；混合页面使用带 layout 门禁的直接编排。

引用资料清单页只从实际来源记录生成：合并重复资料、统一编号并保留可选正文页回链。它不承载数据明细或复杂补充分析，不把计算、推导、合成内容和普通提示词锚点伪装成引用资料；去重后超过八项时保持单页边界并返回范围超载。

统计类模块的原始数据、样本口径、计算规则和禁止推断要求由 Producer 在生成阶段执行，并在 Builder 路由命中后从对应模块 reference 读取；不得在入口阶段预载，也不得绕过模块 validator。

### 6. 检查 PPTX

`PPT_DRAFT` 必须满足：

- 恰好一页，且画布与已锁定的 `canvas_profile` 完全一致；
- 竖版模式必须是原生 PowerPoint 页面尺寸，禁止裁切、拉伸、横版截图或把完整横版页作为图片嵌入；
- 文字、形状、表格和图表为 PowerPoint 原生可编辑对象；
- 无填充文字层必须具有视觉全透明但可命中的原生形状填充，避免点击留白时穿透到背景框；选中整块文字对象后，可以在 Microsoft PowerPoint 中直接修改已有文字的字号与字重；
- 通过语义审计、整页渲染检查、可读性检查和传播可读性检查；
- 页面底部只有数据来源，专业术语、口径和计算方法存在于 PowerPoint 备注而不是可见画面；
- 删除、压缩或把可见内容移入备注后必须重新构图：空容器删除或合并，主证据按新信息量放大，正文区上下重心与连续留白重新验收；只移走文字、不重排版式时返回 `CONTENT_REMOVAL_WITHOUT_REFLOW_FAIL`；
- layout JSON 通过短标签单行、孤字、英文 token、数字单位、两行标题与副标题互斥、标题安全区、空容器、连续空白带、纵向空间平衡、跨区块边缘对齐、画布利用率和越界门禁；
- 组织架构图额外检查同层节点水平对齐、一对一直属线垂直对齐、职能虚线方向与无穿越路由；出现 `ORG_PEER_ROW_MISALIGNMENT`、`ORG_DIRECT_REPORT_DOGLEG` 或 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` 时不得交付；
- 当前环境能使用 Microsoft PowerPoint 时，实际打开检查；
- PPTX 使用 PowerPoint 原生自动页码字段；页码为 8pt、位于右下角，在普通编辑视图中不可单独编辑，并随页面在报告中的位置自动更新；
- 对外交付目录只放版本化 PPTX，来源、提示词、预览和 QA 留在内部目录。

### 7. 图片导出能力已退休

Microsoft PowerPoint 原生 `save as PNG` 对 OneSlide 的部分竖版 PPTX 会产生变形，因此该能力自 v1.7.2 起正式退休。

- 用户要求把 PPTX 导出为 PNG、JPG 或其他静态图片时，停止在 PPTX 交付层，明确返回 `POWERPOINT_NATIVE_PNG_RETIRED`。
- 不得启动 PowerPoint 执行图片导出，不得调用 `scripts/export_powerpoint_png.py` 进行转换，不得创建或改写 PNG/JPG/PDF。
- 不得自动切换到“先导出 PDF 再转图片”、第三方渲染、截图、GUI 坐标操作或其他格式。未来如需 PDF 中转路线，必须另立方案、验证版式和获得用户明确授权后再启用。
- 该退休规则不影响 PPTX 的生成、编辑、打开检查和交付。

结构页额外检查实际PowerPoint对象与整页渲染：白名单外内容、缺失必需部件、无授权同级强调、同级几何不一致、稀疏项目过度纵向分散、内容组偏上、把水平平移误做成水平居中、短编号换行、模板骨架漂移、主题语义漂移和总览/收口回扣失败均阻断交付。原生自动页码是整份报告的系统层，不转成普通文本框，也不计入内容部件白名单。

## 硬边界

- 不生成多页报告、隐藏溢出页或第二个候选页。
- 不生成行政区、国家/地区边界、区域分布等地理地图，也不得通过直接编排重建已退休的地图能力；地图类请求返回 `MAP_POLITICAL_RISK_BLOCKED`，改用不含边界表达的排名、矩阵、表格或小多图。
- 不为凑满页面增加装饰性卡片、建议、指标或基准。
- 不为凑满页面增加图标。只有导航、对象、状态、动作或少量流程节点确实需要语义标识时，才允许 Builder 从内置 Tabler 精选库检索一个一致的 SVG；图标不得承担数据编码、业务强调或事实表达，也不要求路径级原生可编辑。
- 不按位置、顺序或视觉偏好随机加粗、随机强调、随机重点填充、随机描边；所有无来源授权的强调开关一律为 `false`。仅允许不承载业务含义的中性交替行/列底色。
- 不为了装下一页而删必需内容、缩成不可读字号或改变中心思想。
- 不把模型补全内容伪装成用户提供或外部核验。
- 不暴露本机路径、提示词历史、被否决方案、内部 QA 或制作说明。
- 不把文件生成、验证脚本通过或 ZIP 完整冒充产品价值或用户验收。

## 发布包自检

```bash
python3 scripts/validate_suite.py .
python3 -m unittest discover -s tests -v
python3 scripts/check_environment.py
```

## 状态

分别报告：

```text
BASIC_OUTPUT_PASS | fail
TECHNICAL_CHAIN_PASS | not_tested | fail
INPUT_CONTRACT_PASS | not_tested | fail
SOURCE_BASELINE_PASS | fail
SINGLE_SLIDE_SCOPE_PASS | fail
PROVENANCE_COVERAGE_PASS | fail
SYNTHETIC_DISCLOSURE_PASS | not_applicable | fail
DATA_RECONCILIATION_PASS | not_applicable | not_tested | fail
HANDOFF_PACKAGE_PASS | fail
BUILDER_HANDOFF_READY | not_applicable | fail
RENDERED_READABILITY_PASS | not_applicable | not_tested | fail
PUBLIC_READABILITY_PASS | not_applicable | not_tested | fail
TERMINOLOGY_ACCESSIBILITY_PASS | not_applicable | not_tested | fail
VISIBLE_INFORMATION_BUDGET_PASS | not_applicable | not_tested | fail
DATA_SOURCE_ONLY_FOOTER_PASS | not_applicable | not_tested | fail
SPEAKER_NOTES_COVERAGE_PASS | not_applicable | not_tested | fail
POWERPOINT_OPEN_CHECK | not_applicable | not_tested | fail
POWERPOINT_NATIVE_PNG_PASS | not_applicable | not_tested | fail
PNG_FORMAT_PASS | not_applicable | not_tested | fail
IMAGE_DIMENSIONS_PASS | not_applicable | not_tested | fail
NO_PDF_CREATED_PASS | not_applicable | not_tested | fail
REQUIREMENT_COVERAGE_PASS | not_tested | fail
PRODUCT_VALUE_PASS | not_tested | fail
USER_REQUIREMENT_PASS | not_tested
PUBLIC_LICENSE_READY | pass
```

只有真实用户可见结果满足本 Skill 的单页、来源和可编辑性要求时，才能标记 `PRODUCT_VALUE_PASS`。只有用户看过具体结果后，才能标记 `USER_REQUIREMENT_PASS`。
