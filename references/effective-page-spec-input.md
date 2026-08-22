# Effective Page Spec 输入合同

## 直接上游

复杂报告页面只接受slide-spec输出的`schema_version=effective-page-spec-1.0`。OneDeck的`director_package`提供全篇导演语境，但不是OneSlide可直接施工的规格。

## 校验顺序

1. 确认输入只对应一个`page_id`和一个画布；
2. 确认`mode=REPORT_PAGE`时存在完整`director_inheritance.locked_fields`；
3. 确认`story`、`primary_relationship`、`primary_visual`、`reading_order`、`display_blocks`、正文/备注分配和验收条件闭合；
4. 确认有效规格没有覆盖或删除任何导演锁定字段；
5. 再进入来源、数据、模块路由、原生绘制和页面QA。

## 图标交接

规格包含`icon_handoff`时，OneSlide必须逐项消费并保留来源与目标绑定。`status=requested`项目缺少必需字段、角色不受支持或必选项目无法按声明执行时，返回精确阻断状态；允许`text_only`时必须在对应`target_id`上显式降级。不得把`status=requested`静默改成无图标，也不得为了匹配现有图标别名替换原始业务概念。

## 决策边界

OneSlide可以决定几何、字号、色值、对象实现、模块选择和在规格容许范围内的微调。不得重新决定：

- 整套页序、父子关系、章节和跨页节奏；
- 本页任务、主张、主张强度、密度和注意力角色；
- 主要关系、主视觉形式和阅读顺序；
- 来源边界、必含项、禁止项和允许强调。

## 状态与回退

- 缺少有效规格：`EFFECTIVE_PAGE_SPEC_REQUIRED`，返回slide-spec。
- 有效规格与导演继承值冲突：`EFFECTIVE_PAGE_SPEC_CONFLICT`，返回slide-spec；不得自由规划。
- 单页容量或关系无法实现：`SINGLE_SLIDE_SCOPE_OVERLOAD`或`MODULE_COVERAGE_GAP`，返回slide-spec的单页表达构思；不得擅自拆页。
- 页面包通过：`SINGLE_PAGE_PACKAGE_PASS`，交给Deck Control。
- 需要整套重排、跨页修复或组装：`DECK_ASSEMBLY_OUT_OF_SCOPE`，交给Deck Control；若其判断是上游导演问题，再精确返回OneDeck。
