# OneSlide orchestration contract

## There is only one entrance to the outside world

top layer `SKILL.md` It is the only discoverable entrance.`producer/ENGINE.md` with `builder/ENGINE.md` It is an internal execution description and must not be used as a separate installation or call by the user. Skill.

## Boundaries of responsibility

### top layer OneSlide

- Determine whether it is a single-page task;
- Derive output patterns;
- control low-burden interactions;
- Orchestration content engine and rendering engine;
- Summary tier status.

### Producer engine

- Establish a source baseline;
- Lock page questions, relationships, conclusions, and information budget;
- Targeted completion and item-by-item source annotation;
- generate Brief, Builder Prompt, structured handoff and content confirmation checklist.

Producer Not drawn PowerPoint.

### Builder engine

- Consumption verified handoff;
- Choose a deterministic module or a direct composition path;
- Create native editable PowerPoint object;
- Complete semantics, rendering, readability and realism PowerPoint Check.

Builder Do not re-determine page goals, do not rewrite user facts, and do not add new synthetic business content.

## pattern routing

```text
PROMPT_ONLY
  → Producer
  → validate_package.py
  → Delivery Prompt + handoff + content review

PPT_DRAFT
  → Producer
  → validate_package.py
  → Builder routing
  → hit module or direct composition
  → Generate a page PPTX
  → Semantic audit + Full page rendering + PowerPoint Check
```

## Downgrade rules

Reserved in the following cases Producer result and return `PPT_RENDERING_BLOCKED`:

- Builder missing files;
- Node.js or `@oai/artifact-tool` Wait for the running dependency to be unavailable;
- Builder Inability to express the required primary relationships;
- Routing conflict or module verification failure;
- Unable to generate native editable objects;
- The current environment cannot complete the requirements PPT Check.

After downgrading, you are not allowed to `delivery/` fake PPTX, and the prompt word package must not be called PPT Finished product.

## Isolate external and internal files

- Ultimately the reader only sees one page PPT business content and necessary sources/Synthetic Disclosure.
- The content confirmation list is for the task client and does not enter the customer PPTX.
- Routing, prompt words, source ledger, model decision, preview and QA For production and reviewers, stay in the internal directory.
- `delivery/` Only put versioning PPTX;Publish ZIP No real customer data, running products or native paths.

## Compatibility principle

- The two engines within the suite communicate using relative paths.
- Does not depend on external installation of the same name Producer or Builder.
- Do not read personal directories or history test fixtures outside the package at runtime.
- New Builder Modules must not be changed Producer Source semantics and per-page budget.
- New provenance The type must be updated at the same time Producer Contracts, validators and tests.
