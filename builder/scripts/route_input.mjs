import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(scriptDir, "..", "references", "module-registry.json");

const pageModelMethodMap = new Map([
  ["two_period_rank_migration", "bump-ranking"],
  ["multi_period_rank_migration", "bump-ranking"],
  ["composition_shift", "composition-shift"],
  ["share_shift", "composition-shift"],
  ["cohort_retention", "cohort-retention"],
  ["survival_curve", "cohort-retention"],
  ["group_distribution", "box-plot"],
  ["continuous_distribution", "histogram"],
  ["raw_observation_distribution", "box-plot-jitter"],
  ["correlation_analysis", "correlation-matrix"],
  ["bivariate_linear_relationship", "scatter-regression"],
  ["estimate_interval_band", "confidence-band"],
  ["causal_chain", "causal-chain"],
  ["issue_tree", "issue-tree"],
  ["stage_process", "stage-process"],
  ["waterfall_attribution", "waterfall-attribution"],
  ["route_tradeoff", "route-tradeoff"],
  ["matrix", "hr-level-function-matrix"],
  ["flow", "sankey-flow"],
  ["time_trend", "chart-insight"],
]);

const definitions = {
  "complex-org-chart": { aliases: ["Organizational structure", "organizational chart", "org chart", "organization chart"], cues: [["report", "Superior", "subordinate", "Department", "dashed line", "project team", "Region"]] },
  "causal-chain": { aliases: ["causal chain", "cause-and-effect chain", "cause and effect chain", "driving factors", "driver tree"], cues: [["cause", "effect", "influence", "drive", "lead to", "reduce", "thereby", "then", "ultimately", "improve", "result"]] },
  "issue-tree": { aliases: ["issue tree", "problem tree", "logic tree"], cues: [["break down", "divide", "branch", "sub-issue", "sub-topic", "root cause", "mece"]] },
  "stage-process": { aliases: ["five step process", "stage process", "chevron", "step process"], cues: [["steps", "stage", "Process", "milestone", "stage gate"]] },
  "waterfall-attribution": { aliases: ["waterfall chart", "waterfall"], cues: [["starting point", "end point", "budget profit", "budgeted profit", "actual profit", "increase or decrease", "difference", "item by item", "attribution", "balanced"]] },
  "route-tradeoff": { aliases: ["Route comparison", "Two routes", "tradeoff", "route a", "route b"], cues: [["trade-off", "Contrast", "Disputed points", "Recommended route", "two routes"]] },
  "scqa-roadmap": { aliases: ["scqa", "Situational conflict questions answers"], cues: [["situation", "conflict", "question", "answer", "landing path"]] },
  "bubble-heatmap": { aliases: ["bubble matrix", "2×2", "2x2", "bubble matrix"], cues: [["value", "difficulty", "Bubbles", "heat", "priority"]] },
  "chart-insight": { aliases: ["charts and insights", "chart insight", "bar chart insights"], cues: [["bar chart", "line", "insight card", "leader line", "data point", "data conclusion"]] },
  "scenario-planning": { aliases: ["scenario planning", "pessimistic baseline optimistic", "scenario planning"], cues: [["pessimistic", "benchmark", "optimistic", "probability of occurrence", "no regrets move"]] },
  marimekko: { aliases: ["marimekko", "mekko", "mosaic chart"], cues: [["column width", "horizontal width", "horizontal breadth", "market size", "segment", "share", "composition", "block area"]] },
  "tornado-sensitivity": { aliases: ["tornado diagram", "sensitivity analysis", "tornado", "Only change one variable at a time"], cues: [["Pessimistic value", "optimistic value", "low value", "high value", "Base case", "Benchmark results", "parameters", "variable", "Univariate"]] },
  "radar-capability": { aliases: ["radar chart", "nine-dimensional radar"], cues: [["capability dimension", "current level", "industry median", "target", "maturity"]] },
  "dumbbell-gap": { aliases: ["Dumbbell diagram", "Dumbbell point chart", "dumbbell"], cues: [["Current situation", "target", "Benchmark", "gap", "indicator"]] },
  "bump-ranking": { aliases: ["Ranking migration chart", "slope map", "bump chart", "slope chart", "slope-ranking"], cues: [["Ranking", "time point", "rise", "fall", "List", "Multiple issues"]] },
  "composition-shift": { aliases: ["composition change diagram", "Percent stacked column chart", "100%stacked column chart", "composition shift"], cues: [["Proportion", "constitute", "period", "total100%", "structural changes"]] },
  "cohort-retention": { aliases: ["cohort retention", "Group retention", "Batch retention"], cues: [["batch", "relative period", "initial base", "immature", "still active"], ["No.0week", "the following weeks", "blank", "early churn"]] },
  "box-plot": { aliases: ["boxplot", "box-and-whisker plot", "box plot"], cues: [["median", "quartile", "middle 50%", "middle50%", "typical level", "dispersion", "outlier", "whisker", "distribution"]] },
  histogram: { aliases: ["Histogram", "histogram"], cues: [["continuous numeric value", "binning", "interval", "Concentrate", "Skewness", "long tail", "Many peaks", "Missing values", "sample"]] },
  "box-plot-jitter": { aliases: ["box plot with observations", "box plot with jittered points", "box plot jitter", "per employee"], cues: [["original observations", "individual observations", "median", "quartile", "outliers", "sample size", "per person"]] },
  "correlation-matrix": { aliases: ["correlation matrix", "correlation matrix", "correlation matrix"], cues: [["change together", "opposite direction", "weak relationship", "The strongest positive", "The strongest negative", "coefficient", "pearson", "spearman"]] },
  "scatter-regression": { aliases: ["scatter regression", "linear regression", "scatter regression"], cues: [["Two continuous indicators", "relationship direction", "relationship strength", "deviation from trend", "outlier", "Interpretable range", "intra-sample correlation"]] },
  "confidence-band": { aliases: ["confidence band", "confidence interval band", "confidence band"], cues: [["center estimate", "upper and lower bounds", "interval width", "uncertainty", "threshold", "Resampling"], ["estimate", "lower", "upper", "interval"]] },
  "small-multiples": { aliases: ["small multiples", "small multiples", "3×3 miniature"], cues: [["multiple objects", "unified scale", "mini polyline", "matrix", "benchmark"]] },
  "sankey-flow": { aliases: ["Sankey diagram", "sankey"], cues: [["flow band", "Diversion", "loss", "conversion rate", "Four layers of nodes"]] },
  "chord-dependency": { aliases: ["chord diagram", "dependency wheel", "chord"], cues: [["Two-way dependency", "interaction strength", "circumference", "Department collaboration"]] },
  "market-funnel": { aliases: ["tam sam som", "market funnel", "market space funnel"], cues: [["tam", "sam", "som", "Penetration", "Price per customer"]] },
  "region-map-table": { aliases: ["Map details", "Distribution map", "area map"], cues: [["city", "area", "map", "Bubbles", "detailed list"]] },
  "industry-value-chain": { aliases: ["Industrial value chain", "value chain diagram", "value chain"], cues: [["upstream", "midstream", "downstream", "participants", "profit margin"]] },
  "spiral-maturity": { aliases: ["spiral maturity", "spiral", "spiral maturity"], cues: [["multiple iterations", "four circles", "design", "execute", "measure", "precipitation"]] },
  "gantt-dependency": { aliases: ["Gantt chart", "gantt"], cues: [["Task", "month", "Depend on", "critical path", "milestone"]] },
  "hr-age-gender-pyramid": { aliases: ["Age and Gender Pyramid", "population pyramid", "People Pyramid"], cues: [["age group", "male", "women", "Number of people", "Personnel structure"]] },
  "hr-workforce-reconciliation": { aliases: ["Personnel reconciliation", "Prepare reconciliation", "Headcount reconciliation"], cues: [["Beginning of period", "Onboarding", "Resign", "transfer out", "transfer in", "End of term"]] },
  "hr-new-hire-survival": { aliases: ["Newcomer retention survival curve", "survival curve", "cohort survival"], cues: [["After joining", "Retention rate", "batch", "Si Ling", "survive"]] },
  "hr-supply-demand-gap": { aliases: ["Manpower supply and demand gap", "Prepare supply and demand", "Talent supply and demand"], cues: [["demand forecast", "internal supply", "natural loss", "retire", "external supplement"]] },
  "hr-level-function-matrix": { aliases: ["job function matrix", "Job system matrix"], cues: [["Rank", "functional sequence", "management span", "Number of people upside down", "Hierarchy"]] },
  "hr-from-to-mobility": { aliases: ["department from-to matrix", "from-to talent flow", "from-to matrix", "talent mobility matrix", "internal flow matrix"], cues: [["outflow department", "inflow department", "internal transfer", "cross-department transfer", "post-transfer quality", "transfer rate", "retention", "talent island"]] },
  "hr-eligibility-matrix": { aliases: ["Eligibility Coverage Matrix", "policy coverage matrix", "eligibility matrix"], cues: [["Eligibility", "Cover people", "Policy", "exception", "Applicable"]] },
  "hr-service-catalog": { aliases: ["hr Service catalog", "Human Resources Service Directory", "service catalog"], cues: [["Service catalog", "Service level", "channel", "time commitment", "Automation"]] },
  "hr-ticket-intake": { aliases: ["hr Work order acceptance", "Work order entry", "ticket intake"], cues: [["Acceptance channels", "Work order quantity", "First time resolution rate", "backlog", "accept"]] },
  "hr-ticket-classification": { aliases: ["hr Work order classification", "Work order classification flow", "ticket classification"], cues: [["Work order classification", "reclassification rate", "service level", "priority", "dispatch"]] },
};

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/[: ://, , ,; ;()()\[\][]"']/g, " ").replace(/\s+/g, " ").trim();
}

