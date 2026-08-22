# Changelog

## 1.9.2 — 2026-08-22

- Added a fully transparent native hit area to visually unfilled text shapes, preventing clicks in text-box whitespace from falling through to separate background frames.
- Preserved paragraph, run, mixed emphasis, shape order and visible formatting without rewriting font properties.
- Added structural, export and idempotence regressions for the text-object selection boundary.
- Added native PowerPoint object-selection plus font-size/font-weight save-and-reopen verification to the Builder acceptance boundary.

## 1.9.1 — 2026-08-21

- Added deterministic consumption of slide-spec `icon_handoff`, including field validation, semantic-role mapping, target binding and explicit unsupported or text-only fallback states.
- Prevented required visual markers from being silently omitted and preserved source concepts instead of rewriting them to match the icon library.
- Added item-level QA from source concept and route result through the actual SVG or text fallback embedded in the final PPTX.
- Added representative claim, issue-map and aligned-comparison regressions while keeping icons limited to semantic markers.

## 1.9.0 — 2026-08-21

- Declared slide-spec `effective_page_spec` as the direct upstream for complex-report pages.
- Added immutable OneDeck director-field checks and precise conflict returns.
- Assigned deck assembly and cross-page execution control to Deck Control while preserving the one-page run boundary.

## Maintenance cleanup — 2026-08-18

- Removed the obsolete positive-path test for the retired PowerPoint PNG exporter.
- Removed unreferenced legacy packaging, page-intent, and installation artifacts after isolated backup.
- Merged the legacy `slope-ranking` compatibility note into the canonical `bump-ranking` module and archived the obsolete historical regression note.
- Removed the unreachable standalone icon-relationship MVP renderer; the supported connector path remains in `semantic_relationship_connectors.mjs`.
- Removed the duplicate `powerpoint-contract.md`; active owners remain the public Skill, Builder engine, module contracts, and dedicated regression tests.
- Kept `POWERPOINT_NATIVE_PNG_RETIRED` as the explicit compatibility response and removed its retired test from the required package inventory.

## 1.8.1 — 2026-08-14

- 摘要段落图标与目录编号改为相对首行文字的光学中心对齐。
- 目录编号容器从标签有效字高的 1.2 倍增至 1.5 倍，保留默认 3pt 字号差。

## 1.7.2

- Retired Microsoft PowerPoint's direct `save as PNG` route because it can distort portrait OneSlide files.
- Replaced the former export implementation with a side-effect-free `POWERPOINT_NATIVE_PNG_RETIRED` response.
- Prohibited automatic PDF intermediates, third-party rendering, screenshots, or other image-export fallbacks until a separate route is explicitly designed and validated.

## 1.7.1

- Added semantic relationship curves for 2–6 large outline icons with clock-position floating endpoints and explicit visual gaps.
- Replaced tangent-stretched curves that looked like rounded polylines with continuously turning half-ellipse Bezier geometry controlled by `arcHeight`.
- Kept each curve and arrowhead as one native PowerPoint shape by writing `a:tailEnd` into the curve line properties; prohibited separate arrowhead triangles and default icon containers.

## 1.7.0

- Added a curated 195-icon Tabler SVG subset with bundled MIT license and reproducible generation from the official asset package.
- Added deterministic Chinese business-semantic retrieval across navigation, object, status, action and process-node roles; decorative, space-filling, business-emphasis and data-encoding roles return `NO_ICON`.
- Added optional `semantic_icon` handoff, Builder usage contract and regression tests. SVG icons are replaceable visual assets and are not required to be editable as native PowerPoint paths.

## 1.6.1

- Added deterministic one-slide PNG export through Microsoft PowerPoint's native `save as PNG` command.
- Prohibited PDF intermediates, third-party rendering and GUI coordinate automation for PowerPoint-to-PNG requests.
- Added output discovery for PowerPoint-selected filenames plus PNG signature, pixel-dimension and no-PDF validation gates.

## 1.6.0

- Added native PowerPoint canvas profiles for 16:9 presentations, 9:16 short-video B-roll and portrait 3:4 knowledge graphics.
- Made short-video and B-roll requests derive 9:16 without a ratio questionnaire; normalized “high 4, wide 3” to portrait 3:4.
- Prohibited crop, stretch, screenshots, embedded landscape pages and reuse of 1280×720 module coordinates in portrait modes.
- Added a vertical one-point renderer, portrait routing guard, canvas/package validation and native PPTX regression coverage.
- Tightened B-roll scope to one core claim, vertical stacking and phone-readable copy; wide or dense content returns scope overload instead of generating hidden extra pages.

## 1.5.1

- Classified visual differences as structural hierarchy, stable readability patterns, or source-grounded business emphasis.
- Standardized business emphasis as bold text plus highlight fill; border color, width, line style, and visibility remain unchanged.
- Added shared-edge rules and regression tests to prevent partial or doubled borders in adjacent containers.

## 1.4.6

- Added blocking checks for empty content containers and large uninterrupted blank bands.
- Required layout reflow whenever visible content is deleted, compressed, or moved into speaker notes.
- Prevented low-position decorative or action objects from masking unbalanced main content.

