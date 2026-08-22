# Section Transition Module

支持 `section_transition`。默认语义骨架由章节编号、结构横线、章节名称和必要引导语组成；实际部件仍以 `visible_components` 白名单为准。

页面保持低信息密度，不增加品牌、Logo、问题列表、footnote、额外eyebrow或装饰块。要求继承模板时，编号、横线、标题和引导语的相对关系不得漂移。

失败状态：`UNDECLARED_COMPONENT_FAIL`、`MISSING_REQUIRED_COMPONENT_FAIL`、`TEMPLATE_SKELETON_DRIFT_FAIL`、`SHORT_LABEL_WRAP_FAIL`。
