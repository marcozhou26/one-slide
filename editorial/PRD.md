# OneSlide Editorial QA PRD

目标版本：OneSlide 1.4.0

Editorial QA 是 Builder 之后的内部高级审校门禁。它拥有整页审美判断权，但没有 PPT 修改权。它只判断初稿是否值得改、最值得改什么，并把一条高价值任务交回 Builder。

## 产品职责

```text
Builder 初稿 → Editorial QA → PASS_AS_IS / LOCAL_REPAIR / RECOMPOSE
                              → Builder 执行 → Editorial QA 复审
```

Editorial QA 必须先说明页面为什么成立、哪些设计选择必须保护，再决定是否提出修改。它不得为了制造 before/after 差异而找茬。

## 四种决策

- `PASS_AS_IS`：页面已经成熟，任何可想到的改动都没有足够净收益；直接保留。
- `BUILDER_LOCAL_REPAIR`：存在一个明确、材料性、低扰动的局部缺陷；给 Builder 一条修复任务。
- `BUILDER_RECOMPOSE`：问题涉及区域平衡、板块秩序或主关系表达；要求 Builder 整体重排。
- `EDITORIAL_BLOCKED`：缺少可判断的渲染、来源或页面任务，无法诚实审校。

## QA 输出

只输出：页面优势、一个最重要问题、证据、重要性、需要保护的优势、Builder 目标、成功标准、禁止改法和置信度。不得输出坐标、字号、颜色值、操作序列或补丁。

只有 `high` 置信度可以要求 Builder 修改。置信度不足时必须 `PASS_AS_IS` 或 `EDITORIAL_BLOCKED`。

## Builder 职责

Builder 自己把编辑任务翻译成具体对象和参数，输出 `builder-revision-plan.json`，执行后保留前后整页证据。Editorial QA 不参与对象定位和补丁执行。

## 复审

修改后重新看整页，只回答：原问题是否明显减轻、受保护优势是否保留、是否出现新的材料性问题。未同时满足三项就回退。

## 验收

- 优秀页面应稳定得到 `PASS_AS_IS`；
- 局部缺陷页的 after 在盲测中应稳定优于 before；
- 结构性问题不得用局部补丁通过；
- QA 建议必须少而重要，默认零条，最多一条；
- 技术门禁通过不能替代审美价值或用户验收。

## 非目标

- 不直接编辑 PPT；
- 不充当机械布局扫描器；
- 不列问题清单；
- 不做第二次自由生成；
- 不以改动数量证明价值。
