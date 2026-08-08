# Logic Structure Schema

`logic-structure.json` Use the following structure:

```json
{
  "version": "0.1",
  "audience_mode": "analysis",
  "title": {
    "text": "Extended lead time",
    "source_ids": ["S01"],
    "origin": "source"
  },
  "source_anchors": [
    {
      "id": "S01",
      "text": "The extended delivery cycle is mainly caused by frequent changes in requirements, insufficient resources in key positions, and long cross-department confirmation times."
    }
  ],
  "diagram": {
    "type": "causal-chain",
    "nodes": [
      {
        "id": "n-demand",
        "text": "Requirements change frequently",
        "source_ids": ["S01"],
        "kind": "cause"
      },
      {
        "id": "n-delay",
        "text": "Extended lead time",
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

## Field rules

- `version` fixed to `0.1`.
- `audience_mode` for `decision` or `analysis`.
- `title.origin` for `source` or `placeholder`.
- `title.origin=source` , the title must be a contiguous substring of the specified original text anchor.
- `title.origin=placeholder` , the title must be equal to `To be supplemented by customers`.
- `source_anchors` of ID Only, the text remains the same.
- `diagram.type` Currently fixed to `causal-chain`.
- Each node literal must be its `source_ids` A contiguous substring pointing to the original text, or equal to `To be supplemented by customers`.
- of each side `relation` fixed to `causes`, and must have an original evidence anchor.
- The graph must be a directed acyclic graph.
- Each text anchor is mapped to at least one visible node.
