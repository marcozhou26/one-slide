# Problem Tree and Issue Tree Modules

## Applicable

The original article clearly states the core issue, two to three first-level branches and their sub-topics. Trees only express decomposition relationships and do not automatically change parallel facts into cause and effect.

## prohibited

- When the original text does not clearly indicate mutual exclusion and exhaustion, do not show or claim that MECE.
- Do not add branches to fill the tree structure; use "to be supplemented by the customer" for missing positions that the original text indicates should be retained.
- Verified core root cause, excluded and other statuses must have original text anchors.

## input structure

`module_id` for `issue-tree`; `diagram.type` for `issue-tree`. contains a `root`, two to three `branches`, each branch contains one to three `children`. Optional `verification`, `status`, `so_what` with evidence `mece`.

run `validate_issue_tree.mjs`, `plan_issue_tree.mjs` and `render_issue_tree.mjs`. Formal output must be performed PowerPoint Export contract.
