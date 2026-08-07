import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const MODULES = new Set([
  "hr-age-gender-pyramid",
  "hr-workforce-reconciliation",
  "hr-new-hire-survival",
  "hr-supply-demand-gap",
  "hr-level-function-matrix",
  "hr-from-to-mobility",
  "hr-eligibility-matrix",
  "hr-service-catalog",
  "hr-ticket-intake",
  "hr-ticket-classification",
]);
function context(data) {
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const text = (item, label) => {
    validateVisibleText(item, anchors, label);
    (item.source_ids ?? []).forEach((id) => mapped.add(id));
  };
  const source = (ids, label) => {
    requireCondition(
      Array.isArray(ids) && ids.length,
      "SOURCE_FIDELITY_FAIL",
      `${label} needs source_ids`,
    );
    ids.forEach((id) => {
      requireCondition(
        anchors.has(id),
        "SOURCE_FIDELITY_FAIL",
        `${label} cites unknown source ${id}`,
      );
      mapped.add(id);
    });
  };
  return { mapped, text, source };
}
const finite = (values, message) =>
  requireCondition(
    values.every(Number.isFinite),
    "DATA_CONTRACT_FAIL",
    message,
  );
const textList = (items, c, label) => items?.forEach((x) => c.text(x, label));

function age(d, c) {
  requireCondition(
    d.bands?.length === 7,
    "DATA_CONTRACT_FAIL",
    "Age pyramid requires seven age bands",
  );
  d.bands.forEach((x) => {
    c.text(x.label, "Age band");
    c.text(x.tenure, "Tenure");
    c.text(x.salary, "Salary");
    c.text(x.turnover, "Turnover");
    c.text(x.manager_share, "Manager share");
    finite(
      [x.male, x.female, x.healthy_male, x.healthy_female],
      "Age counts must be numeric",
    );
    requireCondition(
      Math.min(x.male, x.female, x.healthy_male, x.healthy_female) >= 0,
      "DATA_CONTRACT_FAIL",
      "Age counts cannot be negative",
    );
    c.source(x.source_ids, "Age band data");
  });
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function workforce(d, c) {
  requireCondition(
    d.months?.length === 12,
    "DATA_CONTRACT_FAIL",
    "Workforce reconciliation requires twelve months",
  );
  d.months.forEach((x, i) => {
    c.text(x.label, "Month");
    finite([
      x.opening,
      x.campus_hires,
      x.social_hires,
      x.referral_hires,
      x.voluntary_exit,
      x.involuntary_exit,
      x.transfer_out,
      x.transfer_in,
      x.closing,
    ], "Workforce values must be numeric");
    const expected = x.opening + x.campus_hires + x.social_hires +
      x.referral_hires - x.voluntary_exit - x.involuntary_exit -
      x.transfer_out + x.transfer_in;
    requireCondition(
      expected === x.closing,
      "WORKFORCE_RECONCILIATION_FAIL",
      `Month ${i + 1} does not reconcile`,
    );
    if (i < 11) {
      requireCondition(
        x.closing === d.months[i + 1].opening,
        "WORKFORCE_RECONCILIATION_FAIL",
        "Closing must equal next opening",
      );
    }
    c.source(x.source_ids, "Workforce month");
    if (x.annotation) c.text(x.annotation, "Month annotation");
  });
  for (const field of ["attrition_rate", "recruitment_rate", "budget"]) {
    const supplied = d.months.filter((month) => month[field] !== undefined && month[field] !== null);
    requireCondition(
      supplied.length === 0 || supplied.length === 12,
      "DATA_CONTRACT_FAIL",
      `${field} must be supplied for all twelve months or omitted entirely`,
    );
    if (supplied.length) finite(supplied.map((month) => month[field]), `${field} must be numeric`);
  }
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function nonIncreasing(values) {
  return values.every((v, i) => i === 0 || v <= values[i - 1]);
}
function survival(d, c) {
  requireCondition(
    d.periods?.length === 25,
    "DATA_CONTRACT_FAIL",
    "Survival curve requires months 0–24",
  );
  d.periods.forEach((x) => c.text(x, "Survival period"));
  requireCondition(
    d.cohorts?.length === 4,
    "DATA_CONTRACT_FAIL",
    "Survival curve requires four cohorts",
  );
  d.cohorts.forEach((x) => {
    c.text(x.label, "Cohort");
    requireCondition(
      x.values?.length === 25 && x.values[0] === 100 && nonIncreasing(x.values),
      "SURVIVAL_CURVE_FAIL",
      "Cohort must start at 100 and never increase",
    );
    finite(x.values, "Survival values must be numeric");
    c.source(x.source_ids, "Cohort data");
  });
  requireCondition(
    d.benchmark?.values?.length === 25 && nonIncreasing(d.benchmark.values),
    "SURVIVAL_CURVE_FAIL",
    "Benchmark must be non-increasing",
  );
  c.text(d.benchmark.label, "Benchmark");
  c.source(d.benchmark.source_ids, "Benchmark data");
  requireCondition(
    d.risk_rows?.length === 4,
    "DATA_CONTRACT_FAIL",
    "Survival page requires four risk rows",
  );
  d.risk_rows.forEach((x) => {
    c.text(x.label, "Risk factor");
    requireCondition(
      x.scores?.length === 5,
      "DATA_CONTRACT_FAIL",
      "Risk row requires five intervals",
    );
    finite(x.scores, "Risk scores must be numeric");
    c.source(x.source_ids, "Risk row");
  });
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function supply(d, c) {
  requireCondition(
    d.periods?.length === 6,
    "DATA_CONTRACT_FAIL",
    "Supply-demand page requires six periods",
  );
  d.periods.forEach((x, i) => {
    c.text(x.label, "Forecast period");
    finite([
      x.demand,
      x.demand_low,
      x.demand_high,
      x.opening,
      x.attrition,
      x.retirement,
      x.promotion,
      x.transfer,
      x.supply,
      x.gap,
      x.external,
    ], "Supply-demand values must be numeric");
    requireCondition(
      x.demand_low <= x.demand && x.demand <= x.demand_high,
      "DATA_CONTRACT_FAIL",
      "Demand must stay within forecast band",
    );
    requireCondition(
      x.opening - x.attrition - x.retirement + x.promotion + x.transfer ===
        x.supply,
      "SUPPLY_RECONCILIATION_FAIL",
      `Supply period ${i + 1} does not reconcile`,
    );
    requireCondition(
      x.demand - x.supply === x.gap && x.external === x.gap,
      "SUPPLY_RECONCILIATION_FAIL",
      `Gap period ${i + 1} does not reconcile`,
    );
    c.source(x.source_ids, "Supply-demand period");
  });
  requireCondition(
    d.strategies?.length === 3,
    "DATA_CONTRACT_FAIL",
    "Supply-demand requires three strategies",
  );
  d.strategies.forEach((x) => {
    c.text(x.label, "Supply strategy");
    c.text(x.cycle, "Strategy cycle");
    c.text(x.cost, "Strategy cost");
    c.text(x.risk, "Strategy risk");
    requireCondition(
      Number.isFinite(x.count) && x.count >= 0,
      "DATA_CONTRACT_FAIL",
      "Strategy count must be non-negative",
    );
    c.source(x.source_ids, "Strategy count");
  });
  requireCondition(
    d.strategies.reduce((s, x) => s + x.count, 0) === d.periods.at(-1).gap,
    "SUPPLY_RECONCILIATION_FAIL",
    "Strategies must close final gap",
  );
  textList(d.insights, c, "Insight");
}
function levelMatrix(d, c) {
  requireCondition(
    d.functions?.length === 5,
    "DATA_CONTRACT_FAIL",
    "Level matrix requires five functions",
  );
  d.functions.forEach((x) => c.text(x, "Function"));
  requireCondition(
    d.levels?.length === 8,
    "DATA_CONTRACT_FAIL",
    "Level matrix requires eight levels",
  );
  d.levels.forEach((x) => {
    c.text(x.label, "Level");
    requireCondition(
      x.cells?.length === 5,
      "DATA_CONTRACT_FAIL",
      "Every level requires five cells",
    );
    x.cells.forEach((cell) => {
      finite(
        [cell.count, cell.salary, cell.tenure],
        "Level cell metrics must be numeric",
      );
      requireCondition(
        cell.count >= 0,
        "DATA_CONTRACT_FAIL",
        "Headcount cannot be negative",
      );
      c.source(cell.source_ids, "Level cell");
    });
    requireCondition(
      Number.isFinite(x.management_span),
      "DATA_CONTRACT_FAIL",
      "Management span must be numeric",
    );
    c.source(x.source_ids, "Level row");
  });
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function mobility(d, c) {
  requireCondition(
    d.departments?.length === 6,
    "DATA_CONTRACT_FAIL",
    "Mobility matrix requires six departments",
  );
  d.departments.forEach((x) => c.text(x, "Department"));
  requireCondition(
    d.matrix?.length === 6 && d.matrix.every((r) => r.length === 6),
    "DATA_CONTRACT_FAIL",
    "Mobility matrix must be 6x6",
  );
  requireCondition(
    d.quality?.length === 6 && d.quality.every((r) => r.length === 6),
    "DATA_CONTRACT_FAIL",
    "Mobility quality matrix must be 6x6",
  );
  d.matrix.flat().forEach((v) =>
    requireCondition(
      Number.isInteger(v) && v >= 0,
      "DATA_CONTRACT_FAIL",
      "Mobility counts must be non-negative integers",
    )
  );
  d.quality.flat().forEach((v) =>
    finite([v.retention, v.performance], "Mobility quality must be numeric")
  );
  c.source(d.source_ids, "Mobility matrix");
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function metrics(d, c) {
  requireCondition(
    d.metrics?.length === 3,
    "DATA_CONTRACT_FAIL",
    "Metric page requires three headline metrics",
  );
  d.metrics.forEach((x) => {
    c.text(x.label, "Metric");
    c.text(x.value, "Metric value");
    c.text(x.target, "Metric target");
    c.source(x.source_ids, "Metric");
  });
  textList(d.insights, c, "Insight");
  if (d.conclusion) c.text(d.conclusion, "Conclusion");
}
function eligibility(d, c) {
  metrics(d, c);
  requireCondition(
    d.policies?.length >= 4 && d.policies.length <= 7,
    "DATA_CONTRACT_FAIL",
    "Eligibility matrix requires 4–7 policies",
  );
  d.policies.forEach((x) => c.text(x, "Policy"));
  requireCondition(
    d.segments?.length >= 4 && d.segments.length <= 8,
    "DATA_CONTRACT_FAIL",
    "Eligibility matrix requires 4–8 segments",
  );
  d.segments.forEach((x) => {
    c.text(x.label, "Employee segment");
    requireCondition(
      x.scores?.length === d.policies.length,
      "DATA_CONTRACT_FAIL",
      "Eligibility row width mismatch",
    );
    finite(x.scores, "Eligibility scores must be numeric");
    c.source(x.source_ids, "Eligibility row");
  });
}
function service(d, c) {
  metrics(d, c);
  requireCondition(
    d.services?.length === 5,
    "DATA_CONTRACT_FAIL",
    "Service catalog requires five services",
  );
  d.services.forEach((x) => {
    c.text(x.label, "Service");
    c.text(x.owner, "Service owner");
    finite(
      [x.volume, x.success, x.automation],
      "Service metrics must be numeric",
    );
    c.source(x.source_ids, "Service row");
  });
}
function intake(d, c) {
  metrics(d, c);
  requireCondition(
    d.services?.length === 5 && d.intents?.length === 4,
    "DATA_CONTRACT_FAIL",
    "Ticket intake requires 5 services and 4 intents",
  );
  d.services.forEach((x) => c.text(x, "Service"));
  d.intents.forEach((x) => c.text(x, "Intent"));
  requireCondition(
    d.matrix?.length === 5 && d.matrix.every((r) => r.length === 4),
    "DATA_CONTRACT_FAIL",
    "Ticket intake matrix must be 5x4",
  );
  d.matrix.flat().forEach((v) =>
    finite([v.volume, v.one_touch], "Ticket intake cells must be numeric")
  );
  c.source(d.source_ids, "Ticket intake matrix");
}
function classification(d, c) {
  metrics(d, c);
  requireCondition(
    d.categories?.length === 5,
    "DATA_CONTRACT_FAIL",
    "Classification requires five categories",
  );
  d.categories.forEach((x) => {
    c.text(x.label, "Category");
    finite(
      [x.input, x.predicted, x.final],
      "Classification values must be numeric",
    );
    requireCondition(
      Math.abs(x.input - x.final) <= x.reclassified,
      "CLASSIFICATION_RECONCILIATION_FAIL",
      "Category movement cannot explain final count",
    );
    c.source(x.source_ids, "Classification category");
  });
  c.text(d.other_label, "Other label");
}

export function validateR5Module(data) {
  requireCondition(
    data?.version === "1.0",
    "LOGIC_STRUCTURE_FAIL",
    "Unsupported version",
  );
  requireCondition(
    MODULES.has(data?.module_id),
    "LOGIC_STRUCTURE_FAIL",
    "Expected an R5 module_id",
  );
  requireCondition(
    data?.diagram?.type === data.module_id,
    "LOGIC_STRUCTURE_FAIL",
    "diagram.type must match module_id",
  );
  const c = context(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  ({
    "hr-age-gender-pyramid": age,
    "hr-workforce-reconciliation": workforce,
    "hr-new-hire-survival": survival,
    "hr-supply-demand-gap": supply,
    "hr-level-function-matrix": levelMatrix,
    "hr-from-to-mobility": mobility,
    "hr-eligibility-matrix": eligibility,
    "hr-service-catalog": service,
    "hr-ticket-intake": intake,
    "hr-ticket-classification": classification,
  })[data.module_id](data.diagram, c);
  return {
    ok: true,
    module_id: data.module_id,
    ...validateAllAnchorsMapped(data.source_anchors, c.mapped),
  };
}
if (
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const p = process.argv[2];
  try {
    if (!p) throw new Error("Usage: validate_r5_module.mjs <input.json>");
    process.stdout.write(
      `${
        JSON.stringify(
          validateR5Module(JSON.parse(await fs.readFile(p, "utf8"))),
        )
      }\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${
        JSON.stringify({
          code: error.code ?? "DATA_CONTRACT_FAIL",
          message: error.message,
        })
      }\n`,
    );
    process.exitCode = 1;
  }
}
