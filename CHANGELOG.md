# Changelog

## Component versions

| Component | Version | Source |
| --- | --- | --- |
| OneSlide suite | 1.4.0 | `SKILL.md` and `builder/references/module-registry.json` |
| Producer engine | 1.1.2 | `producer/ENGINE.md` |
| Builder engine | 3.3.7 | `builder/ENGINE.md` and the module registry |

- Corrected `chart-insight` by requiring explicit comparable bar units, stable category/series IDs, a declared secondary-axis range, visible ratio values, and source-backed insight anchors to exact data points instead of renderer-guessed connectors.
- Added R5 percentage range gates (`0–100`) and closed enum gates for three-level risk scores, with regressions across workforce, survival, mobility, service-catalog and ticket-intake modules.
- Retired `hr-ticket-classification`: aggregate before/after category totals cannot support a truthful reclassification flow without an origin-destination confusion matrix; use `sankey-flow` when real flows exist or `hr-ticket-intake` for intake diagnostics.
- Retired `hr-eligibility-matrix`: the implementation encoded automation/readiness states rather than actual eligibility conditions and exceptions; use a source-backed matrix or guarded direct composition.
- Added the productized `part-to-whole` module for one-period, one-total composition across 3–6 reconciled non-negative parts, with native editable pie and single-ring doughnut charts.
- Added relationship-first routing, Producer payload rules, source-backed doughnut center content, percentage calculation from exact values, strict reconciliation and scope guards against trends, multi-object comparison, negative values and excess categories.
- Upgraded `marimekko` with an `absolute` layout mode for non-100% unequal-width and unequal-height columns: widths use segment `total_value`, stack heights use absolute `value`, and every column must reconcile to its total.
- Preserved the legacy `normalized` 100%-height mode and added Producer handoff rules, absolute-value fixtures, reconciliation failures, native rendering, overflow checks, and editable-shape regression coverage.

## 1.4.0 — 2026-08-09

- Reworked the unreleased post-build concept into a read-only Editorial QA gate: protect strong pages, return at most one high-value Builder brief, and require Builder to own every PPTX change.
- Added a six-dimension editorial rubric covering visual subject, title-evidence linkage, evidence-adjacent annotation, semantic emphasis, reading rhythm, and information contribution.
- Added source-hash-locked patch operations, B-level input handling, no-material-edit behavior, native editability and semantic-token verification, and a full editorial run contract.
- Added a single information-contribution gate for all visible slide and template objects.
- Blocked decorative top bands, title eyebrows/kickers/overlines, heading rules, title accents, empty decorative strips, filler objects, and other aesthetic-only components.
- Removed the former heading-safe-zone exemption for heading rules and title accents, while preserving data encodings, relationship lines, axes, necessary grouping containers, provenance, and explicitly required identity marks.

## 1.3.1 — 2026-08-10

- Reduced mandatory startup reading to the input and single-slide contracts; provenance, packaging, degradation and rendering instructions now load only when their stage begins.
- Removed duplicated statistical-module rules from the public Skill entry while preserving the full Producer and module contracts.
- Standardized documented commands on the top-level OneSlide Skill directory and made final-stage validation explicit.
- Replaced the ambiguous Builder registry field `skill_version` with separate suite and Builder engine versions, plus a suite-version consistency gate.
- Blocked structured handoffs that request a productized module without a complete `module_payload`, while preserving direct module requests from raw natural-language input.
- Added regression coverage for the structured-handoff gate, raw-input compatibility, component versions and prohibited GitHub attribution.

## 1.3.0 — 2026-08-09

- Added the productized `correlation-matrix` module for 4–10 metrics, accepting a validated symmetric coefficient matrix or reproducible aligned observations with Pearson/Spearman, sample, missing-value, period, population, source and threshold metadata.
- Added anonymous relationship-first routing, coefficient range/diagonal/symmetry/dimension/label gates, three-channel position-number-color encoding, visible non-causality language, native editable rendering and PowerPoint open evidence.
- Added the productized `scatter-regression` module for paired continuous observations, with relationship-first routing, explicit x/y units and scope, OLS slope/intercept/R² reconciliation, pairwise-missing and duplicate handling, residual-ranked labelled exceptions, native editable PowerPoint objects, and a visible non-causal interpretation boundary.
- Added the productized `confidence-band` module for 5–12 ordered estimates with editable interval polygons, explicit interval semantics, methods, sample/population scope, missing-value handling and optional threshold meaning.
- Added anonymous relationship-first routing, Producer handoff rules, complete/sparse/missing/conflict/abnormal-format tests, and safeguards against relabelling confidence intervals as prediction or risk intervals.
- Added the productized `cohort-retention` module for 3–8 cohorts across 4–12 aligned relative periods, with explicit initial bases, counts/rates reconciliation, survival versus period-retention semantics, and trailing censoring that never converts unobserved periods to zero.
- Added relationship-first routing from anonymous natural language and aligned cohort arrays, while preserving the narrower `hr-new-hire-survival` module for its fixed 0–24 month benchmark-and-risk-matrix page.
- Added Producer handoff rules, complete/sparse/conflict/missing/censoring/abnormal-format fixtures, native-editable rendering, registry coverage, and PowerPoint QA hooks.

