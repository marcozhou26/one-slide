import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const FORBIDDEN_VISIBLE = /\b(?:IQR|CAGR|bootstrap|PERCENTILE\.INC|OLS|p[- ]?value)\b|Type\s*7|R[²2]/iu;

function parseArgs(argv) {
  const options = { requiredNotes: [], maxVisibleChars: 420 };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--require-note") { options.requiredNotes.push(value); index += 1; continue; }
    if (key === "--layout") { options.layout = value; index += 1; continue; }
    if (key === "--pptx") { options.pptx = value; index += 1; continue; }
    if (key === "--max-visible-chars") { options.maxVisibleChars = Number(value); index += 1; continue; }
    throw new Error(`Unknown or incomplete argument: ${key}`);
  }
  if (!options.layout || !options.pptx || !Number.isFinite(options.maxVisibleChars)) {
    throw new Error("Usage: audit_public_readability.mjs --layout <layout.json> --pptx <file.pptx> [--require-note <text>] [--max-visible-chars <n>]");
  }
  return options;
}

function xmlText(xml) {
  return String(xml ?? "")
    .replace(/<a:br\s*\/>/gu, "\n")
    .replace(/<\/a:p>/gu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&")
    .trim();
}

export async function auditPublicReadability({ layoutPath, pptxPath, requiredNotes = [], maxVisibleChars = 420 }) {
  const layout = JSON.parse(await fs.readFile(layoutPath, "utf8"));
  const textElements = (layout.elements ?? []).filter((element) => typeof element.text === "string" && element.text.trim());
  const findings = [];
  const visibleText = textElements.map((element) => element.text).join("\n");
  const forbidden = visibleText.match(FORBIDDEN_VISIBLE);
  if (forbidden) findings.push({ code: "UNEXPLAINED_VISIBLE_TERM", text: forbidden[0] });
  const footerText = textElements.filter((element) => Number(element.bbox?.[1]) >= 640);
  const invalidFooter = footerText.filter((element) => element.name !== "data-source-footer");
  if (invalidFooter.length) findings.push({ code: "FOOTER_NOT_SOURCE_ONLY", names: invalidFooter.map((element) => element.name) });
  const dataSources = textElements.filter((element) => element.name === "data-source-footer");
  if (dataSources.length !== 1 || !dataSources[0]?.text.startsWith("数据来源：")) findings.push({ code: "DATA_SOURCE_FOOTER_MISSING_OR_DUPLICATE", count: dataSources.length });
  if (visibleText.replace(/\s/gu, "").length > maxVisibleChars) findings.push({ code: "VISIBLE_INFORMATION_BUDGET_FAIL", visibleChars: visibleText.replace(/\s/gu, "").length, maxVisibleChars });

  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const noteNames = Object.keys(zip.files).filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(name));
  const noteText = (await Promise.all(noteNames.map(async (name) => xmlText(await zip.file(name).async("string"))))).join("\n");
  if (!noteText) findings.push({ code: "SPEAKER_NOTES_MISSING" });
  for (const expected of requiredNotes) if (!noteText.includes(expected)) findings.push({ code: "SPEAKER_NOTES_COVERAGE_FAIL", expected });

  return {
    ok: findings.length === 0,
    code: findings.length === 0 ? "PUBLIC_READABILITY_PASS" : "PUBLIC_READABILITY_FAIL",
    visibleChars: visibleText.replace(/\s/gu, "").length,
    noteChars: noteText.replace(/\s/gu, "").length,
    findings,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await auditPublicReadability({
    layoutPath: path.resolve(options.layout),
    pptxPath: path.resolve(options.pptx),
    requiredNotes: options.requiredNotes,
    maxVisibleChars: options.maxVisibleChars,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 10;
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(new URL(import.meta.url).pathname)) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 2; });
}
