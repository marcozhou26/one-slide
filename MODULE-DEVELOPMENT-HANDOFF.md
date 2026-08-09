# OneSlide 模块开发工作交接

更新时间：2026-08-08  
交接目标：把后续大量图表模块的开发，迁移到新的工作空间继续推进。

## 1. 项目定位

OneSlide 不是整套 PPT 自动生成器，而是“先确定一页的信息关系和版式逻辑，再让 AI 执行”的单页咨询型 PPT 工具。

每次运行只生成一页 16:9 PowerPoint，必须满足：

- 来源事实、数字、口径和结论强度可追溯；
- 图表、文字和形状为 PowerPoint 原生可编辑对象；
- 信息不足时只做定向补全，并标明合成或待确认内容；
- 不因为新增模块而扩大单页范围、改变 Producer 的来源语义或偷偷生成多页。

## 2. 当前架构与职责

```text
用户材料
  ↓
Producer
  - 锁定读者任务、页面问题、主要关系和中心结论
  - 建立来源基线和 provenance
  - 生成 builder-prompt.md 与 builder-handoff.json
  ↓
Builder 路由
  - 判断是否命中一个正式模块
  - 或进入 direct_composition
  ↓
Builder 模块
  - validator：输入契约与来源门禁
  - planner：页面空间分配
  - renderer：原生 PowerPoint 对象
  - QA：布局、渲染、可编辑性和 PowerPoint 检查
```

Producer 不绘制 PowerPoint，也不负责精确坐标。Builder 不重新决定页面目标、不重写用户事实、不增加新的业务内容。

主要入口：

- `SKILL.md`：唯一用户入口；
- `producer/ENGINE.md`：Producer 内部执行规则；
- `producer/references/output-contract.md`：Producer → Builder 交接格式；
- `builder/ENGINE.md`：Builder 执行与 QA 规则；
- `builder/references/module-registry.json`：正式模块注册表，由路由脚本读取。

## 3. 已完成的 bump-ranking 升级

`slope-ranking` 已从正式模块注册表退休，正式模块 ID 为 `bump-ranking`。旧输入仍保留兼容转换，不删除旧 fixture。

已完成：

- 支持 2–8 个有序时期；
- 支持 5–12 个对象；
- 每个对象使用与时期数一致的 `ranks`、`values`、`states` 数组；
- 支持 `active`、`new`、`exited`、`not_ranked`；
- 阻止同一时期重复排名；
- 支持两期 slope-style 和三期以上 Bump Chart；
- 更新 Producer 的模块选择和交接规则；
- 新增五期、进入/退出、重复排名和数组长度异常 fixture；
- 已生成真实的多期参考 PPTX：`builder/assets/reference-pages/bump-ranking.pptx`。

关键文件：

- `builder/references/bump-ranking-module.md`
- `builder/scripts/validate_r3_module.mjs`
- `builder/scripts/plan_r3_module.mjs`
- `builder/scripts/render_r3_module.mjs`
- `builder/scripts/route_input.mjs`
- `builder/scripts/route_module.mjs`
- `producer/ENGINE.md`
- `producer/references/output-contract.md`
- `builder/references/information-structure-compiler.md`

旧版兼容文件：

- `builder/assets/test-fixtures/slope-ranking-valid.json`
- `builder/references/slope-ranking-module.md`

## 4. 已完成的 composition-shift 纵向切片

`composition-shift` 已作为第 34 个正式模块注册，用于 3–8 个时期、2–6 个稳定构成项的多期占比变化。它与 `marimekko` 分工明确：前者固定柱宽、回答结构如何变化；后者用宽度同时表达细分规模。

已完成：

