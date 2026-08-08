# Group retention and survival curve module

Applicable: Compare the retention or survival changes of multiple joining, onboarding, customer acquisition or first-time subscription batches on the same set of relative periods, and identify early churn, batch differences and abnormal turning points. formal module ID for `cohort-retention`, `diagram.type` Must have the same name.

## Boundaries with existing modules

- This module supports 3–8 a cohort, 4–12 Relative periods, different maturities and tail unobserved periods;
- `curve_mode=survival` It means "still exists as of this period", the value must be non-increasing;
- `curve_mode=period_retention` It means "the cycle is still active" and a real rebound is allowed, but the unobserved period is not allowed to be filled in 0;
- `hr-new-hire-survival` Continue to undertake the four fixed tasks,0–24 The narrow-caliber pages of monthly, industry benchmarks and risk factor matrices will not be replaced by this module;
- If the page also requires a separate reason matrix, channel attribution, or a second main image, omit the module field and enter `direct_composition`, or return a single page range overload.

## Enter the contract

- `relative_periods`: 4–12 a strictly increasing relative period, each containing a value, a visible label, and `source_ids`;
- `relative_period_unit`: Relative period units such as week, month, quarter, etc.;
- `cohort_definition`: cohort rules of formation;
- `denominator`: Initial base and retained denominator diameter;
- `measure`: Definition of retention number or proportion;
- `curve_mode`: `survival` or `period_retention`;
- `cohorts`: 3–8 batches,`id` Unique, contains label, positive integer `initial_count`, and the same length as the relative period `retained_counts`, `retention_rates` At least one of the two;
- `insights`: 1–3 Insights backed by data;
- `source_note`: Source, period or data description visible on the page;
- Optional `conclusion`, `disclosure` and `censoring_note`.

Producer Users should not be asked to fill in the number of people and proportions repeatedly. If only the number of people is provided, press `Number of people ÷ initial base` Calculate the scale; when only the scale is provided, press `Proportion × initial base` Count impressions. Both must be aligned when provided.

## Missing, censored and conflicting access control

- relative period 0 The number of people must be equal to the initial base number, and the proportion must be equal to 100%;
- Immature or unobserved cycles use tail continuation `null`, must not be written as 0; Appear `null` Returns when another numerical value appears later `CENSORING_CONTRACT_FAIL`;
- There is a tail `null` must be provided when visible `censoring_note`, explicitly whitespace is not 0;
- `survival` Return when the curve picks up `SURVIVAL_CURVE_FAIL`; `period_retention` It can rebound, but the number and proportion must still be equal;
- Number of people cannot be negative, exceed the initial base, or use decimals; the scale range is 0–100;
- The difference in number and proportion exceeds 0.6 person or 0.2 percentage points returned `COHORT_RECONCILIATION_FAIL`;
- The formal module is blocked when the initial base, denominator, relative period unit, source or curve caliber is missing, without relying on layout guessing.

## Pages and editability

The main image is native PowerPoint Line segments, dots, axes, grid lines and text. each cohort Displays the batch name, initial base, and latest observed period; the curve stops at the last observed point. There are up to three data insights on the right side, and it is clear that "Immature/Unobserved is blank, not 0". Bottom retains source, caliber and synthetic case disclosures.

Acceptance covers at least: complete headcount input, scale input only, sparse natural language routing, missing initial cardinality, headcount and scale conflicts, curve pick-up, non-tail nulls, immature tail periods, non-blocking style missing and exceptions JSON format. generate PPTX Check the next page 16:9, rendering, overflow,0 Picture objects, native editable objects, and Microsoft PowerPoint actually open.
