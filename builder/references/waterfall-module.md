# 瀑布归因模块

## 适用

用户提供起点、终点和逐项增减值，需要解释差异如何形成。模块接受结构化数据或文字与数据混合输入。

## 数据门禁

- `起点 + 全部增减项 = 终点`，超出显式容差即返回 `WATERFALL_RECONCILIATION_FAIL`。
- 增减项标签、分组、可控性、洞察和结论必须来自原文或数据字段。
- 不根据结果倒推缺失项，不把未提供的差额自动归入“其他”。
- 单位、汇率、期间和一次性项目口径冲突时停止正式生成。

## 输入结构

`module_id` 为 `waterfall-attribution`；`diagram.type` 为 `waterfall`。包含 `start`、二至七项 `contributions`、`end`、单位和可选洞察、底部结论、来源脚注。用户要求来源说明时使用 `diagram.footnotes`，不得因为主图模块缺少页脚而转入自由编排。

运行 `validate_waterfall.mjs`、`plan_waterfall.mjs` 和 `render_waterfall.mjs`，并执行 PowerPoint 输出契约。
