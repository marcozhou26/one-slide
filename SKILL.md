---
name: one-slide
description: "Turn complete or sparse user material into exactly one source-traceable, presentation-ready slide prompt, and optionally one native-editable 16:9 PowerPoint page with consulting-grade structure and layout. Use when the user wants one professional slide, may not have enough detail, wants missing content completed without changing supplied facts, and needs every synthetic or inferred element identified."
license: Apache-2.0
metadata:
  author: "周俊东 Marco"
  version: "1.2.2"
---

# OneSlide

一次只处理一页 PPT，并以咨询报告级标准组织逻辑、信息和版式。用户只接触这一个入口；内部先完成内容设计与来源标注，需要 PPTX 时再调用随包附带的 Builder 引擎。

## 每次运行先读

完整读取：

- `references/input-contract.md`
- `references/suite-contract.md`
- `producer/references/single-slide-contract.md`
- `producer/references/provenance-contract.md`
- `producer/references/output-contract.md`

进入绘制阶段时，再读取 `builder/ENGINE.md` 和路由返回的唯一模块 reference。不要预读全部 Builder 模块。

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

## 三种内容模式

- `SOURCE_ONLY`：现有信息足以支持这一页，不新增事实。
- `SYNTHETIC_AUGMENTATION`：只补页面必要缺口，不改变用户事实和主逻辑。
- `EVIDENCE_BLOCKED`：目标要求真实事实，但缺少证据且不能诚实补全。

样式、措辞、版式和图表选择不是事实缺口，可以从主要关系推导。

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

合成数字或数据集必须在页面上显示：

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

### 6. 检查 PPTX

`PPT_DRAFT` 必须满足：

- 恰好一页、16:9；
- 文字、形状、表格和图表为 PowerPoint 原生可编辑对象；
- 通过语义审计、整页渲染检查和可读性检查；
- layout JSON 通过短标签单行、孤字、英文 token、数字单位、两行标题与副标题互斥、标题安全区、纵向空间平衡、跨区块边缘对齐、画布利用率和越界门禁；
- 组织架构图额外检查同层节点水平对齐、一对一直属线垂直对齐、职能虚线方向与无穿越路由；出现 `ORG_PEER_ROW_MISALIGNMENT`、`ORG_DIRECT_REPORT_DOGLEG` 或 `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` 时不得交付；
- 当前环境能使用 Microsoft PowerPoint 时，实际打开检查；
- 对外交付目录只放版本化 PPTX，来源、提示词、预览和 QA 留在内部目录。

## 硬边界

- 不生成多页报告、隐藏溢出页或第二个候选页。
- 不为凑满页面增加装饰性卡片、建议、指标或基准。
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
POWERPOINT_OPEN_CHECK | not_applicable | not_tested | fail
REQUIREMENT_COVERAGE_PASS | not_tested | fail
PRODUCT_VALUE_PASS | not_tested | fail
USER_REQUIREMENT_PASS | not_tested
PUBLIC_LICENSE_READY | pass
```

只有真实用户可见结果满足本 Skill 的单页、来源和可编辑性要求时，才能标记 `PRODUCT_VALUE_PASS`。只有用户看过具体结果后，才能标记 `USER_REQUIREMENT_PASS`。
