# 问题树与议题树模块

## 适用

原文明确给出核心问题、二至三个一级分支及其子议题。树只表达分解关系，不自动把并列事实改成因果。

## 禁止

- 原文未明确互斥和穷尽时，不显示或声称 MECE。
- 不为填满树结构补写分支；缺失但原文明示应保留的位置使用“待客户补充”。
- 已验证核心根因、已排除等状态必须有原文锚点。

## 输入结构

`module_id` 为 `issue-tree`；`diagram.type` 为 `issue-tree`。包含一个 `root`、二至三个 `branches`，每个分支包含一至三个 `children`。可选 `verification`、`status`、`so_what` 和有证据的 `mece`。

运行 `validate_issue_tree.mjs`、`plan_issue_tree.mjs` 和 `render_issue_tree.mjs`。正式输出必须执行 PowerPoint 输出契约。
