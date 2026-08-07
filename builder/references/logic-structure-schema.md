# Logic Structure Schema

`logic-structure.json` 使用以下结构：

```json
{
  "version": "0.1",
  "audience_mode": "analysis",
  "title": {
    "text": "交付周期延长",
    "source_ids": ["S01"],
    "origin": "source"
  },
  "source_anchors": [
    {
      "id": "S01",
      "text": "交付周期延长，主要由需求频繁变更、关键岗位资源不足和跨部门确认时间过长共同造成。"
    }
  ],
  "diagram": {
    "type": "causal-chain",
    "nodes": [
      {
        "id": "n-demand",
        "text": "需求频繁变更",
        "source_ids": ["S01"],
        "kind": "cause"
      },
      {
        "id": "n-delay",
        "text": "交付周期延长",
        "source_ids": ["S01"],
        "kind": "effect"
      }
    ],
    "edges": [
      {
        "from": "n-demand",
        "to": "n-delay",
        "relation": "causes",
        "source_ids": ["S01"]
      }
    ]
  }
}
```

## 字段规则

- `version` 固定为 `0.1`。
- `audience_mode` 为 `decision` 或 `analysis`。
- `title.origin` 为 `source` 或 `placeholder`。
- `title.origin=source` 时，标题必须是指定原文锚点的连续子串。
- `title.origin=placeholder` 时，标题必须等于 `待客户补充`。
- `source_anchors` 的 ID 唯一，文字保持原样。
- `diagram.type` 当前固定为 `causal-chain`。
- 每个节点文字必须是其 `source_ids` 指向原文的连续子串，或等于 `待客户补充`。
- 每条边的 `relation` 固定为 `causes`，并且必须有原文证据锚点。
- 图必须是有向无环图。
- 每个原文锚点至少映射到一个可见节点。
