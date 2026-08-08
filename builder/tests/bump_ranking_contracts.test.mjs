import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadR3ModuleInput, validateR3Module } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeModule } from "../scripts/route_module.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("bump-ranking validates and plans a five-period migration", async () => {
  const data = await fixture("bump-ranking-valid.json");
  assert.equal(validateR3Module(data).ok, true);
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
  const plan = planR3Module(data);
  assert.equal(plan.chart.width, 888);
  assert.equal(plan.rail.width, 250);
});

test("bump-ranking accepts explicit new and exited states", async () => {
  const data = await fixture("bump-ranking-entry-exit.json");
  assert.equal(validateR3Module(data).ok, true);
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
});

test("legacy slope-ranking fixture normalizes to bump-ranking", async () => {
  const data = await loadR3ModuleInput(path.join(skillRoot, "assets/test-fixtures/slope-ranking-valid.json"));
  assert.equal(data.module_id, "bump-ranking");
  assert.equal(data.diagram.type, "bump-ranking");
  assert.deepEqual(data.diagram.periods.map((item) => item.text), ["2023 年", "2026 年"]);
  assert.equal(validateR3Module(data).ok, true);
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
});

test("duplicate ranks at one period are blocked", async () => {
  const data = await fixture("bump-ranking-valid.json");
  data.diagram.objects[1].ranks[2] = data.diagram.objects[0].ranks[2];
  assert.throws(() => validateR3Module(data), (error) => error.code === "BUMP_RANK_CONFLICT");
});

test("rank arrays must match the period count", async () => {
  const data = await fixture("bump-ranking-valid.json");
  data.diagram.objects[0].ranks.pop();
  assert.throws(() => validateR3Module(data), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("bump and slope names route to the upgraded module", async () => {
  const bump = await routeInput({ input_mode: "text", text: "做一张五个时点的排名迁移 Bump Chart" });
  assert.equal(bump.module.module_id, "bump-ranking");
  const legacy = await routeModule({ requested_module: "slope-ranking" });
  assert.equal(legacy.module.module_id, "bump-ranking");
});
