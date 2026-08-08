import test from "node:test";
import assert from "node:assert/strict";
import { routeModule } from "../scripts/route_module.mjs";
import { validateIssueTree } from "../scripts/validate_issue_tree.mjs";
import { validateStageProcess } from "../scripts/validate_stage_process.mjs";
import { validateWaterfall } from "../scripts/validate_waterfall.mjs";

test("routes explicit modules and returns genuine ambiguity", async () => {
  assert.equal((await routeModule({ requested_module: "issue-tree" })).module.module_id, "issue-tree");
  const result = await routeModule({ has_explicit_causality: true, has_hierarchy: true });
  assert.equal(result.code, "ROUTE_AMBIGUITY_REVIEW");
});

test("issue tree blocks unsupported MECE", () => {
  const data = {
    version: "1.0",
    module_id: "issue-tree",
    audience_mode: "analysis",
    title: { text: "Conclusion", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "Conclusion; question; branch A; sub-item A; branch B; sub-item B." }],
    diagram: {
      type: "issue-tree",
      root: { id: "r", text: "question", source_ids: ["S1"] },
      branches: [
        { id: "a", text: "Branch A", source_ids: ["S1"], children: [{ id: "a1", text: "Sub-Xiang A", source_ids: ["S1"] }] },
        { id: "b", text: "Branch B", source_ids: ["S1"], children: [{ id: "b1", text: "Sub-item B", source_ids: ["S1"] }] }
      ],
      mece: true
    }
  };
  assert.throws(() => validateIssueTree(data), (error) => error.code === "SOURCE_FIDELITY_FAIL");
});

test("process blocks unsupported order", () => {
  const data = {
    version: "1.0",
    module_id: "stage-process",
    title: { text: "three steps forward", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "three steps forward; Diagnosis; pilot; promotion; piloting follows diagnosis, and promotion follows piloting." }],
    diagram: {
      type: "stage-process",
      steps: [
        { id: "a", text: "Diagnosis", source_ids: ["S1"] },
        { id: "b", text: "pilot", source_ids: ["S1"] },
        { id: "c", text: "promotion", source_ids: ["S1"] }
      ],
      transitions: [
        { from: "b", to: "a", source_ids: ["S1"] },
        { from: "b", to: "c", source_ids: ["S1"] }
      ]
    }
  };
  assert.throws(() => validateStageProcess(data), (error) => error.code === "LOGIC_STRUCTURE_FAIL");
});

test("waterfall requires reconciliation", () => {
  const data = {
    version: "1.0",
    module_id: "waterfall-attribution",
    title: { text: "Profit changes", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "Profit changes; Beginning of period; price; Sales volume; End of term." }],
    diagram: {
      type: "waterfall",
      start: { id: "s", text: "Beginning of period", source_ids: ["S1"], value: 100 },
      contributions: [
        { id: "p", text: "price", source_ids: ["S1"], value: -10 },
        { id: "v", text: "Sales volume", source_ids: ["S1"], value: 5 }
      ],
      end: { id: "e", text: "End of term", source_ids: ["S1"], value: 96 }
    }
  };
  assert.throws(() => validateWaterfall(data), (error) => error.code === "WATERFALL_RECONCILIATION_FAIL");
});
