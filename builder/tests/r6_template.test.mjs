import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const template = path.join(skillRoot, "assets/test-fixtures/r6-brand-template.pptx");
const generated = path.join(skillRoot, "assets/reference-pages/tornado-sensitivity.pptx");
const script = path.join(skillRoot, "scripts/apply_powerpoint_template.py");
const extract = (pptx, member) => spawnSync("unzip", ["-p", pptx, member], { encoding: null });
const count = (text, pattern) => [...text.matchAll(pattern)].length;

test("template following preserves master and adds native editable shapes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "consulting-template-test-"));
  const output = path.join(directory, "branded.pptx");
  const manifest = path.join(directory, "manifest.json");
  const result = spawnSync("python3", [script, "--template", template, "--generated", generated, "--output", output, "--manifest", manifest], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const audit = JSON.parse(await fs.readFile(manifest, "utf8"));
  assert.equal(audit.template_master_preserved, true);
  assert.equal(audit.template_layout_preserved, true);
  assert.ok(audit.editable_shapes_cloned > 20);
  const outputMaster = extract(output, "ppt/slideMasters/slideMaster1.xml");
  assert.equal(outputMaster.status, 0);
  const masterXml = outputMaster.stdout.toString("utf8");
  assert.equal(count(masterXml, /<p:ph\b[^>]*\btype=["']sldNum["']/gu), 1);
  assert.match(masterXml, /<a:rPr\b[^>]*\bsz=["']800["']/u);
  const slide = extract(output, "ppt/slides/slide1.xml");
  assert.equal(slide.status, 0);
  const slideXml = slide.stdout.toString("utf8");
  assert.match(slideXml, /template-footer/);
  assert.match(slideXml, /结果的 70% 波动来自两个变量/);
  assert.doesNotMatch(slideXml, /<p:pic>/);
  assert.equal(count(slideXml, /<p:ph\b[^>]*\btype=["']sldNum["']/gu), 1);
  assert.equal(count(slideXml, /<a:fld\b[^>]*\btype=["']slidenum["']/gu), 1);
  assert.match(slideXml, /<a:rPr\b[^>]*\bsz=["']800["']/u);
  assert.equal(audit.automatic_slide_number_ready, true);
});

test("missing or corrupt template is blocked with a stable code", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "consulting-template-fail-"));
  const output = path.join(directory, "bad.pptx");
  const missing = spawnSync("python3", [script, "--template", path.join(directory, "missing.pptx"), "--generated", generated, "--output", output], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stdout).code, "TEMPLATE_COMPATIBILITY_FAIL");
  const corrupt = path.join(directory, "corrupt.pptx");
  await fs.writeFile(corrupt, "not a zip");
  const corruptResult = spawnSync("python3", [script, "--template", corrupt, "--generated", generated, "--output", output], { encoding: "utf8" });
  assert.equal(corruptResult.status, 2);
  assert.equal(JSON.parse(corruptResult.stdout).code, "TEMPLATE_COMPATIBILITY_FAIL");
});