function dataTokens(value, out = new Set()) {
  if (Array.isArray(value)) for (const item of value) dataTokens(item, out);
  else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) { out.add(normalizeText(key)); dataTokens(item, out); }
  else if (typeof value === "string") out.add(normalizeText(value));
  return out;
}

function scoreDefinition(definition, text, tokens) {
  const evidence = [];
  for (const alias of definition.aliases) if (text.includes(normalizeText(alias))) evidence.push(`explicit:${alias}`);
  for (const group of definition.cues) {
    const hits = group.filter((cue) => text.includes(normalizeText(cue)) || tokens.has(normalizeText(cue)));
    if (hits.length >= Math.min(2, group.length)) evidence.push(...hits.map((hit) => `cue:${hit}`));
  }
  const explicit = evidence.filter((item) => item.startsWith("explicit:")).length;
  const cues = evidence.filter((item) => item.startsWith("cue:")).length;
  return { score: explicit * 100 + cues * 10, evidence };
}

function inferCompositionShift(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const periods = Array.isArray(data.periods) ? data.periods : [];
  const series = Array.isArray(data.series) ? data.series : [];
  const totals = Array.isArray(data.totals) ? data.totals : [];
  if (periods.length < 3 || periods.length > 8 || series.length < 2 || series.length > 6 || totals.length !== periods.length) return null;
  if (!totals.every((value) => Number.isFinite(Number(value)) && Number(value) > 0)) return null;
  if (!series.every((item) => item && typeof item === "object" && typeof item.name === "string" && Array.isArray(item.values) && item.values.length === periods.length && item.values.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0))) return null;
  const reconciles = periods.every((_, index) => {
    const sum = series.reduce((total, item) => total + Number(item.values[index]), 0);
    const expected = Number(totals[index]);
    return Math.abs(sum - expected) <= Math.max(0.01, expected * 0.001);
  });
  if (!reconciles) return null;
  const relationshipCue = ["structure", "constitute", "Proportion", "combination", "mix", "share", "composition"].some((cue) => text.includes(cue));
  if (!relationshipCue) return null;
  return ["inferred:reconciled_component_series", "inferred:multi_period_totals", "cue:structure_relationship"];
}

