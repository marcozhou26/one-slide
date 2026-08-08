# Output contract

Create a new versioned run directory. Never overwrite an existing run.

## Required package

```text
<run-directory>/
├── brief/
│   └── slide-brief.md
├── handoff/
│   ├── builder-prompt.md
│   ├── builder-handoff.json
│   ├── handoff-manifest.json
│   ├── data/                  optional
│   └── assets/                optional
├── review/
│   └── content-review.md
├── delivery/                  PPT_DRAFT only after successful render
│   └── <clean-version-name>.pptx
└── internal/
    ├── source-baseline.json
    ├── provenance-ledger.json
    ├── generation-ledger.json
    ├── validation-report.json
    └── verify/                optional QA evidence
```

Do not create empty optional directories. Client delivery contains only the versioned PPTX. Review and internal material remain outside `delivery/`.

## handoff-manifest.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "synthetic_content": true,
  "synthetic_data": true,
  "status": "ready",
  "builder_target": "single-consulting-slide-builder",
  "entrypoints": {
    "builder_prompt": "builder-prompt.md",
    "builder_handoff": "builder-handoff.json",
    "content_review": "../review/content-review.md"
  },
  "files": []
}
```

Paths in `files` are relative to `handoff/`. Each requires `path`, `role`, `format`, and `sha256`; CSV also requires `row_count`. Absolute paths, `..`, local URLs, secrets, temporary paths, and missing dependencies are forbidden.

## builder-handoff.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "subject": "page object",
  "story": "One sentence central idea supported by evidence",
  "audience_task": "What should readers understand or decide after reading",
  "source_ids": ["U01", "G01", "C01"],
  "content": {
    "title": {"text": "concluding title", "source_ids": ["C01"]},
    "subtitle": {"text": "Synthetic sample data, not real customer data", "source_ids": ["G01"]},
    "insights": [],
    "actions": [],
    "footnotes": []
  },
  "structure": {
    "primary_question": "Questions to answer on the page",
    "primary_relationship": "category x value",
    "primary_exhibit": "ranking-chart",
    "visual_intent": "Horizontally sorted bar chart",
    "layout_intent": "full-canvas"
  },
  "information_budget": {
    "primary_exhibit_count": 1,
    "supporting_evidence_count": 0,
    "action_or_condition_count": 0,
    "status": "pass"
  },
  "display_blocks": [],
  "datasets": [],
  "review_marking": {
    "required": true,
    "synthetic_data_disclosure": "Synthetic sample data, not real customer data",
    "qualitative_marker": "Pending confirmation"
  },
  "constraints": {
    "must_include": [],
    "must_avoid": [],
    "slide_count": 1
  }
}
```

Every visible text object uses `{text, source_ids}`. Structured display items use their own `source_ids`. Dataset records stay in CSV or JSON when more than a few values are required.

### Executable module payload

if and only if a product has been Builder The module can cover all required content, and Producer Already able to press this module reference When filling in the real input contract,`builder-handoff.json` Added:

```json
{
  "requested_module": "waterfall-attribution",
  "module_payload": {
    "version": "1.0",
    "module_id": "waterfall-attribution",
    "source_anchors": [],
    "title": {},
    "diagram": {}
  }
}
```

`requested_module`, `structure.primary_exhibit` and `module_payload.module_id` Must be consistent.`module_payload` This module must be included validator All required fields and all visible content; not just module names or half-finished skeletons. When the mixed page or module cannot accommodate all required content, all three items are omitted, and the Builder enter `direct_composition`, the module must not be shoehorned into the module.

The ranking migration page uses the official module ID `bump-ranking`.Producer Should be used when handing over `diagram.periods` and each object's `ranks`, `values`, `states` Array; the length of the array must match the number of epochs, and the epochs maintain their original order. The data for the two periods can be obtained by Builder rendered as slope-style Visually, data of three periods and above are presented as Bump Chart. New entries, exits, or not listed yet must be written explicitly. `states`, you can’t guess based on color or copywriting. Old version `slope-ranking` The left and right fields are only used for compatibility with existing running packages and are not used as generation targets for new prompt words.

