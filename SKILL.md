---
name: one-slide
description: "Turn complete or sparse user material into exactly one source-traceable, presentation-ready slide prompt, and optionally one native-editable 16:9 PowerPoint page with consulting-grade structure and layout. Use when the user wants one professional slide, may not have enough detail, wants missing content completed without changing supplied facts, and needs every synthetic or inferred element identified."
license: Apache-2.0
metadata:
  author: "周俊东 Marco"
  version: "1.2.2"
---

# OneSlide

Process one page at a time. Create exactly one PowerPoint slide per run, applying consulting-grade standards to its logic, information structure, and layout. This file is the only user-facing entry point. Content design and provenance work happen first; when a PPTX is requested, pass the approved package to the bundled Builder engine.

## Read first on every run

Read these files in full:

- `references/input-contract.md`
- `references/suite-contract.md`
- `producer/references/single-slide-contract.md`
- `producer/references/provenance-contract.md`
- `producer/references/output-contract.md`

Before drawing, also read `builder/ENGINE.md` and the reference for the single module returned by routing. Do not preload every Builder module.

## First interaction

State naturally that this run will create one slide, then prefill the following from the conversation, attachments, and confirmed decisions:

- what the slide must communicate;
- who will read it and what they should understand or decide;
- one main question, one main relationship, and one central conclusion;
- which user-supplied content must be preserved; and
- which essential gaps may be filled and visibly labeled.

Ask a blocking question only when two equally reasonable page directions would change the central conclusion or main exhibit. Never ask the user to fill internal fields, module identifiers, coordinates, card counts, or decorative preferences.

## Two output modes

Infer the output mode from the user's own words:

- `PROMPT_ONLY`: the user asks for a prompt, brief, handoff package, or generation instructions.
- `PPT_DRAFT`: the user asks OneSlide to create, draw, generate, or deliver a PowerPoint slide.

When the carrier is not specified, default to `PROMPT_ONLY` and explain that choice briefly. If the user later switches to `PPT_DRAFT`, reuse the locked sources and page direction without asking them to restate the material.

## Three content modes

- `SOURCE_ONLY`: existing evidence is sufficient; add no new facts.
- `SYNTHETIC_AUGMENTATION`: fill only the gaps essential to the slide, without changing user facts or the main logic.
- `EVIDENCE_BLOCKED`: the requested conclusion requires real evidence that is unavailable, so it cannot be completed honestly.

Style, wording, layout, and diagram selection are not factual gaps; infer them from the main relationship.

## Workflow

### 1. Lock the single-slide boundary

Preserve the original request and create source records and hashes for every attachment used. A run may contain only:

```text
1 audience task
1 main question
1 main relationship
1 central conclusion
1 main exhibit
0-3 supporting evidence topics
0-1 action or condition area
```

If competing main exhibits or more than three evidence topics remain, return `SINGLE_SLIDE_SCOPE_OVERLOAD` and recommend the strongest single-slide focus. Do not silently remove essential content or create a second slide.

### 2. Establish the source baseline

Assign a stable `source_id` to every user-supplied fact, stable inference, calculation, external verification, and model-generated completion. Preserve the user's numbers, definitions, conclusion strength, inclusions, and exclusions.

Treat user attachments as user-supplied evidence, not automatic independent verification. If authoritative values conflict, stop the affected calculation instead of choosing a side silently.

### 3. Fill only targeted gaps

When content is insufficient, add only what the main exhibit and declared evidence topics require:

- Synthetic data must define the object, granularity, period, unit, denominator, and calculation rule.
- Totals, percentages, funnels, bridges, repeated values, and title claims must reconcile.
- Synthetic qualitative content must be labeled as a hypothesis, example, or pending confirmation.
- Never fabricate sources, customer quotations, industry benchmarks, legal conclusions, or actual company performance.

If a real organization lacks real data, never present invented metrics under that organization's name. Use an anonymous example or return `EVIDENCE_BLOCKED`.

### 4. Build the content package

Follow `producer/ENGINE.md` and write a versioned run directory. Every visible fact, headline, chart value, insight, and action must include `source_ids`.

Any synthetic metric or dataset requires this visible disclosure:

```text
Synthetic sample data, not real customer data
```

Place “Pending confirmation” beside synthetic qualitative content, or provide a page legend with an item-by-item mapping. User approval of an illustrative scenario does not convert it into verified fact.

Run:

```bash
python3 producer/scripts/validate_package.py <run-directory> --stage handoff --write-report
```

After structural validation, read the brief, prompt, handoff files, and content-review checklist in full. Passing the script does not prove sound consulting logic or visual quality.

### 5. Deliver the selected output

For `PROMPT_ONLY`, deliver:

- `handoff/builder-prompt.md`
- `handoff/builder-handoff.json`
- `review/content-review.md`

For `PPT_DRAFT`, read `builder/ENGINE.md` after the content package passes, then pass `handoff/builder-handoff.json` to the bundled Builder. Builder owns module selection, exact geometry, native PowerPoint objects, rendering, and PPTX quality checks. It must not reinterpret the page objective or source facts.

