import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateScatterRegression, calculateLinearRegression, loadScatterRegressionInput } from "../scripts/validate_scatter_regression.mjs";
import { planScatterRegression } from "../scripts/plan_scatter_regression.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("complete input reproduces OLS statistics, sample handling and one-page plan", async () => {
  const data = await fixture("scatter-regression-valid.json");
  const result = validateScatterRegression(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  assert.equal(result.calculated.valid.length, 16);
  assert.equal(result.calculated.duplicate_pairs, 0);
  assert.ok(Math.abs(result.calculated.slope - 0.61875) < 1e-10);
  assert.ok(Math.abs(result.calculated.intercept - 37.875) < 1e-10);
  assert.ok(Math.abs(result.calculated.r_squared - 0.8083691143293792) < 1e-10);
  const plan = planScatterRegression(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.ok(plan.chart.width > plan.rail.width);
});

test("representative natural language and paired values route without a module or chart name", async () => {
  const text = "Please ask the project leader to judge the direction and strength of the relationship between input time and on-time delivery completion, identify projects that obviously deviate from the overall trend, and explain to what extent the conclusion can be explained.";
  assert.doesNotMatch(text, /scatter|regression|Scatter|Return|chart|module/i);
  const observations = [
    [20,48],[24,51],[28,54],[32,58],[36,59],[40,64],[44,66],[48,68],[52,73],[56,74],[60,78],[64,81]
  ].map(([x,y], index) => ({ id: `p${index + 1}`, x, y }));
  const result = await routeInput({ input_mode: "mixed", text, data: { x_metric: "hours invested", x_unit: "hours", y_metric: "On-time delivery completion", y_unit: "%", period: "2026first half of year", observations } });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "scatter-regression");
  assert.match(result.evidence.join(" "), /paired_continuous_observations/);
});

test("missing paired observations blocks without inventing a fitted relationship", async () => {
  await assert.rejects(
    () => routeInput({ input_mode: "mixed", text: "Determine the direction and strength of the relationship between two indicators", data: { x_metric: "invest", x_unit: "hours", y_metric: "Completeness", y_unit: "%", period: "2026year" } }),
    (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT",
  );
});

test("conflicting units in paired records stop routing instead of silently merging", async () => {
  const observations = Array.from({ length: 8 }, (_, index) => ({ id: String(index), x: index + 1, y: index * 2 + 3, x_unit: index === 7 ? "day" : "hours", y_unit: "%", period: "2026year" }));
  await assert.rejects(
    () => routeInput({ input_mode: "mixed", text: "Determine the relationship direction and deviation trend of two continuous indicators", data: { x_metric: "invest", x_unit: "hours", y_metric: "Completeness", y_unit: "%", period: "2026year", observations } }),
    (error) => error.code === "SOURCE_BASELINE_FAIL",
  );
});

test("missing non-blocking style does not block a valid statistical payload", async () => {
  const data = await fixture("scatter-regression-valid.json");
  delete data.style;
  assert.equal(validateScatterRegression(data).ok, true);
});

test("zero variance is rejected before producing a misleading line", async () => {
  const data = await fixture("scatter-regression-zero-variance.json");
  assert.throws(() => validateScatterRegression(data), (error) => error.code === "REGRESSION_ZERO_VARIANCE");
});

test("fewer than eight formal valid pairs is rejected", async () => {
  const data = await fixture("scatter-regression-valid.json");
  data.diagram.observations = data.diagram.observations.slice(0, 7);
  data.diagram.sample = { total: 7, valid: 7, missing: 0, duplicate_pairs: 0 };
  const calculated = calculateLinearRegression(data.diagram.observations);
  data.diagram.statistics = { slope: calculated.slope, intercept: calculated.intercept, r_squared: calculated.r_squared, source_ids: ["C01"] };
  assert.throws(() => validateScatterRegression(data), (error) => ["DATA_CONTRACT_FAIL", "REGRESSION_SAMPLE_TOO_SMALL"].includes(error.code));
});

test("declared slope, intercept and R-squared must reconcile from unrounded pairs", async () => {
  const data = await fixture("scatter-regression-valid.json");
  data.diagram.statistics.r_squared = 0.91;
  assert.throws(() => validateScatterRegression(data), (error) => error.code === "REGRESSION_STATISTICS_RECONCILIATION_FAIL");
});

test("highlighted observations must follow the declared absolute-residual rule", async () => {
  const data = await fixture("scatter-regression-valid.json");
  data.diagram.highlight_ids = ["p01", "p02"];
  assert.throws(() => validateScatterRegression(data), (error) => error.code === "REGRESSION_OUTLIER_RECONCILIATION_FAIL");
});

test("malformed JSON is rejected as an abnormal input file", async () => {
  await assert.rejects(() => loadScatterRegressionInput(path.join(skillRoot, "assets/test-fixtures/scatter-regression-abnormal-format.json")), SyntaxError);
});

test("executable Producer handoff keeps requested module, primary exhibit and payload aligned", async () => {
  const payload = await fixture("scatter-regression-valid.json");
  const routed = await routeV3({ subject: "The relationship between two continuous indicators", story: payload.title.text, source_ids: ["S01", "C01", "G01"], display_blocks: [{ block_id: "B01" }], requested_module: "scatter-regression", structure: { primary_exhibit: "scatter-regression" }, module_payload: payload });
  assert.equal(routed.route, "deterministic_module");
  assert.equal(routed.module_id, "scatter-regression");
  assert.equal(routed.module_input, "module_payload");
});

test("renderer loader directly consumes a formal Producer handoff and keeps direct payload compatibility", async (t) => {
  const payload = await fixture("scatter-regression-valid.json");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "scatter-regression-loader-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  const handoffPath = path.join(tempDir, "builder-handoff.json");
  const payloadPath = path.join(tempDir, "module-payload.json");
  const handoff = {
    schema_version: "1.0",
    product: "single-consulting-slide-producer",
    output_mode: "PPT_DRAFT",
    single_slide: true,
    subject: "Anonymous project investment and delivery relationship",
    story: payload.title.text,
    source_ids: ["G01", "G02", "C01"],
    structure: { primary_exhibit: "scatter-regression" },
    requested_module: "scatter-regression",
    module_payload: payload,
  };
  await Promise.all([
    fs.writeFile(handoffPath, JSON.stringify(handoff), "utf8"),
    fs.writeFile(payloadPath, JSON.stringify(payload), "utf8"),
  ]);
  const [loadedHandoff, loadedPayload] = await Promise.all([
    loadScatterRegressionInput(handoffPath),
    loadScatterRegressionInput(payloadPath),
  ]);
  assert.equal(loadedHandoff.module_id, "scatter-regression");
  assert.deepEqual(loadedHandoff, payload);
  assert.deepEqual(loadedPayload, payload);
});
