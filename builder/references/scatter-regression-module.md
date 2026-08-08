# Bicontinuous variable linear relationship module

Applicable: Help readers determine the direction of the relationship between two continuous variables in the current sample, linear strength, observations that deviate from the overall trend, and the extent to which the conclusion can be interpreted. formal module ID for `scatter-regression`, `diagram.type` Must have the same name.V1 Only performs a one-variable ordinary least squares linear fit with an intercept and does not extend to logarithmic, exponential, or polynomial models.

## Boundaries with other modules

- This module requires item by item x/y Raw observations, only correlation coefficients, slopes, or pooled mean inputs are not accepted;
- `histogram` To answer the distribution of a single continuous indicator, this module answers the common change of two continuous indicators;
- `chart-insight` When dealing with time series or general chart insights, unary linear models are no longer calculated;
- If the page also needs independent group comparison, time trend or causal path, omit the three module fields and enter `direct_composition`, or return a single page range overload;
- Correlation or regression only describes the linear association within the sample and cannot be rewritten as cause and effect or made up. p value, confidence interval, or statistical significance.

## Enter the contract

- `x_metric`, `y_metric`: The indicator names of the two axes;`x_unit`, `y_unit`: respective units;
- `period`, `population`, `sample_definition`, `source_note`: Period, population, sample granularity and source description;
- `observations`: 8–200 Original records one by one, each containing a unique `id`, `x`, `y` and `source_ids`;Missing values are left explicitly as `null`, optional `label` Used to mark abnormal points on the page;
- `sample`: Original total number, number of valid pairs, number of missing pairs and number of exact duplicate pairs;
- `method=ordinary_least_squares_with_intercept`;
- `handling`: V1 It is fixed to eliminate paired deletions, retain exact duplicates as independent observations, and retain and label outliers;
- `outlier_rule`: Selection rules for abnormal points visible on the page;V1 Use absolute residuals to sort and label before 1–3 valid observations;
- `highlight_ids`: must be compared with the former obtained by complex calculation of absolute residuals N observations are consistent, and the corresponding records must be made visible `label`;
- `statistics`: Declared `slope`, `intercept` and `r_squared`, by Builder Recalculate from valid original observations;
- `reconciliation_rule`: Recalculation, tolerance and display rounding rules visible on the page;
- `interpretation_boundary`: "Intra-sample correlation does not equal causation, extrapolation needs to be verified separately" visible on the page;
- `insights`: 1–3 Insights that are supported by data and do not cross interpretation boundaries; optional `conclusion` and `disclosure`.

## Missing, duplicate, outlier and recalculation access control

- Valid matches are less than 3 Return in time `REGRESSION_SAMPLE_TOO_SMALL`;The official product page requires at least 8 valid pairing;
- x or y Returns when zero variance `REGRESSION_ZERO_VARIANCE`;
- Missing x or y The records are retained in the original observations, but only paired eliminations are performed, and the sample statistics must be balanced;
- V1 Exact duplicates are not automatically removed; the declared number of duplicates must be consistent with the original observation recalculation;
- Outliers continue to participate in the fitting;`highlight_ids` The recalculation must be sorted by absolute residuals, and points that support the conclusion cannot be selected visually;
- slope, intercept and R² Recalculate using the original unrounded values, and the absolute error must not exceed `1e-6`;The page displays the slope and intercept to two decimal places,R² three decimal places;
- Not accepted `through_origin`, polynomial, logarithmic, or exponential methods; do not accept or present significant conclusions that are not supported by the input.

## Pages and editability

The main image uses native PowerPoint Ellipse points, lines, axes, grid lines and text. Regression lines use a different line style than data points; outlier points must have native text labels and leaders in addition to color. The page also displays formulas,R², number of samples, missing/Repeat processing, outlier rules, sources/period/Overall and interpretive boundaries. Acceptance must cover complete, sparse natural language, key missing, fuzzy conflicts, non-blocking style missing, exceptions JSON, insufficient sample, zero variance, statistical equilibrium and formal Producer handoff.
