# OneSlide Module development work handover

Update time: 2026-08-08
Handover goal: Migrate the subsequent development of a large number of chart modules to the new workspace and continue to advance it.

## 1. Project positioning

OneSlide Not the whole set PPT automatic generator, but "first determine the information relationship and layout logic of a page, and then let AI Single-page consultation type for "Execution" PPT Tools.

Only one page is generated per run 16:9 PowerPoint, must satisfy:

- Source facts, figures, caliber and strength of conclusions are traceable;
- Charts, text, and shapes are PowerPoint Native editable objects;
- When there is insufficient information, only directional completion will be done, and the synthesis or content pending confirmation will be marked;
- Do not expand or change the scope of a single page due to new modules Producer source semantics or secretly generate multiple pages.

## 2. Current structure and responsibilities

```text
user material
  ↓
Producer
  - Target reader tasks, page questions, main relationships, and central conclusions
  - Establish source baselines and provenance
  - generate builder-prompt.md with builder-handoff.json
  ↓
Builder routing
  - Determine whether a formal module is hit
  - or enter direct_composition
  ↓
Builder module
  - validator: Enter contract and source access control
  - planner:Page space allocation
  - renderer: native PowerPoint object
  - QA: layout, rendering, editability and PowerPoint Check
```

Producer Not drawn PowerPoint, is not responsible for precise coordinates.Builder Do not re-determine page goals, do not rewrite user facts, and do not add new business content.

Main entrance:

- `SKILL.md`: unique user entrance;
- `producer/ENGINE.md`: Producer internal enforcement rules;
- `producer/references/output-contract.md`: Producer → Builder handover format;
- `builder/ENGINE.md`: Builder Execution and QA rules;
- `builder/references/module-registry.json`: Formal module registry, read by routing scripts.

## 3. completed bump-ranking Upgrade

`slope-ranking` Retired from official module registry, official module ID for `bump-ranking`. Old inputs remain compatible with transformations and old inputs are not deleted fixture.

Completed:

- support 2–8 an orderly period;
- support 5–12 object;
- Each object uses the same number of epochs `ranks`, `values`, `states` array;
- support `active`, `new`, `exited`, `not_ranked`;
- Prevent repeated rankings during the same period;
- Support two phases slope-style and more than three periods Bump Chart;
- update Producer Module selection and handover rules;
- Five new issues added, enter/Exits, duplicate rankings, and array length exceptions fixture;
- Real multi-issue references generated PPTX: `builder/assets/reference-pages/bump-ranking.pptx`.

Key documents:

- `builder/references/bump-ranking-module.md`
- `builder/scripts/validate_r3_module.mjs`
- `builder/scripts/plan_r3_module.mjs`
- `builder/scripts/render_r3_module.mjs`
- `builder/scripts/route_input.mjs`
- `builder/scripts/route_module.mjs`
- `producer/ENGINE.md`
- `producer/references/output-contract.md`
- `builder/references/information-structure-compiler.md`

Legacy compatible files:

- `builder/assets/test-fixtures/slope-ranking-valid.json`
- `builder/references/slope-ranking-module.md`

## 4. completed composition-shift slice lengthwise

`composition-shift` Already as the 34 formal module registration for 3–8 period,2–6 The multi-period proportion change of a stable component. it is related to `marimekko` The division of labor is clear: the former fixes the column width and answers how the structure changes; the latter uses the width to express the subdivision scale at the same time.

Completed:

- Producer Ability to identify multi-phase constituent relationships and generate complete, executable payload;
- `share` with `absolute` Two calibers, the absolute value mode simultaneously checks the denominator, total amount and proportion;
- The proportions of each period are forced to be equal to 100%, to prevent array misalignment and duplication ID, unknown key components and denominator conflicts;
- Natural language, explicit modules, complete input, sparse input, exception aggregation, and exception length testing;
- Native PowerPoint stacked rectangles, text, axes, and insight areas;
- Reference documents:`builder/assets/reference-pages/composition-shift.pptx`;
- Artifact Tool Rendering, overflow, native objects and Microsoft PowerPoint The actual open check passes.
- Used Case Factory Generate anonymous income structure cases without module names and chart names;OneSlide Now available 3–8 period,2–6 stable components, period-by-period breakdowns and total balances, and “structural/constitute/Proportion/Combination" related words, automatic recognition `composition-shift`; General multi-series trends lacking total amounts will not be misjudged.
- This representative case has been traversed from original input to one page PPT, and through data leveling, source mapping, rendering, overflow, native objects and Microsoft PowerPoint Actual machine inspection.

