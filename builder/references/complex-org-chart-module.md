# Complex organization chart semantic model

Use `org-model.json` as the single source of truth for organization identity and relationships. Do not let page coordinates, routing, or rendering alter this model.

## Input contract

The validator accepts one JSON model with version `0.1`. The required facts are:

- a visible `title`;
- formal `nodes` with stable IDs, labels, kinds, and source anchors;
- declared `relationships` between those IDs;
- `temporary_groups`, which may be an empty array;
- `source_anchors` containing every cited source ID.

Accept only these node kinds: `org_unit`, `position`, `person`.

Accept only these relationship kinds:

- `primary_reporting`: formal parent to formal child;
- `functional_guidance`: functional owner to guided formal node;
- `temporary_membership`: formal node to temporary group.

Temporary group members are references shaped as `{ "node_id", "source_ids" }`. Do not copy labels, kinds, people, or attributes into the member record. Use `validity.start` and `validity.end` only when the source provides them.

If an input file or JSON value is missing, unreadable, or malformed, stop with `ORG_INPUT_INVALID`. If a relationship is ambiguous, resolve it upstream; do not guess in this validator.

### Optional overlays (B-level contract)

The base `org-model.json` remains the only source of truth for formal node identity, direct reporting, functional guidance, and temporary membership. An overlay is optional and may be one object, an array, or `{ "overlays": [...] }`. The three overlay types may be combined; each type may appear at most once. Overlay records may only reference node IDs already present in the validated base model.

Run the same validator with an overlay:

```bash
node scripts/validate_org_model.mjs --input <org-model.json> --overlay <overlay.json>
```

Input behavior:

| Input | Requirement | Missing / conflict behavior | Process use |
| --- | --- | --- | --- |
| `org-model.json` | required; readable JSON, version `0.1` | unreadable or malformed: `ORG_INPUT_INVALID`; semantic conflict: stable `ORG_*` code | formal hierarchy validation, layout, relationship ledger |
| overlay JSON | optional; object, array, or `overlays[]` wrapper | absent: render the approved base chart unchanged; malformed: `ORG_OVERLAY_FORMAT_INVALID` | optional evidence, risk, or interface rendering |
| overlay node references | conditional when an overlay is present | unknown or repeated reference: hard failure; never infer a node | attaches overlay data to formal nodes |
| hand-entered derived flags / summaries | optional verification fields | validator recomputes and rejects conflicts with `ORG_OVERLAY_FORMULA_CONFLICT` | reconciliation evidence only |

Natural-language and spreadsheet inputs are still normalized upstream. Do not ask a user to fill this internal JSON contract when the needed facts can be derived from the supplied file or handoff. Ambiguous formal reporting relationships remain blocking because guessing would alter the organization truth. Missing non-blocking display detail degrades to the base organization chart.

#### `placement_evidence`

Each `placements[]` record is keyed by `placement_key`, attaches to one or more `node_ids`, and contains `authorization_score` (0–10), `cycle_months`, `milestone_rate_pct` (0–100), optional numeric `resource_crowding`, and at least one `governance_conditions` string. Evidence stays spatially attached to the referenced branch; it does not become a second chart or an equal-card matrix. When one resource-crowding statistic covers nodes from more than one placement class, store it once under `shared_evidence` with its complete `node_ids` scope. Do not copy the same aggregate into multiple classification cards; the validator rejects that double attribution.

#### `node_risk_encoding`

The overlay provides `node_ids`, three numeric thresholds under `rules`, and optional `expected_summary`. Raw measures remain on each referenced formal node under `attributes`: `headcount`, `turnover_rate_pct`, `key_role_count`, `key_roles_with_successor`, and `manager_tenure_lt_6m`.

The validator—not the supplied booleans—recomputes:

```text
successor_gap = key_roles_with_successor < key_role_count
key_role_dense = key_role_count >= minimum_count
                 and key_role_count / headcount * 100 >= minimum_pct
triple_breakpoint = turnover_rate_pct > threshold
                    and successor_gap
                    and key_role_dense
```

