import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateR3Module } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { renderR3Module } from "../scripts/render_r3_module.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const fixture = async (name = "part-to-whole-valid.json") => JSON.parse(await fs.readFile(new URL(`../assets/test-fixtures/${name}`, import.meta.url), "utf8"));

test("doughnut and pie payloads validate and plan deterministically", async () => {
  for (const name of ["part-to-whole-valid.json", "part-to-whole-pie-valid.json"]) {
    const data = await fixture(name);
    assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
    assert.deepEqual(planR3Module(data), planR3Module(data));
  }
});

test("absolute non-percent values preserve the exact total and calculated share basis", async () => {
  const data = await fixture();
  data.diagram.unit = "件";
  data.diagram.total_value = 1000;
  data.diagram.parts = [
    { id: "p1", label: { text: "咨询", source_ids: ["S01"] }, value: 400, source_ids: ["S01"], priority: true },
    { id: "p2", label: { text: "办理", source_ids: ["S01"] }, value: 300, source_ids: ["S01"] },
    { id: "p3", label: { text: "投诉", source_ids: ["S01"] }, value: 200, source_ids: ["S01"] },
    { id: "p4", label: { text: "其他", source_ids: ["S01"] }, value: 100, source_ids: ["S01"] },
  ];
  data.diagram.center_label.text = "咨询";
  data.diagram.center_value.text = "40%";
  data.source_anchors[0].text += "；件；1000；咨询；400；办理；300；投诉；200；其他；100；40%";
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
});

test("reconciliation, range, IDs, source fidelity, and doughnut center are strict", async () => {
  const badTotal = await fixture();
  badTotal.diagram.parts[0].value = 71;
  assert.throws(() => validateR3Module(badTotal), (error) => error.code === "PART_TO_WHOLE_RECONCILIATION_FAIL");

  const missingTotal = await fixture();
  delete missingTotal.diagram.total_value;
  assert.throws(() => validateR3Module(missingTotal), (error) => error.code === "DATA_CONTRACT_FAIL");

  const negative = await fixture();
  negative.diagram.parts[0].value = -1;
  assert.throws(() => validateR3Module(negative), (error) => error.code === "DATA_CONTRACT_FAIL");

  for (const count of [2, 7]) {
    const wrongCount = await fixture();
    wrongCount.diagram.parts = Array.from({ length: count }, (_, index) => ({ id: `x${index}`, label: { text: "其他", source_ids: ["S01"] }, value: 100 / count, source_ids: ["S01"] }));
    assert.throws(() => validateR3Module(wrongCount), (error) => error.code === "DATA_CONTRACT_FAIL");
  }

  const duplicate = await fixture();
  duplicate.diagram.parts[1].id = duplicate.diagram.parts[0].id;
  assert.throws(() => validateR3Module(duplicate), (error) => error.code === "DATA_CONTRACT_FAIL");

  const centerSource = await fixture();
  centerSource.diagram.center_value.source_ids = [];
  assert.throws(() => validateR3Module(centerSource), (error) => error.code === "SOURCE_FIDELITY_FAIL");

  const visibleSource = await fixture();
  delete visibleSource.diagram.parts[0].label.source_ids;
  assert.throws(() => validateR3Module(visibleSource), (error) => error.code === "SOURCE_FIDELITY_FAIL");
});

test("routing selects a single reconciled total and rejects multi-period pie forcing", async () => {
  const explicit = await routeInput({ text: "请做一个环图，数据稍后补齐" });
  assert.equal(explicit.module.module_id, "part-to-whole");

  const inferred = await routeInput({
    input_mode: "mixed",
    text: "一个总量由三个互斥构成项组成并完全对平",
    data: { period: "2026", total_value: 100, unit: "%", parts: [{ label: "企业", value: 72 }, { label: "个人", value: 18 }, { label: "其他", value: 10 }] },
  });
  assert.equal(inferred.module.module_id, "part-to-whole");

  const multiPeriod = await routeInput({
    input_mode: "mixed",
    text: "用饼图比较跨期结构变化",
    data: { periods: ["2024", "2025", "2026"], totals: [100, 100, 100], series: [{ name: "企业", values: [60, 65, 70] }, { name: "个人", values: [40, 35, 30] }] },
  });
  assert.equal(multiPeriod.module.module_id, "composition-shift");
});

test("structured handoff requires matching requested, primary, and payload module IDs", async () => {
  const data = await fixture();
  const ready = await routeV3({ subject: "收入结构", story: data.title.text, source_ids: ["S01"], requested_module: "part-to-whole", structure: { primary_exhibit: "part-to-whole" }, module_payload: data });
  assert.equal(ready.route, "deterministic_module");
  const conflict = await routeV3({ subject: "收入结构", story: data.title.text, source_ids: ["S01"], requested_module: "marimekko", structure: { primary_exhibit: "part-to-whole" }, module_payload: data });
  assert.equal(conflict.route, "ROUTE_CONFLICT");
});

test("pie and doughnut render as native editable PowerPoint charts, including no-insight layout", async () => {
  for (const [name, expectedTag] of [["part-to-whole-valid.json", "doughnutChart"], ["part-to-whole-pie-valid.json", "pieChart"]]) {
    const data = await fixture(name);
    if (expectedTag === "pieChart") { data.diagram.insights = []; delete data.diagram.conclusion; }
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-part-to-whole-"));
    const output = { pptx: path.join(temp, `${expectedTag}.pptx`), preview: path.join(temp, `${expectedTag}.png`), layout: path.join(temp, `${expectedTag}.json`) };
    await renderR3Module(data, output);
    assert.ok((await fs.stat(output.pptx)).size > 1000);
    const entries = execFileSync("unzip", ["-Z1", output.pptx], { encoding: "utf8" });
    const chartPath = entries.split("\n").find((entry) => /\/charts\/chart1\.xml$/u.test(entry));
    assert.ok(chartPath, entries);
    const chartXml = execFileSync("unzip", ["-p", output.pptx, chartPath], { encoding: "utf8" });
    assert.match(chartXml, new RegExp(`<c:${expectedTag}>`, "u"));
  }
});