Key documents:

- `builder/references/composition-shift-module.md`
- `builder/assets/test-fixtures/composition-shift-valid.json`
- `builder/assets/test-fixtures/composition-shift-bad-total.json`
- `builder/assets/test-fixtures/composition-shift-length-mismatch.json`
- `builder/tests/composition_shift_contracts.test.mjs`

## 4.1 completed cohort-retention slice lengthwise

`cohort-retention` Already as the 35 formal module registration for 3–8 joining, onboarding, customer acquisition or first activation batch in 4–12 Retention or survival comparison over a relative period. It explicitly retains the initial base, number of people/Proportion, denominator, unit, period and immature tail period, and with fixed four groups,0–24 monthly, industry benchmark plus risk matrix `hr-new-hire-survival` Maintain business boundaries.

Completed:

- Case Factory Anonymous natural language cases do not appear in module names and chart names, and can still automatically identify batches, relative periods, early churn and immature tail relationships;
- Producer Synchronously add complete executable payload rules,`requested_module`, `structure.primary_exhibit` with `module_payload.module_id` Alignment;
- independent reference, validator, planner, renderer, official registration form and reference PPTX;
- Complete number of people, proportion only, lack of initial base, number of number ratio conflicts, survival recovery, current retention recovery, non-tail null value, non-blocking style missing and damage JSON test;
- One page natively editable PPTX; Semantic, layout, overflow and object audit passed;Microsoft PowerPoint actually opened as 1/1 page,92 a native shape, 0 picture object;
- Current return:Producer 18/18, Builder 90/90, module special 10/10.

Key documents:

- `builder/references/cohort-retention-module.md`
- `builder/scripts/validate_cohort_retention.mjs`
- `builder/scripts/plan_cohort_retention.mjs`
- `builder/scripts/render_cohort_retention.mjs`
- `builder/assets/test-fixtures/cohort-retention-valid.json`
- `builder/tests/cohort_retention_contracts.test.mjs`
- `builder/assets/reference-pages/cohort-retention.pptx`

## 5. Producer with Builder module handover rules

### histogram slice lengthwise

`histogram` Already as the 35 A formal module registration for distribution analysis of a continuous numerical indicator over a defined period. The module retains original observations and explicit missing values, recalculates strictly increasing explicit binning boundaries, and simultaneously presents samples, units, denominators, periods, and frequencies/Frequency aperture; categorical histograms will not hit this module.

Adding a new module cannot just change Builder. As long as the module requires Producer Generate executable payload, it must be completed at the same time:

1. Producer Be able to identify this information relationship instead of just identifying the module name;
2. Producer reference/ENGINE Be able to describe field, period, unit, status and source requirements;
3. `builder-handoff.json` in `requested_module`, `structure.primary_exhibit` and `module_payload.module_id` completely consistent;
4. `module_payload` is complete and passable validator Input, semi-finished products with only module names are not accepted;
5. Builder Still the final gatekeeper to module fields and visuals;
6. If a module cannot cover all the required content on the page, all three module fields are omitted and enter `direct_composition`, the module must not be shoehorned into the module.

Taking ranking migration as an example, the new Producer payload Should be used:

```json
{
  "module_id": "bump-ranking",
  "diagram": {
    "periods": [],
    "objects": [
      {
        "ranks": [],
        "values": [],
        "states": []
      }
    ]
  }
}
```

Don't generate old ones for new tasks `left_period`, `right_period`, `left_rank`, `right_rank` field.

## 6. Minimum vertical slice of new module

Each new module must complete one real available link at a time, rather than just submitting renderer:

```text
true/representative input
  → Producer handover rules
  → route_input / route_v3
  → module reference
  → validator
  → planner
  → renderer
  → reference PPTX
  → complete fixture with exception fixture
  → Rendering, overflow, native objects and editability checks
```

At least add:

- one `builder/references/<module>-module.md`;
- an official registry entry;
- validator, planner, renderer;
- a complete fixture;
- one or more exceptions fixture;
- Routing regression testing;
- Reference PPTX;
- Producer Handover rules or clear explanation of why only leave `direct_composition`.

