# Ranking Migration Graph Module (Bump Chart)

Applicable:5–12 objects in 2–8 Ranking migration at an ordered time point. Classics presented at two points in time slope chart, presented at three or more time points Bump Chart.

Required input: ordered time points, object name, ranking slot at each time point, object source; the object can optionally provide the value of each time point. Ranking available `states` clearly marked as `active`, `new`, `exited` or `not_ranked`.

Compatible input: legacy version `slope-ranking` of `left_period`, `right_period`, `left_rank`, `right_rank`, `left_value` and `right_value` will be converted to the new version on load `periods`, `ranks` and `values`.

Blocking: The time point is less than 2 one or more 8 , objects less than 5 one or more 12 , the array length of each object is inconsistent with the time point, the ranking at the same time point is repeated, the active object lacks a positive integer ranking, exit/Stop when the unlisted objects still have rankings or numerical values. Reasons may not be added based on ranking changes; reasons must be sourced.

Visual rules:

- Use the same ranking axis at each time point; ranking 1 Located above.
- Lines, nodes, labels, and values all use PowerPoint Native object, no image is needed to carry the main image.
- Priority objects can be bolded in brand orange or blue; other objects remain neutral, and color cannot be used to replace unprovided business meaning.
- Newly entered or exited objects are represented by explicit states and broken line segments, and missing data are not drawn as zeros.
- Only click the object label and value when the first and last ones are valid to avoid the middle label wall.

Acceptance: Run `validate_r3_module.mjs`, `plan_r3_module.mjs` and `render_r3_module.mjs`; Covering at least two phases of compatibility, five phases of migration and new entry/Exit three cases and check PowerPoint Native objects and page readability.