function inferCohortRetention(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const periods = Array.isArray(data.relative_periods) ? data.relative_periods : [];
  const cohorts = Array.isArray(data.cohorts) ? data.cohorts : [];
  if (periods.length < 4 || periods.length > 12 || cohorts.length < 3 || cohorts.length > 8) return null;
  const periodValues = periods.map((period) => Number(typeof period === "object" ? period.value : period));
  if (!periodValues.every((value, index) => Number.isFinite(value) && (index === 0 ? value === 0 : value > periodValues[index - 1]))) return null;
  const aligned = cohorts.every((cohort) => {
    const values = cohort?.retained_counts ?? cohort?.retention_rates;
    return Number.isFinite(Number(cohort?.initial_count)) && Number(cohort.initial_count) > 0 && Array.isArray(values) && values.length === periods.length;
  });
  if (!aligned) return null;
  const relationshipCue = ["batch", "relatively", "Join", "Onboarding", "Acquire customers", "activate", "retain", "Survive", "Loss"].some((cue) => text.includes(cue));
  if (!relationshipCue) return null;
  return ["inferred:aligned_relative_periods", "inferred:cohort_initial_bases", "cue:cohort_comparison"];
}

function inferBoxPlot(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length < 3 || groups.length > 8) return null;
  const complete = groups.every((group) => group && typeof group === "object" && ["q1", "median", "q3", "whisker_low", "whisker_high", "sample_size", "missing_count"].every((key) => Number.isFinite(Number(group[key]))));
  if (!complete) return null;
  const relationshipCue = ["distribution", "middle 50%", "middle50%", "typical level", "median", "quartile", "dispersion", "variation", "outlier"].some((cue) => text.includes(cue));
  if (!relationshipCue) return null;
  return ["inferred:group_distribution_summary", "inferred:quartile_whisker_fields", "cue:distribution_relationship"];
}

