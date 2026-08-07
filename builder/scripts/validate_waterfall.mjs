import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

export function validateWaterfall(data) {
  requireCondition(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(data?.module_id === "waterfall-attribution", "LOGIC_STRUCTURE_FAIL", "Expected waterfall-attribution module");
  requireCondition(data?.diagram?.type === "waterfall", "LOGIC_STRUCTURE_FAIL", "Expected waterfall diagram");
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const { start, end, contributions } = data.diagram;
  requireCondition(Number.isFinite(start?.value) && Number.isFinite(end?.value), "DATA_CONTRACT_FAIL", "Start and end values are required");
  validateVisibleText(start, anchors, "Start label");
  validateVisibleText(end, anchors, "End label");
  (start.source_ids ?? []).forEach((id) => mapped.add(id));
  (end.source_ids ?? []).forEach((id) => mapped.add(id));
  requireCondition(Array.isArray(contributions) && contributions.length >= 2 && contributions.length <= 7, "DATA_CONTRACT_FAIL", "Waterfall requires two to seven contributions");
  const ids = new Set();
  for (const contribution of contributions) {
    requireCondition(typeof contribution.id === "string" && !ids.has(contribution.id), "DATA_CONTRACT_FAIL", "Contribution ids must be unique");
    ids.add(contribution.id);
    requireCondition(Number.isFinite(contribution.value) && contribution.value !== 0, "DATA_CONTRACT_FAIL", "Contribution values must be non-zero numbers");
    validateVisibleText(contribution, anchors, `Contribution ${contribution.id}`);
    (contribution.source_ids ?? []).forEach((id) => mapped.add(id));
    if (contribution.explanation) {
      validateVisibleText(contribution.explanation, anchors, `Explanation ${contribution.id}`);
      (contribution.explanation.source_ids ?? []).forEach((id) => mapped.add(id));
    }
  }
  const calculated = start.value + contributions.reduce((sum, item) => sum + item.value, 0);
  const tolerance = data.diagram.tolerance ?? 1e-6;
  requireCondition(Math.abs(calculated - end.value) <= tolerance, "WATERFALL_RECONCILIATION_FAIL", `Waterfall does not reconcile: calculated ${calculated}, expected ${end.value}`);
  for (const insight of data.diagram.insights ?? []) {
    validateVisibleText(insight, anchors, "Insight");
    (insight.source_ids ?? []).forEach((id) => mapped.add(id));
  }
  if (data.diagram.bottom_conclusion) {
    validateVisibleText(data.diagram.bottom_conclusion, anchors, "Bottom conclusion");
    (data.diagram.bottom_conclusion.source_ids ?? []).forEach((id) => mapped.add(id));
  }
  for (const footnote of data.diagram.footnotes ?? []) {
    validateVisibleText(footnote, anchors, "Footnote");
    (footnote.source_ids ?? []).forEach((id) => mapped.add(id));
  }
  return { ok: true, reconciled_value: calculated, ...validateAllAnchorsMapped(data.source_anchors, mapped) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_waterfall.mjs <input.json>");
    const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
    process.stdout.write(`${JSON.stringify(validateWaterfall(data))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