After Builder delivers, run:

```bash
python3 producer/scripts/validate_package.py <run-directory> --stage final --write-report
```

If Builder is unavailable, a runtime dependency is missing, or routing returns `MODULE_COVERAGE_GAP`, preserve the validated prompt package and return `PPT_RENDERING_BLOCKED`. Do not substitute a generic renderer and claim consulting-grade PowerPoint output.

Producer may write `requested_module` and a complete executable `module_payload` only when a productized module covers all required content and its validator accepts the payload. A module name without an executable payload must not force routing. Mixed-layout pages use `direct_composition`.

Module-specific statistical boundaries:

- Use `box-plot-jitter` only with complete raw observations, groups, sample sizes, a common period and unit, and the sample definition. Preserve every observation. Builder calculates Tukey hinges and 1.5×IQR whiskers, draws each point as a native object, and discloses that horizontal jitter prevents overlap without changing values.
- Use `correlation-matrix` for 4–10 indicators with a symmetric coefficient matrix or aligned raw observations that can be recalculated. Preserve indicator IDs and labels, Pearson or Spearman method, sample size, missing-value handling, period, population, source, and display threshold. If the method is absent, Pearson may be used only with disclosure. The slide must state that correlation does not imply causation.
- Use `scatter-regression` only with complete paired x/y observations, both metrics and units, sample definition, period, population, and source. Version 1 supports univariate ordinary least squares with an intercept. Producer declares missing pairs, exact duplicates, and outliers; Builder recalculates slope, intercept, and R². Block insufficient valid pairs or zero variance. Never describe correlation or regression as causation or fabricate significance.
- Use `confidence-band` for an ordered central estimate with intervals. Preserve 5–12 unique ordered periods; `estimate`, `lower`, and `upper`; metric and unit; interval type and definition; estimation method; sample or population; source; missing-value semantics; and optional threshold semantics. Missing patterns or thresholds do not block. Missing core series, interval definitions, or statistical conventions do. Do not relabel confidence intervals as prediction or risk intervals or overstate probability, causality, or significance.

### 6. Verify the PPTX

A `PPT_DRAFT` must satisfy all of the following:

- exactly one 16:9 slide;
- text, shapes, tables, and charts remain native editable PowerPoint objects;
- semantic audits, full-slide rendering checks, and readability checks pass;
- layout JSON passes checks for wrapped short labels, orphan words, unbreakable tokens, number-unit splits, two-line-title/subtitle conflicts, title safe zones, vertical balance, cross-block alignment, canvas use, and overflow;
- organization charts also pass peer-row alignment, straight one-to-one reporting lines, functional-line direction, and route-crossing checks. Do not deliver results containing `ORG_PEER_ROW_MISALIGNMENT`, `ORG_DIRECT_REPORT_DOGLEG`, or `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS`;
- if Microsoft PowerPoint is available, open the actual file there and inspect it; and
- the external delivery folder contains only the versioned PPTX. Keep sources, prompts, previews, and QA evidence in the internal directory.

## Hard boundaries

- Do not generate a multi-slide deck, hidden overflow slide, or second candidate slide.
- Do not add decorative cards, recommendations, metrics, or benchmarks merely to fill space.
- Do not remove essential content, shrink text below readable size, or alter the main point to make content fit.
- Do not present model-generated content as user-supplied or externally verified.
- Do not expose local paths, prompt history, rejected approaches, internal QA, or production instructions.
- Do not treat file generation, a passing validation script, or ZIP integrity as proof of product value or user acceptance.

## Release package self-test

```bash
python3 scripts/validate_suite.py .
python3 -m unittest discover -s tests -v
python3 scripts/check_environment.py
```

## Status reporting

Report these independently:

```text
BASIC_OUTPUT_PASS | fail
TECHNICAL_CHAIN_PASS | not_tested | fail
INPUT_CONTRACT_PASS | not_tested | fail
SOURCE_BASELINE_PASS | fail
SINGLE_SLIDE_SCOPE_PASS | fail
PROVENANCE_COVERAGE_PASS | fail
SYNTHETIC_DISCLOSURE_PASS | not_applicable | fail
DATA_RECONCILIATION_PASS | not_applicable | not_tested | fail
HANDOFF_PACKAGE_PASS | fail
BUILDER_HANDOFF_READY | not_applicable | fail
RENDERED_READABILITY_PASS | not_applicable | not_tested | fail
POWERPOINT_OPEN_CHECK | not_applicable | not_tested | fail
REQUIREMENT_COVERAGE_PASS | not_tested | fail
PRODUCT_VALUE_PASS | not_tested | fail
USER_REQUIREMENT_PASS | not_tested
PUBLIC_LICENSE_READY | pass
```

Mark `PRODUCT_VALUE_PASS` only after real users have received results that satisfy the single-slide, provenance, and editability requirements. Mark `USER_REQUIREMENT_PASS` only after the user has reviewed a specific result.
