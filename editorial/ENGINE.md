# Editorial QA Engine

只在 Builder 已生成一页 PPTX 后运行。完整读取：

- `references/input-contract.md`
- `references/editorial-contract.md`
- `references/review-rubric.md`
- `references/output-contract.md`

## 首轮审校

1. 锁定源 PPTX、handoff、整页 PNG、layout 和哈希；
2. 先用整页渲染判断构图、主次、区域关系和阅读节奏，不从允许操作反推问题；
3. 建立重复视觉组清单：组成员、共同语义角色、必须统一的属性、可随内容变化的属性，以及是否存在越界、裁切或异常换行；
4. 写出至少两项具体页面优势，并标为 Builder 必须保护的基线；
5. 判断是否存在一个足以改变读者理解或明显降低完成度的材料性问题；若重复组存在明显越界，优先级高于孤立卡片的轻度拥挤；
6. 输出 `editorial-qa.json`，运行 `scripts/validate_editorial_qa.py`；
7. `PASS_AS_IS` 直接结束，禁止生成 Builder revision plan；
8. `BUILDER_LOCAL_REPAIR` 或 `BUILDER_RECOMPOSE` 只把一条任务交给 Builder；一条任务可以覆盖同一根因下的一整个重复组，不能拆成多个孤立微调。

## Builder 执行

Builder 独立读取 QA 任务，决定具体对象、参数和实现方法。局部修复可使用 `../builder/scripts/apply_editorial_revision.mjs`；重排则回到对应模块 renderer 或直接编排器。Builder 必须把执行计划绑定到 QA 文件和源 PPTX 哈希。

Builder 处理文字适配时遵循：

1. 先保持同级语义的字体层级一致；
2. 数据编码容器（如甘特进度条）不能为文字任意扩大，需对整组统一调整字号、边距和单行适配；
3. 非数据编码容器（如同级洞察卡）优先内容驱动扩容或重排，不得只缩小其中一个成员；
4. 如果可用空间不足以扩容，则升级为 `BUILDER_RECOMPOSE`，而不是制造无意的字号差异。

## 复审

重新渲染候选，由 Editorial QA 生成新的只读判断：

- 原问题是否明显减轻；
- `protected_strengths` 是否全部保留；
- 是否新增材料性问题。

复审不通过时回退源文件。最多一个 Builder 候选；只有 QA 明确指出实现偏离任务、且 Builder 存在不同实现路径时允许再做一次。

## 停止条件

- 页面已成熟，修改净收益不明确；
- 建议只能写成泛泛的“更美观”“更突出”；
- 需要改变事实、数据、来源、主关系或结论强度；
- QA 开始指定坐标、字号、颜色值或操作步骤；
- 下一轮只是无方向微调。