- Producer 能识别多期构成关系并生成完整、可执行 payload；
- `share` 与 `absolute` 两种口径，绝对值模式同时核对分母、总量与占比；
- 每期占比强制对平到 100%，阻止数组错位、重复 ID、未知重点构成和分母冲突；
- 自然语言、显式模块、完整输入、稀疏输入、异常合计和异常长度测试；
- 原生 PowerPoint 堆积矩形、文字、轴线和洞察区；
- 参考文件：`builder/assets/reference-pages/composition-shift.pptx`；
- Artifact Tool 渲染、溢出、原生对象和 Microsoft PowerPoint 实际打开检查通过。
- 已用 Case Factory 生成不含模块名和图表名的匿名收入结构案例；OneSlide 现在可依据 3–8 期、2–6 个稳定构成项、逐期分项与总额对平，以及“结构/构成/占比/组合”关系词，自动识别 `composition-shift`；缺少总额的一般多序列趋势不会被误判。
- 该代表性案例已从原始输入贯通到一页 PPT，并通过数据对平、来源映射、渲染、溢出、原生对象和 Microsoft PowerPoint 实机检查。

关键文件：

- `builder/references/composition-shift-module.md`
- `builder/assets/test-fixtures/composition-shift-valid.json`
- `builder/assets/test-fixtures/composition-shift-bad-total.json`
- `builder/assets/test-fixtures/composition-shift-length-mismatch.json`
- `builder/tests/composition_shift_contracts.test.mjs`

## 4.1 已完成的 cohort-retention 纵向切片

`cohort-retention` 已作为第 35 个正式模块注册，用于 3–8 个加入、入职、获客或首次激活批次在 4–12 个相对周期上的留存或存续比较。它显式保留初始基数、人数／比例、分母、单位、期间和未成熟尾期，并与固定四组、0–24 月、行业基准加风险矩阵的 `hr-new-hire-survival` 保持业务边界。

已完成：

- Case Factory 匿名自然语言案例不出现模块名和图表名，仍能自动识别批次、相对周期、早期流失和未成熟尾期关系；
- Producer 同步增加完整可执行 payload 规则，`requested_module`、`structure.primary_exhibit` 与 `module_payload.module_id` 对齐；
- 独立 reference、validator、planner、renderer、正式注册表和参考 PPTX；
- 完整人数、仅比例、缺少初始基数、人数比例冲突、存续回升、当期留存回升、非尾部空值、非阻塞样式缺失和损坏 JSON 测试；
- 一页原生可编辑 PPTX；语义、布局、溢出和对象审计通过；Microsoft PowerPoint 实际打开为 1/1 页、92 个原生 shape、0 图片对象；
- 当前回归：Producer 18/18、Builder 90/90、模块专项 10/10。

关键文件：

- `builder/references/cohort-retention-module.md`
- `builder/scripts/validate_cohort_retention.mjs`
- `builder/scripts/plan_cohort_retention.mjs`
- `builder/scripts/render_cohort_retention.mjs`
- `builder/assets/test-fixtures/cohort-retention-valid.json`
- `builder/tests/cohort_retention_contracts.test.mjs`
- `builder/assets/reference-pages/cohort-retention.pptx`

## 5. Producer 与 Builder 的模块交接规则

### histogram 纵向切片

`histogram` 已作为第 35 个正式模块注册，用于一个连续数值指标在一个明确期间内的分布分析。模块保留原始观测和显式缺失值，复算严格递增的显式分箱边界，并同时呈现样本、单位、分母、期间与频数/频率口径；分类柱状图不会命中该模块。

新增模块不能只改 Builder。只要模块需要 Producer 生成可执行 payload，就必须同时完成：

1. Producer 能识别这种信息关系，而不是只识别模块名称；
2. Producer reference/ENGINE 能说明字段、期间、单位、状态和来源要求；
3. `builder-handoff.json` 中的 `requested_module`、`structure.primary_exhibit` 和 `module_payload.module_id` 完全一致；
4. `module_payload` 是完整、可通过 validator 的输入，不接受只有模块名的半成品；
5. Builder 仍然是模块字段和视觉对象的最终门禁；
6. 如果一个模块无法覆盖页面全部必含内容，三项模块字段都省略，进入 `direct_composition`，不得硬塞模块。

