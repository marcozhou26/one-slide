# Direct orchestration of hybrid structures

1. Extract title, primary evidence, explanatory evidence, insights, action, and legend; write no more page model.
2. Select only one main visual relationship; put the rest into the evidence tape, explanation box, or conclusion tape.
3. Use `scripts/pptx_core.mjs` Semantic component; its source code is not read under normal circumstances. Coordinates are used uniformly `1280×720 px`, not allowed to 960×540, inch value or other canvas coordinates are written directly `position`.
4. Create real columns for repeated fields or `addFieldGroup`. Used for data encoding `addDataBar` or `addChartColumn`.
5. Generate complete candidates at once.`exportPresentation` Will force output layout JSON and perform line wrapping, canvas utilization, and out-of-bounds checks; the current rendering code must be repaired on failure and must not bypass audits or put failed files in `delivery/`.

Minimum calling method:

```javascript
import { createPresentation, exportPresentation, addPageHeading, registerEdgeAlignment, addContainer, addDataBar, addFieldGroup, addNode, addTextBox, addIndexBadge, addActionBand } from "<skill>/scripts/pptx_core.mjs";
const { presentation, slide } = createPresentation();
addPageHeading(slide, { title, subtitle, position: headingFrame });
addContainer(slide, { name, position, fill, border });
addDataBar(slide, { name, position, fill });
addFieldGroup(slide, { name, fields: [{ label, value, alignment }], position });
addNode(slide, { name, text, position, fill, border, fontSize, alignment });
registerEdgeAlignment({ name: "main-right-edge", edge: "right", members: ["MainEvidenceRight", "ConclusionBand", "ActionPanel"] });
await exportPresentation(presentation, { pptx, preview, layout }); // layout must be .json
```

`position` Use `{ left, top, width, height }`. Called only by status tags `addStatusTag`;Other elements cannot be specified directly `roundRect`.

Keep a reading order:

```text
action title → chief evidence → interpret evidence → insight or action → Conclusion and caliber
```

Text first 14/16 pt, the dense parts are reduced to 12 pt. Return when you still can’t let go `SINGLE_SLIDE_FIT_FAIL`, content cannot be deleted or comments moved.

## Text container hard rules

- Use unified page titles `addPageHeading` and full content width, disabling manual insertion of line breaks. Components are not allowed to silently discard subtitles; subtitles can be retained when the title is actually rendered as one line, but when it is actually two lines, the subtitle information must be rearranged and the necessary limited content must be merged into the title, text or legend.`TWO_LINE_TITLE_WITH_SUBTITLE` Export must be blocked.
- Numbers, short column names, status labels, and data labels must be on a single line. Number used `addIndexBadge`, the status label uses `addStatusTag`, must not be replaced by a normal narrow text box.
- Reader-visible tags for synthesized qualitative content are written uniformly `Model-generated completion, pending confirmation`.`SYNTHETIC_GENERATED` only remain in handoff and source ledgers are not displayed in narrow page labels.
- The use of horizontal conclusion bands with labels and text `addActionBand`. Do not guess the label width by hand; the last line of the text must not contain only one to three Chinese characters.
- All text boxes use the component's default small padding. must not rely on PowerPoint The default padding is because the default left and right margins are approximately 10 px, it is easy for short labels that could have been placed to wrap unexpectedly.

## Canvas utilization hard rules

- The page coordinates are fixed to `1280×720 px`. Main content usually starts from the left margin 48–64 px extend to right 1216–1232 px.
- The information is relatively complete and the number of objects is not less than 12 When , the rightmost side of the main content must not be earlier than 1120 px, the bottom of the subject must not be earlier than 540 px. If it is not reached, first check whether it has been misused. 960×540 or inch coordinates, then expand the main evidence area; no decorative objects may be used to fill in the blanks.
- `CANVAS_WIDTH_UNDERUSED`, `CANVAS_HEIGHT_UNDERUSED`, `SHORT_LABEL_WRAP`, `ORPHAN_LINE`, `UNBREAKABLE_TOKEN_WRAP`, `BAD_LINE_START_PUNCTUATION`, `NUMBER_UNIT_SPLIT` They are all blocking items and cannot be ignored. warning.
- After the header component keep at least 16 px complete safety distance. The legend, milestone labels, annotations, and data labels above the main frame are also subject to this restriction and cannot cross the safe area because they are not within the main frame.
- If the title safe area is invaded and there is still at least 56 px For space, first move the main evidence, support area, conclusion area and source area down as a whole; do not just move the main frame, leaving floating comments and continue to squeeze the title.

## Hard rules for cross-block alignment

- Define the unique content frame first, and then calculate the boundaries of the table, conclusion band, and action panel from the frame. Do not handwrite right edges that appear to be close to each other.
- The left and right edges of blocks that are stacked on top of each other and belong to the same main content must be collinear; exceptions can only be made for explicit indent levels, sidebars, or comment areas.
- Must be used for free arrangement `registerEdgeAlignment` Declares that the left and right edges of the main vertical block represent objects. Deviation exceeds 2 px return when `EDGE_ALIGNMENT_MISMATCH`, returned when a declared member is missing `ALIGNMENT_MEMBER_MISSING`.