function conflictingDistributionScope(data) {
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  if (groups.length < 2) return null;
  for (const field of ["period", "unit", "denominator"]) {
    const values = [...new Set(groups.map((group) => normalizeText(group?.[field])).filter(Boolean))];
    if (values.length > 1) return field;
  }
  return null;
}

function inferHistogram(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const values = Array.isArray(data.values) ? data.values : Array.isArray(data.observations) ? data.observations : [];
  const numeric = values.filter((value) => value !== null && value !== "" && Number.isFinite(Number(value))).map(Number);
  const hasContinuousValues = numeric.length >= 8 && new Set(numeric).size >= 5;
  const relationshipCue = ["Distribution", "Concentrate", "Skewness", "long tail", "Many peaks", "interval", "distribution", "skew", "tail", "mode"].some((cue) => text.includes(cue));
  const metadataReady = Boolean(data.unit || data.metric || data.period || data.sample);
  if (!hasContinuousValues || !relationshipCue || !metadataReady) return null;
  return ["inferred:continuous_numeric_observations", "inferred:distribution_relationship", "inferred:traceable_measurement_metadata"];
}

function inferGroupDistribution(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length < 2 || groups.length > 6) return null;
  if (!groups.every((group) => group && typeof group === "object" && typeof group.name === "string" && Array.isArray(group.observations) && group.observations.length >= 5 && group.observations.length <= 60 && group.observations.every((value) => Number.isFinite(Number(value))))) return null;
  if (groups.reduce((sum, group) => sum + group.observations.length, 0) > 240) return null;
  const relationshipCue = ["distribution", "median", "quartile", "outlier", "dispersion", "individual observation", "original observation", "per person", "sample size", "density"].some((cue) => text.includes(cue));
  if (!relationshipCue) return null;
  return ["inferred:grouped_raw_observations", "inferred:sample_sizes", "cue:distribution_relationship"];
}

