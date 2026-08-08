# Process and stage path module

## Applicable

The original text indicates three to six steps, stages, or sequential dependencies. The order of the array must be supported by the original text relationship, and parallel items cannot be forced into a process because of layout requirements.

## input structure

`module_id` for `stage-process`; `diagram.type` for `stage-process`. Each step can include core actions, activities, deliverables, responsibilities and cycles, and stage gates. Adjacent steps must have original text anchors `transitions`. When sources or calculations clearly demonstrate that a step is a bottleneck, you can set `emphasis: "bottleneck"`;Must not emphasize color balance alone.

## prohibited

- Do not create precedence based on guesswork other than the appearance of numbers.
- Do not add responsible parties, cycles, deliverables, milestones or gates.
- Loop feedback is only shown if the original text is clear.

run `validate_stage_process.mjs`, `plan_stage_process.mjs` and `render_stage_process.mjs`, and execute PowerPoint Export contract.
