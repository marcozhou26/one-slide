import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateR3Module } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("box-plot validates complete distribution summaries without style input", async () => {
  const data = await fixture("box-plot-valid.json");
  delete data.style;
  const result = validateR3Module(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  const plan = planR3Module(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.ok(plan.chart.width > plan.rail.width);
});

test("box-plot keeps sample size, missing values, period, unit, quartile method and whisker rule explicit", async () => {
  const data = await fixture("box-plot-valid.json");
  assert.ok(data.diagram.groups.every((group) => Number.isInteger(group.sample_size) && Number.isInteger(group.missing_count)));
  assert.match(data.diagram.quartile_method.text, /PERCENTILE\.INC/);
  assert.match(data.diagram.whisker_rule.text, /1\.5×IQR/);
  assert.match(data.diagram.period.text, /2026/);
  assert.match(data.diagram.unit.text, /natural day/);
  assert.equal(validateR3Module(data).ok, true);
});

test("box-plot blocks missing critical statistical definitions", async () => {
  const data = await fixture("box-plot-valid.json");
  delete data.diagram.quartile_method;
  assert.throws(() => validateR3Module(data), (error) => error.code === "SOURCE_FIDELITY_FAIL");
});

test("box-plot blocks outliers placed inside whiskers", async () => {
  const data = await fixture("box-plot-invalid-outlier.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "BOX_PLOT_RECONCILIATION_FAIL");
});

test("box-plot blocks abnormal group format", async () => {
  const data = await fixture("box-plot-valid.json");
  data.diagram.groups = "five regions";
  assert.throws(() => validateR3Module(data), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("box-plot stops conflicting group units instead of silently normalizing them", async () => {
  await assert.rejects(() => routeInput({
    input_mode: "mixed",
    text: "Compare lead time distribution and exception records across three regions",
    data: { groups: [
      { q1: 2, median: 3, q3: 4, whisker_low: 1, whisker_high: 5, sample_size: 20, missing_count: 0, unit: "day" },
      { q1: 2, median: 3, q3: 4, whisker_low: 1, whisker_high: 5, sample_size: 20, missing_count: 0, unit: "hours" },
      { q1: 2, median: 3, q3: 4, whisker_low: 1, whisker_high: 5, sample_size: 20, missing_count: 0, unit: "day" },
    ] },
  }), (error) => error.code === "SOURCE_BASELINE_FAIL");
});

test("box-plot routes a sparse natural request without a module or chart name", async () => {
  const result = await routeInput({
    input_mode: "text",
    text: "To compare the order delivery cycles of the five regions on the same scale, readers need to look at the typical level, middle level50%Range, dispersion, and abnormally long periods are recorded, with the number of samples and missing values noted.",
  });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "box-plot");
});

test("box-plot infers structured distribution summaries without visual hints", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "Compare lead time distribution, fluctuations and abnormal records across regions.",
    data: {
      groups: ["A", "B", "C"].map((name, index) => ({ name, q1: 2 + index, median: 3 + index, q3: 4 + index, whisker_low: 1 + index, whisker_high: 5 + index, sample_size: 30, missing_count: index })),
    },
  });
  assert.equal(result.module.module_id, "box-plot");
  assert.match(result.evidence.join(" "), /group_distribution_summary/);
});

test("generic group comparison does not masquerade as a distribution summary", async () => {
  await assert.rejects(() => routeInput({ input_mode: "text", text: "Compare average lead times across five regions" }), (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT");
});
