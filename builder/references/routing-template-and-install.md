# Unified routing, templates and installation

## routing

Sort the input into JSON:

```json
{
  "input_mode": "text | data | mixed",
  "text": "Original text or task description",
  "data": {},
  "requested_module": "Optional; filled in if explicitly specified by the user"
}
```

Run:

```bash
node scripts/route_input.mjs input.json
```

- `selected`: Read the return module's reference, validator, planner and renderer.
- `needs_structure_choice`: Only display the two returned candidate structures and do not generate a formal page.
- `ROUTE_EVIDENCE_INSUFFICIENT`: In the absence of reliable structural evidence, stop speculating.
- The user explicitly specifies that the graph only determines routing; insufficient data is still determined by the corresponding validator blocked.

## template follow

No template that is generated first and passes logic, layout and overflow checks PPTX, and then run:

```bash
python3 scripts/apply_powerpoint_template.py \
  --template customer-template.pptx \
  --generated generated-page.pptx \
  --output customer/page_V01.pptx \
  --target-slide 1 \
  --manifest internal/template-manifest.json
```

The template page must be the same as the generated page 16:9, and provide a target page that does not conflict with the main text. The script retains the template package, master, layout, theme, background and existing decorations, and writes the native shape of the generated page to the target page; it stops when the generated page contains pictures, media, hyperlinks or charts that require additional relationships, and does not perform incomplete cloning.

Template output still needs to perform full size rendering, overflow checking and Microsoft PowerPoint Actual opening check. List only `internal/`, the customer directory only contains versioned PPTX.

## Installation verification

Standard delivery is reserved for the top layer `consulting-logic-slide/` of ZIP. Execute separately after decompression Skill Specification checks, built-in tests, and target client installations; compression integrity is not a substitute for installation verification.
