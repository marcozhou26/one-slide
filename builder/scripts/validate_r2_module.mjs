import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const R2_MODULES = new Set([
  "route-tradeoff",
  "scqa-roadmap",
  "bubble-heatmap",
  "chart-insight",
  "scenario-planning",
]);

function collector(data) {
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const text = (item, label) => {
    validateVisibleText(item, anchors, label);
    (item.source_ids ?? []).forEach((id) => mapped.add(id));
  };
  const source = (ids, label) => {
    requireCondition(Array.isArray(ids) && ids.length > 0, "SOURCE_FIDELITY_FAIL", `${label} needs source_ids`);
    ids.forEach((id) => {
      requireCondition(anchors.has(id), "SOURCE_FIDELITY_FAIL", `${label} cites unknown source ${id}`);
      mapped.add(id);
    });
  };
  return { anchors, mapped, text, source };
}

function validateRouteTradeoff(data, c) {
  const routes = data.diagram.routes;
  requireCondition(Array.isArray(routes) && routes.length === 2, "DATA_CONTRACT_FAIL", "Route tradeoff requires exactly two routes");
  const dimensions = routes[0]?.rows?.map((row) => row.dimension_id) ?? [];
  requireCondition(dimensions.length >= 3 && dimensions.length <= 6, "DATA_CONTRACT_FAIL", "Route tradeoff requires three to six dimensions");
  for (const route of routes) {
    c.text(route.label, "Route label");
    requireCondition(route.rows?.length === dimensions.length, "DATA_CONTRACT_FAIL", "Both routes must use identical dimensions");
    route.rows.forEach((row, index) => {
      requireCondition(row.dimension_id === dimensions[index], "DATA_CONTRACT_FAIL", "Route dimensions must align in the same order");
      c.text(row.dimension, "Dimension");
      c.text(row.judgment, "Route judgment");
      c.text(row.evidence, "Route evidence");
      requireCondition([0, 1, 2, 3].includes(row.score), "DATA_CONTRACT_FAIL", "Route score must be 0–3");
    });
  }
  for (const conflict of data.diagram.conflicts ?? []) c.text(conflict, "Conflict");
  if (data.diagram.recommendation) c.text(data.diagram.recommendation, "Recommendation");
}

function validateScqaRoadmap(data, c) {
  for (const key of ["s", "c", "q", "a"]) c.text(data.diagram.scqa?.[key], `SCQA ${key.toUpperCase()}`);
  const stages = data.diagram.stages;
  requireCondition(Array.isArray(stages) && stages.length >= 2 && stages.length <= 4, "DATA_CONTRACT_FAIL", "SCQA roadmap requires two to four stages");
  const laneIds = stages[0]?.lanes?.map((lane) => lane.id) ?? [];
  requireCondition(laneIds.length >= 2 && laneIds.length <= 4, "DATA_CONTRACT_FAIL", "SCQA roadmap requires two to four lanes");
  for (const stage of stages) {
    c.text(stage.label, "Stage label");
    c.text(stage.gate, "Stage gate");
    requireCondition(stage.lanes?.length === laneIds.length, "DATA_CONTRACT_FAIL", "Every stage must contain the same lanes");
    stage.lanes.forEach((lane, index) => {
      requireCondition(lane.id === laneIds[index], "DATA_CONTRACT_FAIL", "Lane order must be stable across stages");
      c.text(lane.label, "Lane label");
      c.text(lane.action, "Lane action");
    });
  }
}

function validateBubbleHeatmap(data, c) {
  const items = data.diagram.items;
  requireCondition(Array.isArray(items) && items.length >= 6 && items.length <= 15, "DATA_CONTRACT_FAIL", "Bubble heatmap requires 6–15 items");
  const ids = new Set();
  const ranks = new Set();
  for (const item of items) {
    requireCondition(typeof item.id === "string" && !ids.has(item.id), "DATA_CONTRACT_FAIL", "Item ids must be unique");
    ids.add(item.id);
    c.text(item.label, "Bubble label");
    c.text(item.function, "Function label");
    requireCondition([item.x, item.y, item.size].every(Number.isFinite), "DATA_CONTRACT_FAIL", "Bubble coordinates and size must be numeric");
    requireCondition(item.x >= 0 && item.x <= 5 && item.y >= 0 && item.y <= 5 && item.size > 0, "DATA_CONTRACT_FAIL", "Bubble values are outside supported ranges");
    requireCondition(Array.isArray(item.scores) && item.scores.length === 5 && item.scores.every((v) => Number.isInteger(v) && v >= 1 && v <= 5), "DATA_CONTRACT_FAIL", "Heatmap requires five 1–5 scores");
    requireCondition(Number.isInteger(item.rank) && !ranks.has(item.rank), "DATA_CONTRACT_FAIL", "Ranks must be unique integers");
    ranks.add(item.rank);
    c.source(item.source_ids, `Bubble ${item.id}`);
  }
  (data.diagram.axis_labels ?? []).forEach((item) => c.text(item, "Axis label"));
  if (data.diagram.bottom_conclusion) c.text(data.diagram.bottom_conclusion, "Bottom conclusion");
}

