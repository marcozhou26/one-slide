import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

function loadJsZip() {
  for (const base of [null, process.env.CODEX_NODE_MODULES, process.env.NODE_PATH]) {
    if (base === "") continue;
    try {
      const require = createRequire(base ? path.join(base, "__oneslide_require__.cjs") : import.meta.url);
      return require("jszip");
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
    }
  }
  throw new Error("JSZip is unavailable");
}

const JSZip = loadJsZip();

function patchRelationshipShape(shapeXml) {
  if (/<a:tailEnd\b/u.test(shapeXml)) return shapeXml;
  return shapeXml.replace(/(<a:ln\b[^>]*>[\s\S]*?<a:prstDash\b[^>]*\/>)/u, '$1<a:tailEnd type="triangle" w="sm" len="sm"/>');
}

export async function ensureCurveArrowheads(pptxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  let patched = 0;
  for (const name of Object.keys(zip.files).filter((item) => /^ppt\/slides\/slide\d+\.xml$/u.test(item))) {
    const file = zip.file(name);
    let xml = await file.async("string");
    xml = xml.replace(/<p:sp>(?:(?!<p:sp>).)*?<p:cNvPr\b[^>]*\bname="relationship-(?!label-)[^"]+"[\s\S]*?<\/p:sp>/gu, (shape) => {
      const updated = patchRelationshipShape(shape);
      if (updated !== shape) patched += 1;
      return updated;
    });
    zip.file(name, xml);
  }
  if (patched === 0) throw new Error("CURVE_ARROWHEAD_PATCH_FAIL: no relationship curves found");
  const output = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const temporary = `${pptxPath}.arrowheads-${process.pid}.tmp`;
  await fs.writeFile(temporary, output);
  await fs.rename(temporary, pptxPath);
  return { status: "CURVE_ARROWHEADS_READY", patched };
}

if (process.argv[1]?.endsWith("ensure_curve_arrowheads.mjs")) {
  ensureCurveArrowheads(path.resolve(process.argv[2])).then(console.log).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
