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
    title: { text: "结论", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "结论；问题；分支甲；子项甲；分支乙；子项乙。" }],
    diagram: {
      type: "issue-tree",
      root: { id: "r", text: "问题", source_ids: ["S1"] },
      branches: [
        { id: "a", text: "分支甲", source_ids: ["S1"], children: [{ id: "a1", text: "子项甲", source_ids: ["S1"] }] },
        { id: "b", text: "分支乙", source_ids: ["S1"], children: [{ id: "b1", text: "子项乙", source_ids: ["S1"] }] }
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
    title: { text: "三步推进", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "三步推进：诊断后试点，试点后推广。" }],
    diagram: {
      type: "stage-process",
      steps: [
        { id: "a", text: "诊断", source_ids: ["S1"] },
        { id: "b", text: "试点", source_ids: ["S1"] },
        { id: "c", text: "推广", source_ids: ["S1"] }
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
    title: { text: "利润变化", source_ids: ["S1"], origin: "source" },
    source_anchors: [{ id: "S1", text: "利润变化：期初、价格、销量、期末。" }],
    diagram: {
      type: "waterfall",
      start: { id: "s", text: "期初", source_ids: ["S1"], value: 100 },
      contributions: [
        { id: "p", text: "价格", source_ids: ["S1"], value: -10 },
        { id: "v", text: "销量", source_ids: ["S1"], value: 5 }
      ],
      end: { id: "e", text: "期末", source_ids: ["S1"], value: 96 }
    }
  };
  assert.throws(() => validateWaterfall(data), (error) => error.code === "WATERFALL_RECONCILIATION_FAIL");
});
