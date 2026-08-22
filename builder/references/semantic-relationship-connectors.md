# OneSlide 语义关系连接线 MVP

仅在 2–6 个大图标作为实体主角，且页面核心是实体之间的传递、上下游、先后、反馈或循环关系时使用。

## 边界

- 图标节点必须有文字标签；连接线不能替代关系说明。
- 连接线只表达来源或已确认逻辑，不用颜色、粗细或弧度制造未经授权的业务强调。
- `direct` 可使用吸附连接器；弧线类关系使用 PowerPoint 原生可编辑的 `custGeom/cubicBezTo`。端点不吸附到固定顶点，而由 `sourceClock`、`targetClock` 和 `gap` 定义视觉上的浮动锚点与留白。
- 上下弧必须使用半椭圆几何：两个贝塞尔控制柄分别从起点和终点沿弦线法向伸出，柄长为 `4/3 × arcHeight`。不得把两个控制柄横向拉向中部，因为那会形成两段近似直线加中部圆角。
- 弧线和终点箭头必须是同一个 PowerPoint 形状；箭头通过 `a:tailEnd` 写入线条属性，不得另画三角形。
- 大图标默认使用统一的细线 outline 资产；不得默认增加圆形、卡片或底板容器。
- MVP 支持 2–6 个节点，不支持自循环、任意避障或通用图编辑器。
- 一对节点的双向循环固定使用 `upper_arc + lower_arc`，箭头方向相反，标签分别位于上下两侧。

## 路由

| route | 含义 | 默认锚点 |
| --- | --- | --- |
| `direct` | 普通传递或先后 | 右侧到左侧 |
| `upper_arc` | 上方正向关系 | 2 点钟到 10 点钟，默认留白 18 px |
| `lower_arc` | 下方反向或补充关系 | 8 点钟到 4 点钟，默认留白 18 px |
| `feedback_arc` | 后端向前端反馈 | 8 点钟到 4 点钟，增大曲率 |
| `outer_loop` | 跨越多个节点的外围回流 | 7:30 到 4:30，增大曲率 |

调用 `scripts/semantic_relationship_connectors.mjs`。每条关系至少提供 `id`、`from`、`to`、`route`；可选 `sourceClock`、`targetClock`、`gap` 和 `arcHeight`。`label` 由页面 renderer 作为独立文本对象绘制。PPTX 导出后必须调用 `scripts/ensure_curve_arrowheads.mjs`，把箭头写回同一曲线对象。

## QA

- 检查 `direct` 为 `p:cxnSp`；弧线类关系为含 `a:custGeom/a:cubicBezTo` 的原生形状。两者都不得是静态截图或拼接线段。
- 检查每个关系只对应一个曲线形状、形状的 `a:ln` 内存在 `a:tailEnd`、不存在 `*-arrowhead` 独立形状。
- 检查箭头实际指向、端点与 icon 之间的留白、上下弧线是否分离、标签是否贴近对应曲线。
- `direct` 移动节点做吸附验证；贝塞尔弧线验证路径级可编辑、箭头方向与重新打开后的几何稳定性。
- 如果原生 `curved` 不能稳定形成所需弧高或避障，返回 `RELATIONSHIP_CURVE_CONTROL_GAP`，该边升级到后续贝塞尔几何层，不用折线冒充。
