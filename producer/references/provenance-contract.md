# Provenance contract

Every important output item must be traceable to one or more stable source IDs.

## Provenance kinds

| Kind | ID prefix | Meaning |
| --- | --- | --- |
| `user_supplied` | `U` | Directly supplied by the user or a user-provided file |
| `derived_from_source` | `D` | Reliably derived without adding a new factual claim |
| `calculated` | `C` | Produced by an explicit formula from identified inputs |
| `synthetic_generated` | `G` | Generated to fill a declared gap; pending confirmation or illustrative |
| `externally_verified` | `E` | Supported by a real external source recorded with title and URL or stable citation |

IDs are uppercase prefix plus digits, such as `U01`, `G03`, or `C02`.

## Required ledger fields

Each entry in `internal/provenance-ledger.json` requires:

```json
{
  "source_id": "G01",
  "kind": "synthetic_generated",
  "statement": "What this source or generated item represents",
  "origin": "user prompt, relative source path, formula, or generation rule",
  "status": "locked | pending_confirmation | confirmed_scenario | verified",
  "affects": ["content.title", "display_blocks.B01.items.M01"]
}
```

Additional requirements:

- `calculated` entries require `formula` and `input_source_ids`.
- `synthetic_generated` entries require `gap_id`, `generation_rule`, and `status=pending_confirmation` or `confirmed_scenario`.
- `externally_verified` entries require a real `citation` object.
- `user_supplied` entries identify the exact prompt anchor or source file location when available.

## Visible coverage

The following must carry `source_ids` in `builder-handoff.json`:

- title and subtitle when present;
- every insight;
- every action or recommendation;
- every display block and every structured item;
- every footnote that makes a factual or definitional claim;
- every dataset and calculated field shown on the page.

Container-level IDs do not replace item-level IDs when items come from different origins.

## Review copy

`review/content-review.md` is user-facing and must let a non-technical user locate every synthetic item. Organize it by visible page location and use these Chinese labels:

- 用户提供
- 根据资料推导
- 根据数据计算
- 模型补全，待确认
- 外部来源核验

Do not expose internal reasoning, rejected alternatives, system prompts, validator internals, or local absolute paths.

## Slide disclosure

When any visible number, record, event, or metric is synthetic, the slide must visibly contain:

```text
合成示例数据，非真实客户数据
```

When qualitative content is synthetic but no synthetic metrics are present, mark the affected block `待确认` or include a page-level legend that maps the marker to `模型补全，待确认`.

Do not mark user-supplied content as synthetic merely because it was reformatted. Do not remove synthetic disclosure merely because the user approved the layout.
