# 混合结构直接编排

1. 提取标题、主证据、解释证据、洞察、动作和图注；不再写第二套 page model。
2. 只选一个主视觉关系；其余放入证据带、解释栏或结论带。
3. 使用 `scripts/pptx_core.mjs` 的语义组件和 `1280×720 px` 坐标。
4. 为重复字段建立真实列或 `addFieldGroup`。为数据编码使用 `addDataBar` 或 `addChartColumn`。
5. 一次生成完整候选；修复 `exportPresentation` 的 layout 门禁后才能交付。
6. 地图请求返回 `MAP_POLITICAL_RISK_BLOCKED`，改用排名、矩阵、表格或小多图。
7. 默认关闭所有同级内容业务强调。禁止用行号、列号、第一项、最后一项或视觉平衡决定 `bold`、重点 `color/fill/border`；只有完整 `allowed_emphasis` 可以开启。允许中性奇偶行/列底色，但它不得同时改变字重、文字色、边框或字号。矩阵若只强调一种业务状态，其余单元格必须统一为一种普通样式。
8. 业务强调固定使用 `bold + highlight_fill`，不得改变 `border` 或 `borderWidth`。表格与矩阵先确定全表统一细边框，再为重点格替换底纹和字重；不得让重点格自己的边框覆盖相邻共边。

最小调用方式：用 `createPresentation` 建页，用语义组件绘制，设置备注与数据来源，再调用 `exportPresentation({ pptx, preview, layout })`。`position` 使用 `{ left, top, width, height }`。只有状态标签调用 `addStatusTag`；其他元素不得直接指定 `roundRect`。

保持“行动标题 → 主证据 → 解释证据 → 洞察或动作 → 结论”的阅读顺序。

正文先用 14/16 pt，密集局部才降至 12 pt。仍放不下时返回 `SINGLE_SLIDE_FIT_FAIL`。不得删除读者理解结论必需的内容；术语解释、口径、代号翻译、公式和方法进备注，页底只保留数据来源。

## 文本容器硬规则

- 页标题使用 `addPageHeading` 和完整宽度，禁止手动换行；两行标题不得再堆副标题。
- 编号、短列名、状态标签、数据标签一律单行。编号使用 `addIndexBadge`，状态标签使用 `addStatusTag`，不得用普通窄文本框替代。
- 合成定性内容的读者可见标签统一写 `模型补全，待确认`。`SYNTHETIC_GENERATED` 只保留在 handoff 和来源台账，不在狭窄页面标签中显示。
- 横向结论带使用 `addActionBand`；正文末行不得只剩一至三个汉字。
- 使用组件小内边距，不依赖 PowerPoint 默认内边距。

## 画布利用率硬规则

- 页面固定为 `1280×720 px`，主内容通常从 48–64 px 延伸到 1216–1232 px。
- 信息完整且对象数不少于 12 时，主内容最右边不得早于 1120 px，主体最下边不得早于 540 px。未达到时先检查坐标口径，再扩大主证据区；不得用装饰物填空。
- `CANVAS_WIDTH_UNDERUSED`、`CANVAS_HEIGHT_UNDERUSED`、`SHORT_LABEL_WRAP`、`ORPHAN_LINE`、`UNBREAKABLE_TOKEN_WRAP`、`BAD_LINE_START_PUNCTUATION`、`NUMBER_UNIT_SPLIT` 均为阻断项，不是可忽略 warning。
- 标题之后保留至少 16 px 安全间距，图例和注释同样受限。
- 若标题安全区被侵入而底部仍有至少 56 px 空间，先整体下移主证据、支持区、结论区和来源区；不得只移动主框。
- 可见内容被删除、压缩或移入备注后，必须重新计算正文框架并局部重排。不得保留空框、空卡片或让低位细线掩盖中间大空白。
- 大容器没有有效正文/数据或只剩标题时，返回 `EMPTY_CONTENT_CONTAINER_FAIL`。正文区出现超过 150 px 的非意图连续空白带时返回 `VISUAL_BALANCE_FAIL`；通过合并空容器、放大主证据、调整比例或重排修复，不得用装饰物填空。
- 旧稿编辑和备注迁移场景必须比较修改前后：只要删除或迁移了可见对象，就必须保留重排证据；未重排即返回 `CONTENT_REMOVAL_WITHOUT_REFLOW_FAIL`。
- `EMPTY_CONTENT_CONTAINER_FAIL`、`VISUAL_BALANCE_FAIL` 和 `CONTENT_REMOVAL_WITHOUT_REFLOW_FAIL` 均为阻断项。
- 数据来源行以下除 PowerPoint 原生页码外不得出现任何可见对象；出现正文、结论或遗留容器时返回 `CONTENT_BELOW_SOURCE_FOOTER_FAIL`。

## 跨区块对齐硬规则

- 先定义唯一内容框架，再从框架计算表格、结论带和行动面板的边界，不得分别手写看似接近的右边缘。
- 上下堆叠且同属主内容的区块，左边缘和右边缘必须共线；只有明确的缩进层级、侧栏或注释区可以例外。
- 自由编排必须用 `registerEdgeAlignment` 声明主要纵向区块的左、右边缘代表对象。偏差超过 2 px 时返回 `EDGE_ALIGNMENT_MISMATCH`，缺少声明成员时返回 `ALIGNMENT_MEMBER_MISSING`。