function inferCorrelationMatrix(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const matrix = Array.isArray(data.matrix) ? data.matrix : [];
  const observations = Array.isArray(data.observations) ? data.observations : [];
  if (metrics.length < 4 || metrics.length > 10) return null;
  const matrixReady = matrix.length === metrics.length && matrix.every((row, i) => Array.isArray(row) && row.length === metrics.length && row.every((value, j) => Number.isFinite(Number(value)) && Number(value) >= -1 && Number(value) <= 1 && Math.abs(Number(value) - Number(matrix[j]?.[i])) <= .0001));
  const observationReady = observations.length === metrics.length && observations.every((item) => Array.isArray(item.values) && item.values.length >= 3);
  if (!matrixReady && !observationReady) return null;
  const cue = ["change together", "opposite direction", "relationship", "association", "coefficient", "pearson", "spearman", "Positive correlation", "negative correlation"].some((item) => text.includes(item));
  if (!cue) return null;
  return matrixReady ? ["inferred:symmetric_coefficient_matrix", "inferred:unique_metric_axis", "cue:relationship_screening"] : ["inferred:aligned_raw_observations", "inferred:unique_metric_axis", "cue:relationship_screening"];
}

function conflictingCorrelationScope(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const looksLikeCorrelation = Array.isArray(data.metrics) && (Array.isArray(data.matrix) || Array.isArray(data.observations));
  if (!looksLikeCorrelation) return null;
  for (const field of ["methods", "periods", "populations", "units"]) {
    const values = Array.isArray(data[field]) ? [...new Set(data[field].map(normalizeText).filter(Boolean))] : [];
    if (values.length > 1) return field;
  }
  return null;
}

function inferScatterRegression(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const observations = Array.isArray(data.observations) ? data.observations : [];
  const valid = observations.filter((item) => item && typeof item === "object" && Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.y)));
  if (valid.length < 8 || valid.length > 200) return null;
  const xValues = new Set(valid.map((item) => Number(item.x)));
  const yValues = new Set(valid.map((item) => Number(item.y)));
  if (xValues.size < 2 || yValues.size < 2) return null;
  const metadataReady = Boolean(data.x_metric && data.y_metric && data.x_unit && data.y_unit && data.period);
  const relationshipCue = ["relationship", "direction", "intensity", "deviate", "outlier", "association", "change together", "extrapolate"].some((cue) => text.includes(cue));
  if (!metadataReady || !relationshipCue) return null;
  return ["inferred:paired_continuous_observations", "inferred:nonzero_bivariate_variance", "cue:bivariate_relationship"];
}

function conflictingScatterScope(data) {
  const observations = Array.isArray(data?.observations) ? data.observations : [];
  if (!observations.length) return null;
  for (const field of ["x_unit", "y_unit", "period"]) {
    const values = [...new Set(observations.map((item) => normalizeText(item?.[field])).filter(Boolean))];
    if (values.length > 1) return field;
  }
  return null;
}

function inferConfidenceBand(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const periods = Array.isArray(data.periods) ? data.periods : [];
  const estimate = Array.isArray(data.estimate) ? data.estimate : [];
  const lower = Array.isArray(data.lower) ? data.lower : [];
  const upper = Array.isArray(data.upper) ? data.upper : [];
  if (periods.length < 5 || periods.length > 12 || estimate.length !== periods.length || lower.length !== periods.length || upper.length !== periods.length) return null;
  if (![estimate, lower, upper].every((series) => series.every((value) => Number.isFinite(Number(value))))) return null;
  if (!periods.every((period, index) => index === 0 || String(period) !== String(periods[index - 1]))) return null;
  if (!estimate.every((value, index) => Number(lower[index]) <= Number(value) && Number(value) <= Number(upper[index]))) return null;
  const relationshipCue = ["center estimate", "upper and lower bounds", "interval width", "uncertainty", "threshold", "Resampling", "estimate", "lower", "upper", "interval"].some((cue) => text.includes(cue));
  const metadataReady = Boolean(data.metric || data.unit || data.interval_definition);
  if (!relationshipCue || !metadataReady) return null;
  return ["inferred:ordered_estimate_bounds", "inferred:interval_definition", "cue:uncertainty_relationship"];
}

