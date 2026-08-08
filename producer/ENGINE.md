---
name: single-consulting-slide-producer
description: Turn sparse or complete user material into one source-traceable consulting-grade slide prompt, and optionally one native-editable PowerPoint draft. Use when the user wants exactly one consulting-style PPT page, may not have enough detail, needs missing content completed without changing supplied facts, and wants every inferred, calculated, or synthetic element clearly identified.
license: Apache-2.0
metadata:
  version: 1.1.2
---

# Single Consulting Slide Producer

Create exactly one consulting-grade slide. The output may be a production prompt or one native-editable PowerPoint page, but the content scope never expands beyond one page.

This Skill combines source-faithful slide architecture with controlled synthetic completion. It does not require the user to fill a detailed form.

## Triggers

Use this Skill when the user asks for exactly one consulting-style slide and any of the following is true:

- `帮我写一个咨询级单页 PPT 提示词`;
- `把这些零散资料整理成一页 PPT`;
- `信息不够的地方你补齐，但要标出来`;
- `直接帮我画成一页可编辑 PowerPoint`.

Do not use it for a multi-page deck, a deck-wide storyline, editing an existing slide without rebuilding its content, or a request whose primary output is not a slide.

## Read first

Read all four references before producing an artifact:

- `references/input-contract.md`
- `references/single-slide-contract.md`
- `references/provenance-contract.md`
- `references/output-contract.md`

## First user interaction

Tell the user, in natural language, that this run will produce exactly one slide. Do not repeat the warning mechanically in every turn.

Prefill the page direction from the conversation and supplied material. State:

- what this one page is about;
- who will read it and what they need to understand or decide;
- the proposed primary question and primary relationship;
- which supplied anchors will be preserved;
- which material, if any, will be completed and marked as pending confirmation.

Ask only when two or more plausible page directions would materially change the central message or primary exhibit. Do not ask for internal fields, module IDs, coordinates, card counts, margins, or decorative preferences.

## Output modes

Infer the mode from the request:

- `PROMPT_ONLY`: the user asks for a prompt, brief, handoff, or slide-generation instruction.
- `PPT_DRAFT`: the user asks to create, draw, render, or deliver the slide itself.

When the request is silent about the final carrier, use `PROMPT_ONLY` and say so briefly. The user can request `PPT_DRAFT` without repeating the source material.

## Generation modes

Choose one:

- `SOURCE_ONLY`: supplied information is sufficient for the selected one-page story. Do not add facts.
- `SYNTHETIC_AUGMENTATION`: complete only declared gaps needed for the page. Invocation of this Skill authorizes clearly labelled, reversible completion unless the user explicitly prohibits it.
- `EVIDENCE_BLOCKED`: the requested factual claim cannot be supported or safely completed.

Do not treat style, wording, layout, or chart selection as factual gaps. Derive them from the page relationship.

## Process

### 1. Lock the one-page boundary

Copy the exact user request and hash every supplied file used. Separate requested visible content from background material.

Define exactly:

```text
1 audience task
1 primary question
1 primary relationship
1 central message
1 primary exhibit
0-3 supporting evidence topics
0-1 action-or-condition area
```

If the request needs competing main exhibits or more than three supporting evidence topics, return `SINGLE_SLIDE_SCOPE_OVERLOAD`. Recommend the strongest one-page focus, but do not silently delete required material or generate multiple pages.

### 2. Build the source baseline

Assign stable IDs to every material source and important anchor. Preserve user-supplied facts, numbers, definitions, claim strength, must-include items, and exclusions.

Treat user files as supplied evidence, not independently verified truth. Resolve conflicting authoritative values before formal handoff or exclude the affected calculation with a visible limitation.

### 3. Assess sufficiency by claim

For every intended title, exhibit, insight, recommendation, and visible metadata item, decide whether it is:

- directly supplied;
- stably derived from supplied material;
- calculated from declared inputs;
- externally verified with a real source;
- missing and eligible for synthetic completion;
- blocked because completion would create a false factual claim.

Do not use a single page-level label as a substitute for item-level provenance.

### 4. Complete only declared gaps

When information is insufficient, create the minimum content needed to express the selected relationship. Do not regenerate supplied anchors or change the page direction.

For generated data:

- define entity, grain, period, unit, denominator, and calculation rules;
- use plausible unevenness rather than decorative random values;
- reconcile totals, shares, bridges, funnels, repeated values, and derived claims;
- calculate the title and insights from the generated records;
- keep analysis-only fields out of the visible handoff.

For qualitative completion, label generated dimensions, causes, options, actions, and evaluation criteria as hypotheses or illustrative content. Do not present them as observed customer facts.

### 5. Apply provenance

Follow `references/provenance-contract.md`. Every visible claim or structured item must carry one or more `source_ids` and a valid provenance kind.

Use visible review marking only where needed:

- any synthetic metric or dataset requires `合成示例数据，非真实客户数据` on the slide;
- synthetic qualitative content requires a nearby `待确认` marker or a clearly mapped page-level legend;
- user-supplied, derived, calculated, and externally verified items remain traceable in `review/content-review.md` without cluttering the page.

User confirmation does not convert synthetic data into verified fact. It becomes a confirmed scenario assumption and retains an appropriate external disclosure.

### 6. Compile the single-slide package

Create the package in `references/output-contract.md`. Keep user-facing review material separate from internal ledgers.

The Builder prompt must describe information relationships and visible requirements, not exact coordinates or renderer internals. Do not join audience-facing fields with `|` or `｜`.

