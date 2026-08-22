import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const MODULES = new Set(["marimekko", "tornado-sensitivity", "radar-capability", "dumbbell-gap", "bump-ranking", "composition-shift", "part-to-whole", "box-plot", "histogram", "box-plot-jitter", "small-multiples"]);

function normalizeRankMigration(data) {
  if (data?.module_id !== "slope-ranking" && data?.diagram?.type !== "slope-ranking") return data;
  const diagram = data.diagram ?? {};
  const periods = [diagram.left_period, diagram.right_period];
  const objects = (diagram.objects ?? []).map((object) => ({
    ...object,
    ranks: [object.left_rank, object.right_rank],
    values: [object.left_value, object.right_value],
    states: ["active", object.exit ? "exited" : "active"],
  }));
  return {
    ...data,
    module_id: "bump-ranking",
    diagram: { ...diagram, type: "bump-ranking", periods, objects },
  };
}

function context(data) {
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

function near(value, expected, tolerance = 1e-6) { return Math.abs(value - expected) <= tolerance; }

function parseCsv(text) {
  const rows = [];
  let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((value) => value !== "")) rows.push(row); }
  requireCondition(rows.length >= 2, "ABNORMAL_FORMAT_FAIL", "CSV needs a header and at least one data row");
  const headers = rows[0];
  requireCondition(headers.every(Boolean) && new Set(headers).size === headers.length, "ABNORMAL_FORMAT_FAIL", "CSV headers must be non-empty and unique");
  return rows.slice(1).map((values, rowIndex) => {
    requireCondition(values.length === headers.length, "ABNORMAL_FORMAT_FAIL", `CSV row ${rowIndex + 2} has ${values.length} cells; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function numeric(value, label) {
  requireCondition(typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)), "ABNORMAL_FORMAT_FAIL", `${label} must be numeric`);
  return Number(value);
}

function scaleFromUnit(unit) {
  const match = String(unit ?? "").match(/(-?\d+(?:\.\d+)?)\s*(?:至|[-–—])\s*(-?\d+(?:\.\d+)?)/u);
  requireCondition(match, "SCALE_CONTRACT_FAIL", "Radar dataset unit must explicitly declare a numeric range such as 0至10分");
  return { min: Number(match[1]), max: Number(match[2]), unit: String(unit).replace(match[0], "").trim() || "分", source_label: String(unit) };
}

function handoffTextSources(data, radarRows, rankingRows) {
  const byId = new Map([["S18", []], ["G18", []]]);
  const add = (id, value) => { if (value !== undefined && value !== null && String(value) !== "") byId.get(id)?.push(String(value)); };
  add("S18", data.content?.title); add("G18", data.content?.subtitle); add("S18", data.content?.action);
  for (const value of data.content?.insights ?? []) add("S18", value);
  for (const value of data.content?.footnotes ?? []) add("G18", value);
  for (const row of radarRows) {
    add("S18", row.dimension); add("S18", row.current_score); add("G18", row.peer_median_score); add("G18", row.target_score);
    add("S18", `现状 ${row.current_score}；同业 ${row.peer_median_score}；目标 ${row.target_score}`);
  }
  for (const row of rankingRows) {
    add("S18", row.unit_name); add("S18", row.decentralization_index); add("G18", row.revenue_100m_cny); add("G18", row.headcount);
  }
  for (const block of data.display_blocks ?? []) for (const item of block.items ?? []) { add("S18", item.label); add("S18", typeof item.value === "string" ? item.value : null); }
  ["本司现状", "同业中位", "目标态", "业务单元分权排序", "试点边界", "6个月观察门槛", "试点边界与观察门槛"].forEach((value) => add("S18", value));
  return [...byId].map(([id, values]) => ({ id, text: [...new Set(values)].join("；") })).filter((item) => item.text);
}

function textItem(text, source_ids) { return { text: String(text), source_ids }; }

function normalizeRadarHandoff(data, radarRows, rankingRows) {
  requireCondition(data?.requested_module === "radar-capability" && data?.structure?.family === "radar-capability", "LOGIC_STRUCTURE_FAIL", "Expected a radar-capability handoff");
  const radarDataset = data.datasets?.find((item) => item.dataset_id === "D01");
  const rankingDataset = data.datasets?.find((item) => item.dataset_id === "D02");
  requireCondition(radarDataset && rankingDataset, "INPUT_CONTRACT_FAIL", "Radar handoff needs D01 radar data and D02 ranking evidence");
  const scale = scaleFromUnit(radarDataset.unit);
  const seriesItems = data.display_blocks?.find((item) => item.block_id === "B01")?.items ?? [];
  const conditionItems = data.display_blocks?.find((item) => item.block_id === "B03")?.items ?? [];
  const anchors = handoffTextSources(data, radarRows, rankingRows);
  const sourceIds = anchors.map((item) => item.id);
  const composite = Object.fromEntries(seriesItems.map((item) => [item.item_id === "R01" ? "current" : item.item_id === "R02" ? "benchmark" : "target", item.value]));
  return {
    version: "1.0",
    module_id: "radar-capability",
    input_kind: "prompt-architect-handoff",
    source_anchors: anchors,
    title: { text: data.content.title, origin: "source", source_ids: ["S18"] },
    subtitle: data.content.subtitle ? textItem(data.content.subtitle, ["G18"]) : null,
    diagram: {
      type: "radar-capability",
      scale,
      series_labels: {
        current: textItem(seriesItems[0]?.label ?? "本司现状", ["S18"]),
        benchmark: textItem(seriesItems[1]?.label ?? "同业中位", ["S18"]),
        target: textItem(seriesItems[2]?.label ?? "目标态", ["S18"]),
      },
      composite,
      dimensions: radarRows.sort((a, b) => numeric(a.dimension_order, "dimension_order") - numeric(b.dimension_order, "dimension_order")).map((row) => ({
        label: textItem(row.dimension, ["S18"]),
        current: numeric(row.current_score, `${row.dimension}.current_score`),
        benchmark: numeric(row.peer_median_score, `${row.dimension}.peer_median_score`),
        target: numeric(row.target_score, `${row.dimension}.target_score`),
        shortfall: textItem(`现状 ${row.current_score}；同业 ${row.peer_median_score}；目标 ${row.target_score}`, sourceIds),
        priority: ["定价权", "组织设置权"].includes(row.dimension),
        source_ids: sourceIds,
      })),
      supporting_evidence: {
        type: "business-unit-ranking",
        title: textItem("业务单元分权排序", ["S18"]),
        ordering: rankingDataset.ordering,
        items: rankingRows.sort((a, b) => numeric(a.unit_order, "unit_order") - numeric(b.unit_order, "unit_order")).map((row) => ({
          label: textItem(row.unit_name, ["S18"]),
          value: numeric(row.decentralization_index, `${row.unit_name}.decentralization_index`),
          revenue: row.revenue_applicable === "false" ? null : numeric(row.revenue_100m_cny, `${row.unit_name}.revenue_100m_cny`),
          revenue_applicable: row.revenue_applicable !== "false",
          headcount: numeric(row.headcount, `${row.unit_name}.headcount`),
          maturity_status: row.maturity_status,
          pilot_candidate: row.pilot_candidate === "yes",
          source_ids: sourceIds,
        })),
      },
      condition: conditionItems.length ? {
        title: textItem("试点边界与观察门槛", ["S18"]),
        items: conditionItems.map((item) => ({ label: textItem(item.label, ["S18"]), value: textItem(item.value, ["S18"]), source_ids: ["S18"] })),
      } : null,
      conclusion: data.content.action ? textItem(data.content.action, ["S18"]) : null,
      footnotes: (data.content.footnotes ?? []).map((value) => textItem(value, ["G18"])),
    },
  };
}

export async function loadR3ModuleInput(inputPath) {
  const data = normalizeRankMigration(JSON.parse(await fs.readFile(inputPath, "utf8")));
  if (data?.version === "1.0" && data?.module_id) return data;
  if (data?.schema_version === "1.0" && data?.module_payload) {
    requireCondition(data.requested_module === data.structure?.primary_exhibit && data.requested_module === data.module_payload.module_id, "ROUTE_CONFLICT", "requested_module, primary_exhibit and module_payload.module_id must match");
    return { ...data.module_payload, input_kind: "producer-module-payload" };
  }
  if (data?.schema_version === "1.0" && data?.requested_module === "radar-capability") {
    const base = path.dirname(inputPath);
    const radarPath = data.datasets?.find((item) => item.dataset_id === "D01")?.path;
    const rankingPath = data.datasets?.find((item) => item.dataset_id === "D02")?.path;
    requireCondition(radarPath && rankingPath, "INPUT_CONTRACT_FAIL", "Radar handoff dataset paths are required");
    const [radarText, rankingText] = await Promise.all([fs.readFile(path.resolve(base, radarPath), "utf8"), fs.readFile(path.resolve(base, rankingPath), "utf8")]);
    return normalizeRadarHandoff(data, parseCsv(radarText), parseCsv(rankingText));
  }
  return data;
}

export async function validateR3ModuleFile(inputPath) {
  const normalized = await loadR3ModuleInput(inputPath);
  return { normalized, result: validateR3Module(normalized) };
}

function validateMekko(data, c) {
  const segments = data.diagram.segments;
  requireCondition(Array.isArray(segments) && segments.length >= 3 && segments.length <= 6, "DATA_CONTRACT_FAIL", "Mekko requires 3–6 segments");
  requireCondition(near(segments.reduce((sum, item) => sum + item.size_share, 0), 100), "MEKKO_RECONCILIATION_FAIL", "Segment size shares must sum to 100");
  const stackIds = segments[0]?.stacks?.map((item) => item.id) ?? [];
  requireCondition(stackIds.length >= 2 && stackIds.length <= 5, "DATA_CONTRACT_FAIL", "Mekko requires 2–5 stack categories");
  for (const segment of segments) {
    c.text(segment.label, "Segment label");
    c.text(segment.absolute_size, "Segment absolute size");
    c.text(segment.growth, "Segment growth");
    requireCondition(segment.stacks?.map((item) => item.id).join("|") === stackIds.join("|"), "DATA_CONTRACT_FAIL", "Every segment must use identical stack categories");
    requireCondition(near(segment.stacks.reduce((sum, item) => sum + item.share, 0), 100), "MEKKO_RECONCILIATION_FAIL", `Stacks in ${segment.label.text} must sum to 100`);
    for (const stack of segment.stacks) { c.text(stack.label, "Stack label"); c.source(stack.source_ids, "Stack value"); }
    c.source(segment.source_ids, "Segment data");
  }
  if (data.diagram.priority_label) c.text(data.diagram.priority_label, "Priority label");
  (data.diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
  if (data.diagram.source_note) c.text(data.diagram.source_note, "Data source");
  if (data.diagram.disclosure) c.text(data.diagram.disclosure, "Disclosure");
}

function validatePartToWhole(data, c) {
  const diagram = data.diagram;
  requireCondition(["pie", "doughnut"].includes(diagram.chart_type), "DATA_CONTRACT_FAIL", "Part-to-whole chart_type must be pie or doughnut");
  requireCondition(!Array.isArray(diagram.periods) || diagram.periods.length === 0, "MODULE_COVERAGE_GAP", "Part-to-whole accepts one period only; multi-period composition uses composition-shift");
  c.text(diagram.period, "Part-to-whole period");
  c.text(diagram.total_label, "Part-to-whole total label");
  requireCondition(Number.isFinite(diagram.total_value) && diagram.total_value > 0, "DATA_CONTRACT_FAIL", "Part-to-whole requires a positive finite total_value");
  requireCondition(typeof diagram.unit === "string" && diagram.unit.trim().length > 0, "DATA_CONTRACT_FAIL", "Part-to-whole unit is required");
  c.source(diagram.total_value_source_ids, "Part-to-whole total value");
  const parts = diagram.parts;
  requireCondition(Array.isArray(parts) && parts.length >= 3 && parts.length <= 6, "DATA_CONTRACT_FAIL", "Part-to-whole requires 3–6 parts");
  const ids = new Set();
  let priorityCount = 0;
  let sum = 0;
  for (const part of parts) {
    requireCondition(typeof part.id === "string" && part.id.length > 0 && !ids.has(part.id), "DATA_CONTRACT_FAIL", "Part-to-whole part IDs must be unique non-empty strings");
    ids.add(part.id);
    c.text(part.label, "Part label");
    requireCondition(Number.isFinite(part.value) && part.value >= 0, "DATA_CONTRACT_FAIL", `Part ${part.id} value must be finite and non-negative`);
    c.source(part.source_ids, `Part ${part.id} value`);
    sum += part.value;
    if (part.priority === true) priorityCount += 1;
  }
  requireCondition(priorityCount <= 1, "DATA_CONTRACT_FAIL", "Part-to-whole supports at most one priority part");
  requireCondition(near(sum, diagram.total_value), "PART_TO_WHOLE_RECONCILIATION_FAIL", "Part values must sum exactly to total_value");
  if (diagram.chart_type === "doughnut") {
    c.text(diagram.center_label, "Doughnut center label");
    c.text(diagram.center_value, "Doughnut center value");
  } else requireCondition(diagram.center_label === undefined && diagram.center_value === undefined, "DATA_CONTRACT_FAIL", "Pie mode cannot contain doughnut center fields");
  requireCondition((diagram.insights ?? []).length <= 3, "DATA_CONTRACT_FAIL", "Part-to-whole supports at most three insights");
  (diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (diagram.conclusion) c.text(diagram.conclusion, "Conclusion");
}

function validateTornado(data, c) {
  requireCondition(Number.isFinite(data.diagram.base_value), "DATA_CONTRACT_FAIL", "Tornado base_value is required");
  const variables = data.diagram.variables;
  requireCondition(Array.isArray(variables) && variables.length >= 4 && variables.length <= 10, "DATA_CONTRACT_FAIL", "Tornado requires 4–10 variables");
  let previous = Infinity;
  for (const variable of variables) {
    c.text(variable.label, "Variable label");
    c.text(variable.range, "Variable range");
    c.text(variable.controllability, "Controllability");
    c.text(variable.confidence, "Confidence");
    requireCondition(Number.isFinite(variable.low_result) && Number.isFinite(variable.high_result), "DATA_CONTRACT_FAIL", "Tornado result endpoints must be numeric");
    const impact = Math.max(Math.abs(variable.low_result - data.diagram.base_value), Math.abs(variable.high_result - data.diagram.base_value));
    requireCondition(impact <= previous + 1e-6, "TORNADO_ORDER_FAIL", "Variables must be sorted by descending absolute impact");
    previous = impact;
    c.source(variable.source_ids, "Variable data");
  }
  (data.diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (data.diagram.action) c.text(data.diagram.action, "Action");
}

function validateRadar(data, c) {
  const scale = data.diagram.scale;
  requireCondition(scale && Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.min < scale.max, "SCALE_CONTRACT_FAIL", "Radar scale must explicitly declare finite min and max values");
  requireCondition(typeof scale.unit === "string" && scale.unit.length > 0, "SCALE_CONTRACT_FAIL", "Radar scale unit is required");
  const dimensions = data.diagram.dimensions;
  requireCondition(Array.isArray(dimensions) && dimensions.length >= 6 && dimensions.length <= 12, "DATA_CONTRACT_FAIL", "Radar requires 6–12 dimensions");
  for (const key of ["current", "benchmark", "target"]) c.text(data.diagram.series_labels?.[key], `Radar ${key} series label`);
  for (const dimension of dimensions) {
    c.text(dimension.label, "Radar dimension");
    if (dimension.group) c.text(dimension.group, "Capability group");
    for (const key of ["current", "benchmark", "target"]) requireCondition(Number.isFinite(dimension[key]) && dimension[key] >= scale.min && dimension[key] <= scale.max, "SCALE_RANGE_FAIL", `Radar ${key} score for ${dimension.label.text} must be within ${scale.min}–${scale.max}`);
    if (dimension.shortfall) c.text(dimension.shortfall, "Shortfall");
    c.source(dimension.source_ids, "Radar scores");
  }
  if (data.diagram.group_cards) {
    requireCondition(Array.isArray(data.diagram.group_cards) && data.diagram.group_cards.length > 0, "DATA_CONTRACT_FAIL", "group_cards must be a non-empty array when provided");
    data.diagram.group_cards.forEach((item) => { c.text(item.group, "Group card label"); c.text(item.problem, "Group problem"); c.text(item.action, "Group action"); c.source(item.source_ids, "Group score"); });
  }
  const evidence = data.diagram.supporting_evidence;
  if (evidence) {
    requireCondition(evidence.type === "business-unit-ranking", "DATA_CONTRACT_FAIL", "Radar supporting evidence currently accepts business-unit-ranking");
    c.text(evidence.title, "Ranking title");
    requireCondition(Array.isArray(evidence.items) && evidence.items.length >= 2 && evidence.items.length <= 10, "DATA_CONTRACT_FAIL", "Business-unit ranking requires 2–10 items");
    let previous = Infinity;
    for (const item of evidence.items) {
      c.text(item.label, "Business-unit label");
      requireCondition(Number.isFinite(item.value) && item.value >= scale.min && item.value <= scale.max, "SCALE_RANGE_FAIL", `Business-unit score for ${item.label.text} must be within ${scale.min}–${scale.max}`);
      if (/降序/u.test(evidence.ordering ?? "")) requireCondition(item.value <= previous, "RANKING_ORDER_FAIL", "Business-unit ranking must follow its declared descending order");
      previous = item.value;
      requireCondition(item.revenue_applicable === false ? item.revenue === null : Number.isFinite(item.revenue), "DATA_CONTRACT_FAIL", "Revenue must be numeric or explicit not-applicable");
      requireCondition(Number.isFinite(item.headcount) && item.headcount >= 0, "DATA_CONTRACT_FAIL", "Business-unit headcount must be non-negative");
      c.source(item.source_ids, "Business-unit evidence");
    }
  }
  if (data.diagram.condition) {
    c.text(data.diagram.condition.title, "Condition title");
    requireCondition(Array.isArray(data.diagram.condition.items) && data.diagram.condition.items.length >= 1 && data.diagram.condition.items.length <= 3, "DATA_CONTRACT_FAIL", "Condition area requires 1–3 items");
    data.diagram.condition.items.forEach((item) => { c.text(item.label, "Condition label"); c.text(item.value, "Condition value"); c.source(item.source_ids, "Condition evidence"); });
  }
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
  (data.diagram.footnotes ?? []).forEach((item) => c.text(item, "Footnote"));
}

function validateDumbbell(data, c) {
  const metrics = data.diagram.metrics;
  requireCondition(Array.isArray(metrics) && metrics.length >= 5 && metrics.length <= 12, "DATA_CONTRACT_FAIL", "Dumbbell requires 5–12 metrics");
  let previous = Infinity;
  for (const metric of metrics) {
    c.text(metric.label, "Metric label"); c.text(metric.domain, "Metric domain"); c.text(metric.difficulty, "Improvement difficulty");
    requireCondition(["higher", "lower"].includes(metric.direction), "DATA_CONTRACT_FAIL", "Metric direction must be higher or lower");
    requireCondition(Number.isFinite(metric.current) && Number.isFinite(metric.target), "DATA_CONTRACT_FAIL", "Dumbbell endpoints must be numeric");
    const gap = Math.abs(metric.target - metric.current);
    requireCondition(gap <= previous + 1e-6, "DUMBBELL_ORDER_FAIL", "Metrics must be sorted by descending absolute gap");
    previous = gap;
    c.source(metric.source_ids, "Metric values");
    if (metric.root_cause) c.text(metric.root_cause, "Root cause");
  }
  (data.diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
}

function validateBump(data, c) {
  const periods = data.diagram.periods;
  const objects = data.diagram.objects;
  requireCondition(Array.isArray(periods) && periods.length >= 2 && periods.length <= 8, "DATA_CONTRACT_FAIL", "Bump chart requires 2–8 periods");
  periods.forEach((period) => c.text(period, "Rank period"));
  requireCondition(Array.isArray(objects) && objects.length >= 5 && objects.length <= 12, "DATA_CONTRACT_FAIL", "Bump chart requires 5–12 objects");
  const ranksByPeriod = periods.map(() => new Set());
  for (const object of objects) {
    c.text(object.label, "Object label");
    requireCondition(Array.isArray(object.ranks) && object.ranks.length === periods.length, "DATA_CONTRACT_FAIL", "Every object needs one rank slot per period");
    const values = object.values ?? object.ranks.map(() => null);
    requireCondition(Array.isArray(values) && values.length === periods.length, "DATA_CONTRACT_FAIL", "Every object needs one value slot per period");
    const states = object.states ?? object.ranks.map((rank) => Number.isInteger(rank) ? "active" : "not_ranked");
    requireCondition(Array.isArray(states) && states.length === periods.length, "DATA_CONTRACT_FAIL", "Every object needs one state slot per period");
    for (let index = 0; index < periods.length; index += 1) {
      const state = states[index]; const rank = object.ranks[index]; const value = values[index];
      requireCondition(["active", "new", "exited", "not_ranked"].includes(state), "DATA_CONTRACT_FAIL", `Unsupported rank state: ${state}`);
      if (["active", "new"].includes(state)) {
        requireCondition(Number.isInteger(rank) && rank >= 1, "DATA_CONTRACT_FAIL", "Active rank must be a positive integer");
        requireCondition(!ranksByPeriod[index].has(rank), "BUMP_RANK_CONFLICT", `Ranks must be unique at period ${index + 1}`);
        ranksByPeriod[index].add(rank);
        if (value !== null && value !== undefined) requireCondition(Number.isFinite(value), "DATA_CONTRACT_FAIL", "Rank values must be numeric when supplied");
      } else {
        requireCondition(rank === null || rank === undefined, "DATA_CONTRACT_FAIL", "Exited or unranked objects must use a null rank");
        requireCondition(value === null || value === undefined, "DATA_CONTRACT_FAIL", "Exited or unranked objects must use a null value");
      }
    }
    c.source(object.source_ids, "Rank migration data");
    if (object.reason) c.text(object.reason, "Movement reason");
  }
  (data.diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
}

function validateCompositionShift(data, c) {
  const periods = data.diagram.periods;
  const components = data.diagram.components;
  requireCondition(Array.isArray(periods) && periods.length >= 3 && periods.length <= 8, "DATA_CONTRACT_FAIL", "Composition shift requires 3–8 periods");
  periods.forEach((period) => c.text(period, "Composition period"));
  requireCondition(Array.isArray(components) && components.length >= 2 && components.length <= 6, "DATA_CONTRACT_FAIL", "Composition shift requires 2–6 components");
  requireCondition(["share", "absolute"].includes(data.diagram.basis), "DATA_CONTRACT_FAIL", "Composition basis must be share or absolute");
  c.text(data.diagram.denominator, "Composition denominator");
  c.text(data.diagram.unit, "Composition unit");
  const componentIds = new Set();
  for (const component of components) {
    requireCondition(typeof component.id === "string" && component.id.trim() !== "" && !componentIds.has(component.id), "DATA_CONTRACT_FAIL", "Composition component ids must be non-empty and unique");
    componentIds.add(component.id);
    c.text(component.label, "Composition component label");
    requireCondition(Array.isArray(component.shares) && component.shares.length === periods.length, "DATA_CONTRACT_FAIL", "Every component needs one share per period");
    requireCondition(component.shares.every((value) => Number.isFinite(value) && value >= 0 && value <= 100), "DATA_CONTRACT_FAIL", "Composition shares must be between 0 and 100");
    if (data.diagram.basis === "absolute") {
      requireCondition(Array.isArray(component.values) && component.values.length === periods.length, "DATA_CONTRACT_FAIL", "Absolute composition needs one value per component and period");
      requireCondition(component.values.every((value) => Number.isFinite(value) && value >= 0), "DATA_CONTRACT_FAIL", "Absolute composition values must be non-negative numbers");
    } else if (component.values !== undefined) {
      requireCondition(Array.isArray(component.values) && component.values.length === periods.length && component.values.every((value) => value === null || Number.isFinite(value)), "DATA_CONTRACT_FAIL", "Optional composition values must align with periods");
    }
    c.source(component.source_ids, "Composition values");
  }
  for (let periodIndex = 0; periodIndex < periods.length; periodIndex += 1) {
    const shareTotal = components.reduce((sum, component) => sum + component.shares[periodIndex], 0);
    requireCondition(near(shareTotal, 100, 0.05), "COMPOSITION_RECONCILIATION_FAIL", `Composition shares for period ${periodIndex + 1} must sum to 100`);
  }
  if (data.diagram.basis === "absolute") {
    requireCondition(Array.isArray(data.diagram.totals) && data.diagram.totals.length === periods.length, "DATA_CONTRACT_FAIL", "Absolute composition needs one denominator total per period");
    requireCondition(data.diagram.totals.every((value) => Number.isFinite(value) && value > 0), "DATA_CONTRACT_FAIL", "Composition totals must be positive numbers");
    c.source(data.diagram.total_source_ids, "Composition totals");
    for (let periodIndex = 0; periodIndex < periods.length; periodIndex += 1) {
      const valueTotal = components.reduce((sum, component) => sum + component.values[periodIndex], 0);
      requireCondition(near(valueTotal, data.diagram.totals[periodIndex], 0.01), "COMPOSITION_RECONCILIATION_FAIL", `Absolute values for period ${periodIndex + 1} must equal the declared total`);
      for (const component of components) {
        const calculatedShare = component.values[periodIndex] / data.diagram.totals[periodIndex] * 100;
        requireCondition(near(calculatedShare, component.shares[periodIndex], 0.05), "COMPOSITION_RECONCILIATION_FAIL", `Share and absolute value disagree for ${component.label.text} in period ${periodIndex + 1}`);
      }
    }
  }
  if (data.diagram.focus_component_id) requireCondition(componentIds.has(data.diagram.focus_component_id), "DATA_CONTRACT_FAIL", "focus_component_id must reference a declared component");
  requireCondition(Array.isArray(data.diagram.insights) && data.diagram.insights.length >= 1 && data.diagram.insights.length <= 3, "DATA_CONTRACT_FAIL", "Composition shift requires 1–3 source-backed insights");
  data.diagram.insights.forEach((item) => c.text(item, "Composition insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
  if (data.diagram.disclosure) c.text(data.diagram.disclosure, "Disclosure");
}

function validateBoxPlot(data, c) {
  const groups = data.diagram.groups;
  requireCondition(Array.isArray(groups) && groups.length >= 3 && groups.length <= 8, "DATA_CONTRACT_FAIL", "Box plot requires 3–8 groups");
  c.text(data.diagram.period, "Distribution period");
  c.text(data.diagram.unit, "Distribution unit");
  c.text(data.diagram.denominator, "Distribution denominator");
  c.text(data.diagram.sample_definition, "Sample definition");
  c.text(data.diagram.missing_policy, "Missing-value policy");
  c.text(data.diagram.quartile_method, "Quartile method");
  c.text(data.diagram.whisker_rule, "Whisker rule");
  requireCondition(data.diagram.whisker_multiplier === 1.5, "DATA_CONTRACT_FAIL", "Version 1.0 requires a 1.5×IQR whisker multiplier");
  const ids = new Set();
  for (const group of groups) {
    requireCondition(typeof group.id === "string" && group.id.trim() && !ids.has(group.id), "DATA_CONTRACT_FAIL", "Distribution group ids must be non-empty and unique");
    ids.add(group.id);
    c.text(group.label, "Distribution group label");
    requireCondition(Number.isInteger(group.sample_size) && group.sample_size >= 5, "DATA_CONTRACT_FAIL", "Each group needs an effective sample size of at least 5");
    requireCondition(Number.isInteger(group.missing_count) && group.missing_count >= 0, "DATA_CONTRACT_FAIL", "Each group needs an explicit non-negative missing count");
    const values = [group.whisker_low, group.q1, group.median, group.q3, group.whisker_high];
    requireCondition(values.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Every group needs numeric whisker, quartile, and median values");
    requireCondition(group.whisker_low <= group.q1 && group.q1 <= group.median && group.median <= group.q3 && group.q3 <= group.whisker_high, "BOX_PLOT_RECONCILIATION_FAIL", "Whiskers, quartiles, and median must be ordered");
    const iqr = group.q3 - group.q1;
    requireCondition(iqr > 0, "BOX_PLOT_RECONCILIATION_FAIL", "Each group needs a positive interquartile range");
    requireCondition(group.whisker_low >= group.q1 - data.diagram.whisker_multiplier * iqr - 1e-6, "BOX_PLOT_RECONCILIATION_FAIL", "Lower whisker must remain inside the declared 1.5×IQR fence");
    requireCondition(group.whisker_high <= group.q3 + data.diagram.whisker_multiplier * iqr + 1e-6, "BOX_PLOT_RECONCILIATION_FAIL", "Upper whisker must remain inside the declared 1.5×IQR fence");
    requireCondition(Array.isArray(group.outliers) && group.outliers.length <= 6 && group.outliers.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Outliers must be an explicit numeric array with at most six values per group");
    requireCondition(group.outliers.every((value) => value < group.whisker_low || value > group.whisker_high), "BOX_PLOT_RECONCILIATION_FAIL", "Every declared outlier must fall outside the whisker endpoints");
    c.source(group.source_ids, "Distribution summary");
  }
  requireCondition(Array.isArray(data.diagram.insights) && data.diagram.insights.length >= 1 && data.diagram.insights.length <= 3, "DATA_CONTRACT_FAIL", "Box plot requires 1–3 source-backed insights");
  data.diagram.insights.forEach((item) => c.text(item, "Distribution insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
  if (data.diagram.source_note) c.text(data.diagram.source_note, "Data source");
  if (data.diagram.disclosure) c.text(data.diagram.disclosure, "Disclosure");
}

function validateBoxPlotJitter(data, c) {
  const groups = data.diagram.groups;
  requireCondition(Array.isArray(groups) && groups.length >= 2 && groups.length <= 6, "DATA_CONTRACT_FAIL", "Distribution comparison requires 2–6 groups");
  c.text(data.diagram.period, "Observation period");
  c.text(data.diagram.unit, "Observation unit");
  c.text(data.diagram.observation_definition, "Observation definition");
  c.text(data.diagram.sample_definition, "Sample definition");
  requireCondition(data.diagram.statistics_rule === "tukey_hinges_1_5_iqr", "BOX_STATISTICS_RULE_FAIL", "statistics_rule must be tukey_hinges_1_5_iqr");
  c.text(data.diagram.statistics_note, "Statistics note");
  c.text(data.diagram.jitter_note, "Jitter note");
  const groupIds = new Set();
  for (const group of groups) {
    requireCondition(typeof group.id === "string" && group.id.trim() !== "" && !groupIds.has(group.id), "DATA_CONTRACT_FAIL", "Group ids must be non-empty and unique");
    groupIds.add(group.id);
    c.text(group.label, "Group label");
    requireCondition(Array.isArray(group.observations) && group.observations.length >= 5 && group.observations.length <= 60, "DATA_CONTRACT_FAIL", "Each group requires 5–60 raw observations");
    requireCondition(group.observations.every(Number.isFinite), "ABNORMAL_FORMAT_FAIL", "Raw observations must be finite numbers");
    requireCondition(group.n === group.observations.length, "SAMPLE_SIZE_MISMATCH", `Declared sample size for ${group.label.text} must equal the raw observation count`);
    c.source(group.source_ids, "Raw observations");
  }
  const totalPoints = groups.reduce((sum, group) => sum + group.observations.length, 0);
  requireCondition(totalPoints <= 240, "SINGLE_SLIDE_FIT_FAIL", "The page supports at most 240 editable observation points");
  requireCondition(Array.isArray(data.diagram.insights) && data.diagram.insights.length >= 1 && data.diagram.insights.length <= 3, "DATA_CONTRACT_FAIL", "Distribution comparison requires 1–3 source-backed insights");
  data.diagram.insights.forEach((item) => c.text(item, "Distribution insight"));
  if (data.diagram.conclusion) c.text(data.diagram.conclusion, "Conclusion");
  if (data.diagram.disclosure) c.text(data.diagram.disclosure, "Disclosure");
}

export function calculateHistogram(diagram) {
  const edges = diagram.binning.edges;
  const counts = Array(edges.length - 1).fill(0);
  let missing = 0;
  for (const value of diagram.observations) {
    if (value === null || value === "") { missing += 1; continue; }
    const number = Number(value);
    if (!Number.isFinite(number)) { missing += 1; continue; }
    let index = -1;
    for (let candidate = 0; candidate < edges.length - 1; candidate += 1) {
      const isLast = candidate === edges.length - 2;
      if (number >= edges[candidate] && (number < edges[candidate + 1] || (isLast && diagram.binning.last_bin_inclusive && number <= edges[candidate + 1]))) {
        index = candidate;
        break;
      }
    }
    requireCondition(index >= 0, "HISTOGRAM_RANGE_FAIL", `Observation ${number} falls outside declared bin edges`);
    counts[index] += 1;
  }
  return { counts, missing, valid: counts.reduce((sum, value) => sum + value, 0), total: diagram.observations.length };
}

function validateHistogram(data, c) {
  const diagram = data.diagram;
  c.text(diagram.metric, "Histogram metric");
  c.text(diagram.unit, "Histogram unit");
  c.text(diagram.period, "Histogram period");
  c.text(diagram.denominator, "Histogram denominator");
  requireCondition(["count", "frequency"].includes(diagram.frequency_basis), "DATA_CONTRACT_FAIL", "Histogram frequency_basis must be count or frequency");
  requireCondition(Array.isArray(diagram.observations) && diagram.observations.length >= 10 && diagram.observations.length <= 500, "DATA_CONTRACT_FAIL", "Histogram requires 10–500 observations including explicit missing values");
  requireCondition(diagram.observations.every((value) => value === null || value === "" || Number.isFinite(Number(value))), "ABNORMAL_FORMAT_FAIL", "Histogram observations must be numeric, null, or blank");
  const edges = diagram.binning?.edges;
  requireCondition(diagram.binning?.method === "explicit_edges", "DATA_CONTRACT_FAIL", "Histogram binning method must be explicit_edges");
  requireCondition(Array.isArray(edges) && edges.length >= 5 && edges.length <= 13 && edges.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Histogram needs 4–12 finite bins");
  requireCondition(edges.every((value, index) => index === 0 || value > edges[index - 1]), "HISTOGRAM_BINNING_FAIL", "Histogram bin edges must be strictly increasing");
  requireCondition(diagram.binning.include_left === true && typeof diagram.binning.last_bin_inclusive === "boolean", "DATA_CONTRACT_FAIL", "Histogram inclusion rules must be explicit");
  c.source(diagram.data_source_ids, "Histogram observations and bins");
  const calculated = calculateHistogram(diagram);
  requireCondition(diagram.sample?.total === calculated.total && diagram.sample?.valid === calculated.valid && diagram.sample?.missing === calculated.missing, "HISTOGRAM_SAMPLE_RECONCILIATION_FAIL", "Histogram total, valid, and missing sample counts must reconcile");
  if (diagram.bins !== undefined) {
    requireCondition(Array.isArray(diagram.bins) && diagram.bins.length === calculated.counts.length, "DATA_CONTRACT_FAIL", "Declared histogram bins must match edge count");
    diagram.bins.forEach((bin, index) => {
      requireCondition(bin.lower === edges[index] && bin.upper === edges[index + 1] && bin.count === calculated.counts[index], "HISTOGRAM_BINNING_FAIL", `Declared bin ${index + 1} does not reproduce from observations`);
      c.source(bin.source_ids, `Histogram bin ${index + 1}`);
    });
  }
  requireCondition(Array.isArray(diagram.insights) && diagram.insights.length >= 1 && diagram.insights.length <= 3, "DATA_CONTRACT_FAIL", "Histogram requires 1–3 source-backed insights");
  diagram.insights.forEach((item) => c.text(item, "Histogram insight"));
  if (diagram.conclusion) c.text(diagram.conclusion, "Conclusion");
  if (diagram.disclosure) c.text(diagram.disclosure, "Disclosure");
  return calculated;
}
function validateSmallMultiples(data, c) {
  const diagram = data.diagram;
  const panels = diagram.panels;
  requireCondition(Array.isArray(panels) && panels.length >= 3 && panels.length <= 9, "DATA_CONTRACT_FAIL", "Small multiples requires 3–9 panels");
  requireCondition(["line", "column"].includes(diagram.series_type), "DATA_CONTRACT_FAIL", "Small multiples series_type must be line or column");
  c.text(diagram.metric, "Small multiples metric");
  c.text(diagram.unit, "Small multiples unit");
  const scale = diagram.scale;
  requireCondition(scale && Number.isFinite(scale.min) && Number.isFinite(scale.max) && scale.min < scale.max, "SCALE_CONTRACT_FAIL", "Small multiples requires a finite shared scale with min < max");
  const count = diagram.periods?.length;
  requireCondition(Number.isInteger(count) && count >= 3 && count <= 12, "DATA_CONTRACT_FAIL", "Small multiples requires 3–12 periods");
  diagram.periods.forEach((item) => c.text(item, "Period"));
  const benchmarkSupplied = diagram.benchmark !== undefined;
  if (benchmarkSupplied) {
    requireCondition(Array.isArray(diagram.benchmark) && diagram.benchmark.length === count && diagram.benchmark.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Benchmark length must match every panel");
    requireCondition(diagram.benchmark.every((value) => value >= scale.min && value <= scale.max), "SCALE_RANGE_FAIL", "Benchmark values must stay within the shared scale");
    c.text(diagram.benchmark_label, "Benchmark label");
    c.source(diagram.benchmark_source_ids, "Benchmark data");
  } else {
    requireCondition(diagram.benchmark_label === undefined && diagram.benchmark_source_ids === undefined, "DATA_CONTRACT_FAIL", "Benchmark metadata cannot be supplied without benchmark values");
  }
  const ids = new Set();
  const states = new Set(["invest", "maintain", "watch", "exit"]);
  for (const panel of panels) {
    requireCondition(typeof panel.id === "string" && panel.id.length > 0 && !ids.has(panel.id), "DATA_CONTRACT_FAIL", "Small multiples panel ids must be unique non-empty strings");
    ids.add(panel.id);
    c.text(panel.label, "Panel label"); c.text(panel.summary, "Panel summary"); c.text(panel.classification, "Panel classification");
    requireCondition(states.has(panel.classification_state), "DATA_CONTRACT_FAIL", "Panel classification_state must be invest, maintain, watch, or exit");
    requireCondition(panel.values?.length === count && panel.values.every(Number.isFinite), "DATA_CONTRACT_FAIL", "Every panel must use the same periods");
    requireCondition(panel.values.every((value) => value >= scale.min && value <= scale.max), "SCALE_RANGE_FAIL", `Panel ${panel.id} values must stay within the shared scale`);
    c.source(panel.source_ids, "Panel values");
  }
  requireCondition((diagram.insights ?? []).length <= 3, "DATA_CONTRACT_FAIL", "Small multiples supports at most three insights");
  (diagram.insights ?? []).forEach((item) => c.text(item, "Insight"));
  if (diagram.conclusion) c.text(diagram.conclusion, "Conclusion");
}

export function validateR3Module(data) {
  data = normalizeRankMigration(data);
  requireCondition(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(MODULES.has(data?.module_id), "LOGIC_STRUCTURE_FAIL", "Expected an R3 module_id");
  requireCondition(data?.diagram?.type === data.module_id, "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const c = context(data);
  if (data.subtitle) c.text(data.subtitle, "Subtitle");
  ({ marimekko: validateMekko, "tornado-sensitivity": validateTornado, "radar-capability": validateRadar, "dumbbell-gap": validateDumbbell, "bump-ranking": validateBump, "composition-shift": validateCompositionShift, "part-to-whole": validatePartToWhole, "box-plot": validateBoxPlot, histogram: validateHistogram, "box-plot-jitter": validateBoxPlotJitter, "small-multiples": validateSmallMultiples })[data.module_id](data, c);
  return { ok: true, module_id: data.module_id, ...validateAllAnchorsMapped(data.source_anchors, c.mapped) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try { if (!inputPath) throw new Error("Usage: validate_r3_module.mjs <input.json>"); const { normalized, result } = await validateR3ModuleFile(inputPath); process.stdout.write(`${JSON.stringify({ ...result, input_kind: normalized.input_kind ?? "module-fixture", scale: normalized.diagram?.scale })}\n`); }
  catch (error) { process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`); process.exitCode = 1; }
}
