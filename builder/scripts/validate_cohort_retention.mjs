import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

function fail(condition, code, message) {
  requireCondition(condition, code, message);
}

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

function normalizeSeries(cohort, periodCount) {
  const counts = cohort.retained_counts;
  const rates = cohort.retention_rates;
  fail(Array.isArray(counts) || Array.isArray(rates), "DATA_CONTRACT_FAIL", "Each cohort needs retained_counts or retention_rates");
  if (counts) fail(counts.length === periodCount, "DATA_CONTRACT_FAIL", "retained_counts must match relative_periods");
  if (rates) fail(rates.length === periodCount, "DATA_CONTRACT_FAIL", "retention_rates must match relative_periods");
  const raw = counts ?? rates;
  let seenNull = false;
  raw.forEach((value) => {
    if (value === null) seenNull = true;
    else fail(!seenNull, "CENSORING_CONTRACT_FAIL", "Unobserved periods must be trailing null values");
  });
  if (counts && rates) {
    for (let index = 0; index < periodCount; index += 1) {
      fail((counts[index] === null) === (rates[index] === null), "CENSORING_CONTRACT_FAIL", "Counts and rates must share the same observed horizon");
    }
  }
  const normalizedCounts = [];
  const normalizedRates = [];
  for (let index = 0; index < periodCount; index += 1) {
    const count = counts?.[index] ?? null;
    const rate = rates?.[index] ?? null;
    if (count === null && rate === null) {
      normalizedCounts.push(null);
      normalizedRates.push(null);
      continue;
    }
    if (count !== null) {
      fail(Number.isInteger(count) && count >= 0 && count <= cohort.initial_count, "DATA_CONTRACT_FAIL", "Retained counts must be whole numbers within the initial base");
    }
    if (rate !== null) {
      fail(Number.isFinite(rate) && rate >= 0 && rate <= 100, "DATA_CONTRACT_FAIL", "Retention rates must stay within 0–100");
    }
    const derivedRate = count === null ? rate : count / cohort.initial_count * 100;
    const derivedCount = rate === null ? count : Math.round(rate / 100 * cohort.initial_count);
    if (count !== null && rate !== null) {
      fail(Math.abs(count - rate / 100 * cohort.initial_count) <= 0.6, "COHORT_RECONCILIATION_FAIL", "Retained count and rate do not reconcile with the initial base");
      fail(Math.abs(derivedRate - rate) <= 0.2, "COHORT_RECONCILIATION_FAIL", "Retention rate conflicts with retained count");
    }
    normalizedCounts.push(derivedCount);
    normalizedRates.push(Number(derivedRate.toFixed(2)));
  }
  fail(normalizedCounts.filter((value) => value !== null).length >= 2, "DATA_CONTRACT_FAIL", "Each cohort needs at least two observed periods");
  fail(normalizedCounts[0] === cohort.initial_count && Math.abs(normalizedRates[0] - 100) <= 0.01, "COHORT_RECONCILIATION_FAIL", "Relative period zero must equal the initial base and 100%");
  return { retained_counts: normalizedCounts, retention_rates: normalizedRates };
}

export function validateCohortRetention(data) {
  fail(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  fail(data?.module_id === "cohort-retention", "LOGIC_STRUCTURE_FAIL", "Expected cohort-retention module_id");
  fail(data?.diagram?.type === "cohort-retention", "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const c = mappedContext(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  const d = data.diagram;
  fail(["survival", "period_retention"].includes(d.curve_mode), "DATA_CONTRACT_FAIL", "curve_mode must be survival or period_retention");
  for (const [item, label] of [[d.relative_period_unit, "Relative period unit"], [d.cohort_definition, "Cohort definition"], [d.denominator, "Denominator"], [d.measure, "Measure"], [d.source_note, "Source note"]]) c.text(item, label);
  fail(Array.isArray(d.relative_periods) && d.relative_periods.length >= 4 && d.relative_periods.length <= 12, "DATA_CONTRACT_FAIL", "Relative periods must contain 4–12 points");
  let prior = -Infinity;
  d.relative_periods.forEach((period) => {
    c.text(period.label, "Relative period label");
    fail(Number.isFinite(period.value) && period.value > prior, "DATA_CONTRACT_FAIL", "Relative periods must be strictly increasing numbers");
    prior = period.value;
  });
  fail(d.relative_periods[0].value === 0, "DATA_CONTRACT_FAIL", "The first relative period must be zero");
  fail(Array.isArray(d.cohorts) && d.cohorts.length >= 3 && d.cohorts.length <= 8, "DATA_CONTRACT_FAIL", "Cohort retention needs 3–8 cohorts");
  const ids = new Set();
  let hasCensoring = false;
  const normalizedCohorts = d.cohorts.map((cohort) => {
    fail(typeof cohort.id === "string" && cohort.id.length > 0 && !ids.has(cohort.id), "DATA_CONTRACT_FAIL", "Cohort IDs must be unique non-empty strings");
    ids.add(cohort.id);
    c.text(cohort.label, "Cohort label");
    fail(Number.isInteger(cohort.initial_count) && cohort.initial_count > 0, "DATA_CONTRACT_FAIL", "Each cohort needs a positive integer initial_count");
    c.source(cohort.source_ids, "Cohort data");
    const normalized = normalizeSeries(cohort, d.relative_periods.length);
    const observedRates = normalized.retention_rates.filter((value) => value !== null);
    if (d.curve_mode === "survival") {
      fail(observedRates.every((value, index) => index === 0 || value <= observedRates[index - 1] + 1e-9), "SURVIVAL_CURVE_FAIL", "Survival curves cannot increase");
    }
    if (normalized.retention_rates.includes(null)) hasCensoring = true;
    return { ...cohort, ...normalized };
  });
  fail(!hasCensoring || d.censoring_note, "CENSORING_CONTRACT_FAIL", "A visible censoring_note is required when periods are unobserved");
  if (d.censoring_note) c.text(d.censoring_note, "Censoring note");
  fail(Array.isArray(d.insights) && d.insights.length >= 1 && d.insights.length <= 3, "DATA_CONTRACT_FAIL", "Cohort retention needs 1–3 insights");
  d.insights.forEach((item) => c.text(item, "Insight"));
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
  if (d.disclosure) c.text(d.disclosure, "Disclosure");
  const mapping = validateAllAnchorsMapped(data.source_anchors, c.mapped);
  return { ok: true, module_id: data.module_id, normalized: { ...data, diagram: { ...d, cohorts: normalizedCohorts } }, ...mapping };
}

export async function loadCohortRetentionInput(inputPath) {
  const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  return validateCohortRetention(data).normalized;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_cohort_retention.mjs <input.json>");
    const result = validateCohortRetention(JSON.parse(await fs.readFile(inputPath, "utf8")));
    process.stdout.write(`${JSON.stringify({ ...result, normalized: undefined })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
