# Output contract

Create a new versioned run directory. Never overwrite an existing run.

## Required package

```text
<run-directory>/
├── brief/
│   └── slide-brief.md
├── handoff/
│   ├── builder-prompt.md
│   ├── builder-handoff.json
│   ├── handoff-manifest.json
│   ├── data/                  optional
│   └── assets/                optional
├── review/
│   └── content-review.md
├── delivery/                  PPT_DRAFT only after successful render
│   └── <clean-version-name>.pptx
└── internal/
    ├── source-baseline.json
    ├── provenance-ledger.json
    ├── generation-ledger.json
    ├── validation-report.json
    └── verify/                optional QA evidence
```

Do not create empty optional directories. Client delivery contains only the versioned PPTX. Review and internal material remain outside `delivery/`.

## handoff-manifest.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "canvas_profile": "short_video_broll_9_16",
  "synthetic_content": true,
  "synthetic_data": true,
  "status": "ready",
  "builder_target": "single-consulting-slide-builder",
  "entrypoints": {
    "builder_prompt": "builder-prompt.md",
    "builder_handoff": "builder-handoff.json",
    "content_review": "../review/content-review.md"
  },
  "files": []
}
```

Paths in `files` are relative to `handoff/`. Each requires `path`, `role`, `format`, and `sha256`; CSV also requires `row_count`. Absolute paths, `..`, local URLs, secrets, temporary paths, and missing dependencies are forbidden.

## builder-handoff.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "canvas": {
    "profile": "short_video_broll_9_16",
    "aspect_ratio": "9:16",
    "orientation": "portrait",
    "powerpoint_width_in": 7.5,
    "powerpoint_height_in": 13.333333,
    "composition_policy": "native_recompose"
  },
  "subject": "页面对象",
  "story": "证据支持的一句话中心思想",
  "audience_task": "读者看完要理解或决定什么",
  "source_ids": ["U01", "G01", "C01"],
  "content": {
    "title": {"text": "结论式标题", "source_ids": ["C01"]},
    "subtitle": {"text": "合成示例数据，非真实客户数据", "source_ids": ["G01"]},
    "insights": [],
    "actions": [],
    "footnotes": [],
    "speaker_notes": {
      "terminology": [],
      "scope_and_definitions": [],
      "formulas_and_methods": []
    },
    "data_source": {"text": "匿名合成样本", "source_ids": ["G01"]}
  },
  "structure": {
    "primary_question": "页面要回答的问题",
    "primary_relationship": "category x value",
    "primary_exhibit": "ranking-chart",
    "visual_intent": "横向排序条形图",
    "layout_intent": "full-canvas"
  },
  "information_budget": {
    "primary_exhibit_count": 1,
    "supporting_evidence_count": 0,
    "action_or_condition_count": 0,
    "status": "pass"
  },
  "display_blocks": [],
  "datasets": [],
  "review_marking": {
    "required": true,
    "synthetic_data_disclosure": "合成示例数据，非真实客户数据",
    "qualitative_marker": "待确认"
  },
  "constraints": {
    "must_include": [],
    "must_avoid": [],
    "slide_count": 1
  }
}
```

Every visible text object uses `{text, source_ids}`. Structured display items use their own `source_ids`. Dataset records stay in CSV or JSON when more than a few values are required.

`semantic_icon` 是可选视觉资产交接。只有图标能降低导航、对象、状态、动作或少量流程节点的识别成本时才写入：

```json
{
  "semantic_icon": {
    "enabled": true,
    "role": "status_marker",
    "concept": "风险预警",
    "style": "outline",
    "icon_id": "alert-triangle",
    "selection_reason": "表示需要关注的风险，不表达已经发生的事故"
  }
}
```

图标不是事实、证据、数据编码或业务强调，不需要 `source_ids`。缺失图标偏好时不得追问；默认不使用。只给 `concept + role` 时由 Builder 从精选库检索；提供 `icon_id` 时必须属于精选库。`selection_reason` 与资产路径只留在内部交接，不进入 PPT 正文、备注或数据来源行。

