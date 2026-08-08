# Multi-phase composition change module

Applicable: Answers "What parts does a whole consist of, and how does the composition change over time?" formal module ID for `composition-shift`, `diagram.type` Must have the same name. it uses 100% stacked column expression 3–8 an ordered period and 2–6 A stable component, which does not deal with the horizontal width but also represents the scale. Marimekko, nor does it replace general trend charts.

## Enter the contract

- `periods`: 3–8 an orderly period, each period is with `source_ids` visible text;
- `components`: 2–6 components,`id` Unique, containing label, equal to period `shares`, and what constitutes the data `source_ids`;
- `basis`: `share` or `absolute`;
- `denominator`: Clarify the denominator and statistical caliber;
- `unit`: The unit of absolute value mode, the pure percentage mode still indicates the percentage caliber;
- `insights`: 1–3 Bars can be anchored to data insights;
- Optional `focus_component_id`, `conclusion` and synthetic data `disclosure`.

when `basis=absolute` , each component must also provide a period equal to the `values`, and provide each issue `totals` and `total_source_ids`. The sum of the absolute values of each component must equal the current total,`share` Must be calculated from the same denominator and consistent with the absolute value.

## access control

- The total proportion of each period must be 100%, the tolerance does not exceed 0.05 percentage points;
- Negative numbers, inconsistent array lengths, and repeated formations are not accepted. ID, unknown key components or missing denominator;
- New, exiting or missing components must be explicitly represented in the source data as 0 or independent status, no guessing based on color is allowed;
- Source conflict, denominator inconsistency or absolute value cannot be returned to normal `COMPOSITION_RECONCILIATION_FAIL`, it is not allowed to make up for the difference;
- If the same page must also express different widths of market size, a second independent main image, or more than three supporting topics, omit the Modules field and enter `direct_composition` Or return a single page range overload.

## Pages and editability

The main image is a native rectangular stacked column, text label, axis line and grid line; there are up to three insights supported by sources on the right side and up to one conclusion at the bottom. Users can PowerPoint Edit period, component name, proportion, absolute value, column, color and insight text. Synthetic data must display "Synthetic example data, not real customer data" near the main image.

Acceptance: complete proportion case, absolute value equalization case, proportion not equal to 100%, array length anomalies, sparse natural language routing, and missing style fields must all be tested; generate reference PPTX Post-check rendering, overflow, native objects and Microsoft PowerPoint Open the result.