If `has_unsucceeded_key_role`, `key_role_dense`, `triple_breakpoint`, or an `expected_summary` field is supplied, it must equal the recomputed result. Node area encodes headcount, fill encodes turnover, and the three native editable badges encode successor gap, key-role density, and new-manager status. The legend must explain all three encodings and the triple-risk outline.

#### `hybrid_interface_overlay`

This overlay declares five supported form values (`functional`, `divisional`, `matrix`, `platform`, `legal_entity`), zone metadata, and non-reporting governance interfaces. `formal_relationship_source` must be `data/org-model.json`. Fields named `nodes`, `relationships`, `primary_reporting`, or `functional_guidance` are a hard `ORG_OVERLAY_DOUBLE_TRUTH` failure.

Every zone member and both endpoints of every interface must reference base-model node IDs. Interface `rule_status` is `missing` or `documented`; its marker is recomputed as `warm_triangle` or `diamond`. Reconciliation counts are recomputed from the interfaces. Matrix headcount marked as cross-zone coverage is not added to other zone headcounts, and interface event counts are not summed unless the source explicitly permits that aggregation.

## Hard validation

Run:

```bash
node scripts/validate_org_model.mjs --input <org-model.json>
```

On success, the command prints the validated model, sorted node and relationship ID lists, source coverage, and warnings. On a hard failure it prints JSON to stderr and exits `2`.

Hard failures include duplicate IDs, unsupported kinds, missing source anchors or references, two primary parents, primary-reporting cycles, duplicate primary/functional pairs, cloned temporary members, and reversed validity ranges. The stable domain codes are defined by `scripts/validate_org_model.mjs` and exercised in `tests/org_model_contract.test.mjs`.

## Source coverage

The visible fact count covers the title, every node, every relationship, every temporary group, and every temporary member reference. Each must cite at least one declared source anchor. A successful result therefore has equal `visible` and `mapped` counts and an empty `missingIds` list.

## Render

Natural-language input is compiled by the Agent into this model. For Excel or CSV, read the department/position, direct manager, functional manager, project team, and validity columns and write the same model; do not require the user to fill JSON fields.

Run `scripts/render_complex_org_chart.mjs` with either `--handoff <builder-handoff.json>` or `--input <org-model.json>`, optional `--overlay`, `--pptx`, `--preview`, `--layout`, and `--ledger`. Handoff mode resolves declared datasets, consumes the approved title/subtitle, and requires the declared overlay to be present. The renderer keeps mixed local layouts, functional dotted lines, temporary-team member references, and the three organization-specific overlays inside this one module. It does not create a general graph engine or change `pptx_core.mjs`.

For a risk overlay where all 31 departments report directly to one root, the slide may condense the 31 identical root connectors into four section-entry lines to preserve readability. The relationship ledger still carries all 31 formal relationships, and the visible note must state that the four sections are reading groups rather than added organization levels. Hybrid interfaces use one dedicated horizontal lane per interface; its marker and label stay on that lane and name both endpoint zones, the conflict type, and the written-rule status.

### Organization-chart drawing standard

