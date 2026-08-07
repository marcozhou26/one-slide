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

test("R2 module-specific contradictions are blocked", async () => {
  const scenario = await fixture("scenario-planning");
  scenario.diagram.scenarios[0].probability = 30;
  assert.throws(() => validateR2Module(scenario), (error) => error.code === "SCENARIO_PROBABILITY_FAIL");
  const bubble = await fixture("bubble-heatmap");
  bubble.diagram.items[1].rank = bubble.diagram.items[0].rank;
  assert.throws(() => validateR2Module(bubble), (error) => error.code === "DATA_CONTRACT_FAIL");
});