`canvas.profile` is required and must be one of `presentation_16_9`, `short_video_broll_9_16`, or `knowledge_graphic_3_4`. `composition_policy` must be `native_recompose`: the Builder creates a blank PowerPoint at the requested size and draws native objects on it. Portrait handoffs must omit `requested_module` and `module_payload` until a portrait-specific module exists; they route to guarded vertical direct composition instead of reusing 1280×720 module coordinates.

`content.speaker_notes` is not visible slide copy. It preserves terminology explanations, scope and denominator explanations, acronym translations, formulas and methods. `content.data_source` is the only content allowed in the visible footer. When synthetic data exists, the Builder merges the exact disclosure into the same line.

### 可执行模块载荷

当且仅当一个已产品化 Builder 模块可以覆盖全部必含内容，且 Producer 已能按该模块 reference 填满真实输入契约时，`builder-handoff.json` 增加：

```json
{
  "requested_module": "waterfall-attribution",
  "module_payload": {
    "version": "1.0",
    "module_id": "waterfall-attribution",
    "source_anchors": [],
    "title": {},
    "diagram": {}
  }
}
```

`requested_module`、`structure.primary_exhibit` 和 `module_payload.module_id` 必须一致。`module_payload` 必须包含该模块 validator 所需的全部字段和全部可见内容；不得只放模块名或半成品骨架。混合页面或模块无法容纳全部必含内容时，三项都省略，由 Builder 进入 `direct_composition`，不得硬塞模块。

`chart-insight` 的 `diagram` 必须包含 4–8 个唯一类别 ID、两组唯一且同单位的非负柱形序列，以及一组唯一、带明确单位和固定 `axis_min/axis_max` 的比值或指数序列。三条 `insights[]` 均需携带 `anchor.series_id` 与 `anchor.category_id`，并指向真实存在的数据点；连接线不得由 Renderer 根据洞察顺序猜测。柱形单位冲突、负柱值、比值越界或无效锚点时不得强制命中。`hr-ticket-classification` 与 `hr-eligibility-matrix` 已退休，不得再写入 `requested_module`。

排名迁移页使用正式模块 ID `bump-ranking`。Producer 交接时应使用 `diagram.periods` 和每个对象的 `ranks`、`values`、`states` 数组；数组长度必须与时期数一致，时期保持原始顺序。两期数据可以由 Builder 呈现为 slope-style 视觉，三期及以上数据呈现为 Bump Chart。新进入、退出或暂未上榜必须显式写入 `states`，不能靠颜色或文案猜测。旧版 `slope-ranking` 的左右字段只用于兼容已有运行包，不作为新提示词的生成目标。

多期构成变化页使用 `composition-shift`。`diagram` 必须包含 3–8 个有序 `periods`、2–6 个带唯一 `id` 的 `components`、与时期等长的 `shares`、`basis`、`denominator`、`unit` 和 1–3 条来源支持的 `insights`。每期占比必须对平到 100%。`basis=absolute` 时还要传入各构成的 `values`、每期 `totals` 和 `total_source_ids`，三者必须一致。缺失分母、期间口径冲突、构成项不稳定或页面还需第二个主图时，不得强制命中模块。

单期单总量构成页使用 `part-to-whole`。`diagram` 必须包含 `chart_type=pie|doughnut`、来源支持的单一 `period` 与 `total_label`、正的 `total_value`、`total_value_source_ids`、明确 `unit`，以及 3–6 个带唯一 `id`、来源化 `label`、有限非负 `value` 和 `source_ids` 的互斥构成项。构成值之和必须在浮点误差内严格等于总量；扇区角度使用计算真值，不从四舍五入显示百分比反推。`doughnut` 还必须提供来源支持的 `center_label` 与 `center_value`；`pie` 不得携带中心字段。未指定饼图或环图时，Producer 可对明确构成关系采用 `doughnut` 默认值，不向用户追问。跨期构成转 `composition-shift`；横向规模与内部构成转 `marimekko`；负值、多个总量、超过六个无法诚实合并的构成项、缺少期间/总量/来源或第二个独立主图时不得强制命中。

