import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeGanttDependencies, validateR4Module } from "../scripts/validate_r4_module.mjs";

const builderRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = path.join(builderRoot, "assets/test-fixtures/gantt-dependency-valid.json");

async function fixture() {
  return JSON.parse(await fs.readFile(fixturePath, "utf8"));
}

test("Gantt dependencies require explicit semantics when task periods overlap", async () => {
  const data = await fixture();
  assert.equal(validateR4Module(data).ok, true);
  const broken = structuredClone(data.diagram);
  delete broken.dependencies[1].dependency_type;
  assert.throws(
    () => normalizeGanttDependencies(broken),
    (error) => error.code === "GANTT_DEPENDENCY_TYPE_REQUIRED",
  );
});

test("Gantt render keeps connectors complete and separates axis labels from milestones", async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-gantt-"));
  const pptx = path.join(work, "gantt.pptx");
  const preview = path.join(work, "gantt.png");
  const layoutPath = path.join(work, "gantt.layout.json");
  execFileSync(process.execPath, [
    path.join(builderRoot, "scripts/render_r4_module.mjs"),
    "--input", fixturePath,
    "--pptx", pptx,
    "--preview", preview,
    "--layout", layoutPath,
  ], { stdio: "pipe" });

  const xml = execFileSync("unzip", ["-p", pptx, "ppt/slides/slide1.xml"], { encoding: "utf8" });
  const connectors = xml.match(/<p:cxnSp>[\s\S]*?<\/p:cxnSp>/g) ?? [];
  assert.equal(connectors.length, 9);
  connectors.forEach((connector) => {
    assert.match(connector, /<a:stCxn\b/);
    assert.match(connector, /<a:endCxn\b/);
  });

  const layout = JSON.parse(await fs.readFile(layoutPath, "utf8"));
  const byName = new Map(layout.elements.map((element) => [element.name, element]));
  const monthLabels = layout.elements.filter((element) => /^month-label-/.test(element.name ?? ""));
  const milestones = layout.elements.filter((element) => /^milestone-/.test(element.name ?? ""));
  const monthBottom = Math.max(...monthLabels.map((element) => element.bbox[1] + element.bbox[3]));
  const milestoneTop = Math.min(...milestones.map((element) => element.bbox[1]));
  assert.ok(monthBottom <= milestoneTop, `month labels end at ${monthBottom}, milestone band starts at ${milestoneTop}`);

  for (let index = 1; index <= 10; index += 1) {
    const taskLabel = byName.get(`task-label-t${index}`);
    const progressLabel = byName.get(`task-t${index}`);
    assert.equal(taskLabel.textLayout.lineCount, 1);
    assert.equal(taskLabel.resolvedFontSize, 16); // artifact units = 12 PowerPoint pt
    assert.equal(progressLabel.textLayout.lineCount, 1);
    assert.equal(progressLabel.resolvedFontSize, 13.33); // artifact units = 10 PowerPoint pt
  }

  const sidePanel = byName.get("gantt-side");
  for (let index = 1; index <= 3; index += 1) {
    const card = byName.get(`gantt-metric-${index}`);
    assert.ok(card.bbox[0] >= sidePanel.bbox[0]);
    assert.ok(card.bbox[1] >= sidePanel.bbox[1]);
    assert.ok(card.bbox[0] + card.bbox[2] <= sidePanel.bbox[0] + sidePanel.bbox[2]);
    assert.ok(card.bbox[1] + card.bbox[3] <= sidePanel.bbox[1] + sidePanel.bbox[3]);
  }
});