- Treat alignment and relationship routing as acceptance gates, not optional polish. A page fails with `ORG_PEER_ROW_MISALIGNMENT`, `ORG_DIRECT_REPORT_DOGLEG`, or `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` when the corresponding rule below is violated; a readable file or successful export does not override these failures.
- When three to six first-level units each have exactly one leaf department, align the first-level units on one row and align the ordinary leaf departments on one row. A leaf department that is the single source of two or more functional-guidance relationships may sit on a lower source row so its guidance lines can use the open corridor below the peers. Do not arbitrarily isolate the first branch as a dense left rail when all branches have the same depth.
- A one-child primary-reporting relationship must be a visually straight vertical line: parent and child horizontal centers differ by no more than 1 px. A tiny horizontal offset that turns the connector into a dogleg is a layout failure, even if PowerPoint technically renders the connector.
- For a lower functional-guidance source and raised targets on its right, every dashed relationship leaves the source's right side, travels through the open lower corridor, and enters the bottom of its target. Targets that play the same peer role share the same top coordinate. The dashed path must not cross an unrelated node, its label, or a primary-reporting line.
- Functional-guidance direction remains a source fact. Only relationships with the same declared `source` may share a visual trunk or lane. Never redraw an inbound relationship as if it were outbound merely to obtain a cleaner composition; if the intended owner is unclear or the source facts contain opposite directions that cannot be routed unambiguously, return `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` for upstream confirmation.
- Use one native elbow connector for every relationship. Never assemble one relationship from separate straight or dashed line segments.
- For the first-level bus, every connector must leave the bottom of the root box and enter the top of the first-level department box. Side entry or side exit is invalid.
- A governance layer above the operating head does not make that operating head an ordinary lower-level node. When one direct child of the governance root is the dominant operating head and carries multiple operating branches, align the governance box and operating-head box on the same vertical centerline. Every operating branch must leave the bottom of the operating head and enter the top of the branch node through the operating-root bus.
- Do not generalize the first-level anchor rule to lower levels. A single child directly below its parent uses bottom exit and top entry. When siblings are arranged as a vertical list, the parent exits from its left side and every child is entered from the left through an elbow rail; right-exit/right-entry is invalid. Horizontal chains use side exit and opposite-side entry. Choose from the local structure instead of applying one anchor pattern to every lower relationship.
- A vertical child list must be visibly indented from its parent so the elbow rail sits between the two left boundaries. Merely assigning `left → left` while keeping parent and children on the same left edge is invalid. The sales department's five regions use the same visible indentation and left-rail geometry as the supply-chain department's two manager roles.
- PowerPoint's automatic connector routing may override a valid `left → left` plan. For a rail marked `lockedRail`, run `scripts/normalize_org_connectors.py` after export and verify the rendered PowerPoint geometry. Metadata, endpoint sides, and node indentation alone do not prove the rail is correct.
- A locked rail remains one native editable `bentConnector3`, but its endpoints are not auto-attached because PowerPoint would otherwise move the rail outside the group. Moving either connected node later will not move that locked connector automatically; regenerate the slide after structural edits. Do not describe V0.1 as supporting post-edit automatic rerouting.
- Do not apply the vertical-list rail to a single formal chain. The brand branch remains `品牌部 → 品牌总监 → 品牌策略经理`, with bottom exit and top entry at both levels.
- Use intentional shared bus or rail paths only when they express the same hierarchy. Avoid accidental overlap and never cross node text.
- Route secondary dashed relationships only after the formal hierarchy is placed. If the shortest elbow would cross a node, move the blocking lower-level node first, then use open side anchors. For same-row peers without a lower source lane, prefer functional guidance from the source side facing the target to the target side facing the source. For a lower source lane, use the source side facing the target and the target bottom. Keep the full dashed path outside unrelated node rectangles.
- Local reflow is part of this module: when a role with multiple reports would create crossing or ambiguous lines, change those reports from a horizontal row to a vertical list with the same left-rail rule. Do not preserve a bad row merely to keep initial coordinates unchanged.
- Keep direct-reporting lines solid in the Builder's standard line gray, functional-guidance lines dashed in the Builder's brand blue, and temporary-membership lines dashed in the Builder's project orange. Do not introduce a separate organization-chart palette.
- Use 16 pt for first-level departments and 14 pt for all lower departments, positions, people, and temporary-team member references. Keep the root role visually stronger. Use no more than 12 pt for legends, dates, sources, and other annotations.
- Micro status badges are a deliberate exception to the general annotation scale: when a single white Chinese character sits inside an approximately 20 x 18 pt colored badge, use 8 pt regular weight. Do not bold the character; the badge fill already provides emphasis.
- Inherit the Builder hierarchy: navy root with white text, pale-blue first-level departments with navy borders, white lower-level nodes with light neutral borders, orange only for the temporary-team emphasis zone, and the standard navy title plus divider line.
- Preserve this z-order: background emphasis container below relationship lines; relationship lines below node boxes and text. Never send a relationship line behind a colored container.
- Treat the user-adjusted `assets/reference-pages/complex-org-chart.pptx` as the geometry reference for first-level connector anchoring and hierarchy typography. Do not copy a standalone palette from that file; color and page hierarchy come from the Builder's `COLORS`, title treatment, and node styles.