function validateChartInsight(data, c) {
  const categories = data.diagram.categories;
  requireCondition(Array.isArray(categories) && categories.length >= 4 && categories.length <= 8, "DATA_CONTRACT_FAIL", "Chart insight requires 4–8 categories");
  categories.forEach((item) => c.text(item, "Chart category"));
  const series = data.diagram.series;
  requireCondition(Array.isArray(series) && series.length === 2, "DATA_CONTRACT_FAIL", "Chart insight requires exactly two bar series");
  for (const item of series) {
    c.text(item.label, "Series label");
    requireCondition(Array.isArray(item.values) && item.values.length === categories.length && item.values.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Series values must match categories");
    c.source(item.source_ids, "Series data");
  }
  c.text(data.diagram.ratio.label, "Ratio label");
  requireCondition(data.diagram.ratio.values?.length === categories.length && data.diagram.ratio.values.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Ratio values must match categories");
  c.source(data.diagram.ratio.source_ids, "Ratio data");
  requireCondition(data.diagram.insights?.length === 3, "DATA_CONTRACT_FAIL", "Chart insight requires three insights");
  data.diagram.insights.forEach((item) => c.text(item, "Insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
}

function validateScenarioPlanning(data, c) {
  const scenarios = data.diagram.scenarios;
  requireCondition(Array.isArray(scenarios) && scenarios.length === 3, "DATA_CONTRACT_FAIL", "Scenario planning requires exactly three scenarios");
  const probability = scenarios.reduce((sum, item) => sum + item.probability, 0);
  requireCondition(Math.abs(probability - 100) < 1e-6, "SCENARIO_PROBABILITY_FAIL", "Scenario probabilities must sum to 100");
  const metricIds = scenarios[0]?.metrics?.map((item) => item.id) ?? [];
  requireCondition(metricIds.length === 3, "DATA_CONTRACT_FAIL", "Each scenario requires three metrics");
  for (const scenario of scenarios) {
    c.text(scenario.label, "Scenario label");
    c.text(scenario.assumptions, "Scenario assumptions");
    c.text(scenario.impact, "Scenario impact");
    c.text(scenario.indicator, "Leading indicator");
    c.text(scenario.response, "Scenario response");
    requireCondition(scenario.metrics?.map((item) => item.id).join("|") === metricIds.join("|"), "DATA_CONTRACT_FAIL", "Scenario metrics must align");
    scenario.metrics.forEach((metric) => {
      c.text(metric.label, "Metric label");
      c.text(metric.value, "Metric value");
    });
  }
  c.text(data.diagram.no_regret, "No-regret moves");
  if (data.diagram.contingent) c.text(data.diagram.contingent, "Contingent move");
}

export function validateR2Module(data) {
  requireCondition(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(R2_MODULES.has(data?.module_id), "LOGIC_STRUCTURE_FAIL", "Expected an R2 module_id");
  requireCondition(data?.diagram?.type === data.module_id, "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const c = collector(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  const handlers = {
    "route-tradeoff": validateRouteTradeoff,
    "scqa-roadmap": validateScqaRoadmap,
    "bubble-heatmap": validateBubbleHeatmap,
    "chart-insight": validateChartInsight,
    "scenario-planning": validateScenarioPlanning,
  };
  handlers[data.module_id](data, c);
  return { ok: true, module_id: data.module_id, ...validateAllAnchorsMapped(data.source_anchors, c.mapped) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_r2_module.mjs <input.json>");
    const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
    process.stdout.write(`${JSON.stringify(validateR2Module(data))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
