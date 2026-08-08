# radar capability module

Applicable: Use one 6–12 Vereda comparison `current`, `benchmark`, `target` three sequences. The radar is the only main image; evidence such as business unit sorting can only be used as an adjacent support area and cannot be expanded into a second main image or table wall.

## B level input contract

| input | degree | Accept form and quality requirements | Missing, ambiguous or conflict handling | where the process goes |
| --- | --- | --- | --- | --- |
| Title and source anchor | required | Non-empty title,`origin`, at least one true `source_id`;The title must be a substring of the original source text | Read first handoff and source anchor points; if still missing, `SOURCE_FIDELITY_FAIL` | Title and Source Audit |
| Scale | required | `scale.min`, `scale.max`, `scale.unit`;The upper and lower bounds are finite numbers and `min < max`. support 0–10, also supports input of other continuous scales explicitly declared | Don't guess, don't guess 0–10 converted to 1–5;Missing or contradictory returns `SCALE_CONTRACT_FAIL` | validator, radar loop, scale, three-sequence normalization |
| radar dimension | required | 6–12 items; each item contains the name supported by the source, and the numeric type `current`, `benchmark`, `target` | Return missing items `DATA_CONTRACT_FAIL`;String numbers, null values or out-of-bounds values are returned `SCALE_RANGE_FAIL` / `ABNORMAL_FORMAT_FAIL` | Three native editable radar polygons with axis labels |
| Three sequence names | required | `series_labels.current / benchmark / target`, both with sources | If it is missing, do not fill in the business name yourself and return `SOURCE_FIDELITY_FAIL` | Legend |
| Ability Groups and Group Cards | optional | Dimensions can be brought `group`; `group_cards` A non-empty array when present | It is no longer mandatory to have three groups or three cards; it is verified by the source when provided. | Optional support area when there is no business unit sorting |
| Business unit sorting | optional | `supporting_evidence.type=business-unit-ranking`; 2–10 unit, including name, index, revenue applicability, number of people, and source; when declaring descending order, the actual descending order must be | Sorting conflict returns `RANKING_ORDER_FAIL`;Revenue "not applicable" must be explicitly stated and cannot be written as 0 | Compact supporting evidence area attached to radar |
| Pilot condition area | optional | 1–3 Condition items supported by sources | Missing does not block the radar; provided but returned if the structure is abnormal `DATA_CONTRACT_FAIL` | Single conditional region at the end of the reading chain |
| File type handoff | conditional | Prompt Architect `builder-handoff.json`, D01 radar CSV with D02 sort CSV Use relative paths;UTF-8, unique header, consistent number of rows and columns | Press first JSON Directory parsing; missing files, garbled characters, duplicate headers, abnormal number of columns or non-numeric fields will stop and no generation will occur. PPTX | `loadR3ModuleInput` After standardization, enter the same validator/planner/renderer |

The processing order is fixed as: read the current handoff with relative data files → Validate scales and sources → Verify three sequences with 6–12 dimension → Validate sorting and criteria areas on demand → Planning a main radar and supporting evidence → Render native objects.

## Visual and Semantic Access Control

- The three series share the same circle center, axis order, and input declared scale; normalization is only applied to the plot coordinates and does not change the visible scores.
- The area and visual weight of the sorting area must be smaller than the radar area; the sorting must not be copied into an independent main image, a full-page table or a card array.
- Business unit ranking is not a synonymous replacement for capability group cards; both types of supporting evidence are selected as entered.
- Titles, axis labels, legends, sorting labels, conditions, and footnotes are PowerPoint Native text or vector shapes; images may not be used to carry the main image.
- Boundary violation, scale conflict, anomaly CSV, stop when the core source is missing; do not convert the scale, do not delete the sequence, do not change the radar to a normal table.