以排名迁移为例，新 Producer payload 应使用：

```json
{
  "module_id": "bump-ranking",
  "diagram": {
    "periods": [],
    "objects": [
      {
        "ranks": [],
        "values": [],
        "states": []
      }
    ]
  }
}
```

不要为新任务生成旧的 `left_period`、`right_period`、`left_rank`、`right_rank` 字段。

## 6. 新增模块的最小纵向切片

每个新模块必须一次完成一条真实可用链路，而不是只提交 renderer：

```text
真实/代表性输入
  → Producer 交接规则
  → route_input / route_v3
  → module reference
  → validator
  → planner
  → renderer
  → reference PPTX
  → 完整 fixture 与异常 fixture
  → 渲染、溢出、原生对象和可编辑性检查
```

至少新增：

- 一个 `builder/references/<module>-module.md`；
- 一个正式注册表条目；
- validator、planner、renderer；
- 一个完整 fixture；
- 一个或多个异常 fixture；
- 路由回归测试；
- 参考 PPTX；
- Producer 交接规则或明确说明为什么只走 `direct_composition`。

不要先批量堆底层组件，再等待最后统一接入。第一个模块就必须能从代表性输入运行到用户可见的一页 PPT。

## 7. 模块契约应回答的问题

开发前先写清楚：

- 这张图回答哪一个读者问题？
- 主关系是什么：比较、趋势、迁移、构成、流量、因果、流程还是空间分布？
- 最少需要哪些字段？字段的单位、期间、分母和口径是什么？
- 哪些字段必须来源可追溯？哪些可以计算？哪些只能作为合成示例？
- 数据缺失时是阻塞、定向补全，还是进入 direct composition？
- 哪些状态必须显式表达，不能靠颜色或位置猜？
- 一页内哪些内容是主图，哪些是 0–3 个支持证据，哪些是 0–1 个行动/条件区？
- 用户真正需要编辑什么：文字、数字、线条、节点、表格还是数据关系？

## 8. 验收门禁

必须分别报告，不得合并：

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
REQUIREMENT_COVERAGE_PASS
RENDERED_READABILITY_PASS
POWERPOINT_OPEN_CHECK
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

建议使用的验证顺序：

```bash
# OneSlide / Producer 契约
python3 -m unittest discover -s tests -v

# Builder 模块回归
node --test builder/tests/bump_ranking_contracts.test.mjs
node --test builder/tests/*.test.mjs

# 生成某个模块的 PPTX 后
python3 <presentations-skill>/container_tools/slides_test.py <file.pptx>
```

文件存在、脚本跑通、ZIP 完整或 layout JSON 通过，都不能单独证明用户要求已经满足。最终仍要检查实际渲染和 PowerPoint 原生编辑性。

## 9. 当前已知状态

- Producer 契约测试：18/18 通过；
- bump-ranking 相关测试：22/22 通过；
- Builder 全量测试：使用 bundled `@oai/artifact-tool` 运行 80/80 通过；
- bump-ranking 已使用 bundled `@oai/artifact-tool` 成功生成 PPTX；
- bump-ranking 的布局审计和溢出检查通过；
- PPTX 内部确认使用原生文本框、椭圆、线条和矩形，没有整页图片；
- bump-ranking 已在 Microsoft PowerPoint 中实际打开，确认 1/1 页、窗口正常渲染并暴露 94 个可独立编辑的布局对象；
- composition-shift 的 validator、planner、路由、异常输入、渲染和溢出测试通过；参考 PPTX 在 Microsoft PowerPoint 中实际打开，确认 1/1 页、60 个原生形状、0 个图片对象；
- Case Factory 代表性运行包已通过 handoff/final 契约，生成的一页 PPT 在 Microsoft PowerPoint 中确认 1/1 页、120 个可独立选择的原生布局对象、0 个图片对象；
- Producer 套件测试 18/18 通过，发布源目录校验通过；`PRODUCT_VALUE_PASS: pass`（代表性 Case Factory 任务）；此前 composition-shift 模块结果已获用户验收，`USER_REQUIREMENT_PASS: pass`。本次新生成的具体案例页仍需与模块验收分开记录，当前为 `not_tested`。