- Added the productized `box-plot` module for 3–8 comparable groups, with explicit sample size, missing count, period, unit, denominator, Type 7 quartiles, 1.5×IQR whiskers, labelled outliers, Producer handoff rules, natural-language routing, abnormal fixtures, and native-editable rendering.
- Added the productized `box-plot-jitter` module for 2–6 groups and up to 240 raw observations, with Tukey hinges, 1.5×IQR whiskers, explicit sample sizes, native editable observation points, deterministic visual-only jitter, Producer handoff rules, natural-language routing and abnormal-input fixtures.

- Upgraded the public rank-migration module from the two-period `slope-ranking` contract to the multi-period `bump-ranking` contract.
- Added explicit period arrays, rank/value/state tracks, new-entry and exit handling, duplicate-rank blocking, and source-fidelity fixtures.
- Kept legacy `slope-ranking` inputs and routing aliases compatible while the upgraded module becomes the canonical productized ID.
- Added five-period and entry/exit regression fixtures and a rendered multi-period `bump-ranking.pptx` reference asset; artifact-tool rendering, overflow checks, and native-shape editability checks pass. Microsoft PowerPoint application review remains environment-blocked.
- Added the productized `composition-shift` module for 3–8 periods and 2–6 stable components, with strict 100% reconciliation, optional absolute-value denominator checks, Producer handoff rules, routing regressions, abnormal fixtures, and a native-editable reference page.
- Added guarded inference for generic reconciled multi-period component series with totals, so source material can route to `composition-shift` without naming a module or chart; parallel trend series without totals remain blocked from this route.
- Completed a Case Factory end-to-end representative run from no-module-hint input to a one-slide native-editable PowerPoint, including full regression, package, semantic, overflow, and Microsoft PowerPoint checks.
- Added the productized `histogram` module for one continuous numeric metric and period, preserving raw observations, units, denominator, total/valid/missing sample counts, explicit reproducible bin edges, count/frequency basis, and source-backed distribution findings.
- Added no-module-name/no-chart-name routing from continuous observations plus concentration/skew/tail language, while blocking categorical values, missing observations, unit/period conflicts, abnormal numeric strings, unreconciled samples, and irreproducible bins.
- Added a native-editable one-page reference with adjacent PowerPoint rectangles, source notes, 11 module contract tests, full Builder and Producer regression, overflow/semantic/media audits, and Microsoft PowerPoint 1/1-slide open evidence.

## 1.2.2 — 2026-08-08

- Replaced Sankey straight-line strokes with closed native Bezier ribbon shapes whose thickness is proportional to flow value.
- Changed Sankey nodes to square, borderless native rectangles so ribbons meet node edges without white gaps.
- Added deterministic ribbon stacking, proportional node geometry, editable OOXML regression checks, and PowerPoint render coverage.

## 1.2.1 release candidate — 2026-08-07

- Added blocking organization-chart gates for peer-row alignment, one-child vertical reporting lines, and unambiguous functional-guidance routing.
- Added a balanced layout for flat three-level organizations so equal-depth branches no longer create an arbitrary dense left rail.
- Routed dashed guidance from a lower shared source through the open lower corridor and into target bottoms.
- Made locked-rail normalization accept already-detached native connectors while still requiring complete geometry.
- Added a real 11-node regression fixture matching the reported layout failure.

## 1.2.0 — 2026-08-07

- Renamed the public product and Skill entry from Single Consulting Slide Suite to OneSlide (`one-slide`).
- Added author attribution for 周俊东 Marco and a stable contact route.
- Licensed Skill instructions, engines, scripts, configuration, and tests under Apache License 2.0.
- Licensed original documentation, tutorials, example inputs, example outputs, and owned reference slides under CC BY 4.0.
- Added `NOTICE`, content-license scope, trademark boundary, author information, and a five-part public release kit.
- Kept the one-slide generation logic and layout gates unchanged from 1.1.2.

## 1.1.2 release candidate — 2026-08-07

- Added a blocking title safe-zone audit for all body objects, including floating legends, milestone labels, annotations, and data labels outside the main exhibit frame.
- Added a specific failure for pages that crowd the heading while leaving at least 56 px of unused space at the bottom.
- Required complex Gantt layouts to move the main frame, floating annotations, support band, and source footer as one vertical system.

## 1.1.1 release candidate — 2026-08-07

- Added a page-heading component and a blocking rule that removes or rejects subtitles below rendered two-line titles.
- Added declared cross-section edge-alignment contracts with a 2 px tolerance.
- Fixed the advanced route comparison regression so the table, conclusion band, and action panel share one content frame.

## 1.1.0 release candidate — 2026-08-07

- Added layout-level blocking checks for wrapped short labels, orphan lines, split provenance tokens, punctuation stranded at line starts, number-unit splits, canvas underuse, and out-of-canvas elements.
- Standardized text insets and explicit wrapping behavior in the PowerPoint core.
- Added single-line index badges and a measured action-band primitive.
- Standardized reader-visible synthetic labels to Chinese while retaining English provenance keys internally.
- Clarified the 1280×720 px coordinate contract and aligned conflicting typography rules.

## 1.0.0 release candidate — 2026-08-07

- Added one public Skill entry for prompt-only and PPT-draft modes.
- Embedded the Producer and Builder as internal engines.
- Preserved the exactly-one-slide boundary and low-burden intake.
- Added controlled synthetic completion and item-level provenance.
- Added environment, package, portability, and nested-entry validation.
- Kept public license readiness blocked pending owner choice.