Use of multi-issue composition change page `composition-shift`.`diagram` must contain 3–8 orderly `periods`, 2–6 The only one with `id` of `components`, equal to the period `shares`, `basis`, `denominator`, `unit` and 1–3 source supported `insights`. The proportions in each period must be equal to 100%.`basis=absolute` It is also necessary to pass in the components of each component `values`, each issue `totals` and `total_source_ids`, the three must be consistent. When the denominator is missing, the period caliber conflicts, the components are unstable, or the page requires a second main image, the module must not be forced to hit.

Use in group retention or survival pages `cohort-retention`.`diagram` must contain 4–12 Strictly increasing and starting from 0 started `relative_periods`, `relative_period_unit`, `cohort_definition`, `denominator`, `measure`, `curve_mode`, and 3–8 The only one with `id`, `initial_count` and equal length `retained_counts` or `retention_rates` of cohort.Producer Users are not required to repeatedly fill in the number of people and proportions; only one reason is provided Builder To calculate the other, both must sometimes be equalized. Immature or unobserved cycles can only be continued as tails `null`, and provide the page visible `censoring_note`, shall not be supplemented 0.`survival` Must be non-increasing; use the current active caliber that allows for real recovery `period_retention`. Fixed four groups,0–24 month and also require the industry benchmark and risk matrix pages to continue to be used `hr-new-hire-survival`. This module must not be forced to hit when there is a second independent main picture.

Group distribution comparison page usage `box-plot`.`diagram` must contain 3–8 groups of the same caliber, and those visible on the page `period`, `unit`, `denominator`, `sample_definition`, `missing_policy`, `quartile_method`, `whisker_multiplier=1.5` and `whisker_rule`. Each group must be passed in a valid `sample_size`, `missing_count`, `whisker_low`, `q1`, `median`, `q3`, `whisker_high`, point by point `outliers` and source. Use the quartile algorithm `PERCENTILE.INC(linear interpolation, equivalent to Type 7)`, the endpoint of the whisker is 1.5×IQR The farthest observation within the fence; records outside the fence must be marked as outliers point by point on the page, not just indicated by color. When the statistical caliber is missing, the caliber conflicts between groups, or the page needs a second main image, the module must not be forced to be hit.

Continuous numerical distribution page usage `histogram`.`diagram` Must contain an indicator, unit, period, denominator, original `observations`(For missing values, use `null` or the empty string is explicitly reserved),`sample.total/valid/missing`, `frequency_basis=count|frequency`, `binning.method=explicit_edges`, strictly incremental `edges`, left and right boundary inclusion rules, and 1–3 Distribution insights supported by strip sources.Producer can be calculated `bins`, but Builder It must be recalculated from the original observations and boundaries and checked box by box. The module must not be forced to hit when there is a lack of original observations, samples cannot be aligned, unit or period conflicts, or binning cannot cover all valid values; use other modules for classification data and cannot pretend to be a classification histogram.

Use of distribution page between groups `box-plot-jitter`.`diagram` must contain 2–6 The only one with `id` of `groups`, each group 5–60 a primitive `observations`, consistent with the number of observations `n`, common `period`, `unit`, `observation_definition`, `sample_definition`, `statistics_rule=tukey_hinges_1_5_iqr`, visible `statistics_note`, visible `jitter_note` and 1–3 source supported `insights`;A full page of raw observations does not exceed 240 . Lateral jitter can only be caused by Builder As a deterministic visual avoidance execution, values must not be written back. Only summary statistics, caliber conflicts between groups, missing units/period/When the sample definition or the page also requires a second main image, the module must not be forced to be hit.

