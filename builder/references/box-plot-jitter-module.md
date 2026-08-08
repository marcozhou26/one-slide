# Inter-group distribution and individual observation module

Applicable: Answer "How do the typical levels, dispersion, sample density, and abnormal observations of each group differ?" formal module ID for `box-plot-jitter`, `diagram.type` Must have the same name. Main map will Tukey Box line statistics are superimposed with all original observations, but the lateral jitter is only used to avoid point occlusion and does not change any observation values.

## Enter the contract

- `groups`: 2–6 individual groups; each group `id` Unique, including group name,5–60 original values, declared sample size `n` and source; full page maximum 240 observation points;
- `period`: Observation period common to all groups;
- `unit`: The unit common to all original observations;
- `observation_definition`: What a single observation represents;
- `sample_definition`: Sample inclusion range, denominator or screening criteria;
- `statistics_rule`: Fixed to `tukey_hinges_1_5_iqr`;
- `statistics_note`: Visible description box, median line, whiskers and outlier rules;
- `jitter_note`: It can be seen that the lateral jitter is only a visual displacement and does not change the value;
- `insights`: 1–3 An insight supported by original observations or calculations;
- Optional `conclusion` with synthetic data `disclosure`.

## Statistical rules and access control

- First, arrange each group of original observations in ascending order; the upper and lower half of the odd-numbered samples do not include the overall median;
- `Q1`, median,`Q3` Use the median of the upper and lower halves, that is Tukey hinges;
- The box must end at `Q1−1.5×IQR` with `Q3+1.5×IQR` The farthest actual observation within range; observations outside range are marked separately;
- `n` Must equal the original number of observations; group ID, unit, period, observation definition and sample size must not be missing or conflicting;
- Original observations must be finite values; outlier strings, null values, inconsistent sample sizes or exceeded 240 Block when clicked;
- Missing styles, colors, or custom dither parameters do not block and use deterministic default visual displacement.

## Pages and editability

Each box, whisker, midline and observation point uses an independent PowerPoint native object. Lateral offset is determined by the stable ordering of the observations in the input array, does not write back data, and does not affect statistics. The page must display the group name,`n`, unit, period, sample size, statistical rules and jitter description. Synthetic data must show "synthetic sample data, not real customer data."

Acceptance: complete input, automatic recognition of sparse natural language, missing key fields, sample size conflicts, missing non-blocking styles, abnormal formats and the upper limit of points on a single page must be tested; generate reference PPTX Then check the rendering, overflow, all point native objects, the number of picture objects and Microsoft PowerPoint Open the result.