Don’t pile up the underlying components in batches first and then wait for the final unified access. The first module must be able to run from a representative input to a user-visible page PPT.

## 7. Questions a module contract should answer

Write clearly before development:

- Which reader question does this picture answer?
- What is the primary relationship: comparison, trend, migration, composition, flow, cause and effect, process or spatial distribution?
- What are the minimum fields required? What are the units, period, denominator and caliber of the field?
- Which fields must be source traceable? What can be calculated? Which ones can only be used as synthetic examples?
- When data is missing, is it blocking, directional completion, or entry? direct composition?
- Which states must be expressed explicitly and cannot be guessed by color or position?
- Which content on a page is the main image and which is 0–3 supporting evidence, which are 0–1 action/Conditional area?
- What do users really need to edit: text, numbers, lines, nodes, tables, or data relationships?

## 8. Acceptance of access control

Must be reported separately and not combined:

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
REQUIREMENT_COVERAGE_PASS
RENDERED_READABILITY_PASS
POWERPOINT_OPEN_CHECK
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

Recommended verification sequence:

```bash
# OneSlide / Producer contract
python3 -m unittest discover -s tests -v

# Builder module regression
node --test builder/tests/bump_ranking_contracts.test.mjs
node --test builder/tests/*.test.mjs

# Generate a module PPTX after
python3 <presentations-skill>/container_tools/slides_test.py <file.pptx>
```

File exists, script runs,ZIP complete or layout JSON Neither can alone prove that user requirements have been met. Still ultimately check the actual rendering and PowerPoint Native editability.

## 9. Current known status

- Producer Contract test:18/18 pass;
- bump-ranking Related tests:22/22 pass;
- Builder Full test: use bundled `@oai/artifact-tool` run 80/80 pass;
- bump-ranking Already used bundled `@oai/artifact-tool` Successfully generated PPTX;
- bump-ranking The layout audit and overflow check passed;
- PPTX Internal confirmation uses native text boxes, ovals, lines and rectangles, no full page images;
- bump-ranking Already in Microsoft PowerPoint Actual open in, confirm 1/1 Pages and windows are rendered and exposed normally 94 An independently editable layout object;
- composition-shift of validator, planner, routing, exception input, rendering and overflow tests passed; reference PPTX in Microsoft PowerPoint Actual open in, confirm 1/1 page,60 original shape,0 picture object;
- Case Factory Representative run package passed handoff/final contract, generated page PPT in Microsoft PowerPoint Confirm in 1/1 page,120 independently selectable native layout objects,0 picture object;
- Producer suite test 18/18 Passed, the release source directory verification passed;`PRODUCT_VALUE_PASS: pass`(representative Case Factory task); previously composition-shift The module results have been accepted by the user.`USER_REQUIREMENT_PASS: pass`. The newly generated specific case page this time still needs to be recorded separately from the module acceptance, which is currently `not_tested`.

## 10. Recommended startup sequence for new workspaces

1. Incorporate this handover document and the entire `one-slide-github-public` The working tree serves as the initial context;
2. Run first Producer contract testing and Builder registry/fixture test;
3. First select a module with high value, clear fields, and can be completed on one page for vertical slicing;
4. Write for this module at the same time Producer handover rules and Builder module contract;
5. Compose with real or anonymous fixture Generate a page PPTX;
6. Check rendering, overflow, editability and PowerPoint open results;
7. Only after the module passes, the shared base required by at least two modules will be extracted;
8. Each time a module is completed, write back the module registry,CHANGELOG and the status of this handover document.

## 11. things not to do

- don't put ECharts The example is copied directly into OneSlide As a static diagram; it can only be used as a reference for graphic research;
- Don't just add Builder renderer without updating Producer handover rules;
- Don’t cram all your charts into one catch-all module;
- Don’t add decorative cards just to fill the page;
- Don’t write synthetic data as real customer facts;
- Do not delete old modules until they are no longer compatible with existing running packages;
- Do not pass the technical link by pretending to be a user.

## 12. Work tree reminder during migration

`builder/scripts/plan_r4_module.mjs` of Sankey SLA Modifications to the bottom description area have been independently submitted as `123586f`, not mixed in bump-ranking or composition-shift.bump-ranking Baseline submission is `bbdab2b`. Subsequent modules continue to maintain the independent submission boundary of "one module, one complete vertical slice".