Use of multi-index relationship filtering page `correlation-matrix`.`diagram` must contain 4–10 unique indicators ID/label,`method=pearson|spearman`, `sample_size`, `missing_value_handling`, `period`, `population`, `source_note`, `display_threshold`, visible `causality_note`, and symmetry NxN `matrix` or computable equal length `observations`. Coefficient range, diagonal, symmetry, dimensions and label uniqueness must pass Builder Access control; matrix and observation must be aligned when they exist at the same time. Missing display thresholds and styles can use disclosed safe defaults, and users must not be required to fill in internal fields; modules must not be forced to hit when data, samples, periods, populations, or sources are missing, as well as caliber conflicts or the presence of a second independent master graph. The page must be expressed in terms of position, signed value, and color at the same time, and it must be stated that correlation does not mean causation.

Bicontinuous variable relationship page usage `scatter-regression`.`diagram` must contain `x_metric`, `x_unit`, `y_metric`, `y_unit`, `period`, `population`, `sample_definition`, `source_note`, and 8–200 Strip unique `id`, item by item `x`, `y` and original source `observations`;Use for missing values `null` Explicitly reserved.V1 fixed use `method=ordinary_least_squares_with_intercept`, `handling.missing=pairwise_exclusion`, `handling.duplicates=retain_as_independent` and `handling.outliers=retain_and_label`.Producer Delivery `sample.total/valid/missing/duplicate_pairs`, declared `statistics.slope/intercept/r_squared`, sorted by absolute residuals 1–3 a `highlight_ids`, abnormal point rules visible on the page, recalculation/Tolerance/Show rounding rules and interpretation boundaries that “intra-sample correlation does not represent causation, extrapolation needs to be verified separately”.Builder Unrounded original observations are recalculated and squared; insufficient valid pairing, zero variance in either axis, unit/The hit module must not be forced when there is a period conflict, when there are only summary statistics, when significance is required without evidence, or when there is a second independent master image.

Ordered Center Estimation and Interval Page Use `confidence-band`.`diagram` must contain 5–12 Each label is unique,`order` strictly incremental `periods`, provided in each issue `estimate/lower/upper` and satisfied `lower <= estimate <= upper`;while retaining `metric`, `unit`, `interval_type`, `interval_label`, `interval_definition`, `estimation_method`, `sample_definition`, `population_definition`, `source_note` and 1–3 source supported `insights`. Confidence intervals are required `confidence_level`, and shall not be renamed prediction interval or risk interval. Single-period missing can only set three values to `null`, and provide visible `missing_value_note`;Do not interpolate or complement 0. Thresholds may be omitted; when provided they must include numerical values, labels, and visible semantics and cannot be interpreted by default as statistical significance, risk, or causal bounds. Core sequence, interval definition, estimation method, sample/This module may not be forced to hit when the totality or source is missing.

## builder-prompt.md

Include, when applicable:

1. explicit instruction to produce exactly one slide;
2. audience task and page question;
3. central message and title;
4. primary relationship and exhibit;
5. data files and field-to-visual encoding;
6. supporting evidence and action area;
7. visible review marking and disclosure;
8. reading order and layout intent;
9. must include and must avoid;
10. unit, period, denominator, definition, and source notes.

Do not expose prompt history or internal ledgers. Do not paste large datasets into the prompt.

## Delivery status

For `PROMPT_ONLY`, `status=ready` means the handoff is ready for a compatible Builder.

For `PPT_DRAFT`, do not place a file in `delivery/` until the Builder produces exactly one slide and the required render checks pass. If rendering is blocked, keep `delivery/` absent and record `PPT_RENDERING_BLOCKED` in the validation report.

Validate in two stages:

```bash
python3 scripts/validate_package.py <run-directory> --stage handoff --write-report
python3 scripts/validate_package.py <run-directory> --stage final --write-report
```

The handoff stage validates the content package before rendering and permits `delivery/` to be absent. The final stage requires exactly one delivery PPTX with exactly one slide.
