# Prompt Architect handoff intake

Read this reference only when the input is a Prompt Architect run directory or `handoff-manifest.json`.

## Required handoff files

```text
handoff/builder-prompt.md
handoff/handoff-manifest.json
handoff/builder-handoff.json
```

Optional data and assets remain under `handoff/data/` and `handoff/assets/`.

## Intake checks

1. `brief_status` must be `approved` and manifest `status` must be `ready`.
2. `builder_target` must be `single-consulting-slide-builder`.
3. All manifest paths must be relative and remain inside `handoff/`.
4. Every listed file must exist and match its declared hash.
5. Every display dataset used by the prompt must be listed in the manifest.
6. Every dataset path in `builder-handoff.json` must be listed in the manifest.
7. Dataset fields named by x, y, size, color, label, join, order, filter, or group mappings must exist.
8. Units, period, grain, missing-value rules, and label rules must be explicit when the visual depends on them.

When the package includes its own validated `internal/validation-report.json`, treat it as upstream evidence only. Builder must still validate the selected module and render the PowerPoint.

## Execution

- Use `builder-handoff.json` as the route input.
- Use `builder-prompt.md` for layout intent, reading order, must-include, and must-avoid constraints.
- Load only the data files used by the selected exhibit.
- Do not load the upstream source baseline, transformation ledger, rejected options, or discussion history.
- Do not rewrite the approved central message or change the visible content boundary.

Return `HANDOFF_PACKAGE_FAIL` for broken references or data contracts. Return `MODULE_COVERAGE_GAP` when the Builder cannot faithfully implement the requested visual. Return `SINGLE_SLIDE_FIT_FAIL` when implementation cannot remain readable without changing the approved content scope.