## 13. box-plot slice lengthwise

`box-plot` Already as the 35 Register a formal module for the same indicator, period, unit and statistical caliber 3–8 Comparison of distributions across groups.Producer Valid sample size, missing number,Q1, median,Q3, upper and lower whiskers, point-by-point outliers, and the quartile algorithm and whisker rules visible on the page.Builder Using native rectangles, lines, ellipses, and text, outliers display both markers and values that cannot be expressed with just color.

Key documents:

- `builder/references/box-plot-module.md`
- `builder/assets/test-fixtures/box-plot-valid.json`
- `builder/assets/test-fixtures/box-plot-missing-method.json`
- `builder/assets/test-fixtures/box-plot-invalid-outlier.json`
- `builder/tests/box_plot_contracts.test.mjs`

## 14. correlation-matrix slice lengthwise

`correlation-matrix` Already as the 39 formal module registration for use in 4–10 Identify the strongest positive correlation, the strongest negative correlation and the weakest relationship among the indicators, and screen subsequent key variable combinations.Producer Deliverable symmetry NxN Square matrix of coefficients, or recomputable aligned raw observations;Builder Verification Pearson/Spearman, sample size, missing value handling, period, population, source, display threshold, coefficient range, diagonal, symmetry, dimensionality and label uniqueness.

The page uses native PowerPoint Square cells and text express relationships through row and column positions, signed values, and divergent colors; three categories of candidates are listed on the right, and the statement "correlation does not mean causation" can be seen. Representative anonymous synthesis case from no module name/Natural language input of chart names through to formal Producer handoff with one page PPTX. Current verification:Producer 19/19, Builder 129/129, module special 11/11;Semantics, layout, overflow,0 picture objects and Microsoft PowerPoint 1/1 Page opens and checks passed.`PRODUCT_VALUE_PASS` Based on representative task evaluation only,`USER_REQUIREMENT_PASS` still `not_tested`.

Key documents:

- `builder/references/correlation-matrix-module.md`
- `builder/scripts/validate_correlation_matrix.mjs`
- `builder/scripts/plan_correlation_matrix.mjs`
- `builder/scripts/render_correlation_matrix.mjs`
- `builder/assets/test-fixtures/correlation-matrix-valid.json`
- `builder/tests/correlation_matrix_contracts.test.mjs`
- `builder/assets/reference-pages/correlation-matrix.pptx`

## 15. scatter-regression slice lengthwise

`scatter-regression` As the first 40 A formal module for direction, linear strength, deviation from trend observations and interpretable boundary judgments of two continuous variables in the same unambiguous sample.V1 Only supports one-variable ordinary least squares fitting with intercept, retaining item-by-item x/y Original observations, two-axis units, sample definition, period, population, source, and missing/Repeat/Exception handling rules.Builder Complex calculation of slope, intercept and R², rejects insufficient valid pairings and zero variance on either axis, does not write associations as cause and effect, and does not generate unsourced significance conclusions.

Key documents:

- `builder/references/scatter-regression-module.md`
- `builder/scripts/validate_scatter_regression.mjs`
- `builder/scripts/plan_scatter_regression.mjs`
- `builder/scripts/render_scatter_regression.mjs`
- `builder/assets/test-fixtures/scatter-regression-valid.json`
- `builder/tests/scatter_regression_contracts.test.mjs`
- `builder/assets/reference-pages/scatter-regression.pptx`

## 16. confidence-band slice lengthwise

`confidence-band` As the first 41 a formal module for 5–12 Compare center estimates to range widths over orderly periods, identifying periods when uncertainty widens, narrows, crosses business thresholds, or becomes directional.Producer Reserve estimate/lower/upper, interval types and definitions, estimation methods, samples/Population, source, missing value and threshold semantics;Builder Use native polylines, dots, semi-transparent segmented polygons, and dashed thresholds, and do not rename confidence intervals as prediction intervals or risk intervals.

Key documents:

- `builder/references/confidence-band-module.md`
- `builder/scripts/validate_confidence_band.mjs`
- `builder/scripts/plan_confidence_band.mjs`
- `builder/scripts/render_confidence_band.mjs`
- `builder/tests/confidence_band_contracts.test.mjs`
