# V3.3 Enter the contract

Risk level:B. Prioritize reading the current conversation, attachments and unique files; complete internal structure does not mean requiring the user to fill in fields.

| input | degree | acceptance form | Missing and Conflict Handling | where the process goes |
| --- | --- | --- | --- | --- |
| Single page source content | required | natural language,Markdown, Word, PPT, CSV, JSON or structured handover package | Read the current context and the only object first; if there is still no content, `SOURCE_BASELINE_FAIL` | source baseline |
| Prompt Architect Handover package | optional / preferred | manifest, Builder Prompt, Builder handoff and on-demand data files | Checks approval status, relative paths, fields, and file references; fails `HANDOFF_PACKAGE_FAIL` | Handoff fast path |
| Structured handover package | derived / optional | `subject`, `story`, `source_ids`, `display_blocks`, `structure`, `datasets` or equivalent fields | When it exists, take the fast path directly; no repeated compilation is allowed. page model | V3 routing |
| Actual Readers and Tasks | derived / conditional | User’s original words, project context or `audience_task` | Continue when derivation is stable; ask a question only when different readers will change the story | Title, density, information isolation |
| Data and caliber | conditional | Value, unit, period, range, formula, source | Missing non-core values can be downgraded to structural sketches; conflicts with core values will stop formal generation. | Data Access and Charts |
| Graphic type | derived / optional | User specified or derived from information relationships | Stop when user specification conflicts with data relationship; mixed structure enters `direct_composition` | routing |
| organizational relationship direction | conditional(Organizational chart) | Formal report to superior→Source of subordinates and functional guidance→Objectives, which can be selected from the original text, table or handoff Derivation | When the direction of the relationship between the same dotted line is unclear, no guessing is allowed for typesetting; read the context first and return if there are still two possible directions. `BRIEF_REQUIRED` or `ORG_FUNCTIONAL_ROUTE_AMBIGUOUS` | Organization model, dotted line grouping and connecting line access control |
| Templates and styles | optional | `.pptx`, font, color, margin | If missing, use the default consultation style with square corners, white background, and three colors or less. | visual generation |
| output location | optional | Directory or file name | Use versioned output and do not overwrite files with the same name | Delivery |

The processing order is fixed as:

```text
READ_CONTEXT
→ DERIVE_IF_STABLE
→ USE_DECLARED_DEFAULT
→ PROCEED_WITH_REVERSIBLE_ASSUMPTION
→ DEGRADE_SCOPE
→ ASK_ONE_BLOCKING_QUESTION
→ STOP
```

## Structured fast path

Users must not be asked to fill in fields again when the following conditions are met:

- `subject` and `story` Not empty;
- `source_ids` at least one;
- exist `display_blocks`, `structure`, `dataset`, `datasets` or explicit `requested_module`.

The routing script only returns hit modules or `direct_composition` List of minimum documents required. Models must not read the full module registry.

## Original input path

Continue in the default style when the original content is sufficient to identify the main body, a main conclusion, and a main information relationship. The following situations are no longer covered by Builder Digest on your own and return `BRIEF_REQUIRED`:

- Two or more possible central ideas or competing main images;
- At the same time, multiple independent analysis themes, insight areas and action areas are required;
- Content selection will change the user’s original intention;
- You need to decide which materials go on this page and which ones go to the next page;
- The page goal or reader task is unclear, and different answers change the structure;
- Clearly more than one page but no priority given by the user.

Other blocking situations:

- Multiple equal candidate sources and selecting the wrong one will change the page;
- The strength of the conclusion or the direction of causation cannot be judged from the source;
- Unit, period or range conflicts for core figures;
- User-specified graphics are incompatible with data relationships;
- There is no way to keep content readable on one page without deleting it.

Garbled, truncated, damaged files or incorrect versions return stable error codes and do not generate official customers. PPTX.

`BRIEF_REQUIRED` It's not a build failure. It indicates that the content design is not yet complete and should be Prompt Architect form prefill Brief and confirm with the user.
