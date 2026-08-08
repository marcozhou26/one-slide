import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildAnchorMap, requireCondition, validateAllAnchorsMapped, validateTitle, validateVisibleText } from "./source_fidelity.mjs";

const fail = (condition, code, message) => requireCondition(condition, code, message);
const round = (value) => Number(value.toFixed(4));

function pearson(a, b) {
  const pairs = a.map((value, index) => [value, b[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  fail(pairs.length >= 3, "SAMPLE_SIZE_FAIL", "Each pair needs at least three aligned observations");
  const ax = pairs.map(([x]) => x); const bx = pairs.map(([, y]) => y);
  const am = ax.reduce((s, v) => s + v, 0) / ax.length; const bm = bx.reduce((s, v) => s + v, 0) / bx.length;
  const numerator = ax.reduce((s, v, i) => s + (v - am) * (bx[i] - bm), 0);
  const da = Math.sqrt(ax.reduce((s, v) => s + (v - am) ** 2, 0)); const db = Math.sqrt(bx.reduce((s, v) => s + (v - bm) ** 2, 0));
  fail(da > 0 && db > 0, "ZERO_VARIANCE_FAIL", "Correlation is undefined for a zero-variance metric");
  return round(numerator / (da * db));
}

function ranks(values) {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const out = Array(values.length); let start = 0;
  while (start < sorted.length) { let end = start; while (end + 1 < sorted.length && sorted[end + 1].v === sorted[start].v) end += 1; const rank = (start + end + 2) / 2; for (let k = start; k <= end; k += 1) out[sorted[k].i] = rank; start = end + 1; }
  return out;
}

export function calculateCorrelationMatrix(observations, method) {
  const series = observations.map((item) => item.values.map((value) => value === null ? null : Number(value)));
  return series.map((a, i) => series.map((b, j) => {
    if (i === j) return 1;
    const pairs = a.map((value, index) => [value, b[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    const x = pairs.map(([v]) => v); const y = pairs.map(([, v]) => v);
    return method === "spearman" ? pearson(ranks(x), ranks(y)) : pearson(x, y);
  }));
}

export function validateCorrelationMatrix(data) {
  fail(data?.version === "1.0" && data?.module_id === "correlation-matrix" && data?.diagram?.type === "correlation-matrix", "LOGIC_STRUCTURE_FAIL", "Expected correlation-matrix version 1.0");
  const anchors = buildAnchorMap(data.source_anchors); validateTitle(data.title, anchors); const mapped = new Set(data.title.source_ids ?? []);
  const visible = (item, label) => { validateVisibleText(item, anchors, label); (item.source_ids ?? []).forEach((id) => mapped.add(id)); };
  const d = data.diagram;
  fail(["pearson", "spearman"].includes(d.method), "METHOD_FAIL", "method must be pearson or spearman");
  fail(Number.isInteger(d.sample_size) && d.sample_size >= 3, "SAMPLE_SIZE_FAIL", "sample_size must be a positive integer of at least 3");
  const displayThreshold = d.display_threshold ?? 0.5;
  fail(Number.isFinite(displayThreshold) && displayThreshold >= 0 && displayThreshold <= 1, "THRESHOLD_FAIL", "display_threshold must stay within 0-1");
  for (const [item, label] of [[d.missing_value_handling,"Missing value handling"],[d.period,"Period"],[d.population,"Population"],[d.source_note,"Source note"],[d.causality_note,"Causality note"]]) visible(item, label);
  fail(/不代表因果|does not imply causation/i.test(d.causality_note.text), "CAUSALITY_DISCLOSURE_FAIL", "A visible non-causality note is required");
  fail(Array.isArray(d.metrics) && d.metrics.length >= 4 && d.metrics.length <= 10, "DIMENSION_FAIL", "Correlation matrix needs 4-10 metrics");
  const ids = new Set(); const labels = new Set();
  d.metrics.forEach((metric) => { fail(typeof metric.id === "string" && metric.id && !ids.has(metric.id), "LABEL_UNIQUENESS_FAIL", "Metric IDs must be unique"); ids.add(metric.id); visible(metric.label, "Metric label"); fail(!labels.has(metric.label.text), "LABEL_UNIQUENESS_FAIL", "Metric labels must be unique"); labels.add(metric.label.text); });
  let matrix = d.matrix;
  if (d.observations) {
    fail(Array.isArray(d.observations) && d.observations.length === d.metrics.length, "DIMENSION_FAIL", "observations must match metrics");
    const lengths = new Set(d.observations.map((item) => item.values?.length)); fail(lengths.size === 1, "DIMENSION_FAIL", "Observation arrays must be aligned");
    d.observations.forEach((item, index) => { fail(item.metric_id === d.metrics[index].id && Array.isArray(item.values), "DIMENSION_FAIL", "Observation order must match metrics"); fail(item.values.every((value) => value === null || (typeof value === "number" && Number.isFinite(value))), "ABNORMAL_FORMAT_FAIL", "Observations must be numbers or null"); (item.source_ids ?? []).forEach((id) => { fail(anchors.has(id), "SOURCE_FIDELITY_FAIL", `Unknown observation source ${id}`); mapped.add(id); }); });
    const calculated = calculateCorrelationMatrix(d.observations, d.method);
    if (matrix) matrix.forEach((row, i) => row.forEach((value, j) => fail(Math.abs(value - calculated[i][j]) <= 0.01, "CORRELATION_RECONCILIATION_FAIL", "Provided matrix does not match observations")));
    else matrix = calculated;
  }
  fail(Array.isArray(matrix) && matrix.length === d.metrics.length && matrix.every((row) => Array.isArray(row) && row.length === d.metrics.length), "DIMENSION_FAIL", "matrix must be NxN");
  matrix.forEach((row, i) => row.forEach((value, j) => { fail(typeof value === "number" && Number.isFinite(value), "ABNORMAL_FORMAT_FAIL", "Coefficients must be numbers"); fail(value >= -1 && value <= 1, "COEFFICIENT_RANGE_FAIL", "Coefficients must stay within -1 and 1"); if (i === j) fail(Math.abs(value - 1) <= 0.0001, "DIAGONAL_FAIL", "Diagonal values must equal 1"); else fail(Math.abs(value - matrix[j][i]) <= 0.0001, "SYMMETRY_FAIL", "Matrix must be symmetric"); }));
  fail(Array.isArray(d.insights) && d.insights.length >= 1 && d.insights.length <= 3, "DATA_CONTRACT_FAIL", "Provide 1-3 insights"); d.insights.forEach((item) => visible(item, "Insight"));
  if (d.conclusion) visible(d.conclusion, "Conclusion"); if (d.disclosure) visible(d.disclosure, "Disclosure");
  const mapping = validateAllAnchorsMapped(data.source_anchors, mapped);
  return { ok: true, module_id: data.module_id, normalized: { ...data, diagram: { ...d, display_threshold: displayThreshold, matrix } }, ...mapping };
}

export async function loadCorrelationMatrixInput(inputPath) { const parsed = JSON.parse(await fs.readFile(inputPath, "utf8")); return validateCorrelationMatrix(parsed.module_payload ?? parsed).normalized; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { try { const inputPath = process.argv[2]; if (!inputPath) throw new Error("Usage: validate_correlation_matrix.mjs <input.json>"); process.stdout.write(`${JSON.stringify({ ...validateCorrelationMatrix(JSON.parse(await fs.readFile(inputPath, "utf8"))), normalized: undefined })}\n`); } catch (error) { process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`); process.exitCode = 1; } }
