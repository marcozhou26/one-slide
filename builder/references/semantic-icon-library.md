# OneSlide 语义图标库

仅在 handoff 含 `semantic_icon`，或页面中的导航、对象、状态、动作、流程节点确实需要图标帮助识别时读取。

## 定位

图标是可替换的 SVG 视觉资产，不是 PowerPoint 原生形状，也不要求路径级可编辑。图标只能降低对象识别成本，不能承担数据编码、业务强调或填补空白。

允许角色：`section_identifier`、`object_identifier`、`status_marker`、`action_marker`、`process_node`、`summary_paragraph_marker`。

禁止角色：`decoration`、`space_filler`、`business_emphasis`、`data_encoding`。

不得因为页面有空白、需要更活泼、需要多一种颜色或需要突出某一项而添加图标。同级对象使用图标时应全部使用或全部不用，且图标尺寸、颜色、线宽和与文字的间距保持一致。

## 检索

```bash
node builder/scripts/resolve_semantic_icon.mjs '{"concept":"跨部门协同","role":"object_identifier","limit":5}'
```

检索器只在精选白名单中返回候选。返回 `NO_ICON` 时继续无图标构图，不扩大到完整 Tabler 库，也不临时联网搜索。

Builder 根据页面语境在候选中选一个，并保留 `selection_reason`。默认使用 `outline`。`filled` 只用于来源明确的状态标记，而且同一状态系统必须一致；不得把实心图标用作无依据的业务强调。

## Handoff

```json
{
  "semantic_icon": {
    "enabled": true,
    "role": "object_identifier",
    "concept": "跨部门协同",
    "style": "outline",
    "icon_id": "users-group",
    "selection_reason": "表示多角色共同参与，不暗示上下级关系"
  }
}
```

- `enabled=false` 或字段缺失：不触发图标检索；
- 只有 `concept + role`：Builder 调用检索器返回候选；
- 提供 `icon_id`：仍须属于精选库，并与 `concept + role` 一致；
- `selection_reason` 属于内部交接，不进入页面正文或备注；
- 图标文件路径不得写入对外交付内容。

## 插入与 QA

- SVG 作为独立图片对象插入，不把整页、图表、矩阵或核心关系转成 SVG；
- 保留原始纵横比，不拉伸，不裁切；
- 默认单色，并沿用所属层级的普通文字色；
- 图标不能替代必要文字标签；
- 图标不进入数据来源行，也不算用户事实；
- 检查图标未缺失、未变成占位符、没有裁切或越界，并在 Microsoft PowerPoint 中实际打开时保持清晰。

失败状态：`ICON_ROLE_NOT_ALLOWED`、`ICON_NOT_IN_WHITELIST`、`ICON_SEMANTIC_MISMATCH`、`ICON_ASSET_MISSING`。`NO_ICON` 不是页面失败，继续无图标构图。

摘要页的`summary_paragraph_marker`是段落导航，不是装饰。它必须位于所属段落左侧，默认高度为该段正文有效字高的1.5倍，允许1.4—1.6倍；图标按单行字高计算，不按两行以上的整个段落框高度放大。
