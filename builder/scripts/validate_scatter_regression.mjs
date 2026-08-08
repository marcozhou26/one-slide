import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const TOLERANCE = 1e-6;
const fail = (condition, code, message) => requireCondition(condition, code, message);

function mappedContext(data) {
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const text = (item, label) => {
    validateVisibleText(item, anchors, label);
    (item.source_ids ?? []).forEach((id) => mapped.add(id));
  };
  const source = (ids, label) => {
    fail(Array.isArray(ids) && ids.length > 0, "SOURCE_FIDELITY_FAIL", `${label} needs source_ids`);
    ids.forEach((id) => {
      fail(anchors.has(id), "SOURCE_FIDELITY_FAIL", `${label} cites unknown source ${id}`);
      mapped.add(id);
    });
  };
  return { mapped, text, source };
}

export function calculateLinearRegression(observations) {
  const valid = observations.filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y));
  fail(valid.length >= 3, "REGRESSION_SAMPLE_TOO_SMALL", "At least three valid x/y pairs are required to fit a line");
  const xMean = valid.reduce((sum, item) => sum + item.x, 0) / valid.length;
  const yMean = valid.reduce((sum, item) => sum + item.y, 0) / valid.length;
  const sxx = valid.reduce((sum, item) => sum + (item.x - xMean) ** 2, 0);
  const syy = valid.reduce((sum, item) => sum + (item.y - yMean) ** 2, 0);
  fail(sxx > TOLERANCE && syy > TOLERANCE, "REGRESSION_ZERO_VARIANCE", "Both x and y must have non-zero variance");
  const sxy = valid.reduce((sum, item) => sum + (item.x - xMean) * (item.y - yMean), 0);
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const enriched = valid.map((item) => {
    const fitted = intercept + slope * item.x;
    return { ...item, fitted, residual: item.y - fitted };
  });
  const sse = enriched.reduce((sum, item) => sum + item.residual ** 2, 0);
  const rSquared = 1 - sse / syy;
  const duplicatePairs = valid.length - new Set(valid.map((item) => `${item.x}\u0000${item.y}`)).size;
  return { valid: enriched, slope, intercept, r_squared: rSquared, duplicate_pairs: duplicatePairs };
}

