import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validateR2Module } from "../scripts/validate_r2_module.mjs";
import { planR2Module } from "../scripts/plan_r2_module.mjs";
import { routeModule } from "../scripts/route_module.mjs";

const fixture = async (name) => JSON.parse(await fs.readFile(new URL(`../assets/test-fixtures/${name}-valid.json`, import.meta.url), "utf8"));
const modules = ["route-tradeoff", "scqa-roadmap", "bubble-heatmap", "chart-insight", "scenario-planning"];

for (const moduleId of modules) {
  test(`${moduleId} validates, maps all source anchors, and plans deterministically`, async () => {
    const data = await fixture(moduleId);
    assert.deepEqual(validateR2Module(data).unmappedSourceIds, []);
    assert.deepEqual(planR2Module(data), planR2Module(data));
    assert.equal((await routeModule({ requested_module: moduleId })).module.module_id, moduleId);
  });
}

test("chart-insight blocks unit, axis and insight-anchor correctness failures", async () => {
  const data = await fixture("chart-insight");
  const unitMismatch = structuredClone(data);
  unitMismatch.diagram.series[1].unit = "万元";
  assert.throws(() => validateR2Module(unitMismatch), (error) => error.code === "CHART_UNIT_MISMATCH");
  const outOfAxis = structuredClone(data);
  outOfAxis.diagram.ratio.values[0] = outOfAxis.diagram.ratio.axis_max + 1;
  assert.throws(() => validateR2Module(outOfAxis), (error) => error.code === "RATIO_AXIS_FAIL");
  const badAnchor = structuredClone(data);
  badAnchor.diagram.insights[0].anchor.category_id = "missing-period";
  assert.throws(() => validateR2Module(badAnchor), (error) => error.code === "INSIGHT_ANCHOR_FAIL");
  const negativeBar = structuredClone(data);
  negativeBar.diagram.series[0].values[0] = -1;
  assert.throws(() => validateR2Module(negativeBar), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("R2 module-specific contradictions are blocked", async () => {
  const scenario = await fixture("scenario-planning");
  scenario.diagram.scenarios[0].probability = 30;
  assert.throws(() => validateR2Module(scenario), (error) => error.code === "SCENARIO_PROBABILITY_FAIL");
  const bubble = await fixture("bubble-heatmap");
  bubble.diagram.items[1].rank = bubble.diagram.items[0].rank;
  assert.throws(() => validateR2Module(bubble), (error) => error.code === "DATA_CONTRACT_FAIL");
});
