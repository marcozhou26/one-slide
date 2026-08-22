import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import {
  makeTextShapeHitTarget,
  preparePowerPointTextEditability,
} from "../scripts/normalize_powerpoint_text_editability.mjs";
import { renderReferenceList } from "../scripts/render_reference_list.mjs";

const require = createRequire(
  process.env.CODEX_NODE_MODULES
    ? path.join(process.env.CODEX_NODE_MODULES, "__oneslide_test_require__.cjs")
    : import.meta.url,
);
const JSZip = require("jszip");

const noFillTextShape = '<p:sp><p:nvSpPr/><p:spPr><a:xfrm/><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1400" b="1"/><a:t>已有文字</a:t></a:r></a:p></p:txBody></p:sp>';

test("no-fill text shape gains an invisible PowerPoint hit target without changing its text or line", () => {
  const result = makeTextShapeHitTarget(noFillTextShape);
  assert.equal(result.changed, true);
  assert.equal(result.reason, "TRANSPARENT_TEXT_HIT_TARGET_ADDED");
  assert.match(result.xml, /<a:solidFill[^>]*><a:srgbClr val="FFFFFF"><a:alpha val="0"\/><\/a:srgbClr><\/a:solidFill>/u);
  assert.match(result.xml, /<a:ln><a:noFill\/><\/a:ln>/u);
  assert.match(result.xml, /<a:rPr sz="1400" b="1"\/>/u);
  assert.match(result.xml, /<a:t>已有文字<\/a:t>/u);
});

test("existing text-shape fill is preserved", () => {
  const filled = noFillTextShape.replace(
    "<a:noFill/>",
    '<a:solidFill><a:srgbClr val="E8F0F8"/></a:solidFill>',
  );
  const result = makeTextShapeHitTarget(filled);
  assert.equal(result.changed, false);
  assert.equal(result.reason, "EXISTING_SHAPE_FILL_PRESERVED");
  assert.equal(result.xml, filled);
});

test("OneSlide export gives transparent text shapes stable hit targets and remains idempotent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-text-editability-"));
  const output = {
    pptx: path.join(directory, "editable.pptx"),
    preview: path.join(directory, "preview.png"),
    layout: path.join(directory, "layout.json"),
  };
  const fixture = new URL("../assets/test-fixtures/reference-list-valid.json", import.meta.url);
  await renderReferenceList(JSON.parse(await fs.readFile(fixture, "utf8")), output);
  const zip = await JSZip.loadAsync(await fs.readFile(output.pptx));
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  const shape = xml.match(/<p:sp>[\s\S]*?<p:cNvPr\b[^>]*name="reference-citation-1"[\s\S]*?<\/p:sp>/u)?.[0];
  assert.ok(shape, "reference-citation-1 must exist");
  assert.match(shape, /<a:solidFill[^>]*><a:srgbClr val="FFFFFF"><a:alpha val="0"\/><\/a:srgbClr><\/a:solidFill>/u);

  const repeated = await preparePowerPointTextEditability(output.pptx);
  assert.equal(repeated.preparedTextShapes, 0);
});
