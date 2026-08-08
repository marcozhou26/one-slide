# Center estimation and interval band module

Applicable: along 5–12 Compare center estimates to interval widths over an ordered period or sequence to identify periods when uncertainty widens, narrows, crosses business thresholds, or is directional. formal module ID with `diagram.type` All are `confidence-band`.

## Reader tasks and boundaries

- The main graph answers only one question: how the center estimate changes, and at the same time how its uncertainty changes;
- `confidence_interval`, `credible_interval` and `other_interval` Must be named according to the original meaning of the source and cannot be interchanged;
- Confidence intervals cannot automatically be called prediction intervals or risk intervals, nor can "interval inclusion thresholds" be written as causality, risk, or inevitable consequences;
- If the page also needs independent driver attribution, scenario prediction or a second main image, omit the module field and enter `direct_composition`.

## Enter the contract

- `metric`, `unit`:Indicators and units;
- `periods`: 5–12 Each label is unique,`order` Strictly incremental periods; provided each period `estimate`, `lower`, `upper`, and satisfy `lower ≤ estimate ≤ upper`;
- `interval_type`, `interval_label`, `interval_definition`: Complete description of interval type and meaning; confidence interval is required separately 0–100 between `confidence_level`;
- `estimation_method`: Calculation method of center estimate and interval;
- `sample_definition`, `population_definition`:Sample/Overall caliber; positive integers can be provided in each issue `sample_size`;
- `source_note`: Source and period description visible on the page;
- Optional `threshold`: Numerical values, visible labels and semantics, which must indicate whether it is a business line, statistical line or other boundary;
- `insights`: 1–3 A drawing conclusion supported by numerical values and without excessive inference;
- Optional `missing_value_note`, `conclusion`, `disclosure`.

## Missing and conflict handling

- The three numbers in a single period must all exist or be `null`;Return if part is missing `MISSING_VALUE_CONTRACT_FAIL`;
- When there is a missing period, a visible description must be provided. The polyline and interval band are disconnected at the missing period, and no interpolation or filling is performed. 0;
- Periods repeat, reverse order, or `order` Conflict return `PERIOD_ORDER_FAIL`;
- If the upper and lower bounds of the interval cannot cover the center, the estimated return `INTERVAL_ORDER_FAIL`;
- Missing interval definition or confidence level returned `INTERVAL_DEFINITION_FAIL`;
- Styling, color matching, and missing thresholds are not blocking items and should not be passed off to user field questionnaires.

## Pages and editability

Page usage PowerPoint Native polylines, dots, axes, dashed thresholds, and editable translucent quadrilateral bands between adjacent periods. Color is not the only channel: center estimates are solid lines and dots, intervals are filled bands, and thresholds are dashed lines with text. Retention interval definition, estimation method, sample on the right/Overall and up to three insights; keep sources, missing notes, synthetic disclosures, and restrained conclusions at the bottom.

Acceptance covers complete input, sparse input, missing key definitions, period conflicts, missing non-blocking styles, missing values, incorrect interval order, and exceptions JSON, natural language routing, native objects, rendering, overflow and Microsoft PowerPoint The real machine is open.