## 10. 建议的新工作空间启动顺序

1. 将本交接文件和整个 `one-slide-github-public` 工作树作为初始上下文；
2. 先运行 Producer 契约测试和 Builder registry/fixture 测试；
3. 先挑一个高价值、字段明确、能在一页内完成的模块做纵向切片；
4. 为该模块同时写 Producer 交接规则和 Builder 模块契约；
5. 用真实或匿名合成 fixture 生成一页 PPTX；
6. 检查渲染、溢出、可编辑性和 PowerPoint 打开结果；
7. 只有该模块通过后，再抽取至少两个模块都需要的共享底座；
8. 每完成一个模块，回写模块注册表、CHANGELOG 和本交接文件的状态。

## 11. 不要做的事

- 不要把 ECharts 示例直接复制进 OneSlide 作为静态图；它只能作为图形研究参考；
- 不要只新增 Builder renderer 而不更新 Producer 交接规则；
- 不要把所有图表都塞进一个万能模块；
- 不要为了填满页面增加装饰性卡片；所有可见对象必须通过 `builder/references/information-contribution-gate.md`，顶部装饰色带、eyebrow、标题饰线、空容器和其他纯装饰对象必须阻断；
- 不要把合成数据写成真实客户事实；
- 不要把旧模块删除到无法兼容已有运行包；
- 不要把技术链路通过冒充用户验收通过。

## 12. 迁移时的工作树提醒

`builder/scripts/plan_r4_module.mjs` 的 Sankey SLA 底部说明区修改已独立提交为 `123586f`，没有混入 bump-ranking 或 composition-shift。bump-ranking 基线提交为 `bbdab2b`。后续模块继续保持“一模块一条完整纵向切片”的独立提交边界。

## 13. box-plot 纵向切片

`box-plot` 已作为第 35 个正式模块注册，用于同一指标、期间、单位和统计口径下 3–8 个组的分布比较。Producer 必须交付有效样本量、缺失数、Q1、中位数、Q3、上下须线、逐点异常值，以及页面可见的四分位算法和须线规则。Builder 使用原生矩形、线条、椭圆和文本，异常值同时显示标记和数值，不能只用颜色表达。

关键文件：

- `builder/references/box-plot-module.md`
- `builder/assets/test-fixtures/box-plot-valid.json`
- `builder/assets/test-fixtures/box-plot-missing-method.json`
- `builder/assets/test-fixtures/box-plot-invalid-outlier.json`
- `builder/tests/box_plot_contracts.test.mjs`

## 14. correlation-matrix 纵向切片

`correlation-matrix` 已作为第 39 个正式模块注册，用于在 4–10 个指标中识别最强正相关、最强负相关和弱关系，并筛选后续重点变量组合。Producer 可交付对称 NxN 系数方阵，或可复算的对齐原始观测；Builder 校验 Pearson/Spearman、样本量、缺失值处理、期间、总体、来源、显示阈值、系数范围、对角线、对称性、维度和标签唯一性。

页面使用原生 PowerPoint 方形单元格和文本，同时通过行列位置、带正负号数值和发散色表达关系；右侧列出三类候选，并可见声明“相关不代表因果”。代表性匿名合成案例从无模块名/图表名的自然语言输入贯通到正式 Producer handoff 与一页 PPTX。当前验证：Producer 19/19、Builder 129/129、模块专项 11/11；语义、布局、溢出、0 图片对象和 Microsoft PowerPoint 1/1 页打开检查通过。`PRODUCT_VALUE_PASS` 仅基于代表性任务评估，`USER_REQUIREMENT_PASS` 仍为 `not_tested`。

关键文件：

