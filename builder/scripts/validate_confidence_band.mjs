import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const fail = (condition, code, message) => requireCondition(condition, code, message);

function sourceContext(data) {
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const text = (item, label) => {
    validateVisibleText(item, anchors, label);
    (item.source_ids ?? []).forEach((id) => mapped.add(id));
  };
  const ids = (sourceIds, label) => {
    fail(Array.isArray(sourceIds) && sourceIds.length > 0, "SOURCE_FIDELITY_FAIL", `${label} needs source_ids`);
    sourceIds.forEach((id) => {
      fail(anchors.has(id), "SOURCE_FIDELITY_FAIL", `${label} cites unknown source ${id}`);
      mapped.add(id);
    });
  };
  return { mapped, text, ids };
}

export function validateConfidenceBand(data) {
  fail(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  fail(data?.module_id === "confidence-band", "LOGIC_STRUCTURE_FAIL", "Expected confidence-band module_id");
  fail(data?.diagram?.type === "confidence-band", "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const c = sourceContext(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  const d = data.diagram;
  for (const [item, label] of [
    [d.metric, "Metric"], [d.unit, "Unit"], [d.interval_label, "Interval label"],
    [d.interval_definition, "Interval definition"], [d.estimation_method, "Estimation method"],
    [d.sample_definition, "Sample definition"], [d.population_definition, "Population definition"],
    [d.source_note, "Source note"],
  ]) c.text(item, label);
  fail(["confidence_interval", "credible_interval", "other_interval"].includes(d.interval_type), "INTERVAL_DEFINITION_FAIL", "interval_type must identify the interval semantics");
  if (d.interval_type === "confidence_interval") {
    fail(Number.isFinite(d.confidence_level) && d.confidence_level > 0 && d.confidence_level < 100, "INTERVAL_DEFINITION_FAIL", "A confidence interval needs a confidence_level between 0 and 100");
    fail(/confidence/iu.test(d.interval_label.text) && !/prediction|forecast|risk/iu.test(d.interval_label.text), "INTERVAL_SEMANTICS_FAIL", "A confidence interval must not be relabelled as a prediction or risk interval");
  }
  fail(Array.isArray(d.periods) && d.periods.length >= 5 && d.periods.length <= 12, "DATA_CONTRACT_FAIL", "Confidence band needs 5–12 ordered periods");
  const labels = new Set();
  let priorOrder = -Infinity;
  let observed = 0;
  let hasMissing = false;
  d.periods.forEach((period, index) => {
    c.text(period.label, `Period ${index + 1} label`);
    fail(!labels.has(period.label.text), "PERIOD_ORDER_FAIL", "Period labels must be unique");
    labels.add(period.label.text);
    fail(Number.isFinite(period.order) && period.order > priorOrder, "PERIOD_ORDER_FAIL", "Period order must be strictly increasing");
    priorOrder = period.order;
    const values = [period.estimate, period.lower, period.upper];
    const missingCount = values.filter((value) => value === null).length;
    fail(missingCount === 0 || missingCount === 3, "MISSING_VALUE_CONTRACT_FAIL", "Estimate, lower and upper must be all present or all null for a period");
    if (missingCount === 3) {
      hasMissing = true;
    } else {
      observed += 1;
      fail(values.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Estimate and interval bounds must be finite numbers");
      fail(period.lower <= period.estimate && period.estimate <= period.upper, "INTERVAL_ORDER_FAIL", "Every period must satisfy lower <= estimate <= upper");
    }
    if (period.sample_size != null) fail(Number.isInteger(period.sample_size) && period.sample_size > 0, "SAMPLE_CONTRACT_FAIL", "sample_size must be a positive integer when supplied");
    c.ids(period.source_ids, `Period ${index + 1} values`);
  });
  fail(observed >= 4, "DATA_CONTRACT_FAIL", "At least four periods need observed intervals");
  fail(!hasMissing || d.missing_value_note, "MISSING_VALUE_CONTRACT_FAIL", "Missing periods require a visible missing_value_note");
  if (d.missing_value_note) c.text(d.missing_value_note, "Missing value note");
  if (d.threshold) {
    fail(Number.isFinite(d.threshold.value), "THRESHOLD_CONTRACT_FAIL", "Threshold value must be finite");
    c.text(d.threshold.label, "Threshold label");
    c.text(d.threshold.semantics, "Threshold semantics");
    c.ids(d.threshold.source_ids, "Threshold");
  }
  fail(Array.isArray(d.insights) && d.insights.length >= 1 && d.insights.length <= 3, "DATA_CONTRACT_FAIL", "Confidence band needs 1–3 source-backed insights");
  d.insights.forEach((item) => c.text(item, "Insight"));
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
  if (d.disclosure) c.text(d.disclosure, "Disclosure");
  const mapping = validateAllAnchorsMapped(data.source_anchors, c.mapped);
  return { ok: true, module_id: data.module_id, normalized: structuredClone(data), ...mapping };
}

export async function loadConfidenceBandInput(inputPath) {
  const parsed = JSON.parse(await fs.readFile(inputPath, "utf8"));
  return validateConfidenceBand(parsed?.module_payload?.module_id === "confidence-band" ? parsed.module_payload : parsed).normalized;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) throw new Error("Usage: validate_confidence_band.mjs <input.json>");
    const result = validateConfidenceBand(JSON.parse(await fs.readFile(inputPath, "utf8")));
    process.stdout.write(`${JSON.stringify({ ...result, normalized: undefined })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
