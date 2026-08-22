# Summary Page Module

支持`page_type=summary`。页面必须保留 OneDeck 已确认的背景、张力、核心回应、2—4项支撑和决策落点，不重新设计叙事。

每个可见段落通过`paragraph_leading_icon`绑定一个`summary_paragraph_marker`。图标位于整段文字左侧的独立前导槽位，默认高度为正文有效字高的1.5倍，允许1.4—1.6倍自适应；图标按单行字高计算，不按整个多行文本框高度放大。图标与段落首行按可见墨迹中心做光学对齐，不以 SVG 和文本框包围盒的几何中心代替。

图标只降低段落定位成本，不承担事实、数据编码或业务强调。所有图标使用 Tabler 精选 outline SVG、相同颜色与1.25线宽。找不到准确图标时使用`NO_ICON`降级并让文字回流，不保留空图框。

失败状态：`SUMMARY_NARRATIVE_FAIL`、`SUMMARY_PARAGRAPH_ICON_FAIL`、`ICON_ASSET_MISSING`、`SINGLE_SLIDE_SCOPE_OVERLOAD`。
