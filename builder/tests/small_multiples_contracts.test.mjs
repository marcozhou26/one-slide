import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateR3Module } from "../scripts/validate_r3_module.mjs";
import { planR3Module } from "../scripts/plan_r3_module.mjs";
import { renderR3Module } from "../scripts/render_r3_module.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const fixtureUrl = new URL("../assets/test-fixtures/small-multiples-valid.json", import.meta.url);
const fixture = async () => JSON.parse(await fs.readFile(fixtureUrl, "utf8"));

test("small multiples validates and plans deterministically for 3, 7, and 9 panels", async () => {
  for (const count of [3, 7, 9]) {
    const data = await fixture();
    data.diagram.panels = data.diagram.panels.slice(0, count);
    assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
    assert.deepEqual(planR3Module(data), planR3Module(data));
  }
});

test("small multiples supports an optional benchmark and native column series", async () => {
  const data = await fixture();
  data.diagram.series_type = "column";
  delete data.diagram.benchmark;
  delete data.diagram.benchmark_label;
  delete data.diagram.benchmark_source_ids;
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
});

test("small multiples blocks implicit state, inconsistent periods, and scale overflow", async () => {
  const implicit = await fixture();
  delete implicit.diagram.panels[0].classification_state;
  assert.throws(() => validateR3Module(implicit), (error) => error.code === "DATA_CONTRACT_FAIL");

  const inconsistent = await fixture();
  inconsistent.diagram.panels[0].values.pop();
  assert.throws(() => validateR3Module(inconsistent), (error) => error.code === "DATA_CONTRACT_FAIL");

  const overflow = await fixture();
  overflow.diagram.panels[0].values[0] = overflow.diagram.scale.max + 1;
  assert.throws(() => validateR3Module(overflow), (error) => error.code === "SCALE_RANGE_FAIL");
});

test("small multiples classification is driven by state, not visible wording", async () => {
  const data = await fixture();
  data.diagram.panels[0].classification.text = "自定义处置文字";
  data.diagram.panels[0].classification_state = "exit";
  data.source_anchors.find((item) => item.id === "S02").text += "；自定义处置文字";
  assert.deepEqual(validateR3Module(data).unmappedSourceIds, []);
});

test("small multiples renders a native editable PPTX", async () => {
  const data = await fixture();
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-small-multiples-"));
  const output = {
    pptx: path.join(temp, "small-multiples.pptx"),
    preview: path.join(temp, "small-multiples.png"),
    layout: path.join(temp, "small-multiples-layout.json"),
  };
  await renderR3Module(data, output);
  assert.ok((await fs.stat(output.pptx)).size > 1000);
  assert.ok((await fs.stat(output.preview)).size > 1000);
  assert.ok((await fs.stat(output.layout)).size > 100);
});

test("retired modules cannot fall through structured direct composition", async () => {
  const map = await routeV3({ subject: "区域表现", story: "按省市行政区绘制分布地图", source_ids: ["S01"], requested_module: "region-map-table" });
  assert.equal(map.route, "MAP_POLITICAL_RISK_BLOCKED");
  const spiral = await routeV3({ subject: "成熟度", story: "多轮提升", source_ids: ["S01"], requested_module: "spiral-maturity" });
  assert.equal(spiral.route, "MODULE_RETIRED");
  const survival = await routeV3({ subject: "新人留存", story: "比较入职批次留存", source_ids: ["S01"], requested_module: "hr-new-hire-survival" });
  assert.equal(survival.route, "MODULE_RETIRED");
});
