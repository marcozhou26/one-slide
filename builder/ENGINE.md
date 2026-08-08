---
name: single-consulting-slide-builder
description: Build one native-editable 16:9 consulting PowerPoint slide from an approved Consulting Slide Prompt Architect handoff, a structured Synthetic Input Generator package, or a simple unambiguous raw request. Use for consulting comparisons, processes, matrices, trends, rankings, flows, charts, complex organization charts, HR business pages, and composite analytical single slides. Return BRIEF_REQUIRED instead of forcing complex or ambiguous raw material into one page.
---

# Single Consulting Slide Builder V3.3.5

Only one page of consultation is generated at a time PowerPoint. Prioritize consumption of confirmed structured input packages; only load a hit module. Do not call the general Presentations Skill Replace this Skill.

## core results

- one page,16:9, PowerPoint Natively editable.
- Source facts, figures, caliber and strength of conclusions are traceable.
- Data graphics use square corners; fields use real objects, tables, or blocks, and vertical characters are not used to simulate columns.
- Only one candidate and one full-page rendering are done by default; one repair rendering is allowed after a deterministic defect is discovered.

## input

Three types of entrances are accepted:Prompt Architect Packages, other structures handoff, simple and unambiguous original content.Prompt Architect Press included `references/prompt-architect-handoff.md` Check; structured input is routed directly without repeated generation page model. Original material that is complex, ambiguous, or significantly longer than one page is returned `BRIEF_REQUIRED`. Read on exception `references/input-contract.md`.

## execute

### 1. one route

Input is saved as JSON After running:

```bash
node scripts/route_v3.mjs input.json
```

Continue by result:

- `deterministic_module`: Only read the returned single `reference`. If the route returns `module_input=module_payload`, put handoff in `module_payload` Write it to the running directory as it is `internal/module-input.json`, run directly validator, planner and renderer; May not be reinterpreted or rewritten. Do not read the full registry or renderer source code.
- `direct_composition`: read only `references/visual-grammar.md` and `references/direct-composition.md`, use `scripts/pptx_core.mjs` The semantic component generates a page.`preferred_module` It is just a visual family reminder, which does not mean that there is an executable module load; you must not pretend to hit a deterministic module.
- `BRIEF_REQUIRED`:Complex or ambiguous original material handed to Prompt Architect.
- `SOURCE_BASELINE_FAIL` or `ROUTE_CONFLICT`: Process according to the returned blocking reason without guessing.

When the script is normal, the renderer source code, complete registry or other modules must not be opened reference.

### 2. Source and Audience

- Confirmed handoff Keep the central idea, content boundaries and field mapping, and do not make a second round of content judgment.
- Simple raw input execution `LOSSLESS_TRANSFORMATION`, do not add or delete source content.
- Titles and stories must be supported by sources; evidence only supports description, not causality or suggestion.
- Identify the final audience and their tasks; page models, prompt words,QA and internal paths must not enter the customer PPTX.
- Stop formal generation when data unit, period, range, total and calculation relationships conflict.

### 3. draw