分群留存或存续页使用 `cohort-retention`。`diagram` 必须包含 4–12 个严格递增且从 0 开始的 `relative_periods`、`relative_period_unit`、`cohort_definition`、`denominator`、`measure`、`curve_mode`，以及 3–8 个带唯一 `id`、`initial_count` 和等长 `retained_counts` 或 `retention_rates` 的 cohort。Producer 不要求用户重复填写人数和比例；只提供一种时由 Builder 计算另一种，两者都有时必须对平。未成熟或未观察周期只能作为尾部连续 `null`，并提供页面可见的 `censoring_note`，不得补 0。`survival` 必须非递增；允许真实回升的当期活跃口径使用 `period_retention`。行业基准与独立风险矩阵同时出现时按第二主图处理：单页预算能完整保留时进入带门禁的直接编排，否则返回范围超载。

小倍数比较页使用 `small-multiples`。`diagram` 必须包含 `series_type=line|column`、来源化的 `metric` 与 `unit`、3–12 个有序 `periods`、显式有限的共享 `scale.min/max`，以及 3–9 个等长数值面板。可选 `benchmark` 必须与时期等长，并同时提供 `benchmark_label` 和 `benchmark_source_ids`。每个面板必须包含来源支持的 `label`、`summary`、可见 `classification` 和结构化 `classification_state=invest|maintain|watch|exit`；状态决定视觉语义，禁止从可见中文关键词猜颜色。数值越界、单位冲突、时期不一致或出现第二个独立主图时不得强制命中。

分组分布比较页使用 `box-plot`。`diagram` 必须包含 3–8 个同口径组，以及 `period`、`unit`、`denominator`、`sample_definition`、`missing_policy`、`quartile_method`、`whisker_multiplier=1.5`、`whisker_rule` 和 `source_note`。每组必须传入有效 `sample_size`、`missing_count`、`whisker_low`、`q1`、`median`、`q3`、`whisker_high`、逐点 `outliers` 和来源。四分位算法使用 `PERCENTILE.INC（线性插值，等同 Type 7）`，须线端点是 1.5×IQR 围栏内的最远观测；这些专业解释写入 PowerPoint 备注，正文不显示代号。围栏外记录必须在页面逐点标为异常值，不能只用颜色暗示。统计口径缺失、组间口径冲突或页面还需第二个主图时，不得强制命中模块。

连续数值分布页使用 `histogram`。`diagram` 必须包含一个指标、单位、期间、分母、原始 `observations`（缺失值用 `null` 或空字符串显式保留）、`sample.total/valid/missing`、`frequency_basis=count|frequency`、`binning.method=explicit_edges`、严格递增的 `edges`、左右边界包含规则，以及 1–3 条来源支持的分布洞察。Producer 可以计算 `bins`，但 Builder 必须从原始观测和边界复算并逐箱核对。缺少原始观测、样本无法对平、单位或期间冲突、分箱不能覆盖全部有效值时不得强制命中模块；分类数据使用其他模块，不能用分类柱状图冒充。

组间分布页使用 `box-plot-jitter`。`diagram` 必须包含 2–6 个带唯一 `id` 的 `groups`、每组 5–60 个原始 `observations`、与观测数量一致的 `n`、共同 `period`、`unit`、`observation_definition`、`sample_definition`、`statistics_rule=tukey_hinges_1_5_iqr`、可见 `statistics_note`、可见 `jitter_note` 和 1–3 条来源支持的 `insights`；整页原始观测不超过 240 个。横向抖动只能由 Builder 作为确定性视觉避让执行，不得写回数值。只有汇总统计、组间口径冲突、缺少单位/期间/样本定义、或页面还要求第二个主图时，不得强制命中模块。

多指标关系筛选页使用 `correlation-matrix`。`diagram` 必须包含 4–10 个唯一指标 ID/标签、`method=pearson|spearman`、`sample_size`、`missing_value_handling`、`period`、`population`、`source_note`、`display_threshold`、可见 `causality_note`，以及对称 NxN `matrix` 或可复算的等长 `observations`。系数范围、对角线、对称性、维度和标签唯一性必须通过 Builder 门禁；矩阵与观测同时存在时必须对平。显示阈值和样式缺失可使用披露后的安全默认值，不得要求用户填写内部字段；数据、样本、期间、总体或来源缺失，以及口径冲突或第二个独立主图存在时，不得强制命中模块。页面必须同时用位置、带正负号的数值和颜色表达，并声明相关不代表因果。

