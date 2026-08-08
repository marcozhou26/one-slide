# Correlation matrix module

formal module ID for `correlation-matrix`. it helps readers in 4–10 Identify the strongest positive correlation, the strongest negative correlation and the weakest relationship among the indicators, and select candidate relationships for subsequent key variable analysis; correlation must not be interpreted as cause and effect.

## low burden input contract

Users can provide natural language tasks plus a symmetry NxN A coefficient matrix can also be provided 4–10 Original observations of equal length for each indicator. A complete internal contract does not mean requiring users to fill in a field table. Takes unvocable default when display threshold or visual preference is missing; defaults when method is missing Pearson and disclosed on the page. Formal module loads shall not be generated in the absence of calculable data, samples, periods, populations, or sources.

`diagram` Contains at least:

- `method`: `pearson` or `spearman`;
- `sample_size`, `missing_value_handling`, `period`, `population`, `source_note`;
- `display_threshold`: 0–1, used for candidate relationship screening without changing the matrix value;
- `metrics`: 4–10 unique ID with the only visible label;
- `matrix`: Symmetry NxN coefficient matrix, or `observations`: A set of aligned values for each indicator/null;
- 1–3 source supported `insights`, as well as visible `causality_note`.

## math access control

- The coefficient must be in [-1,1];The diagonal is 1;The matrix is symmetrical; the dimensions are consistent with the number of indicators;
- indicator ID and labels are unique; the original observation length is consistent, and non-empty valid samples meet the declared caliber;
- Pearson Using linear correlation,Spearman Compute the average rank Pearson;Zero-variance sequence blocking;
- When the matrix and original observations are provided simultaneously, the complex difference exceeds 0.01 block; block;
- Unit, period, population, source or method conflicts may not be implicitly merged.

## Pages and editability

The main image uses native PowerPoint Square cells and text. Each off-diagonal cell simultaneously expresses relationships through row and column positions, signed values, and divergent colors; the diagonal line displays 1.00. The strongest positive, strongest negative, and weakest relationship candidates are listed on the right. Method, sample, missing treatment, period, population, source, threshold and "correlation does not mean causation" are visible on the page. Color is not the only channel, and the entire page does not contain image objects.