export async function routeInput(input) {
  if (!input || typeof input !== "object") throw Object.assign(new Error("Input must be an object"), { code: "INPUT_CONTRACT_FAIL" });
  if (input.page_model) {
    const { validatePageModel } = await import("./validate_page_model.mjs");
    validatePageModel(input.page_model);
  }
  const mode = input.input_mode ?? (input.text && input.data ? "mixed" : input.data ? "data" : "text");
  if (!["text", "data", "mixed"].includes(mode)) throw Object.assign(new Error(`Unsupported input_mode: ${mode}`), { code: "INPUT_CONTRACT_FAIL" });
  if (![input.text, input.title, input.page_claim].some((value) => normalizeText(value)) && input.data == null && !input.requested_module && !input.page_model) {
    throw Object.assign(new Error("Text or data is required"), { code: "SOURCE_BASELINE_FAIL" });
  }
  if (input.requested_module) {
    const { routeModule } = await import("./route_module.mjs");
    const routed = await routeModule({ requested_module: input.requested_module });
    return { ...routed, input_mode: mode, confidence: "explicit", evidence: ["requested_module"] };
  }
  const compiledModule = pageModelMethodMap.get(input.page_model?.expression_method);
  if (compiledModule) {
    const { routeModule } = await import("./route_module.mjs");
    const routed = await routeModule({ requested_module: compiledModule });
    return { ...routed, input_mode: mode, confidence: "compiled_structure", evidence: ["page_model.expression_method"] };
  }
  const text = normalizeText([input.text, input.title, input.page_claim, input.page_model?.subject?.text, input.page_model?.story?.text, input.page_model?.expression_method, JSON.stringify(input.data ?? {})].filter(Boolean).join(" "));
  if (!text) throw Object.assign(new Error("Text or data is required"), { code: "SOURCE_BASELINE_FAIL" });
  const tokens = dataTokens(input.data ?? {});
  const distributionScopeConflict = conflictingDistributionScope(input.data);
  if (distributionScopeConflict) throw Object.assign(new Error(`Group distribution ${distributionScopeConflict} values conflict`), { code: "SOURCE_BASELINE_FAIL" });
  const correlationScopeConflict = conflictingCorrelationScope(input.data);
  if (correlationScopeConflict) throw Object.assign(new Error(`Correlation ${correlationScopeConflict} values conflict`), { code: "SOURCE_BASELINE_FAIL" });
  const scatterScopeConflict = conflictingScatterScope(input.data);
  if (scatterScopeConflict) throw Object.assign(new Error(`Paired observations ${scatterScopeConflict} values conflict`), { code: "SOURCE_BASELINE_FAIL" });
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const productized = new Map(registry.modules.filter((item) => item.status === "productized").map((item) => [item.module_id, item]));
  const inferredComposition = inferCompositionShift(input.data, text);
  const inferredCohort = inferCohortRetention(input.data, text);
  const inferredBoxPlot = inferBoxPlot(input.data, text);
  const inferredHistogram = inferHistogram(input.data, text);
  const inferredJitter = inferGroupDistribution(input.data, text);
  const inferredCorrelation = inferCorrelationMatrix(input.data, text);
  const inferredScatter = inferScatterRegression(input.data, text);
  const inferredConfidenceBand = inferConfidenceBand(input.data, text);
  const ranked = Object.entries(definitions)
    .map(([moduleId, definition]) => ({ moduleId, ...scoreDefinition(definition, text, tokens) }))
    .map((item) => inferredComposition && item.moduleId === "composition-shift"
      ? { ...item, score: Math.max(item.score, 60), evidence: [...item.evidence, ...inferredComposition] }
      : item)
    .map((item) => inferredCohort && item.moduleId === "cohort-retention"
      ? { ...item, score: Math.max(item.score, 70), evidence: [...item.evidence, ...inferredCohort] }
      : item)
    .map((item) => inferredBoxPlot && item.moduleId === "box-plot"
      ? { ...item, score: Math.max(item.score, 60), evidence: [...item.evidence, ...inferredBoxPlot] }
      : item)
    .map((item) => item.moduleId === "box-plot" && Array.isArray(input.data?.groups) && !inferredBoxPlot && !item.evidence.some((evidence) => evidence.startsWith("explicit:"))
      ? { ...item, score: 0 }
      : item)
    .map((item) => inferredHistogram && item.moduleId === "histogram"
      ? { ...item, score: Math.max(item.score, 70), evidence: [...item.evidence, ...inferredHistogram] }
      : item)
    .map((item) => item.moduleId === "histogram" && !inferredHistogram && !item.evidence.some((evidence) => evidence.startsWith("explicit:"))
      ? { ...item, score: 0 }
      : item)
    .map((item) => inferredJitter && item.moduleId === "box-plot-jitter"
      ? { ...item, score: Math.max(item.score, 70), evidence: [...item.evidence, ...inferredJitter] }
      : item)
    .map((item) => item.moduleId === "box-plot-jitter" && Array.isArray(input.data?.groups) && !inferredJitter && !item.evidence.some((evidence) => evidence.startsWith("explicit:"))
      ? { ...item, score: 0 }
      : item)
    .map((item) => inferredCorrelation && item.moduleId === "correlation-matrix"
      ? { ...item, score: Math.max(item.score, 80), evidence: [...item.evidence, ...inferredCorrelation] }
      : item)
    .map((item) => item.moduleId === "correlation-matrix" && !inferredCorrelation && !item.evidence.some((evidence) => evidence.startsWith("explicit:"))
      ? { ...item, score: 0 }
      : item)
    .map((item) => inferredScatter && item.moduleId === "scatter-regression"
      ? { ...item, score: Math.max(item.score, 80), evidence: [...item.evidence, ...inferredScatter] }
      : item)
    .map((item) => inferredConfidenceBand && item.moduleId === "confidence-band"
      ? { ...item, score: Math.max(item.score, 80), evidence: [...item.evidence, ...inferredConfidenceBand] }
      : item)
    .filter((item) => item.score > 0 && productized.has(item.moduleId))
    .sort((a, b) => b.score - a.score || a.moduleId.localeCompare(b.moduleId));
  if (!ranked.length) throw Object.assign(new Error("No productized module has enough explicit evidence"), { code: "ROUTE_EVIDENCE_INSUFFICIENT" });
  const explicitTop = ranked[0].score >= 100;
  const threshold = explicitTop ? ranked[0].score : Math.max(20, ranked[0].score - 10);
  const candidates = ranked.filter((item) => item.score >= threshold);
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    return {
      decision: "needs_structure_choice",
      code: "ROUTE_AMBIGUITY_REVIEW",
      input_mode: mode,
      candidates: candidates.slice(0, 2).map((item) => ({ module_id: item.moduleId, evidence: item.evidence })),
    };
  }
  const selected = candidates[0];
  return {
    decision: "selected",
    module: productized.get(selected.moduleId),
    input_mode: mode,
    confidence: explicitTop ? "explicit_visual" : selected.score >= 40 ? "high" : "supported",
    evidence: selected.evidence,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const inputPath = process.argv[2];
    if (!inputPath) throw new Error("Usage: route_input.mjs <input.json>");
    process.stdout.write(`${JSON.stringify(await routeInput(JSON.parse(await fs.readFile(inputPath, "utf8"))), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "ROUTE_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
