import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderR3Module } from "../scripts/render_r3_module.mjs";
import { renderConfidenceBand } from "../scripts/render_confidence_band.mjs";
import { auditPublicReadability } from "../scripts/audit_public_readability.mjs";

const fixture = async (name) => JSON.parse(await fs.readFile(new URL(`../assets/test-fixtures/${name}`, import.meta.url), "utf8"));

async function renderCase(name, data, renderer, requiredNotes) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), `oneslide-public-${name}-`));
  const output = {
    pptx: path.join(directory, `${name}.pptx`),
    preview: path.join(directory, `${name}.png`),
    layout: path.join(directory, `${name}.layout.json`),
  };
  await renderer(data, output);
  const audit = await auditPublicReadability({ layoutPath: output.layout, pptxPath: output.pptx, requiredNotes });
  assert.equal(audit.ok, true, JSON.stringify(audit.findings));
  assert.ok(audit.noteChars > 20);
  return { audit, output };
}

test("box plot moves IQR and quartile methods to notes and keeps a source-only footer", async () => {
  const { output } = await renderCase("box-plot", await fixture("box-plot-valid.json"), renderR3Module, ["IQR", "PERCENTILE.INC"]);
  const layout = JSON.parse(await fs.readFile(output.layout, "utf8"));
  assert.equal(JSON.stringify(layout).includes("box-denominator"), false);
});

test("confidence band moves bootstrap, scope and threshold semantics to notes", async () => {
  await renderCase("confidence-band", await fixture("confidence-band-valid.json"), renderConfidenceBand, ["bootstrap", "目标总体"]);
});

test("marimekko translates CAGR on the slide and preserves the formula in notes", async () => {
  await renderCase("marimekko", await fixture("marimekko-valid.json"), renderR3Module, ["CAGR", "期末值"]);
});
