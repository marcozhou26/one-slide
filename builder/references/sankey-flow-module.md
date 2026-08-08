# Sankey flow

- Used for: diversion, transformation or fulfillment classification of the same resource from left to right, and each flow has a value.
- Not used for: only sequence, no flow; no conservation between any node or layer.

## B level input contract

| input | degree | acceptance form | Missing or conflict handling | where the process goes |
| --- | --- | --- | --- | --- |
| `title` | required | `source`, `placeholder`; or with `source_ids` and non-empty `derivation` of `approved_rewrite` | `approved_rewrite` Forging source substrings is not required; when derivation instructions are missing or the source is unknown `SOURCE_FIDELITY_FAIL` | validator → renderer Title |
| `layers` | required | 3–5 layer, each layer 1–8 unique nodes; nodes contain value and source | missing layer, duplication id, non-numeric value or stop when the node value and flow rate are not conserved. | validator → planner column layout → renderer node |
| `flows` | required | Only connect adjacent layers;value>0; `kind` for `neutral`, `on_time`, `not_on_time`, and compatible with history `success`, `loss` | Stop when unknown semantics, cross-layer connections, missing endpoints, or non-conservation between layers; "Other" cannot be used to make up the difference | validator → planner `flow_semantics` → renderer Streaming color and level |
| SLA local verification area | optional | `display_blocks` in `local_verification`; Five elements, each line contains `monthly_volume`, `fte`, `on_time_rate`, `sla_status` | If it is missing, it will not be drawn; if it exists but is not the five elements, the field is missing, the value is abnormal, or the service volume conflicts with the first-level node `SANKEY_SLA_BLOCK_FAIL` | validator → planner `sla_rows` → renderer single area |
| `insights`, `conclusion` | optional | source object | Reduce support area when missing; stop when sources conflict | validator → renderer Supporting Evidence and Action Area |

The reading order is fixed to `READ_CONTEXT → DERIVE_IF_STABLE → USE_DECLARED_DEFAULT → DEGRADE_SCOPE → STOP`.SLA Area missing is a degradable input; traffic, endpoints, conservation, and business semantics are blocking inputs.

## visual semantics

- `neutral`: Neutral gray-blue flowing band, not implying success or loss.
- `on_time`: A blue stream band indicates completion on time.
- `not_on_time`: Orange flow band, label and object name remain "out of time" and must not be rewritten as "loss".
- history `success/loss` Keep using blue/The orange flow band does not change the existing meaning.
- five elements SLA The verification area must be a partial table format area, completely retaining the service volume,FTE, punctuality,SLA The status has four fields and cannot be split into five cards.
- Each stream uses a native editable stream strip closed by two upper and lower cubic Bezier curves; the bandwidth is `value` Keeping the same scale, the source and target ends are continuously stacked at the edge of the node.
- Nodes must be right-angled, borderless native rectangles. Rounded corners, white strokes, gray strokes, and any outlines that create gaps between nodes and flow bands are prohibited.
- Flowbands are placed above the main white box and below the nodes and labels; they use transparency and deterministic levels when crossing, and no white breakpoints or bridge masks are used. Use the full column width for each level of headers; do not use node width as header width.

## QA

- Check each node value, each layer total and adjacent layer flow conservation.
- Check `neutral/on_time/not_on_time` Object naming, color, and stream hierarchy; there must be no visible text that reads "out of time" instead of "loss."
- Check SLA Five rows and four fields, stream width sorting, source end/Target-side stacking, node borderlessness and partial table readability, and PowerPoint The truth is open.
- OOXML The number of custom geometries must be equal to the number of flows. Each flow strip contains two cubic Bezier curves; however, the structure check cannot be individually proven to be readable. Full-page preview and PowerPoint Regular views must still identify neutral, on-time, and off-time flows, and layer titles must not crowd out numbers or be obscured by nodes.
