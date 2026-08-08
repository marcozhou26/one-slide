# OneSlide Enter the contract

Risk level:B. It handles files, data, content production and multi-step PowerPoint Workflow. Internal integrity cannot be turned into a user questionnaire.

## Enter registration

| input | degree | acceptance form | Missing handling | Ambiguity or conflict handling | where the process goes |
| --- | --- | --- | --- | --- | --- |
| Single page topic, task or material | required | natural language, or readable TXT, MD, CSV, XLSX, DOCX, PPTX, PDF, pictures,JSON, GeoJSON | Read the current conversation, attachments, and unique objects first; if the topic or reader task is still not recognized, just ask a blocking question | Keep competitive explanations; give the recommended direction first if you can recommend it. | Source baseline and single page range |
| Output intent | derived / optional | "Prompt word,Brief, handover package" or "create, draw, generate PPT” | Default `PROMPT_ONLY` and explain | Latest explicit requests take precedence | Output mode |
| Audiences and their tasks | derived / conditional | User’s original words, attachments, project context | Stable derivation; use revocable assumptions when necessary | Ask only when different audiences will change the central conclusion or main image | Page target |
| User facts, figures, definitions and conclusions | optional / source-locked | User text or source file | Use existing evidence; only fill gaps if directed completion is allowed | Do not modify conflicting values; stop affected calculations | Content and source labeling |
| Whether to allow completion | derived / conditional | call OneSlide Grants "clearly marked revocable completion" by default; user can explicitly disable it | Use when completing is prohibited `SOURCE_ONLY` or `EVIDENCE_BLOCKED` | When requiring true facts, the fact requirement overrides the default completion | content mode |
| central conclusion | derived / conditional | a sentence supported by a source or calculation | Derivation from materials; in synthetic data scenarios, first generate data and then calculate | Ask only when two incompatible conclusions require different main images | Titles and Stories |
| main relationship | derived / conditional | Object, dimension, indicator, direction | Derivation from reader tasks and evidence | Information relationships take precedence over incompatible graphics preferences | Main picture and Builder routing |
| Output directory | optional | Writable directory | Create a new version directory in the current workspace | Do not overwrite existing run directory | delivery location |
| PowerPoint operating capability | derived / conditional | `PPT_DRAFT` when needed Node.js, built-in Builder and its rendering dependencies | Downgrade the delivery of the verified prompt word package and return `PPT_RENDERING_BLOCKED` | Not replaced by universal renderer | drawing phase |
| template or brand | optional | PPTX, color, font,Logo, clear rules | Use a built-in neutral consulting style | Explain and apply safety boundaries when conflicting with readability or single-page logic | Builder visual realization |

## Fixed judgment order

```text
READ_CONTEXT
→ DERIVE_IF_STABLE
→ USE_DECLARED_DEFAULT
→ PROCEED_WITH_DISCLOSED_ASSUMPTION
→ DEGRADE_SCOPE
→ ASK_ONE_BLOCKING_QUESTION
→ STOP / HANDOFF / REFUSE
```

Do not block because the user did not give sample size, time range, graph type, color, template, module, coordinates or granularity. When an honest, revocable first version can be produced, proceed directly and note the assumptions.

## Circumstances where follow-up questions are allowed

- Two or more equally legitimate page questions will produce different central conclusions or main images;
- The required content exceeds the single-page budget, and it is impossible to provide a security focus that does not delete the content;
- The core numbers of the two authoritative versions conflict and one of them must be used for page calculations;
- User requests real company facts, but does not have enough evidence and anonymous examples are prohibited;
- There are multiple equivalent candidate files or versions, and choosing the wrong one can significantly change the results.

## B Level file and data rules

- Record the file name for each attachment used,SHA-256, reading status and version judgment.
- Garbled, encrypted, damaged, missing pages, scanned or truncated files must be marked and do not pretend to be read successfully.
- Keep the unit, period, granularity, denominator, filter range, meaning of missing values and calculation caliber.
- The original baseline is not deleted by default; only declared selection and reorganization is done on a single page, and necessary information cannot be secretly moved into notes.
- Do not include sensitive customer information, real personal data, or internal collaboration records in public samples and releases ZIP.

## minimal behavior matrix

- Complete input: go `SOURCE_ONLY`, do not add content or ask questions without reason.
- Sparse natural language: deriving single page direction, directional completion and annotation.
- Missing key themes: Just ask “What does this page want the reader to understand or decide?”
- Ambiguous or conflicting goals: Recommend the strongest focus; ask only when you really can’t advance together.
- Non-blocking preferences are missing: regardless of color, module, coordinate, or card count.
- Exception file: log issues, downgrade to continue when able to continue with existing text.
- No data for the real company: no fact indicators under the name of the company are generated.
- Multi-page request: lock one page; recommend single page focus or return `SINGLE_SLIDE_SCOPE_OVERLOAD`.
- PPT Dependencies are unavailable: keep the prompt word package and do not forge it PPT Complete status.
