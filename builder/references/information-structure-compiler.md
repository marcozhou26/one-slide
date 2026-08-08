# information structure compiler

## purpose

Compile source content to be editable PPT object system. The compiler identifies facts, fields, and relationships before determining the visual syntax; it is not allowed to directly apply templates based on separators, number of paragraphs, or historical page coordinates.

## Compilation order

```text
source anchor
→ reader tasks
→ Stories supported by subjects and sources
→ Entities, fields, units, times and relationships
→ Common Axis and Repeating Units
→ visual grammar
→ Regions, spatial weights, and layers
→ PowerPoint object
```

## Five page models

| Project | Must-answer questions | evidence boundaries |
| --- | --- | --- |
| `subject` | What object is this page essentially about? | From source content, do not use file chapter names instead of judgment |
| `story` | What should readers understand after reading it? | Must have source anchor; only write descriptive results when evidence is insufficient |
| `expression_method` | In what way? | Determined by fields and relationships, not triggered by symbols |
| `information_skeleton` | What entities, fields, units, times, relationships, and common axes are there? | Each binding source anchor point or explicit calculation formula |
| `visual_consequence` | How are primary evidence, explanations, space, axes, and layers allocated? | Derived from information weight and does not pursue mechanical symmetry |

## Field compilation

When any of the following conditions is true, a real field slot must be created:

- Repeat the same field pattern in more than three lines;
- Two or more indicators need to be compared across entities;
- Numbers, units, periods, or states need to be independently aligned;
- After the string is separated, each part can still be sorted, calculated or filtered independently.

Field slot must be recorded `field_id`, `label`, `value_type`, `alignment`, `axis_id` and `source_ids`. Text is usually left-justified and numbers are usually right-justified; specific choices are subject to the reading task.

## Choice of expression method

| information relationship | Preferred visual grammar |
| --- | --- |
| Horizontal comparison of same fields | Real columns, tables, dumbbells, grouped bars |
| Ranking migration between two or more periods | `bump-ranking`;Can be presented in two phases slope-style, three issues and above presented Bump Chart |
| Changes in the proportion of multi-period composition | `composition-shift`;Fixed denominator, stable components, balanced to 100% |
| continuous numerical distribution | `histogram`;Keep original observations, samples and missing values, and use reproducible binning boundaries to express frequency or frequency |
| Distribution between groups and individual observations | `box-plot-jitter`;Same unit and period, original observations, sample size,Tukey Statistical rules and visual jitter for avoidance only |
| bicontinuous variable relationship | `scatter-regression`; item by item x/y Raw observations, two-axis units, samples/period/Overall, unary with intercept OLS, missing/Repeat/Exception handling and slope/intercept/R² Recalculation |
| Ordered central estimates and intervals | `confidence-band`;reserved estimate/lower/upper, interval types and definitions, estimation methods, samples/Population, threshold semantics and missing values |
| time changes | Polyline, small multiple, stage timeline |
| Clear sequence and stage gates | Process or Gantt |
| Clarify the direction of cause and effect | causal chain |
| Classification and Subordination | Issue tree, matrix or hierarchical table |
| Flow conservation | Sankey or From-To |
| Key Figures and Explanations | Indicator area plus evidence area, no decorative card stacking is used |

Both grammars are reasonable but the reading paths are different, so two candidates are returned. User selection is not required when there are only style differences.

## Deduplication boundaries

Additional duplicate markers made by the generator can be removed, such as rankings that are repeated simultaneously in endpoints, subscripts, and conclusions. Unique facts in the source, qualifications, claims, exceptions, sources, or repetitions in different contexts may not be deleted. All retention, splitting, and user-authorized compression are written to the content map.

## natural language boundaries

The original facts and wording strength are retained by default. Parts in the same sentence that bear different field responsibilities can be split into independent objects; no subject, cause and effect or suggestion can be added to make it "more natural". Only when the user explicitly authorizes polishing, can semantically equivalent rewriting be done, and the mapping from the original text to the rewritten version can be retained.

## Judgment of visual elements

By deleting an element, if the reader does not lose facts, relationships, scale, grouping clues, reading paths, or conclusions, the element is not generated by default. Healthy asymmetry can be preserved; spatial weighting is determined by the importance of primary evidence, explanations, and conclusions.
