# Changelog

## Unreleased — chart module upgrades

- Upgraded the public rank-migration module from the two-period `slope-ranking` contract to the multi-period `bump-ranking` contract.
- Added explicit period arrays, rank/value/state tracks, new-entry and exit handling, duplicate-rank blocking, and source-fidelity fixtures.
- Kept legacy `slope-ranking` inputs and routing aliases compatible while the upgraded module becomes the canonical productized ID.
- Added five-period and entry/exit regression fixtures and a rendered multi-period `bump-ranking.pptx` reference asset; artifact-tool rendering, overflow checks, and native-shape editability checks pass. Microsoft PowerPoint application review remains environment-blocked.
- Added the productized `composition-shift` module for 3–8 periods and 2–6 stable components, with strict 100% reconciliation, optional absolute-value denominator checks, Producer handoff rules, routing regressions, abnormal fixtures, and a native-editable reference page.

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
