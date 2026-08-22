# Input contract

## 复杂报告页面规格

复杂报告只接受slide-spec生成的单页`effective-page-spec-1.0`。收到整套Director Package、旧大纲Handoff或多页数组时返回`EFFECTIVE_PAGE_SPEC_REQUIRED`，不得直接施工。

结构页不重新生成页面模型。Producer使用兼容文件名`compile_outline_handoff.mjs`读取一页effective_page_spec，校验`director_inheritance.locked_fields`后，只补充OneSlide内部的`requested_module`、`primary_exhibit`、`module_payload`和主题默认值。

Risk level: B. This is a file, data, content-production, and multi-step workflow. Internal completeness must not become a user questionnaire.

## Inputs

| Input | Degree | Accepted form and quality | Missing handling | Conflict handling | Workflow destination |
| --- | --- | --- | --- | --- | --- |
| One-slide idea, task, or source material | required | Natural language or readable TXT, MD, CSV, XLSX, DOCX, PPTX, PDF, image, or JSON | Read conversation and attachments; if no subject or reader task can be derived, ask one blocking question | Preserve competing interpretations and recommend one when possible | Source baseline and page scope |
| Output intent | derived / optional | Prompt language or request to create/render/draw a PPT | Default to `PROMPT_ONLY` and disclose | Explicit latest request wins | Output mode |
| Audience and reader task | derived / conditional | Natural language or stable context | Derive; use a reversible assumption if one audience is clearly dominant | Ask only when plausible audiences require materially different pages | Page objective |
| User facts, numbers, claims, and definitions | optional / source-locked | Supplied text or readable source files with units and period where applicable | Continue with available evidence or controlled completion | Never alter; block or exclude conflicting calculations | Claims, data, provenance |
| Permission to synthesize | derived / conditional | Invocation of this Skill authorizes clearly labelled completion; explicit prohibition disables it | Use `SOURCE_ONLY` or `EVIDENCE_BLOCKED` | A factual-only request overrides default completion permission | Generation mode |
| Central message | derived / conditional | One defensible sentence | Propose from source-supported evidence; in synthetic-data cases calculate it after data generation | Ask only when two incompatible messages require different exhibits | Slide brief and title |
| Primary relationship | derived / conditional | Explicit dimensions and direction | Derive from reader task and evidence | Meaning wins over a requested visual that cannot encode it | Exhibit and Builder route |
| Output directory | optional | Writable local directory | Create a new versioned run directory in the current work area | Never overwrite an existing run | Package location |
| Builder availability | derived / conditional | Installed readable `single-consulting-slide-builder` for `PPT_DRAFT` | Deliver validated prompt package and return `PPT_RENDERING_BLOCKED` | Never substitute a generic renderer | Rendering step |

## Required decision order

```text
READ_CONTEXT
→ DERIVE_IF_STABLE
→ USE_DECLARED_DEFAULT
→ PROCEED_WITH_DISCLOSED_ASSUMPTION
→ DEGRADE_SCOPE
→ ASK_ONE_BLOCKING_QUESTION
→ STOP / HANDOFF / REFUSE
```

Do not ask for sample size, slide family, period, unit, layout, module, coordinates, color, or style when a plausible reversible default can produce an honest draft. Disclose synthetic assumptions instead.

## One-page ambiguity threshold

Ask only when:

- two or more equally plausible page questions lead to different central messages or primary exhibits;
- a user-designated must-include item conflicts with the one-page budget and no safe one-page focus can preserve it;
- two authoritative source versions conflict on a value required by the page;
- a real-organization claim requires factual evidence that cannot be synthesized safely.

When the strongest focus is evident, recommend it and continue without a form-like approval sequence unless the user requested confirmation.

## File and data handling

- Hash every supplied file used and record its extraction status.
- Record unreadable, encrypted, corrupt, truncated, scanned, stale, or conflicting files.
- Preserve original units, period, grain, denominators, filters, and missing-value meaning.
- Do not silently combine conflicting source versions.
- Keep client-sensitive material out of public examples and release packages.
- `LOSSLESS_TRANSFORMATION` applies to the source baseline. Visible one-page content may select and restructure only within the declared page scope; nothing required may be silently omitted.

## Minimum behavior scenarios

- Complete input: compile without synthetic content and without unnecessary questions.
- Sparse input: derive a page direction, create only the missing illustrative content, and mark it.
- Missing critical direction: ask one question only when no reader task or subject can be derived.
- Ambiguous input: recommend one focus or ask when competing page directions are materially different.
- Non-blocking preferences missing: proceed without asking for visual style or coordinates.
- Low-quality or stale file: record the issue and use only readable, non-conflicting evidence.
- Real company with no data: do not generate factual metrics under the company name.
- Scope overload: keep one page and return `SINGLE_SLIDE_SCOPE_OVERLOAD`; do not generate a deck.
