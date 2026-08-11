import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateR5Module } from "../scripts/validate_r5_module.mjs";
import { planR5Module } from "../scripts/plan_r5_module.mjs";
import { routeModule } from "../scripts/route_module.mjs";

const modules = [
  "hr-age-gender-pyramid",
  "hr-workforce-reconciliation",
  "hr-new-hire-survival",
  "hr-supply-demand-gap",
  "hr-from-to-mobility",
  "hr-operating-diagnostic-matrix",
];
const fixture = async (name) => JSON.parse(await fs.readFile(new URL(`../assets/test-fixtures/${name}-valid.json`, import.meta.url), "utf8"));

for (const moduleId of modules) {
  test(`${moduleId} validates, plans deterministically and routes`, async () => {
    const data = await fixture(moduleId);
    assert.deepEqual(validateR5Module(data).unmappedSourceIds, []);
    assert.deepEqual(planR5Module(data), planR5Module(data));
    assert.equal((await routeModule({ requested_module: moduleId })).module.module_id, moduleId);
  });
}

test("R5 missing, conflict and abnormal input are blocked", async () => {
  const pyramid = await fixture("hr-age-gender-pyramid");
  pyramid.diagram.bands.pop();
  assert.throws(() => validateR5Module(pyramid), (error) => error.code === "DATA_CONTRACT_FAIL");

  const workforce = await fixture("hr-workforce-reconciliation");
  workforce.diagram.months[4].closing += 1;
  assert.throws(() => validateR5Module(workforce), (error) => error.code === "WORKFORCE_RECONCILIATION_FAIL");

  const survival = await fixture("hr-new-hire-survival");
  survival.diagram.cohorts[0].values[8] = survival.diagram.cohorts[0].values[7] + 1;
  assert.throws(() => validateR5Module(survival), (error) => error.code === "SURVIVAL_CURVE_FAIL");
});

test("R5 supply and matrix reconciliation are strict", async () => {
  const supply = await fixture("hr-supply-demand-gap");
  supply.diagram.strategies[0].count += 1;
  assert.throws(() => validateR5Module(supply), (error) => error.code === "SUPPLY_RECONCILIATION_FAIL");

  const mobility = await fixture("hr-from-to-mobility");
  mobility.diagram.matrix.pop();
  assert.throws(() => validateR5Module(mobility), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("workforce core reconciliation remains valid when overlays are omitted", async () => {
  const data = await fixture("hr-workforce-reconciliation");
  for (const month of data.diagram.months) {
    delete month.attrition_rate;
    delete month.recruitment_rate;
    delete month.budget;
  }
  assert.deepEqual(validateR5Module(data).unmappedSourceIds, []);
});

test("R5 percentage and enum ranges are gated", async () => {
  const workforce = await fixture("hr-workforce-reconciliation");
  workforce.diagram.months[0].attrition_rate = 101;
  assert.throws(() => validateR5Module(workforce), (error) => error.code === "PERCENTAGE_RANGE_FAIL");

  const survival = await fixture("hr-new-hire-survival");
  survival.diagram.cohorts[0].values[survival.diagram.cohorts[0].values.length - 1] = -1;
  assert.throws(() => validateR5Module(survival), (error) => error.code === "PERCENTAGE_RANGE_FAIL");

  const risk = await fixture("hr-new-hire-survival");
  risk.diagram.risk_rows[0].scores[0] = 4;
  assert.throws(() => validateR5Module(risk), (error) => error.code === "ENUM_RANGE_FAIL");

  const mobility = await fixture("hr-from-to-mobility");
  mobility.diagram.quality[0][1].retention = 120;
  assert.throws(() => validateR5Module(mobility), (error) => error.code === "PERCENTAGE_RANGE_FAIL");

  const operating = await fixture("hr-operating-diagnostic-matrix");
  operating.diagram.matrix[0][1].primary = 100.1;
  assert.throws(() => validateR5Module(operating), (error) => error.code === "PERCENTAGE_RANGE_FAIL");
});

test("operating diagnostic matrix accepts sparse presentation options and variable dimensions", async () => {
  const operating = await fixture("hr-operating-diagnostic-matrix");
  delete operating.diagram.metrics;
  delete operating.diagram.conclusion;
  delete operating.diagram.disclosure;
  operating.diagram.rows = operating.diagram.rows.slice(0, 3);
  operating.diagram.matrix = operating.diagram.matrix.slice(0, 3);
  assert.deepEqual(validateR5Module(operating).unmappedSourceIds, []);
});

test("operating diagnostic matrix blocks dimension, type and secondary-value conflicts", async () => {
  const dimensions = await fixture("hr-operating-diagnostic-matrix");
  dimensions.diagram.matrix[0].pop();
  assert.throws(() => validateR5Module(dimensions), (error) => error.code === "DATA_CONTRACT_FAIL");

  const textHeatmap = await fixture("hr-operating-diagnostic-matrix");
  textHeatmap.diagram.columns[3].primary.encoding = "heatmap";
  assert.throws(() => validateR5Module(textHeatmap), (error) => error.code === "DATA_CONTRACT_FAIL");

  const secondary = await fixture("hr-operating-diagnostic-matrix");
  secondary.diagram.columns = secondary.diagram.columns.slice(0, 2);
  secondary.diagram.columns[0].secondary = { kind: "percentage", unit: "%" };
  secondary.diagram.matrix = secondary.diagram.matrix.map((row) => row.slice(0, 2));
  assert.throws(() => validateR5Module(secondary), (error) => error.code === "DATA_CONTRACT_FAIL");
  secondary.diagram.matrix.forEach((row, index) => { row[0].secondary = 80 + index; });
  assert.deepEqual(validateR5Module(secondary).unmappedSourceIds, []);
});
