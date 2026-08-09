# 混合结构直接编排

1. 提取标题、主证据、解释证据、洞察、动作和图注；不再写 page model。
2. 只选一个主视觉关系；其余放入证据带、解释栏或结论带。
3. 使用 `scripts/pptx_core.mjs` 的语义组件；正常情况下不读取其源码。坐标统一使用 `1280×720 px`，不得把 960×540、英寸值或其他画布坐标直接写入 `position`。
4. 为重复字段建立真实列或 `addFieldGroup`。为数据编码使用 `addDataBar` 或 `addChartColumn`。
5. 一次生成完整候选。`exportPresentation` 会强制输出 layout JSON 并执行换行、画布利用率和越界检查；失败时必须修复当前渲染代码，不得绕过审计或把失败文件放进 `delivery/`。

最小调用方式：

```javascript
import { createPresentation, exportPresentation, addPageHeading, registerEdgeAlignment, addContainer, addDataBar, addFieldGroup, addNode, addTextBox, addIndexBadge, addActionBand } from "<skill>/scripts/pptx_core.mjs";
const { presentation, slide } = createPresentation();
addPageHeading(slide, { title, subtitle, position: headingFrame });
addContainer(slide, { name, position, fill, border });
addDataBar(slide, { name, position, fill });
addFieldGroup(slide, { name, fields: [{ label, value, alignment }], position });
addNode(slide, { name, text, position, fill, border, fontSize, alignment });
registerEdgeAlignment({ name: "main-right-edge", edge: "right", members: ["MainEvidenceRight", "ConclusionBand", "ActionPanel"] });
await exportPresentation(presentation, { pptx, preview, layout }); // layout 必须是 .json
```

`position` 使用 `{ left, top, width, height }`。只有状态标签调用 `addStatusTag`；其他元素不得直接指定 `roundRect`。

保持一条阅读顺序：

```text
行动标题 → 主证据 → 解释证据 → 洞察或动作 → 结论与口径
```

正文先用 14/16 pt，密集局部才降至 12 pt。仍放不下时返回 `SINGLE_SLIDE_FIT_FAIL`，不得删内容或移入备注。

## 文本容器硬规则

- 页标题统一使用 `addPageHeading` 和完整内容宽度，禁止手动插入换行。组件不允许静默丢弃副标题；标题实际渲染为一行时可以保留副标题，实际为两行时必须重新安排副标题信息，把必要限定内容合并到标题、正文或图注中。`TWO_LINE_TITLE_WITH_SUBTITLE` 必须阻断导出。
- 编号、短列名、状态标签、数据标签一律单行。编号使用 `addIndexBadge`，状态标签使用 `addStatusTag`，不得用普通窄文本框替代。
- 合成定性内容的读者可见标签统一写 `模型补全，待确认`。`SYNTHETIC_GENERATED` 只保留在 handoff 和来源台账，不在狭窄页面标签中显示。
- 标签加正文的横向结论带使用 `addActionBand`。不要手工猜标签宽度；正文最后一行不得只剩一至三个汉字。
- 所有文本框使用组件默认的小内边距。不得依赖 PowerPoint 默认内边距，因为默认左右各约 10 px，容易使本来能放下的短标签意外换行。

## 画布利用率硬规则

- 页面坐标固定为 `1280×720 px`。主内容通常从左边距 48–64 px 延伸到右侧 1216–1232 px。
- 信息较完整且对象数不少于 12 时，主内容最右边不得早于 1120 px，主体最下边不得早于 540 px。未达到时先检查是否误用了 960×540 或英寸坐标，再扩大主证据区；不得用装饰物填空。
- `CANVAS_WIDTH_UNDERUSED`、`CANVAS_HEIGHT_UNDERUSED`、`SHORT_LABEL_WRAP`、`ORPHAN_LINE`、`UNBREAKABLE_TOKEN_WRAP`、`BAD_LINE_START_PUNCTUATION`、`NUMBER_UNIT_SPLIT` 均为阻断项，不是可忽略 warning。
- 标题组件之后保留至少 16 px 的完整安全间距。主框上方的图例、里程碑标签、注释和数据标签同样受此限制，不能因为它们不在主框内就越过安全区。
- 若标题安全区被侵入而页面底部仍有至少 56 px 空间，先整体下移主证据、支持区、结论区和来源区；不得只移动主框，留下漂浮注释继续挤压标题。

## 跨区块对齐硬规则

- 先定义唯一内容框架，再从框架计算表格、结论带和行动面板的边界，不得分别手写看似接近的右边缘。
- 上下堆叠且同属主内容的区块，左边缘和右边缘必须共线；只有明确的缩进层级、侧栏或注释区可以例外。
- 自由编排必须用 `registerEdgeAlignment` 声明主要纵向区块的左、右边缘代表对象。偏差超过 2 px 时返回 `EDGE_ALIGNMENT_MISMATCH`，缺少声明成员时返回 `ALIGNMENT_MEMBER_MISSING`。
