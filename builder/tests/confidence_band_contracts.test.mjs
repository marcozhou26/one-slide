import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfidenceBand, loadConfidenceBandInput } from "../scripts/validate_confidence_band.mjs";
import { planConfidenceBand } from "../scripts/plan_confidence_band.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name = "confidence-band-valid.json") => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("complete ordered estimates and intervals validate and plan one page", async () => {
  const data = await fixture(); const result = validateConfidenceBand(data); const plan = planConfidenceBand(data);
  assert.equal(result.ok, true); assert.deepEqual(result.unmappedSourceIds, []); assert.deepEqual(plan.slide, { width: 1280, height: 720 }); assert.ok(plan.chart.width > plan.rail.width);
});

test("sparse payload does not require style or threshold", async () => {
  const data = await fixture("confidence-band-sparse.json"); delete data.style;
  assert.equal(validateConfidenceBand(data).ok, true);
});

test("missing interval definition is a genuine blocker", async () => {
  const data = await fixture("confidence-band-missing-definition.json");
  assert.throws(() => validateConfidenceBand(data));
});

test("lower estimate upper ordering is enforced", async () => {
  const data = await fixture("confidence-band-invalid-bounds.json");
  assert.throws(() => validateConfidenceBand(data), (error) => error.code === "INTERVAL_ORDER_FAIL");
});

test("period labels and order must be unique and ordered", async () => {
  const data = await fixture("confidence-band-period-conflict.json");
  assert.throws(() => validateConfidenceBand(data), (error) => error.code === "PERIOD_ORDER_FAIL");
});

test("all-null period is allowed only with a visible note", async () => {
  const data = await fixture("confidence-band-missing-value.json");
  assert.equal(validateConfidenceBand(data).ok, true);
  delete data.diagram.missing_value_note;
  assert.throws(() => validateConfidenceBand(data), (error) => error.code === "MISSING_VALUE_CONTRACT_FAIL");
});

test("partial interval missing is blocked", async () => {
  const data = await fixture("confidence-band-partial-missing.json");
  assert.throws(() => validateConfidenceBand(data), (error) => error.code === "MISSING_VALUE_CONTRACT_FAIL");
});

test("confidence interval is not relabelled as prediction or risk", async () => {
  const data = await fixture("confidence-band-semantic-conflict.json");
  assert.throws(() => validateConfidenceBand(data), (error) => error.code === "INTERVAL_SEMANTICS_FAIL");
});

test("anonymous natural language routes without module or chart names", async () => {
  const text = "Please compare the center estimates, upper and lower bounds, and interval widths for eight consecutive quarters using independently sampled quarterly proportions and95%resampling range; focus on which quarters the uncertainty expands and the entire range is crossed6%line of concern, and whether the direction is stable when it falls back.";
  assert.doesNotMatch(text, /confidence|band|confidence band|Polyline|chart|module/i);
  const result = await routeInput({ input_mode: "text", text });
  assert.equal(result.decision, "selected"); assert.equal(result.module.module_id, "confidence-band");
});

test("aligned estimate lower upper arrays infer the relationship", async () => {
  const result = await routeInput({ input_mode: "mixed", text: "Compare center estimates, upper and lower bounds, and range widths from quarter to quarter to identify periods when uncertainty expands and lines of concern are crossed.", data: { periods: ["Q1","Q2","Q3","Q4","Q5"], estimate: [1,2,3,4,5], lower: [0,1,2,3,4], upper: [2,3,4,5,6], metric: "Proportion", unit: "%", interval_definition: "95%resampling range" } });
  assert.equal(result.module.module_id, "confidence-band");
});

test("Producer executable handoff keeps module fields aligned", async () => {
  const data = await fixture(); const result = await routeV3({ subject: "quarterly estimates", story: data.title.text, source_ids: ["S01"], requested_module: "confidence-band", structure: { primary_exhibit: "confidence-band" }, module_payload: data });
  assert.equal(result.route, "deterministic_module"); assert.equal(result.module_input, "module_payload");
});

test("abnormal JSON format is rejected", async () => {
  await assert.rejects(() => loadConfidenceBandInput(path.join(skillRoot, "assets/test-fixtures/confidence-band-invalid-format.json")), SyntaxError);
});
