# Waterfall Attribution Module

## Applicable

The user provides the starting point, end point, and incremental values, and needs to explain how the differences are formed. The module accepts structured data or mixed text and data input.

## Data access control

- `starting point + All additions and subtractions = end point`, returns if the explicit tolerance is exceeded `WATERFALL_RECONCILIATION_FAIL`.
- Added or subtracted labeling, grouping, controllability, insights, and conclusions must come from the original text or data fields.
- Missing items are not deduced based on the results, and unprovided differences are not automatically classified as "others".
- Stop formal generation when unit, exchange rate, period and one-time item caliber conflict.

## input structure

`module_id` for `waterfall-attribution`; `diagram.type` for `waterfall`. contains `start`, items two to seven `contributions`, `end`, units and optional insights, bottom conclusion, source footnotes. Used when the user requests a source description `diagram.footnotes`, it is not allowed to switch to free layout because the main image module lacks a footer.

run `validate_waterfall.mjs`, `plan_waterfall.mjs` and `render_waterfall.mjs`, and execute PowerPoint Export contract.
