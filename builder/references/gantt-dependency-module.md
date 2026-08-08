# Gantt dependency

- Used for:2–6 swimming lanes,8–20 tasks,1–18 Project review for time scale slots; supports both ordinary months and `T0`, `T+N` Relative time scale.
- Not used for: task lists without start and end slots, swim lanes or verifiable time relationships; implementation preconditions without endpoints can only be entered into the description area and cannot be forged. Gantt side.

## B level input contract

| input | degree | acceptance form | Missing or conflict handling | where the process goes |
| --- | --- | --- | --- | --- |
| `lanes` | required | 2–6 swimlane object with source | When the task is missing, duplicated or refers to an unknown swim lane `DATA_CONTRACT_FAIL` | validator → swim lane layout |
| `tasks` | required | 8–20 item; including unique id, sourced tags/person in charge,lane, start/end, progress, critical | Stop on endpoint, scope, progress or reference conflicts, no guessing | validator → planner row height/time scale → renderer Task bar |
| `month_label_map` | optional | slot string key to `T0`/`T+N`;Both keys and values are strictly increasing | If missing, keep the ordinary month; if the format is abnormal or conflicts with the task scope `GANTT_TIME_SCALE_FAIL` | validator → planner `time_axis` → renderer time scale |
| `dependencies` | conditional | `from`, `to`;may contain `relationship_class` with `not_a_prerequisite` | When classification is missing, it will be handled as a necessary historical dependency;`time_order_only` must be both `not_a_prerequisite=true`, reverse or conflict semantics stop | validator → planner normalization → renderer Two sets of line types |
| Stage level | optional | `layer_steps`, or `side_metrics` in “stage level;T0for11layer,T+2for10layer,T+6for9layer" | If there is no such information, it will not be drawn; if there is information but the time does not increase, the level does not decrease step by step, or the time scale is not within the axis `GANTT_LAYER_STEP_FAIL` | validator → planner `layer_steps` → renderer step line |
| `milestones`, `side_metrics`, `conclusion` | optional | source object | Reduce support area if not provided; stop on wrong month or source conflict | validator → planner → renderer support area |

The reading order is fixed to `READ_CONTEXT → DERIVE_IF_STABLE → USE_DECLARED_DEFAULT → DEGRADE_SCOPE → STOP`. Relative time scales, relational classifications, and hierarchical sequences, once provided, may not be downgraded to ordinary months, uniform "dependency lines", or ordinary descriptive text.

## visual semantics

- `time_order_only + not_a_prerequisite=true`: High-contrast gray dotted line, no arrow; line must be above the main frame and below the task bar, in full-page preview and PowerPoint Clearly visible in regular view; only shown in chronological order.
- Historical uncategorized relationships or `prerequisite`: Blue solid elbow-shaped arrow; indicates necessary dependencies.
- The two relationships are validator, planner and renderer The same normalized result is used instead of copywriting guessing.
- The stage level is drawn using native polylines and nodes under the main diagram;`11→10→9` must be aligned with the relative timeline.
- The output retains swim lane shading, task bars, progress and owners, native connectors, milestones, and support areas.

## QA

- Dependency endpoints are consistent with chronology; pure chronology has no arrows and is not called a requirement.
- `T0/T+N` Remains the source time scale after rendering; may not be automatically overwritten to a normal month.
- Hierarchical ladder nodes, tasks, timescales, and right columns do not overflow; connectors, text, and ladder lines remain natively editable.
- OOXML The presence of connectors in cannot individually prove readability; the four chronological lines must be used in full-page previews and PowerPoint Visible item by item in regular view.
- Milestone labels, relationship legends, and time scale descriptions all belong to the Gantt text and may not enter the safe area of the page title. The main Gantt frame, all floating annotations, support areas, and sources must be moved down as a vertical frame while there is still space below.
