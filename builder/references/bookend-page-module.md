# Bookend Page Module

支持 `cover` 与 `ending`。输入必须来自页面合同，使用穷尽式 `visible_components`。封面界定主题和演示身份；结束页按上游合同执行结论回扣、邀请、答疑或联系收束，不默认生成“谢谢”。

支持 `light`、`navy` 和 `inherit_template`。主题只替换背景、文字、辅助和强调令牌，不改变内容、层级与强调语义。模板继承通过正式模板流程完成；页面模块不得擅自重排已确认骨架。

普通内容部件必须全部来自白名单。OneSlide原生自动页码属于报告系统层，不作为内容组件，也不转成普通文本框。

失败状态：`UNDECLARED_COMPONENT_FAIL`、`MISSING_REQUIRED_COMPONENT_FAIL`、`TEMPLATE_SKELETON_DRIFT_FAIL`、`THEME_SEMANTIC_DRIFT_FAIL`。
