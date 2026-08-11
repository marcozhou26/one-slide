# Part-to-whole 模块

适用：在一个明确期间内，把一个正的单一总量拆成 3–6 个互斥构成项，回答“整体由什么组成、哪一项主导”。`chart_type=pie` 使用原生饼图；`chart_type=doughnut` 使用单环原生环图。

不适用：跨期构成变化使用 `composition-shift`；横向规模与内部构成同时编码使用 `marimekko`；多个对象的同一构成比较使用条形图或直接编排。多环、嵌套环、旭日图、3D、爆炸饼和静态图片不属于本模块。

## 输入契约

- `diagram.chart_type`：`pie|doughnut`；缺少图形偏好时 Producer 可从明确构成关系采用 `doughnut` 默认值，不向用户追问。
- `diagram.period`：来源支持的单一期间。
- `diagram.total_value`：有限正数；`total_value_source_ids` 必须存在。
- `diagram.unit`：非空字符串，例如 `%`、`¥亿`、`人`、`件`。
- `diagram.parts`：3–6 项，`id` 唯一；`value` 为有限非负数；`label`、数值来源均可追溯。
- `parts[].value` 之和必须在 `1e-6` 浮点误差内等于 `total_value`，否则返回 `PART_TO_WHOLE_RECONCILIATION_FAIL`。扇区角度只使用计算真值，不从四舍五入显示百分比反推。
- 最多一个 `priority=true`。优先项只改变一个扇区和对应构成行的强调，不使用爆炸、阴影或 3D。
- `doughnut` 必须提供来源支持的 `center_label` 与 `center_value`；`pie` 禁止提供中心字段。
- `insights` 0–3 条，`conclusion` 可选；没有洞察时不生成空洞察栏。
- 合成 fixture 必须通过 `subtitle` 显示“合成示例数据，非真实客户数据”。

## 视觉契约

- 图表对象必须是 PowerPoint 原生 `pie` 或 `doughnut` chart，固定 `firstSliceAngle=0`；环洞固定为 55。
- 小扇区不强行在扇区内放字。主图旁使用原生色块、类别、绝对值和计算占比构成稳定图例。
- 右侧洞察栏仅在 `insights` 非空时出现；底部结论带仅在 `conclusion` 存在时出现。
- 所有正文保持至少 12 pt；标签不得重叠、越界或依赖图片。

## 阻塞

- 缺少总量、期间、单位或来源；
- 构成项少于 3 或多于 6、重复 ID、负值或非有限值；
- 合计不对平；
- 多期间、多个总量或第二个独立主图；
- 环图中心文字无来源；
- 要求趋势、排名、关系、多环、嵌套或 3D。
