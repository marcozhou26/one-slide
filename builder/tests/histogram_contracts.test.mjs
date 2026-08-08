import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateR3Module, calculateHistogram } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("complete input validates and reproduces every bin, sample count, and one-slide plan", async () => {
  const data = await fixture("histogram-valid.json");
  delete data.style;
  const result = validateR3Module(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  assert.deepEqual(calculateHistogram(data.diagram), { counts: [2,7,14,12,7,4,1,1], missing: 2, valid: 48, total: 50 });
  const plan = planR3Module(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.ok(plan.chart.width > plan.rail.width);
});

test("sparse natural language plus observations routes without asking for module or chart names", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "Please help managers see clearly which range the batch processing time is mainly concentrated in, whether it is skewed, and whether there is a long tail.",
    data: { metric: "Processing time", unit: "minutes", period: "2026year7month", values: [4,7,11,12,14,17,20,22,24,25,27,29,31,34,36,39,42,48,54,64,73] },
  });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "histogram");
  assert.match(result.evidence.join(" "), /continuous_numeric_observations/);
});

test("missing critical observations blocks instead of inventing a distribution", async () => {
  await assert.rejects(
    () => routeInput({ input_mode: "mixed", text: "Determine the concentration range and long tail of processing time", data: { metric: "Processing time", unit: "minutes", period: "2026year7month" } }),
    (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT",
  );
});

test("ambiguous conflicting units do not silently merge into a formal payload", async () => {
  const data = await fixture("histogram-valid.json");
  data.source_anchors[0].text += ";The unit of another version is seconds";
  data.diagram.unit = { text: "Minutes and seconds conflict", source_ids: ["G01"] };
  assert.throws(() => validateR3Module(data), (error) => error.code === "SOURCE_FIDELITY_FAIL");
});

test("missing non-blocking style and bin labels do not block valid observations", async () => {
  const data = await fixture("histogram-valid.json");
  delete data.style;
  delete data.diagram.bins;
  assert.equal(validateR3Module(data).ok, true);
});

test("sample totals must reconcile with explicit missing values", async () => {
  const data = await fixture("histogram-bad-sample.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "HISTOGRAM_SAMPLE_RECONCILIATION_FAIL");
});

test("duplicate or unsorted bin edges are blocked", async () => {
  const data = await fixture("histogram-bad-bins.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "HISTOGRAM_BINNING_FAIL");
});

test("abnormal numeric format is blocked without coercing units out of strings", async () => {
  const data = await fixture("histogram-abnormal-format.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "ABNORMAL_FORMAT_FAIL");
});

test("declared bin counts must be exactly reproducible from raw observations", async () => {
  const data = await fixture("histogram-valid.json");
  data.diagram.bins[2].count = 13;
  assert.throws(() => validateR3Module(data), (error) => error.code === "HISTOGRAM_BINNING_FAIL");
});

test("categorical labels do not masquerade as a continuous distribution", async () => {
  await assert.rejects(
    () => routeInput({ input_mode: "mixed", text: "Look at the distribution of different departments", data: { metric: "Department", unit: "people", period: "2026year7month", values: ["sales", "Delivery", "Finance", "sales"] } }),
    (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT",
  );
});

test("structured handoff keeps requested module, primary exhibit, and payload aligned", async () => {
  const payload = await fixture("histogram-valid.json");
  const routed = await routeV3({
    schema_version: "1.0", subject: "Processing time", story: "The distribution is concentrated and there is a long tail", source_ids: ["G01", "C01"],
    display_blocks: [{ block_id: "B01" }], structure: { primary_exhibit: "histogram" },
    requested_module: "histogram", module_payload: payload,
  });
  assert.equal(routed.route, "deterministic_module");
  assert.equal(routed.module_id, "histogram");
  assert.equal(routed.module_input, "module_payload");
});