双连续变量关系页使用 `scatter-regression`。`diagram` 必须包含 `x_metric`、`x_unit`、`y_metric`、`y_unit`、`period`、`population`、`sample_definition`、`source_note`，以及 8–200 条带唯一 `id`、逐条 `x`、`y` 和来源的原始 `observations`；缺失值用 `null` 显式保留。V1 固定使用 `method=ordinary_least_squares_with_intercept`、`handling.missing=pairwise_exclusion`、`handling.duplicates=retain_as_independent` 和 `handling.outliers=retain_and_label`。Producer 交付 `sample.total/valid/missing/duplicate_pairs`、声明的 `statistics.slope/intercept/r_squared`、按绝对残差排序的 1–3 个 `highlight_ids`、页面可见的异常点规则、复算/容差/显示舍入规则和“样本内关联不代表因果，外推需另行验证”的解释边界。Builder 从未舍入原始观测复算并对平；有效配对不足、任一轴零方差、单位/期间冲突、只有汇总统计、要求显著性但没有证据，或存在第二个独立主图时，不得强制命中模块。

有序中心估计与区间页使用 `confidence-band`。`diagram` 必须包含 5–12 个标签唯一、`order` 严格递增的 `periods`，每期提供 `estimate/lower/upper` 且满足 `lower <= estimate <= upper`；同时保留 `metric`、`unit`、`interval_type`、`interval_label`、`interval_definition`、`estimation_method`、`sample_definition`、`population_definition`、`source_note` 和 1–3 条来源支持的 `insights`。置信水平、区间定义、样本/总体、估计方法、缺失值说明和阈值语义写入备注；正文用“估计范围”等普通中文，不显示 `bootstrap` 等专业代号。单期缺失只能把三个值同时设为 `null`，不得插值或补 0。核心序列、区间定义、估计方法、样本/总体或来源缺失时，不得强制命中本模块。

引用资料附录页使用 `reference-list`。Producer 从一个或多个来源记录中提取真实使用的 `externally_verified` 条目，以及明确带引用元数据的 `user_supplied` 文件；按 DOI、URL 或稳定作品标识去重，按首次出现顺序编号，并保留可选的正文页回链。`diagram.references` 包含 2–8 项，每项必须有 `id`、`canonical_key`、页面可见 `citation`、页面可见 `locator`、`source_ids` 和可选 `supporting_pages`。不得收录计算、稳定推导、合成内容或普通提示词锚点，不得猜测缺失的作者、机构、标题、日期或定位信息。超过 8 项返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`；数据明细和复杂补充分析不得强制命中本模块。

## builder-prompt.md

Include, when applicable:

1. explicit instruction to produce exactly one slide;
2. exact native canvas profile, ratio and PowerPoint dimensions, plus a ban on crop, stretch and embedded landscape pages;
3. audience task and page question;
4. central message and title;
5. primary relationship and exhibit;
6. data files and field-to-visual encoding;
7. supporting evidence and action area;
8. visible review marking and disclosure;
9. reading order and layout intent;
10. must include and must avoid;
11. visible data source plus speaker-note allocation for unit, period, denominator, terminology, definitions, formulas and methods.

Do not expose prompt history or internal ledgers. Do not paste large datasets into the prompt.

## Delivery status

For `PROMPT_ONLY`, `status=ready` means the handoff is ready for a compatible Builder.

For `PPT_DRAFT`, do not place a file in `delivery/` until the Builder produces exactly one slide and the required render checks pass. If rendering is blocked, keep `delivery/` absent and record `PPT_RENDERING_BLOCKED` in the validation report.

Validate in two stages:

```bash
python3 scripts/validate_package.py <run-directory> --stage handoff --write-report
python3 scripts/validate_package.py <run-directory> --stage final --write-report
```

The handoff stage validates the content package before rendering and permits `delivery/` to be absent. The final stage requires exactly one delivery PPTX with exactly one slide.
