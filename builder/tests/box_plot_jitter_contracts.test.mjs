import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadR3ModuleInput, validateR3Module } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("complete grouped observations validate and plan without style input", async () => {
  const data = await fixture("box-plot-jitter-valid.json");
  delete data.style;
  const result = validateR3Module(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  const plan = planR3Module(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.ok(plan.chart.width > plan.rail.width);
});

test("sparse natural language with raw groups routes without module or chart names", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "Please use one page to compare the processing time distribution of each employee in the four work groups so that readers can see the typical levels, sample density and outliers at the same time.",
    data: {
      groups: [
        { name: "Group A", observations: [42,44,45,46,47,48,49,50,52,54,58,72] },
        { name: "Group B", observations: [38,40,41,42,43,44,45,46,47,49,51,53] },
        { name: "Group C", observations: [45,46,47,48,49,50,51,52,54,56,59,61] },
        { name: "Group D", observations: [35,37,39,40,41,42,43,44,46,48,50,65] }
      ]
    }
  });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "box-plot-jitter");
  assert.match(result.evidence.join(" "), /grouped_raw_observations/);
});

test("missing key unit is blocked instead of inferred", async () => {
  const data = await fixture("box-plot-jitter-missing-unit.json");
  assert.throws(() => validateR3Module(data));
});

test("declared sample size must equal raw observation count", async () => {
  const data = await fixture("box-plot-jitter-sample-mismatch.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "SAMPLE_SIZE_MISMATCH");
});

test("ambiguous group statistics without raw observations do not masquerade as a supported distribution", async () => {
  await assert.rejects(() => routeInput({ input_mode: "mixed", text: "Compare the distribution of each group", data: { groups: [{ name: "A", median: 10 }, { name: "B", median: 12 }] } }), (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT");
});

test("missing non-blocking visual preferences still validates", async () => {
  const data = await fixture("box-plot-jitter-valid.json");
  delete data.style;
  delete data.diagram.jitter_seed;
  assert.equal(validateR3Module(data).ok, true);
});

test("abnormal observation formats are blocked", async () => {
  const data = await fixture("box-plot-jitter-abnormal-format.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "ABNORMAL_FORMAT_FAIL");
});

test("Producer executable handoff is consumed without rewriting the module payload", async () => {
  const handoffPath = process.env.BOX_PLOT_HANDOFF;
  if (!handoffPath) return;
  const handoff = JSON.parse(await fs.readFile(handoffPath, "utf8"));
  const loaded = await loadR3ModuleInput(handoffPath);
  assert.equal(loaded.module_id, "box-plot-jitter");
  assert.deepEqual(loaded.diagram.groups, handoff.module_payload.diagram.groups);
  assert.equal(validateR3Module(loaded).ok, true);
});
