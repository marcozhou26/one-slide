# OneSlide Enter contract test results

Test objects:`one-slide` 1.2.2(Enter Contract Inheritance Verified 1.2.0)
Input contract level: B
Test date:2026-08-07

| test_id | scene | input | actual behavior | Do you want to ask? | evidence | result |
| --- | --- | --- | --- | --- | --- | --- |
| IC01 | Complete input | The audience, conclusion, real data, and units are complete, as long as the prompt words | Use `SOURCE_ONLY`;Does not add synthetic content | No | `test_source_only_package_passes` | pass |
| IC02 | sparse natural language | "Explain why the approval of grassroots managers is slow. The lack of information can be supplemented and it can be done directly. PPT” | Derivation of approval stage×Time-consuming; filling in anonymous examples; labeling sources item by item; generating one page PPTX | No | `qa_runs/sparse-ppt-draft-v1` | pass |
| IC03 | Missing key themes | "Do a one-page consultation for me PPT” | There are no themes or reader tasks to derive; just ask, “What does this page primarily want readers to understand or decide?” | Yes, threshold reached | Contract Semantics Walkthrough | pass |
| IC04 | Ambiguous or conflicting goals | Same page calls for pay inversion, organizational hierarchy and full action plan | Return `SINGLE_SLIDE_SCOPE_OVERLOAD`;Recommend the strongest single page focus and do not generate multiple pages. | Yes, threshold reached | Contract Semantics Walkthrough | pass |
| IC05 | Missing non-blocking preference | The theme and data are complete, but there are no colors, modules, coordinates and templates | Use a neutral professional style; choose graphics from primary relationships | No | OneSlide contract with Builder Default rules | pass |
| IC06 | exception file | The attachment is damaged, but the user text already explains the topic | Mark attachment as unreadable; continue with readable text only and do not pretend extraction was successful | No | B Level exception input semantic drill | pass |
| IC07 | No data for real companies | Request to generate factual turnover rates for a real company, but without evidence | Do not generate fictitious indicators under real company names; return `EVIDENCE_BLOCKED` Or change to anonymous example | No | Fact Boundary Semantics Walkthrough | pass |
| IC08 | PPT Running dependencies are missing | Request PPTX, but `@oai/artifact-tool` Not available | Keep the verified prompt word package; return `PPT_RENDERING_BLOCKED` | No | `check_environment.py` downgrade contract | pass |

## Status

```text
INPUT_CONTRACT_DECLARED
INPUT_CONTRACT_TESTED
INPUT_CONTRACT_PASS
```

This status proves that this round covers complete, sparse, critical missing, direction conflicts, non-blocking preferences, exception files, real company fact boundaries and operational dependency scenarios. It does not represent all topics and all Builder The module has been tested with real users.

## 2026-08-09 histogram Module additional verification

| test_id | scene | actual behavior | Do you want to ask? | evidence | result |
| --- | --- | --- | --- | --- | --- |
| HIC01 | Complete input | Recalculation 8 intervals,48 valid observations and 2 missing values, generate a one-page plan | No | `histogram_contracts.test.mjs` | pass |
| HIC02 | sparse natural language | Automatic routing from continuous observations to "lumped, skewed, long-tailed" relationships, no module name or chart name required | No | Same as above | pass |
| HIC03 | Missing key observations | No official distribution page, no fabricated samples | No | Same as above | pass |
| HIC04 | unit conflict | Block formal payloads from inconsistent sources | No | Same as above | pass |
| HIC05 | Non-blocking styles and missing precomputed binning | Use the default style and continue after recalculating from the original observations | No | Same as above | pass |
| HIC06 | Exception format | Numeric strings with units, bad boundaries, incorrect samples, and inconsistent statement frequencies are blocked respectively. | No | Same as above | pass |

`INPUT_CONTRACT_PASS` Only covering the declaration and executed scenarios of this module does not mean acceptance by real users.

## 2026-08-09 scatter-regression Module additional verification

| test_id | scene | actual behavior | Do you want to ask? | evidence | result |
| --- | --- | --- | --- | --- | --- |
| SRIC01 | Complete input | From item to item x/y Complex calculation of slope, intercept,R², valid/Missing/Repeated samples and absolute residual anomalies | No | `scatter_regression_contracts.test.mjs` | pass |
| SRIC02 | sparse natural language | From two continuous indicators, directions/intensity/Off-trend tasks and paired observations are automatically routed and do not require module or chart names. | No | Same as above | pass |
| SRIC03 | Missing key observations | Formal fitting, no fabrication of data | No | Same as above | pass |
| SRIC04 | unit conflict | Block pairs of records from different units and do not convert or merge them implicitly | No | Same as above | pass |
| SRIC05 | Missing non-blocking style | Continue using the default layout without asking about colors and formatting. | No | Same as above | pass |
| SRIC06 | Exception format conflicts with statistics | damaged JSON, zero variance, insufficient samples, statistical imbalance, and inconsistent ordering of outliers are blocked respectively. | No | Same as above | pass |

`INPUT_CONTRACT_PASS` Only covering the declaration and executed scenarios of this module does not mean acceptance by real users.
