import test from "node:test";
import assert from "node:assert/strict";
import { validatePageModel } from "../scripts/validate_page_model.mjs";
import { routeInput } from "../scripts/route_input.mjs";

function validModel() {
  return {
    version: "2.0",
    audience: { reader: "Business leader", task: "Determine which business lines have growth paths worth copying" },
    subject: { text: "2023—2026 Annual business line revenue ranking migration", source_ids: ["S01"] },
    story: { text: "Two business lines rose in rankings", source_ids: ["S02"] },
    expression_method: "two_period_rank_migration",
    information_skeleton: {
      entities: [
        { id: "alpha", label: "Alpha", source_ids: ["S03"] },
        { id: "beta", label: "Beta", source_ids: ["S04"] },
      ],
      fields: [
        { field_id: "business", label: "business line", value_type: "text", alignment: "left", axis_id: "business_axis", source_ids: ["S03", "S04"] },
        { field_id: "revenue", label: "income", value_type: "currency", alignment: "right", axis_id: "revenue_axis", source_ids: ["S03", "S04"] },
      ],
      relationships: [
        { type: "same_entity_across_time", from: "alpha_2023", to: "alpha_2026", source_ids: ["S03"] },
      ],
    },
    visual_consequence: {
      primary_evidence: "Two periods of ranking migration",
      regions: [{ id: "ranking", role: "primary_evidence", weight: 0.78 }, { id: "insight", role: "interpretation", weight: 0.22 }],
      alignment_axes: ["business_axis", "revenue_axis"],
      layers: ["background", "relationship", "text"],
    },
  };
}

test("complete unfamiliar page model passes", () => {
  assert.deepEqual(validatePageModel(validModel()), { ok: true, fields: 2, entities: 2, axes: ["business_axis", "revenue_axis"] });
});

test("missing story evidence stops instead of inventing a conclusion", () => {
  const model = validModel();
  model.story.source_ids = [];
  assert.throws(() => validatePageModel(model), (error) => error.code === "SOURCE_FIDELITY_FAIL");
});

test("unknown visual alignment axis stops", () => {
  const model = validModel();
  model.visual_consequence.alignment_axes.push("invented_axis");
  assert.throws(() => validatePageModel(model), (error) => error.code === "PAGE_MODEL_FAIL");
});

test("ambiguous sparse request cannot pass as a page model", () => {
  assert.throws(() => validatePageModel({ version: "2.0" }), (error) => error.code === "TARGET_AUDIENCE_FAIL");
});

test("compiled expression method routes without Markdown tokens or template cues", async () => {
  const result = await routeInput({ page_model: validModel() });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "bump-ranking");
  assert.equal(result.confidence, "compiled_structure");
});

test("non-blocking style information is optional", () => {
  const model = validModel();
  delete model.style_contract;
  assert.equal(validatePageModel(model).ok, true);
});

test("old or conflicting page-model version stops", () => {
  const model = validModel();
  model.version = "1.0";
  assert.throws(() => validatePageModel(model), (error) => error.code === "PAGE_MODEL_FAIL");
});