- `builder/references/correlation-matrix-module.md`
- `builder/scripts/validate_correlation_matrix.mjs`
- `builder/scripts/plan_correlation_matrix.mjs`
- `builder/scripts/render_correlation_matrix.mjs`
- `builder/assets/test-fixtures/correlation-matrix-valid.json`
- `builder/tests/correlation_matrix_contracts.test.mjs`
- `builder/assets/reference-pages/correlation-matrix.pptx`

## 15. scatter-regression 纵向切片

`scatter-regression` 作为第 40 个正式模块，用于两个连续变量在同一明确样本中的方向、线性强度、偏离趋势观测和可解释边界判断。V1 仅支持带截距的一元普通最小二乘拟合，保留逐条 x/y 原始观测、两轴单位、样本定义、期间、总体、来源以及缺失/重复/异常处理规则。Builder 复算斜率、截距和 R²，拒绝有效配对不足与任一轴零方差，不把关联写成因果，也不生成没有来源的显著性结论。

关键文件：

- `builder/references/scatter-regression-module.md`
- `builder/scripts/validate_scatter_regression.mjs`
- `builder/scripts/plan_scatter_regression.mjs`
- `builder/scripts/render_scatter_regression.mjs`
- `builder/assets/test-fixtures/scatter-regression-valid.json`
- `builder/tests/scatter_regression_contracts.test.mjs`
- `builder/assets/reference-pages/scatter-regression.pptx`

## 16. confidence-band 纵向切片

`confidence-band` 作为第 41 个正式模块，用于沿 5–12 个有序时期比较中心估计与区间宽度，识别不确定性扩大、收窄、越过业务阈值或方向不稳的时期。Producer 保留 estimate/lower/upper、区间类型和定义、估计方法、样本/总体、来源、缺失值和阈值语义；Builder 使用原生折线、圆点、半透明分段多边形和虚线阈值，且不把置信区间改称预测区间或风险区间。

关键文件：

- `builder/references/confidence-band-module.md`
- `builder/scripts/validate_confidence_band.mjs`
- `builder/scripts/plan_confidence_band.mjs`
- `builder/scripts/render_confidence_band.mjs`
- `builder/tests/confidence_band_contracts.test.mjs`

## 17. 信息贡献门槛

OneSlide 已建立跨 Producer、Builder、layout 审计和 PowerPoint 模板的统一信息贡献门槛。每个可见对象必须传递语境、编码证据、表达关系、提供定义来源、说明行动条件或承载用户明确要求的身份；只为美观、填空或制造模板感的对象不得进入页面。

自动阻断包括 `DECORATIVE_ELEMENT_BLOCKED`、`DECORATIVE_TOP_BAND_BLOCKED`、`EYEBROW_BLOCKED` 和 `TEMPLATE_DECORATION_BLOCKED`。结构带、关系线、坐标轴、数据图形和承载真实内容的容器不因“没有文字”而被误杀。

关键文件：

- `builder/references/information-contribution-gate.md`
- `builder/scripts/layout_quality.mjs`
- `builder/scripts/apply_powerpoint_template.py`
- `builder/tests/layout_quality.test.mjs`
- `builder/tests/r6_template.test.mjs`

## 18. Editorial Editor 后置模块

OneSlide 1.4 的目标链路为 `Producer → Builder 初稿 → Editorial Editor → 完整回归 → delivery`。Editorial Editor 只在真实一页 PPTX 和整页渲染存在后运行，一次选择一个最影响理解的问题，用可回退的成组原生对象补丁改善页面；没有明确收益时记录 `NO_MATERIAL_EDIT`。事实、数字、单位、来源、主关系和结论强度不得改变。

关键文件：

- `editorial/PRD.md`
- `editorial/ENGINE.md`
- `editorial/references/input-contract.md`
- `editorial/references/editorial-contract.md`
- `editorial/references/review-rubric.md`
- `editorial/scripts/apply_editorial_patch.mjs`
- `editorial/scripts/verify_editorial_roundtrip.py`
- `builder/tests/editorial_editor.test.mjs`
