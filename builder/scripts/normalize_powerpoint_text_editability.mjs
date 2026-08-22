import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const TRANSPARENT_HIT_FILL = `<a:solidFill xmlns:a="${DRAWING_NS}"><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill>`;

function loadJsZip() {
  const candidates = [null, process.env.CODEX_NODE_MODULES, process.env.NODE_PATH].filter(
    (value, index, values) => value === null || (Boolean(value) && values.indexOf(value) === index),
  );
  for (const base of candidates) {
    try {
      const require = createRequire(base ? path.join(base, "__oneslide_require__.cjs") : import.meta.url);
      return require("jszip");
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  throw new Error("JSZip is unavailable; set CODEX_NODE_MODULES to the bundled Node.js package directory");
}

const JSZip = loadJsZip();

function makeShapeFillHitTarget(shapePropertiesXml) {
  const noFill = /<a:noFill\b[^>]*\/>/u.exec(shapePropertiesXml);
  if (!noFill) return { xml: shapePropertiesXml, changed: false };

  const lineStart = shapePropertiesXml.search(/<a:ln\b/u);
  if (lineStart !== -1 && noFill.index > lineStart) {
    return { xml: shapePropertiesXml, changed: false };
  }

  return {
    xml: `${shapePropertiesXml.slice(0, noFill.index)}${TRANSPARENT_HIT_FILL}${shapePropertiesXml.slice(noFill.index + noFill[0].length)}`,
    changed: true,
  };
}

export function makeTextShapeHitTarget(shapeXml) {
  if (!/<p:txBody>/u.test(shapeXml)) {
    return { xml: shapeXml, changed: false, reason: "NOT_TEXT_SHAPE" };
  }
  const shapeProperties = /<p:spPr(?:\s[^>]*)?>[\s\S]*?<\/p:spPr>/u.exec(shapeXml);
  if (!shapeProperties) {
    return { xml: shapeXml, changed: false, reason: "NO_SHAPE_PROPERTIES" };
  }
  const prepared = makeShapeFillHitTarget(shapeProperties[0]);
  if (!prepared.changed) {
    return { xml: shapeXml, changed: false, reason: "EXISTING_SHAPE_FILL_PRESERVED" };
  }
  return {
    xml: `${shapeXml.slice(0, shapeProperties.index)}${prepared.xml}${shapeXml.slice(shapeProperties.index + shapeProperties[0].length)}`,
    changed: true,
    reason: "TRANSPARENT_TEXT_HIT_TARGET_ADDED",
  };
}

export function prepareSlideXmlForNativeTextSelection(slideXml) {
  let preparedTextShapes = 0;
  const xml = slideXml.replace(/<p:sp>[\s\S]*?<\/p:sp>/gu, (shape) => {
    const result = makeTextShapeHitTarget(shape);
    if (result.changed) preparedTextShapes += 1;
    return result.xml;
  });
  return { xml, preparedTextShapes };
}

export async function preparePowerPointTextEditability(pptxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  let inspectedParts = 0;
  let preparedTextShapes = 0;
  for (const name of Object.keys(zip.files).sort()) {
    if (!/^ppt\/slides\/slide\d+\.xml$/u.test(name)) continue;
    const file = zip.file(name);
    if (!file) continue;
    inspectedParts += 1;
    const result = prepareSlideXmlForNativeTextSelection(await file.async("string"));
    preparedTextShapes += result.preparedTextShapes;
    zip.file(name, result.xml);
  }
  if (inspectedParts === 0) throw new Error("PPTX package has no slide XML parts");
  const output = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const temporary = `${pptxPath}.text-editability-${process.pid}.tmp`;
  await fs.writeFile(temporary, output);
  await fs.rename(temporary, pptxPath);
  return {
    status: "POWERPOINT_TEXT_HIT_TARGETS_READY",
    inspectedParts,
    preparedTextShapes,
  };
}

async function main() {
  const pptxPath = process.argv[2];
  if (!pptxPath?.endsWith(".pptx")) {
    throw new Error("Usage: normalize_powerpoint_text_editability.mjs <file.pptx>");
  }
  console.log(JSON.stringify(await preparePowerPointTextEditability(path.resolve(pptxPath))));
}

if (process.argv[1]?.endsWith("normalize_powerpoint_text_editability.mjs")) {
  main().catch((error) => {
    console.error(JSON.stringify({ code: "POWERPOINT_TEXT_EDITABILITY_FAIL", message: error.message }));
    process.exitCode = 10;
  });
}
