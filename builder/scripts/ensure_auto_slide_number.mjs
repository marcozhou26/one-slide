import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

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

const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const FIELD_ID = "{F7021451-1387-4CA6-816F-3879F97B5CBC}";

export const AUTO_SLIDE_NUMBER = Object.freeze({
  fontSizePt: 8,
  fontFace: "Arial",
  color: "697386",
  canvasWidth: 1280,
  canvasHeight: 720,
  width: 40,
  height: 14,
  right: 24,
  bottom: 12,
});

function hasSlideNumberPlaceholder(xml) {
  return /<p:ph\b[^>]*\btype=["']sldNum["']/u.test(xml);
}

function maxShapeId(xml) {
  let maximum = 1;
  for (const match of xml.matchAll(/<p:cNvPr\b[^>]*\bid=["'](\d+)["']/gu)) {
    maximum = Math.max(maximum, Number(match[1]));
  }
  return maximum;
}

function slideNumberShape({ id, x, y, width, height, cachedNumber }) {
  const style = AUTO_SLIDE_NUMBER;
  return `<p:sp xmlns:a="${DRAWING_NS}">` +
    `<p:nvSpPr><p:cNvPr id="${id}" name="Slide Number Placeholder ${id}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="sldNum" sz="quarter" idx="4294967295"/></p:nvPr></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="0"><a:noFill/></a:ln></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/>` +
    `<a:lstStyle><a:lvl1pPr><a:defRPr sz="${style.fontSizePt * 100}">` +
    `<a:solidFill><a:srgbClr val="${style.color}"/></a:solidFill>` +
    `<a:latin typeface="${style.fontFace}"/><a:ea typeface="${style.fontFace}"/><a:cs typeface="${style.fontFace}"/>` +
    `</a:defRPr></a:lvl1pPr></a:lstStyle>` +
    `<a:p><a:pPr algn="r"/><a:fld id="${FIELD_ID}" type="slidenum">` +
    `<a:rPr lang="en-US" sz="${style.fontSizePt * 100}"><a:solidFill><a:srgbClr val="${style.color}"/></a:solidFill>` +
    `<a:latin typeface="${style.fontFace}"/><a:ea typeface="${style.fontFace}"/><a:cs typeface="${style.fontFace}"/></a:rPr>` +
    `<a:t>${cachedNumber}</a:t></a:fld><a:endParaRPr lang="en-US" sz="${style.fontSizePt * 100}"/></a:p></p:txBody></p:sp>`;
}

function enableMasterSlideNumber(xml) {
  if (/<p:hf\b/u.test(xml)) {
    return xml.replace(/<p:hf\b([^>]*)\bsldNum=["'][^"']*["']([^>]*)\/>/u, '<p:hf$1sldNum="1"$2/>')
      .replace(/<p:hf(?![^>]*\bsldNum=)([^>]*)\/>/u, '<p:hf sldNum="1"$1/>');
  }
  if (xml.includes("<p:txStyles>")) return xml.replace("<p:txStyles>", '<p:hf sldNum="1"/><p:txStyles>');
  if (xml.includes("<p:extLst>")) return xml.replace("<p:extLst>", '<p:hf sldNum="1"/><p:extLst>');
  return xml.replace("</p:sldMaster>", '<p:hf sldNum="1"/></p:sldMaster>');
}

function addPlaceholder(xml, geometry, cachedNumber, partType) {
  let updated = partType === "master" ? enableMasterSlideNumber(xml) : xml;
  if (hasSlideNumberPlaceholder(updated)) return { xml: updated, added: false };
  const shape = slideNumberShape({ id: maxShapeId(updated) + 1, ...geometry, cachedNumber });
  if (!updated.includes("</p:spTree>")) throw new Error(`PPTX part has no p:spTree: ${partType}`);
  updated = updated.replace("</p:spTree>", `${shape}</p:spTree>`);
  return { xml: updated, added: true };
}

function parseSlideSize(presentationXml) {
  const tag = presentationXml.match(/<p:sldSz\b[^>]*>/u)?.[0];
  const width = tag?.match(/\bcx=["'](\d+)["']/u)?.[1];
  const height = tag?.match(/\bcy=["'](\d+)["']/u)?.[1];
  if (!width || !height) throw new Error("PPTX presentation.xml has no readable slide size");
  return { width: Number(width), height: Number(height) };
}

function numberGeometry(slideSize) {
  const style = AUTO_SLIDE_NUMBER;
  const xScale = slideSize.width / style.canvasWidth;
  const yScale = slideSize.height / style.canvasHeight;
  const width = Math.round(style.width * xScale);
  const height = Math.round(style.height * yScale);
  return {
    x: Math.round(slideSize.width - (style.right * xScale) - width),
    y: Math.round(slideSize.height - (style.bottom * yScale) - height),
    width,
    height,
  };
}

function classifyPart(name) {
  if (/^ppt\/slideMasters\/slideMaster\d+\.xml$/u.test(name)) return "master";
  if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/u.test(name)) return "layout";
  if (/^ppt\/slides\/slide\d+\.xml$/u.test(name)) return "slide";
  return null;
}

export async function ensureAutoSlideNumber(pptxPath) {
  const input = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(input);
  const presentationFile = zip.file("ppt/presentation.xml");
  if (!presentationFile) throw new Error("PPTX package is missing ppt/presentation.xml");
  const slideSize = parseSlideSize(await presentationFile.async("string"));
  const geometry = numberGeometry(slideSize);
  let addedParts = 0;
  let inspectedParts = 0;

  for (const name of Object.keys(zip.files).sort()) {
    const partType = classifyPart(name);
    if (!partType) continue;
    const file = zip.file(name);
    if (!file) continue;
    inspectedParts += 1;
    const cachedNumber = partType === "slide" ? Number(name.match(/slide(\d+)\.xml$/u)?.[1] ?? 1) : 1;
    const result = addPlaceholder(await file.async("string"), geometry, cachedNumber, partType);
    zip.file(name, result.xml);
    if (result.added) addedParts += 1;
  }

  if (inspectedParts === 0) throw new Error("PPTX package has no master, layout, or slide XML parts");
  const output = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const temporary = `${pptxPath}.numbering-${process.pid}.tmp`;
  await fs.writeFile(temporary, output);
  await fs.rename(temporary, pptxPath);
  return { status: "AUTO_SLIDE_NUMBER_READY", addedParts, inspectedParts, slideSize, geometry, style: AUTO_SLIDE_NUMBER };
}

async function main() {
  const pptxPath = process.argv[2];
  if (!pptxPath?.endsWith(".pptx")) throw new Error("Usage: ensure_auto_slide_number.mjs <file.pptx>");
  console.log(JSON.stringify(await ensureAutoSlideNumber(path.resolve(pptxPath))));
}

if (process.argv[1]?.endsWith("ensure_auto_slide_number.mjs")) {
  main().catch((error) => {
    console.error(JSON.stringify({ code: "AUTO_SLIDE_NUMBER_FAIL", message: error.message }));
    process.exitCode = 10;
  });
}