export function validateScatterRegression(data) {
  fail(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  fail(data?.module_id === "scatter-regression", "LOGIC_STRUCTURE_FAIL", "Expected scatter-regression module_id");
  fail(data?.diagram?.type === "scatter-regression", "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const c = mappedContext(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  const d = data.diagram;
  for (const [item, label] of [
    [d.x_metric, "X metric"], [d.x_unit, "X unit"], [d.y_metric, "Y metric"], [d.y_unit, "Y unit"],
    [d.period, "Period"], [d.population, "Population"], [d.sample_definition, "Sample definition"],
    [d.outlier_rule, "Outlier rule"], [d.reconciliation_rule, "Reconciliation rule"],
    [d.interpretation_boundary, "Interpretation boundary"], [d.source_note, "Source note"],
  ]) c.text(item, label);
  fail(d.method === "ordinary_least_squares_with_intercept", "REGRESSION_METHOD_FAIL", "V1 requires ordinary least squares with an intercept");
  fail(d.handling?.missing === "pairwise_exclusion", "DATA_CONTRACT_FAIL", "V1 requires pairwise exclusion for missing x/y values");
  fail(d.handling?.duplicates === "retain_as_independent", "DATA_CONTRACT_FAIL", "V1 retains exact duplicate pairs as independent observations");
  fail(d.handling?.outliers === "retain_and_label", "DATA_CONTRACT_FAIL", "V1 retains highlighted outliers in the fitted model");
  fail(Array.isArray(d.observations) && d.observations.length >= 8 && d.observations.length <= 200, "DATA_CONTRACT_FAIL", "Scatter regression requires 8–200 raw observations");
  const ids = new Set();
  d.observations.forEach((item) => {
    fail(item && typeof item === "object" && typeof item.id === "string" && item.id.trim() && !ids.has(item.id), "DATA_CONTRACT_FAIL", "Observation IDs must be unique non-empty strings");
    ids.add(item.id);
    fail((item.x === null || Number.isFinite(item.x)) && (item.y === null || Number.isFinite(item.y)), "ABNORMAL_FORMAT_FAIL", "Observation x/y values must be finite numbers or null");
    c.source(item.source_ids, `Observation ${item.id}`);
    if (item.label) c.text(item.label, `Observation label ${item.id}`);
  });
  const calculated = calculateLinearRegression(d.observations);
  fail(calculated.valid.length >= 8, "REGRESSION_SAMPLE_TOO_SMALL", "Formal scatter regression requires at least eight valid x/y pairs");
  const missing = d.observations.length - calculated.valid.length;
  fail(d.sample?.total === d.observations.length && d.sample?.valid === calculated.valid.length && d.sample?.missing === missing && d.sample?.duplicate_pairs === calculated.duplicate_pairs, "REGRESSION_SAMPLE_RECONCILIATION_FAIL", "Total, valid, missing, and duplicate sample counts must reproduce from raw observations");
  fail(Number.isFinite(d.statistics?.slope) && Math.abs(d.statistics.slope - calculated.slope) <= TOLERANCE, "REGRESSION_STATISTICS_RECONCILIATION_FAIL", "Declared slope does not reproduce from raw observations");
  fail(Number.isFinite(d.statistics?.intercept) && Math.abs(d.statistics.intercept - calculated.intercept) <= TOLERANCE, "REGRESSION_STATISTICS_RECONCILIATION_FAIL", "Declared intercept does not reproduce from raw observations");
  fail(Number.isFinite(d.statistics?.r_squared) && Math.abs(d.statistics.r_squared - calculated.r_squared) <= TOLERANCE, "REGRESSION_STATISTICS_RECONCILIATION_FAIL", "Declared R-squared does not reproduce from raw observations");
  c.source(d.statistics.source_ids, "Regression statistics");
  fail(Array.isArray(d.highlight_ids) && d.highlight_ids.length >= 1 && d.highlight_ids.length <= 3, "DATA_CONTRACT_FAIL", "Highlight 1–3 observations by absolute residual");
  fail(new Set(d.highlight_ids).size === d.highlight_ids.length, "DATA_CONTRACT_FAIL", "highlight_ids must be unique");
  const expectedHighlights = [...calculated.valid].sort((left, right) => Math.abs(right.residual) - Math.abs(left.residual) || left.id.localeCompare(right.id)).slice(0, d.highlight_ids.length).map((item) => item.id);
  fail(d.highlight_ids.every((id, index) => id === expectedHighlights[index]), "REGRESSION_OUTLIER_RECONCILIATION_FAIL", "highlight_ids must match the absolute-residual ranking");
  d.highlight_ids.forEach((id) => fail(d.observations.find((item) => item.id === id)?.label, "DATA_CONTRACT_FAIL", `Highlighted observation ${id} requires a visible label`));
  fail(Array.isArray(d.insights) && d.insights.length >= 1 && d.insights.length <= 3, "DATA_CONTRACT_FAIL", "Scatter regression requires 1–3 source-backed insights");
  d.insights.forEach((item) => c.text(item, "Insight"));
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
  if (d.disclosure) c.text(d.disclosure, "Disclosure");
  const mapping = validateAllAnchorsMapped(data.source_anchors, c.mapped);
  return { ok: true, module_id: data.module_id, calculated, ...mapping };
}

export async function loadScatterRegressionInput(inputPath) {
  const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  validateScatterRegression(data);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_scatter_regression.mjs <input.json>");
    const result = validateScatterRegression(JSON.parse(await fs.readFile(inputPath, "utf8")));
    process.stdout.write(`${JSON.stringify({ ...result, calculated: { ...result.calculated, valid: undefined } })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