- First determine the main information relationship and main evidence area, and then draw the object.
- Data bars, chart columns, waterfall columns, table cells, and general containers must have square corners.
- Continuous numeric distributions must preserve original observations, units, periods, denominators, samples, and missing values, using reproducible explicit binning boundaries and adjacent native rectangles; they must not be passed off as spaced categorical histograms.
- Rounded corners are only allowed for explicit status labels; they may not be used for data coding, trends, hierarchies, process nodes, or conclusion bands.
- Sankey diagrams use closed native Bezier flow strips; nodes use right-angled, borderless rectangles. Thick straight lines, white node strokes, or rounded nodes are not allowed to be returned.
- Shared fields with more than three rows must use real columns, table cells, or stable slots.
- Connection lines only express direction, cause and effect, dependence, the same object across stages, or unique annotation pointing; draw relationship lines first, and then draw nodes.
- Title usage `addPageHeading` and full container width. A one-line title can have subtitles; a two-line title cannot have subtitles. Regular text 14/16 pt;Local subtitle 16/18 pt; 12 pt Use only for intensive local, secondary labels, sources, and legends.
- Return when the content cannot be moved to the next page without deleting words. `SINGLE_SLIDE_FIT_FAIL`.
- No need to abbreviate fonts, delete evidence or change the central idea to repair the upstream Brief;Return for content scope issues Prompt Architect.
- `position` only use `1280×720 px` Coordinates; must not be mixed with inches or 960×540 coordinates.
- Numbers, short column names, status labels, and data labels must be on a single line and used separately. `addIndexBadge`, `addStatusTag` or explicitly `singleLine: true`.
- Synthesize qualitative content in PPT Can be written in person `Model-generated completion, pending confirmation`;English source key stay inside handoff, do not put narrow tags.
- Lateral action belt use `addActionBand`, don't cram labels and long sentences into two narrow, unmeasured text boxes.
- The actual lower edge of the title component is retained after at least 16 px Safe distance. The main figure, legend, milestone labels, notes, data labels, and action areas all belong to the main text, and none of them may extend into the title safe area. You cannot just check the outer frame of the main image.
- First allocate title area, text area, action/The conclusion area and source area are then arranged vertically in the text area. If crowding occurs near the title but there is still space at the bottom of the page 56 px The above movable margin must be moved downwards as a whole; the title must not be pushed upward while leaving the blank space at the bottom of the page.
- The organizational chart must place ordinary departments at the same level on the same horizontal line; the horizontal center error of the parent-child node in a one-to-one subordinate relationship must not exceed 1 px, otherwise mark `ORG_DIRECT_REPORT_DOGLEG`. Departments that provide a common source for more than two functional guidance can be placed in the lower source row; the dotted line starts from the node toward the side of the target, passes through the blank channel below, and enters from the bottom of the target. If the dotted line crosses irrelevant nodes, merges opposite-direction relationships into the same source, or nodes on the same layer are unevenly high, press `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` or `ORG_PEER_ROW_MISALIGNMENT` Block delivery.

### 4. QA

After building run:

```bash
python3 scripts/audit_pptx_semantics.py final.pptx
node scripts/audit_visual_source.mjs
node scripts/layout_quality.mjs internal/verify/layout.json
```

`exportPresentation` Already built in layout Quality access control;`SHORT_LABEL_WRAP`, `ORPHAN_LINE`, `UNBREAKABLE_TOKEN_WRAP`, `BAD_LINE_START_PUNCTUATION`, `NUMBER_UNIT_SPLIT`, `TWO_LINE_TITLE_WITH_SUBTITLE`, `HEADING_SAFE_ZONE_INTRUSION`, `CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE`, `EDGE_ALIGNMENT_MISMATCH`, `CANVAS_WIDTH_UNDERUSED`, `CANVAS_HEIGHT_UNDERUSED` and cross-border must block delivery. Direct arrangement must also use `registerEdgeAlignment` Declare the collinear edges of the main longitudinal blocks. Rendering a full page requires manual checking of title wrapping, title safe areas, upper and lower white balance, occlusion, connecting lines, data encoding, field blocking and readability. Known deterministic flaws must be fixed regardless of candidate budget; no iterations are allowed for beautification that has no clear benefit.

Organizational structure module additional blocking `ORG_PEER_ROW_MISALIGNMENT`, `ORG_DIRECT_REPORT_DOGLEG` and `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS`. These states must come from actual node coordinates and relationship direction checks, not just scans for prompt words or dependencies PowerPoint Automatic routing.

## Token discipline

- Do not read `references/module-registry.json`;Read internally in routing script.
- Do not read missed modules reference.
- The script source code for normal execution is not read.
- Structured input is not generated repeatedly page model, content mapping or a second set of data descriptions.
- Intermediate plans are kept in the internal workspace; normal delivery only returns the final PPTX.

## delivery boundary

The customer directory only contains versions PPTX. source, prompt words, routing results, preview and QA Put the internal directory.

Report separately:

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
RENDERED_READABILITY_PASS
REQUIREMENT_COVERAGE_PASS
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

Unexecuted level write `not_tested`. technical testing and ZIP Wholeness cannot replace reality PowerPoint Visual inspection or user acceptance.

## Expand

New modules must provide a reference, validator, planner, renderer, complete input test and abnormal input test. New code must not expand the resident context; routing results only return information about hit modules.