## 1.4.5

- Added one default body/notes allocation without new audience modes: visible slide copy carries the conclusion and primary evidence, while terminology, scope, formulas and methods move to native PowerPoint speaker notes.
- Restricted the visible footer to one `数据来源：...` line and merged synthetic-data disclosure into that source line.
- Added `PUBLIC_READABILITY_PASS`, terminology, visible-budget, source-only-footer and speaker-notes coverage checks.
- Migrated the first vertical MVP across `box-plot`, `confidence-band` and `marimekko`, including plain-language replacements for IQR, Bootstrap and CAGR.

## 1.4.4

- Corrected `chart-insight` with explicit comparable bar units, stable category/series IDs, a declared secondary-axis range, visible ratio values and exact insight-to-data anchors.
- Added R5 percentage range gates across workforce, mobility, service-catalog and ticket-intake inputs; the previously retired fixed survival module remains absent from the installed build.
- Retired `hr-ticket-classification` because aggregate category totals cannot prove origin-destination reclassification flow; use `sankey-flow` with a real confusion matrix or `hr-ticket-intake` for intake diagnostics.
- Retired `hr-eligibility-matrix` because its three-state grid encoded automation readiness rather than actual eligibility conditions and exceptions; use a source-backed general matrix or guarded direct composition.

## 1.4.3

- Added the productized `part-to-whole` module for a single positive total reconciled across 3–6 mutually exclusive non-negative parts.
- Added native editable PowerPoint pie and single-ring doughnut charts, exact-value angle calculation, stable external composition rows, source-backed doughnut center content, and optional inline or side-rail insights.
- Added Producer payload rules, relationship-first routing, multi-period and Marimekko scope guards, reconciliation/source/negative/count/ID failures, native-chart regression and a rendered reference page.

## 1.4.2

- Retired and removed `region-map-table` because map-like output creates avoidable political and boundary-expression risk.
- Retired and removed the decorative `spiral-maturity` module and the superseded fixed-format `hr-new-hire-survival` module; general retention work now uses `cohort-retention`.
- Upgraded `small-multiples` to 3–9 comparable panels with explicit metric, unit, shared scale, structured classification state, optional benchmark, and line or column views.
- Removed keyword-based color inference from visible classification text and added sparse, conflict, abnormal-state, scale, routing, rendering, and retirement regressions.

## 1.4.1

- Added deterministic compact peer-group layout for declared agenda, numbered-overview, and numbered-recap items.
- Added one-to-three-column navigation layouts for 2—18 declared peer items without ordinary-page bullet auto-detection.
- Added blocking checks for peer-group cohesion, sparse over-distribution, and vertical group balance.

## Component versions

| Component | Version | Source |
| --- | --- | --- |
| OneSlide suite | 1.8.1 | `SKILL.md` and `builder/references/module-registry.json` |
| Producer engine | 1.1.3 | `producer/ENGINE.md` |
| Builder engine | 3.6.1 | `builder/ENGINE.md` and the module registry |

## 1.4.0 — 2026-08-10

- Added Outline → OneSlide 1.0 page-contract compilation for one page at a time.
- Added `bookend-page`, `navigation-page`, and `section-transition` vertical modules.
- Added support for `cover`, `agenda`, `section_transition`, `numbered_overview`, `numbered_recap`, and `ending`.
- Added light, navy, and template-inheritance theme modes without semantic drift.
- Added blocking gates for undeclared components, missing required components, unauthorized peer emphasis, peer geometry, relative translation, short-label wrapping, template skeleton drift, theme drift, and callback failure.
- Preserved the native 8 pt bottom-right automatic slide number as report-level system chrome.

## 1.3.3 — 2026-08-10

- Added a PowerPoint-native automatic slide-number field to every generated page at the shared export boundary.
- Fixed the slide-number design at 8pt, right-aligned in the bottom-right page region, without asking users for an internal style field.
- Added the required placeholder and field to the slide master, layout and slide so the number follows page order instead of behaving like static text.
- Extended semantic QA to block missing, duplicate, non-automatic, wrongly sized or misplaced page numbers while preserving the 12pt minimum for ordinary visible content.
- Added export, idempotence, missing-number and native PowerPoint regression coverage. Public release and user acceptance remain separate.

## 1.3.2 — 2026-08-10

- Added the productized `reference-list` module for a single numbered list of 2–8 sources actually used by OneSlide.
- Added Producer compilation from one or more provenance ledgers, DOI/URL/work-level deduplication, first-use ordering and optional正文页回链.
- Excluded calculations, derived claims, synthetic content and ordinary prompt anchors from the visible reference list; missing citation metadata now blocks instead of being invented.
- Kept the page deliberately simple: one reading column, native editable text and separators, no cards, charts, icons, thumbnails or supplemental analysis.
- Added complete, sparse, missing, duplicate, overload, malformed-format, formal-handoff and route regressions. Public release and user acceptance remain separate.

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
- Added public license and attribution files for the release package.
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
