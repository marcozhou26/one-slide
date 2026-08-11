# Single-slide contract

## Non-negotiable scope

One run produces content for exactly one 16:9 slide. A review file, source ledger, prompt, data file, preview, or QA report does not count as another slide. A second PPT page, hidden overflow page, appendix page, or alternate candidate violates this contract unless the user starts a separate run.

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

At most three visible blocks have `budget_role=supporting_evidence` and at most one has `budget_role=action_or_condition`. Necessary title, subtitle, units, sample, period, definition, disclosure, and provenance legend are metadata and do not consume evidence slots.

Do not turn every generated field into visible content. Keep plausibility and reconciliation fields internal when readers do not need them.

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
- Do not request or describe a top decorative band, eyebrow, kicker, overline, title accent, brand strip, empty card, or any other visible object whose only purpose is aesthetic styling.
- Do not shrink body text or hide material to avoid a scope decision.