If one productized Builder module can express every must-include item, read only that module reference and include a complete executable `module_payload` as defined by `references/output-contract.md`. Do not emit a module name without its validator-ready payload. Hybrid pages keep the generic structured handoff and let Builder use guarded direct composition.

For rank-migration pages, treat `bump-ranking` as the canonical module. Prefer it when the evidence contains an ordered ranking across two or more periods; two periods may render as a slope-style view, while three or more periods must be handed off as a bump chart. A complete payload must preserve the ordered `periods`, one `ranks`/`values`/`states` slot per period for each object, explicit `source_ids`, and `new`/`exited`/`not_ranked` states where applicable. Do not generate the legacy `left_period`/`right_period` payload for new work; Builder keeps that shape only as a compatibility input.

For multi-period composition pages, use `composition-shift` only when one stable denominator is compared across 3–8 ordered periods and 2–6 stable components. The payload must include source-backed `periods`, unique component IDs and labels, one `shares` slot per period, `basis`, `denominator`, `unit`, and 1–3 data-backed insights. Each period must reconcile to 100%. When `basis=absolute`, also include component `values`, period `totals`, and `total_source_ids`, and ensure the absolute values, totals, and calculated shares reconcile. If widths also encode market size, use `marimekko`; if the page requires another independent primary exhibit, omit the three module fields and use guarded direct composition.

### 7. Validate the package

Run:

```bash
python3 scripts/validate_package.py <run-directory> --stage handoff --write-report
```

Then inspect the complete page semantically. The validator proves package structure, declared provenance coverage, topic budget, safe paths, and selected disclosure rules. It does not prove consulting quality or PowerPoint quality.

### 8. Finish according to output mode

For `PROMPT_ONLY`, deliver:

- `handoff/builder-prompt.md`;
- `handoff/builder-handoff.json`;
- `review/content-review.md`.

For `PPT_DRAFT`, locate `single-consulting-slide-builder` and give it the validated handoff. The Builder owns module selection, exact geometry, native PowerPoint objects, rendering, and PPTX QA.

If the Builder is unavailable, unsupported, or returns `MODULE_COVERAGE_GAP`, keep the valid prompt package and return `PPT_RENDERING_BLOCKED`. Do not fall back to a generic renderer and claim consulting-grade PowerPoint completion.

After rendering, require exactly one 16:9 slide, native editability, semantic audit, full-page render inspection, and actual Microsoft PowerPoint review when available. Store previews and QA evidence under `internal/verify/`, never in the public delivery folder.

After the Builder places the PPTX in `delivery/`, run the same validator with `--stage final --write-report`.

## Hard boundaries

- Exactly one slide per run. Never create a deck or hidden overflow slide.
- Never invent a source, quotation, named-person statement, legal claim, market benchmark, or customer outcome.
- Never attach invented metrics or events to a real organization as if they were factual.
- If the user requires factual accuracy and evidence is absent, use `EVIDENCE_BLOCKED`; do not synthesize numbers.
- Never alter a user-supplied number to make arithmetic work. Expose the conflict.
- Never write the conclusion first and manufacture numbers to support it.
- Never hide required visible content in speaker notes, footnotes, internal files, or another page.
- Never solve overload by deleting content, shrinking body text, or stacking microcharts.
- Never expose prompt history, rejected options, internal QA, local paths, or production instructions in a client-facing PPTX.
- Do not mark package validation as PowerPoint quality or user acceptance.

## Scripts

Validate a generated run directory with:

```bash
python3 scripts/validate_package.py <run-directory> --write-report
```

Exit codes:

- `0`: declared package checks passed;
- `2`: invalid command arguments;
- `10`: package contract or validation failure.

Run the packaged regression tests with:

```bash
python3 -m unittest discover -s tests -v
```

## Verification

- [ ] The user was told that the run produces exactly one slide.
- [ ] The page has one audience task, question, relationship, message, and primary exhibit.
- [ ] Every supplied file used has a source record and extraction status.
- [ ] Every visible claim, block, item, and dataset has valid `source_ids`.
- [ ] Generated content fills a declared gap and does not overwrite a supplied anchor.
- [ ] Synthetic data has the exact visible disclosure.
- [ ] The visible topic budget passes without hidden overflow.
- [ ] `validate_package.py` passes and its report is stored internally.
- [ ] `PPT_DRAFT` contains exactly one editable slide and passes rendered inspection.
- [ ] PowerPoint inspection and user acceptance remain separate from structural validation.

## Anti-patterns

- Generating a complete second story after the one-page direction is locked.
- Marking a whole page synthetic while leaving individual claims untraceable.
- Treating user approval of a scenario as factual verification.
- Asking users to complete an internal schema before any useful work begins.
- Adding decorative cards, recommendations, or benchmarks to make the slide look fuller.
- Returning a generic PPT after the consulting Builder reports a module gap.

## Extension points

- Add new provenance kinds only with a stable ID prefix, ledger fields, visible behavior, and validator tests.
- Add a new Builder route only when it preserves the declared primary relationship and has a real one-slide regression case.
- Add new input formats through the B-level file handling contract without increasing user form burden.
- Keep optional external research separate from synthetic completion; verified facts require real citations.

## Completion states

Report separately:

```text
BASIC_OUTPUT_PASS | fail
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
```

`PROMPT_ONLY` can complete with the rendering states marked `not_applicable`. `PPT_DRAFT` cannot be called complete while rendering or PowerPoint inspection required by the target environment remains untested.
