# Continuous Numerical Distribution Module

Applicable: Answer "Which range does a continuous numerical indicator concentrate in, and whether there is skewness, long tail or multiple peaks". formal module ID for `histogram`, `diagram.type` Must have the same name. It uses adjacent, equal-width or clearly unequal-width native rectangles to express continuous intervals. It does not deal with classification frequencies, nor can it be pretended to be spaced classification columns.

## low burden input contract

- `metric`, `unit`, `period`, `denominator`: with `source_ids` Measurement object, unit, period, denominator/Sample diameter;
- `observations`: 10–500 original observations, numerical precision is preserved, missing values are used explicitly `null` or empty string;
- `sample`: `total`, `valid`, `missing`, must be aligned with the original observation;
- `frequency_basis`: `count` or `frequency`;
- `binning`: `method=explicit_edges`, 4–12 Strictly increasing intervals `edges`, `include_left=true` and clear `last_bin_inclusive`;
- `data_source_ids`: Source of original observations, samples and binning rules;
- `insights`: 1–3 The bars are concentrated, skewed, long-tailed or multimodal, supported by complex calculation results;
- Optional `bins`, `conclusion` with synthetic data `disclosure`.

Producer Metrics and periods can be derived from natural language, unique data files, and stable measurement metadata, with revocable, disclosed explicit boundaries used when binning preferences are missing; users must not be required to fill in module names or coordinates. Missing original observations, units/When there is a period conflict or the denominator cannot be determined honestly, the formal load will be stopped or downgraded, and no fabrication will be made.

## Recalculation and blocking

- Each valid observation must fall into and only fall into one interval; the left is closed and the right is open by default, and whether the last box contains an upper bound must be explicit;
- If provided `bins`, Builder from `observations + edges` Recalculate and check the lower bound, upper bound and frequency box by box;
- `total = valid + missing = observations.length`;The frequency denominator is `valid`, missing values do not enter the bar height but must be reported within the page;
- Boundaries are repeated or in reverse order, samples are not flat, statement frequencies are not reproducible, and valid values fall outside the boundaries and are blocked respectively;
- Classification labels, multiple different units or periods, and multiple independent indicators cannot be forced to hit this module.

## Pages and editability

The main image uses adjacent PowerPoint Native rectangles, grid lines, axis labels and data labels; distribution interpretation supported by up to three sources on the right and one conclusion at the bottom. Readers can edit binning boundaries, columns, and frequencies/Frequency labels, sample descriptions, and insight text. Synthetic data must show "synthetic sample data, not real customer data."

Acceptance coverage is complete, sparse, key missing, fuzzy/Conflicts, lack of non-blocking optimization, non-reproducible cases of abnormal format and declaration frequency, and check one page 16:9, rendering readability, overflow, native objects, image objects and Microsoft PowerPoint actually open.
