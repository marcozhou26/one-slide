import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildSankeyRibbonPath, computeSankeyGeometry } from "../scripts/sankey_geometry.mjs";
import { renderR4Module } from "../scripts/render_r4_module.mjs";

const fixture = async () => JSON.parse(
  await fs.readFile(new URL("../assets/test-fixtures/sankey-flow-valid.json", import.meta.url), "utf8"),
);

test("Sankey geometry preserves proportional node and ribbon thickness", async () => {
  const data = await fixture();
  const geometry = computeSankeyGeometry(
    data.diagram.layers,
    data.diagram.flows,
    { left: 100, top: 180, width: 620, height: 360 },
    { nodeWidth: 20, gap: 14 },
  );
  for (const layer of data.diagram.layers) {
    for (const node of layer.nodes) {
      assert.ok(Math.abs(geometry.nodes[node.id].height - node.value * geometry.scale) < 1e-9);
      const outgoing = geometry.flows.filter((flow) => flow.from === node.id);
      const incoming = geometry.flows.filter((flow) => flow.to === node.id);
      if (outgoing.length) {
        assert.ok(Math.abs(outgoing.reduce((sum, flow) => sum + flow.thickness, 0) - geometry.nodes[node.id].height) < 1e-9);
      }
      if (incoming.length) {
        assert.ok(Math.abs(incoming.reduce((sum, flow) => sum + flow.thickness, 0) - geometry.nodes[node.id].height) < 1e-9);
      }
    }
  }
  const pathGeometry = buildSankeyRibbonPath(geometry.flows[0]);
  assert.equal(pathGeometry.customPaths[0].commands.filter((item) => item.cubicBezTo).length, 2);
  assert.deepEqual(pathGeometry.customPaths[0].commands.at(-1), { close: {} });
});

test("Sankey renderer exports native Bezier ribbons and borderless square nodes", async () => {
  const data = await fixture();
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-sankey-ribbon-"));
  const output = {
    pptx: path.join(directory, "sankey.pptx"),
    preview: path.join(directory, "sankey.png"),
    layout: path.join(directory, "sankey.layout.json"),
  };
  await renderR4Module(data, output);
  const extracted = spawnSync("unzip", ["-p", output.pptx, "ppt/slides/slide1.xml"], { encoding: "utf8" });
  assert.equal(extracted.status, 0, extracted.stderr);
  const xml = extracted.stdout;
  assert.equal((xml.match(/<a:custGeom\b/g) ?? []).length, data.diagram.flows.length);
  assert.equal((xml.match(/<a:cubicBezTo>/g) ?? []).length, data.diagram.flows.length * 2);
  assert.equal((xml.match(/name="sankey-ribbon-/g) ?? []).length, data.diagram.flows.length);
  assert.doesNotMatch(xml, /sankey-crossing-underpass/);
  const socialNode = xml.split("<p:sp>").find((part) => part.includes('name="node-social"')) ?? "";
  assert.match(socialNode, /<a:prstGeom prst="rect"[^>]*>/);
  assert.match(socialNode, /<a:ln[^>]*>\s*<a:noFill\s*\/>/);
});
