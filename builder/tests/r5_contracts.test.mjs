import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateR5Module } from "../scripts/validate_r5_module.mjs";
import { planR5Module } from "../scripts/plan_r5_module.mjs";
import { routeModule } from "../scripts/route_module.mjs";

const modules = [
  "hr-age-gender-pyramid",
  "hr-workforce-reconciliation",
  "hr-supply-demand-gap",
  "hr-level-function-matrix",
  "hr-from-to-mobility",
  "hr-service-catalog",
  "hr-ticket-intake",
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

});

test("R5 percentage ranges are gated", async () => {
  const workforce = await fixture("hr-workforce-reconciliation");
  workforce.diagram.months[0].attrition_rate = 101;
  assert.throws(() => validateR5Module(workforce), (error) => error.code === "PERCENTAGE_RANGE_FAIL");
  const mobility = await fixture("hr-from-to-mobility");
  mobility.diagram.quality[0][1].retention = 120;
  assert.throws(() => validateR5Module(mobility), (error) => error.code === "PERCENTAGE_RANGE_FAIL");
  const service = await fixture("hr-service-catalog");
  service.diagram.services[0].automation = -0.1;
  assert.throws(() => validateR5Module(service), (error) => error.code === "PERCENTAGE_RANGE_FAIL");
  const intake = await fixture("hr-ticket-intake");
  intake.diagram.matrix[0][0].one_touch = 100.1;
  assert.throws(() => validateR5Module(intake), (error) => error.code === "PERCENTAGE_RANGE_FAIL");
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
