# Single-slide contract

## Non-negotiable scope

One run produces content for exactly one slide on the locked native canvas: presentation 16:9, short-video B-roll 9:16, or portrait knowledge graphic 3:4. A review file, source ledger, prompt, data file, preview, or QA report does not count as another slide. A second PPT page, hidden overflow page, appendix page, or alternate candidate violates this contract unless the user starts a separate run.

## Page model

Every page must define:

```text
audience_task
primary_question
primary_relationship
central_message
primary_exhibit
supporting_evidence_topics: 0-3
action_or_condition_areas: 0-1
```

The primary exhibit must contain or reference the evidence required to inspect the central message. Insights may interpret declared evidence but may not introduce a new evidence topic.

## Sufficiency decision

Information is sufficient only when the selected page can state an honest message and express its primary relationship without inventing factual claims.

Missing decoration, exact wording, module ID, layout coordinates, color, or font is not an evidence gap.

The following may be completed in `SYNTHETIC_AUGMENTATION`:

- illustrative categories, criteria, or framework dimensions;
- anonymous fictional records and values;
- scenario assumptions;
- illustrative actions or conditions supported by the generated scenario;
- labels and reader-facing wording that preserve supplied meaning.

The following may not be synthesized as facts:

- a real organization's operating metrics, events, results, or customer behavior;
- quotations, interview findings, survey results, benchmarks, market facts, sources, or named-person statements;
- legal, regulatory, medical, financial, safety, or compliance claims;
- causal claims about a real situation without evidence.

## Visible topic budget

Exactly one visible block has `budget_role=primary_exhibit`.

At most three visible blocks have `budget_role=supporting_evidence` and at most one has `budget_role=action_or_condition`. Every visible title, subtitle, unit, period, label, legend, definition, disclosure, source line, and annotation consumes the visible information budget. Metadata is not exempt merely because it is technically necessary.

Do not turn every generated field into visible content. Keep plausibility and reconciliation fields internal when readers do not need them.

For `short_video_broll_9_16`, tighten the visible budget to one core claim, one primary exhibit and at most one tightly coupled supporting cue. Use vertical stacking and phone-readable labels. A wide process, dense multi-column table or complete lecture framework is scope overload, not permission to shrink, crop or create extra pages.

## Body, notes, and footer allocation

- Keep only the conclusion, primary evidence, and reader-needed labels on the visible slide.
- Put terminology explanations, scope and denominator explanations, code or acronym translations, formulas, calculation methods, missing-value handling, and technical limitations in PowerPoint speaker notes.
- Reserve the visible footer for one `数据来源：...` line only. Merge the exact synthetic-data disclosure into that source line when applicable.
- Do not use speaker notes to hide a fact or limitation whose omission would cause the visible conclusion to be materially misunderstood. Rewrite the visible conclusion instead.
- Do not expose unexplained professional acronyms or internal module names in titles, conclusions, legends, or body copy.

## Scope overload

Return `SINGLE_SLIDE_SCOPE_OVERLOAD` when preserving explicit requirements would require:

- more than one primary exhibit;
- more than three independent evidence topics;
- more than one unrelated recommendation or condition area;
- text density that cannot remain readable at the target canvas.

Recommend one page focus and list excluded candidates in the user-facing brief. Do not automatically create page two.

## Page families

Choose the visual family from the relationship, not from the number of rows or the user's use of a chart word:

- comparison: entities on shared criteria;
- chart: trend, ranking, variance, distribution, correlation, or single-total composition;
- matrix: true row-by-column coverage;
- process: ordered stages or dependencies;
- waterfall: movement from start to end;
- funnel: conversion or attrition;
- quadrant: two-axis prioritization;
- hierarchy: nested or reporting relationships;
- direct composition: one coherent qualitative relationship not covered by a deterministic module.

If no installed Builder module faithfully expresses the relationship, return `MODULE_COVERAGE_GAP`. Do not force a hierarchy into a matrix or a causal relationship into decorative cards.

## Copy and layout rules

- Use a conclusion title only when evidence supports it; otherwise use a factual or question-led title.
- Title, subtitle, and summary use the full available width of their container. Do not insert manual line breaks for appearance.
- Do not use `|` or `｜` to join visible fields. Use structured aligned items.
- Do not add an insight rail, action bar, recommendation, or footnote to fill space.
- Do not emphasize an item because it is first, last, highly ranked, or visually convenient. Bold, emphasis text color, emphasis fill, and emphasis border changes default to false for peer content. Neutral zebra banding by odd/even row or column is allowed only as a readability aid and must not change weight, text color, border, size, or business meaning. Business emphasis requires `allowed_emphasis.target`, `reason`, `method`, and `source_ids`; otherwise return `UNAUTHORIZED_EMPHASIS_FAIL`.
- When one business state is authorized for emphasis, use one emphasis style for that state and one uniform neutral style for everything else. Do not assign separate colors to non-focus states.
- The default business-emphasis method is bold text plus a highlight fill. Do not change border color, width, line style, or visibility for emphasis. Adjacent cells and containers must keep one uniform thin shared-edge treatment. A border difference used only for emphasis returns `EMPHASIS_BORDER_FORBIDDEN`.
- Do not shrink body text or hide material to avoid a scope decision.
- Do not place any visible footer content other than the data source line.
