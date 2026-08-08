# Group distribution summary module

Applicable to: Answering "Typical levels, intermediate levels of multiple groups" 50% How do intervals, dispersions, and abnormal records differ?” formal module ID for `box-plot`, `diagram.type` Must have the same name. The module only processes the same indicator, the same period, the same unit and the same statistical caliber. 3–8 Comparable groups and does not replace histogram distributions, time trends, or pages that only compare means.

## Enter the contract

- `period`, `unit`, `denominator`: Clarify the period, unit, statistical denominator and screening range;
- `sample_definition`, `missing_policy`: Explain what an observation represents, how to count valid samples, and how to handle missing records;
- `quartile_method`: Quartile algorithm visible on the page, used in this version `PERCENTILE.INC(linear interpolation, equivalent to Type 7)`;
- `whisker_multiplier`: This version is fixed as `1.5`;
- `whisker_rule`: The page shows the description "The endpoint of the whisker is 1.5×IQR The farthest observation inside the fence, and the records outside the fence are marked as outliers point by point”;
- `groups`: 3–8 group,`id` Unique; each group contains tags, valid `sample_size`, `missing_count`, `whisker_low`, `q1`, `median`, `q3`, `whisker_high`, explicit `outliers` and `source_ids`;
- `insights`: 1–3 Findings supported by distribution summary; optional `conclusion` and synthetic data `disclosure`.

## access control

- Each group must meet `whisker_low ≤ q1 ≤ median ≤ q3 ≤ whisker_high`, and IQR greater than 0;
- Whisker endpoints must not cross the declared 1.5×IQR Fences; each outlier must be outside the whiskers and cannot be hinted at by color alone;
- The effective sample size is at least 5, the missing number must be provided explicitly and must not be negative;
- Returned when period, unit, denominator, sample definition, missing rule, quartile algorithm, or whisker rule are missing `DATA_CONTRACT_FAIL`;
- Returned when caliber conflicts, summary value order is wrong, or outlier locations are inconsistent `BOX_PLOT_RECONCILIATION_FAIL`;Do not automatically correct source statistical results.

## Pages and editability

The main image uses native PowerPoint Lines, Rectangles, Ellipses and Text: Box Expressions Q1–Q3, the median uses a clear horizontal line and numerical value, the whiskers and endpoints are independently editable, and the outliers are displayed point by point with the word "outlier value" + Value" label. The effective sample size and missing number are displayed directly under the group name; the period, sample, missing, quartile algorithm and whisker rule are displayed on the right. Synthetic data must appear on the page as "Synthetic sample data, not real customer data."

Acceptance must cover complete input, sparse natural language, missing key calibres, ambiguities or conflicts, missing non-blocking styles, abnormal formatting, statistical ordering errors, misplaced outliers, rendering, overflow, native objects, and Microsoft PowerPoint actually open.
