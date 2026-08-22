import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { renderReferenceList } from "../scripts/render_reference_list.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixturePath = path.join(skillRoot, "assets/test-fixtures/reference-list-valid.json");
const semanticAudit = path.join(skillRoot, "scripts/audit_pptx_semantics.py");

const relevantParts = (zip) => Object.keys(zip.files).filter((name) =>
  /^ppt\/(?:slideMasters\/slideMaster|slideLayouts\/slideLayout|slides\/slide)\d+\.xml$/u.test(name),
);

test("every rendered page receives one native 8 pt automatic number at bottom right", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-auto-number-"));
  const output = {
    pptx: path.join(directory, "numbered.pptx"),
    preview: path.join(directory, "preview.png"),
    layout: path.join(directory, "layout.json"),
  };
  const data = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  await renderReferenceList(data, output);

  const zip = await JSZip.loadAsync(await fs.readFile(output.pptx));
  const parts = relevantParts(zip);
  assert.deepEqual(parts.sort(), [
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slides/slide1.xml",
  ]);
  for (const name of parts) {
    const xml = await zip.file(name).async("string");
    assert.equal((xml.match(/type="sldNum"/gu) ?? []).length, 1, name);
    assert.equal((xml.match(/type="slidenum"/gu) ?? []).length, 1, name);
    assert.match(xml, /sz="800"/u, name);
    assert.match(xml, /<a:off x="11582400" y="6610350"\/>/u, name);
    assert.match(xml, /<a:ext cx="381000" cy="133350"\/>/u, name);
  }

  const audit = spawnSync("python3", [semanticAudit, output.pptx], { encoding: "utf8" });
  assert.equal(audit.status, 0, audit.stdout || audit.stderr);
  assert.equal(JSON.parse(audit.stdout).code, "SEMANTIC_AUDIT_PASS");
});

test("the automatic-number postprocessor is idempotent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-auto-number-repeat-"));
  const output = {
    pptx: path.join(directory, "numbered.pptx"),
    preview: path.join(directory, "preview.png"),
    layout: path.join(directory, "layout.json"),
  };
  const data = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  await renderReferenceList(data, output);
  const script = path.join(skillRoot, "scripts/ensure_auto_slide_number.mjs");
  const repeated = spawnSync(process.execPath, [script, output.pptx], { encoding: "utf8" });
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).addedParts, 0);

  const zip = await JSZip.loadAsync(await fs.readFile(output.pptx));
  for (const name of relevantParts(zip)) {
    const xml = await zip.file(name).async("string");
    assert.equal((xml.match(/type="sldNum"/gu) ?? []).length, 1, name);
  }
});

test("semantic audit blocks a page that has no automatic slide number", () => {
  const unnumbered = path.join(skillRoot, "assets/reference-pages/reference-list.pptx");
  const audit = spawnSync("python3", [semanticAudit, unnumbered], { encoding: "utf8" });
  assert.equal(audit.status, 10);
  assert.match(audit.stdout, /automatic slide-number placeholder/u);
});
