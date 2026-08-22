# Navigation Page Module

支持 `agenda`、`numbered_overview` 与 `numbered_recap`。目录一次列全章节；编号总览一次列全后续编号项；编号收口必须通过 `deck_context.callback_to` 回扣对应总览。

仅处理 `page_contract.peer_groups` 已明确声明的同级内容组，不自动识别普通内容页的 bullet。支持 2—18 项；目录与收口默认单栏，编号总览按项目数量确定一至三栏，也可通过 `peer_groups[].layout_policy.columns` 明确指定。

同级项目默认完全同质：编号容器、字号、字重、颜色、对齐和尺寸一致。条目先按紧凑节奏组成一个整体，再移动整组；不得使用纵向 `space-between` 填满画布。每列不超过四行时，组内净间距不得超过 28 px；标题到内容组的距离必须至少为典型组内净间距的 1.35 倍。内容组中心应位于 720 px 画布的 360—430 px 区间，优先靠近 390 px。

目录编号不使用脱离标签字号的固定圆形。编号容器高度按右侧标签有效单行字高的`1.5×`计算，允许5%渲染误差；编号字号比标签小`2–4pt`，默认小`3pt`。长标签换成两行时仍以标签字号的单行字高计算，不能按整个两行文本框高度放大编号。编号容器与右侧标签首行按可见墨迹中心做光学对齐，不以文本框和圆形包围盒的几何中心代替。

`group_translation=relative_only` 与 `must_not_center=true` 只限制水平方向，不禁止垂直视觉居中。平移不得改变已经合格的组内节奏。

失败状态：`UNAUTHORIZED_PEER_EMPHASIS_FAIL`、`PEER_GEOMETRY_INCONSISTENCY_FAIL`、`PEER_GROUP_DECLARATION_FAIL`、`PEER_GROUP_LAYOUT_POLICY_FAIL`、`PEER_GROUP_COHESION_FAIL`、`SPARSE_GROUP_OVERDISTRIBUTED`、`CONTENT_GROUP_TOO_HIGH`、`CONTENT_GROUP_TOO_LOW`、`RELATIVE_LAYOUT_INTENT_FAIL`、`SHORT_LABEL_WRAP_FAIL`、`DECK_CALLBACK_FAIL`。
