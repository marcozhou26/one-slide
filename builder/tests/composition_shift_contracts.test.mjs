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

test("composition-shift validates a four-period share migration without style input", async () => {
  const data = await fixture("composition-shift-valid.json");
  delete data.style;
  const result = validateR3Module(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  const plan = planR3Module(data);
  assert.equal(plan.slide.width, 1280);
  assert.equal(plan.slide.height, 720);
  assert.ok(plan.chart.width > plan.rail.width);
});

test("composition-shift validates reconciled absolute values and denominators", async () => {
  const data = await fixture("composition-shift-valid.json");
  data.diagram.basis = "absolute";
  data.source_anchors.find((item) => item.id === "S03").text += "; million yuan";
  data.diagram.unit = { text: "million yuan", source_ids: ["S03"] };
  data.diagram.totals = [100, 200, 300, 400];
  data.diagram.total_source_ids = ["S03"];
  data.diagram.components[0].values = [42, 92, 153, 228];
  data.diagram.components[1].values = [28, 58, 84, 104];
  data.diagram.components[2].values = [20, 34, 42, 44];
  data.diagram.components[3].values = [10, 16, 21, 24];
  assert.equal(validateR3Module(data).ok, true);
});

test("composition-shift accepts six distinct components and an explicit zero share", async () => {
  const data = await fixture("composition-shift-valid.json");
  data.source_anchors.find((item) => item.id === "S03").text += "; Channel cooperation; Subscription support";
  data.diagram.components[0].shares = [40, 44, 49, 55];
  data.diagram.components[1].shares = [26, 27, 26, 24];
  data.diagram.components[2].shares = [18, 15, 12, 9];
  data.diagram.components[3].shares = [10, 8, 7, 6];
  data.diagram.components.push(
    { id: "channel", label: { text: "Channel cooperation", source_ids: ["S03"] }, shares: [6, 5, 4, 3], source_ids: ["S03"] },
    { id: "support", label: { text: "Subscription support", source_ids: ["S03"] }, shares: [0, 1, 2, 3], source_ids: ["S03"] },
  );
  assert.equal(validateR3Module(data).ok, true);
});

test("composition-shift blocks period shares that do not sum to 100", async () => {
  const data = await fixture("composition-shift-bad-total.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "COMPOSITION_RECONCILIATION_FAIL");
});

test("composition-shift blocks arrays that do not match the period count", async () => {
  const data = await fixture("composition-shift-length-mismatch.json");
  assert.throws(() => validateR3Module(data), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("composition-shift routes from explicit and sparse natural-language relationships", async () => {
  const explicit = await routeInput({ input_mode: "text", text: "Please make one100%Stacked column chart comparing four-year income structure" });
  assert.equal(explicit.module.module_id, "composition-shift");
  const sparse = await routeInput({ input_mode: "text", text: "compare2022Arrive2025Structural changes in the proportion of the four types of income in the year, total for each period100%" });
  assert.equal(sparse.module.module_id, "composition-shift");
});

test("composition-shift infers reconciled multi-period components without module or chart hints", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "Based on the attached data, please answer what changes have occurred in the revenue structure in the past five years and where resources should be prioritized in the next year.",
    data: {
      periods: ["2021", "2022", "2023", "2024", "2025"],
      series: [
        { name: "Subscription platform", values: [108, 147, 197.6, 268.8, 366] },
        { name: "Dosage andAIvalue added", values: [36, 54, 83.6, 115.2, 152.5] },
        { name: "Implementation services", values: [72, 72, 72.2, 67.2, 61] },
        { name: "Support and more", values: [24, 27, 26.6, 28.8, 30.5] },
      ],
      totals: [240, 300, 380, 480, 610],
    },
  });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "composition-shift");
  assert.match(result.evidence.join(" "), /reconciled_component_series/);
});

test("generic parallel trends without totals do not masquerade as composition shift", async () => {
  await assert.rejects(
    () => routeInput({
      input_mode: "mixed",
      text: "Compare business trends over the past five years",
      data: { periods: ["2021", "2022", "2023"], series: [{ name: "A", values: [1, 2, 3] }, { name: "B", values: [3, 4, 5] }] },
    }),
    (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT",
  );
});
