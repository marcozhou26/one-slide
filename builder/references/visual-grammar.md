# Consultation Page Visual Grammar

only in `direct_composition` Or read when visual defects are fixed.

## Geometry

| semantics | components | Geometry |
| --- | --- | --- |
| Data bars, chart columns, waterfall columns | `addDataBar`, `addChartColumn` | square corner rectangle |
| Ordinary containers, conclusion bands, table cells | `addContainer`, `addTableCell` | square corner rectangle |
| Process nodes, cause and effect nodes, hierarchical nodes | `addNode` | square corner rectangle |
| status label | `addStatusTag` | Allow small rounded corners |

Rounded corners may not be used to express length, scale, trend, hierarchy, or phase. Core data graphics, conclusion strips, and large panels must not be rounded.

## Field

- Two fields: label and value split into two objects, or use `addFieldGroup`.
- Repeating fields in more than three rows: Create real columns, table cells, or stable slots.
- Not allowed in visible text `｜` or ` | ` Separate fields.
- Colons are only used for labels and values within a sentence, not for structures with more than three columns.

## Color and level

- There should be no more than three main colors; unusually warm, standard cool, and neutral gray.
- The main evidence occupies the largest space; explanations and actions must not preempt the weight of the main evidence.
- Establish hierarchy through position, font size, weight, white space and a small amount of color, without using decorative icons, shadows, gradients and web-style components.

## Fonts and lines

- Font size: title 24–34 pt, adapted by content; only long conclusion titles can be reduced to 24 pt;Local subtitle 16/18 pt;Regular text 14/16 pt;Source and legend 12 pt.
- 12 pt Only dense local and secondary labels, not full page default. Core numbers available 24 pt;Maximum five files for the whole page.
- Numbers, short column names, status labels, and data labels must not wrap. Use short numbers `addIndexBadge`; Use tags in combination with action text `addActionBand`.
- Title area usage `addPageHeading`: A one-line title can be accompanied by a subtitle; a two-line title cannot be accompanied by a subtitle.
- Use Chinese source tags for external pages:`Model-generated completion, pending confirmation`. English provenance key For internal tracking only.
- Relationship lines are created before nodes; use whitespace or shading to separate them.
- Use connecting lines only to express relationships; vertical bars must not be treated as field boundaries.

## canvas

- `position` Use uniformly `1280×720 px` coordinates. If the input is described in inches, explicitly convert before calling the component; do not mix units.
- You can’t just complete one in the upper left corner 960×540 Leave a large amount of white space behind the page. The main evidence area should use the full content width and extend the body into the lower half of the page.
- Whitespace serves grouping and reading, not error coordinates. Layout audit reporting canvas width or height underutilization must be fixed.
- Tables, conclusion strips, and action panels stacked one above another within the same content frame must share the left and right edges; separate handwritten approximate coordinates are prohibited. use `registerEdgeAlignment` Declare and check cross-block edges.

## vertical rhythm

- The title area is a complete safe area, not just text and ink. Leave at least 16 px, before starting any text object.
- The outer frame of the main figure, legend, milestone labels, comments, data labels, relationship descriptions and action areas are all treated as text objects; floating labels are not allowed to be placed in the title safe area.
- First lock the title area and source area, and then put the main evidence, support area and conclusion area into the text canvas between them. When the text is dense, give priority to using the available space at the bottom. Do not leave a large blank space at the bottom of the page and push the content below the title.
- If the text invades the title safe area and there is at least 56 px space, mark `CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE`; Mark when there is not enough space below `HEADING_SAFE_ZONE_INTRUSION`. Both block delivery.
