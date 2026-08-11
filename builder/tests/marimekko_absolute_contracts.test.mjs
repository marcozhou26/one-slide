import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { validateR3Module } from "../scripts/validate_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fixture() {
  return JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures/marimekko-valid.json"), "utf8"));
}

test("absolute Marimekko validates and plans unequal width and height geometry", async () => {
  const data = await fixture();
  assert.equal(data.diagram.layout_mode, "absolute");
  assert.equal(validateR3Module(data).ok, true);
  assert.equal(planR3Module(data).chart.width, 850);
});

test("absolute Marimekko blocks stack values that do not reconcile to the column total", async () => {
  const data = await fixture();
  data.diagram.segments[0].stacks[0].value += 1;
  assert.throws(() => validateR3Module(data), (error) => error.code === "MEKKO_RECONCILIATION_FAIL");
});

test("Marimekko remains discoverable from unequal-width and absolute-value language", async () => {
  const result = await routeInput({ input_mode: "text", text: "按细分规模决定列宽，按绝对利润决定列高和内部构成，做一张不等宽不等高 Marimekko" });
  assert.equal(result.module.module_id, "marimekko");
});
