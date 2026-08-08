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
  "complex-org-chart": { aliases: ["组织架构", "组织结构图", "org chart", "organization chart"], cues: [["汇报", "上级", "下级", "部门", "虚线", "项目组", "大区"]] },
  "causal-chain": { aliases: ["因果链", "驱动因素", "causal chain", "driver tree"], cues: [["导致", "影响", "驱动", "传导", "继而", "最终", "改善", "结果"]] },
  "issue-tree": { aliases: ["议题树", "问题树", "issue tree", "logic tree"], cues: [["拆解", "分支", "子议题", "根因", "mece"]] },
  "stage-process": { aliases: ["五步流程", "阶段流程", "chevron", "step process"], cues: [["步骤", "阶段", "流程", "里程碑", "阶段门"]] },
  "waterfall-attribution": { aliases: ["瀑布图", "waterfall"], cues: [["起点", "终点", "预算利润", "实际利润", "增减", "差额", "逐项解释", "归因", "对平"]] },
  "route-tradeoff": { aliases: ["路线对比", "两种路线", "tradeoff", "路线 a", "路线 b"], cues: [["取舍", "对比", "争议点", "推荐路线", "两条路线"]] },
  "scqa-roadmap": { aliases: ["scqa", "情境冲突问题答案"], cues: [["情境", "冲突", "问题", "答案", "落地路径"]] },
  "bubble-heatmap": { aliases: ["气泡矩阵", "2×2", "2x2", "bubble matrix"], cues: [["价值", "难度", "气泡", "热力", "优先级"]] },
  "chart-insight": { aliases: ["图表加洞察", "图表＋洞察", "柱状图洞察", "chart insight"], cues: [["柱状图", "折线", "洞察栏", "引线", "数据结论"]] },
  "scenario-planning": { aliases: ["情景规划", "悲观基准乐观", "scenario planning"], cues: [["悲观", "基准", "乐观", "发生概率", "无悔举措"]] },
  marimekko: { aliases: ["marimekko", "mekko", "马赛克图"], cues: [["列宽", "横向宽度", "市场规模占比", "内部构成", "份额构成", "块面积"]] },
  "tornado-sensitivity": { aliases: ["龙卷风图", "敏感性分析", "tornado", "一次只变一个变量"], cues: [["悲观值", "乐观值", "低值", "高值", "基准情形", "基准结果", "参数", "变量", "单变量"]] },
  "radar-capability": { aliases: ["雷达图", "九维雷达", "radar chart"], cues: [["能力维度", "当前水平", "行业中位", "目标", "成熟度"]] },
  "dumbbell-gap": { aliases: ["哑铃图", "哑铃点图", "dumbbell"], cues: [["现状", "目标", "标杆", "差距", "指标"]] },
  "bump-ranking": { aliases: ["排名迁移图", "坡度图", "bump chart", "slope chart", "slope-ranking"], cues: [["排名", "时点", "上升", "下降", "榜单", "多期"]] },
  "composition-shift": { aliases: ["构成变化图", "百分比堆积柱状图", "100%堆积柱状图", "composition shift"], cues: [["占比", "构成", "时期", "合计100%", "结构变化"]] },
  "cohort-retention": { aliases: ["cohort retention", "分群留存", "批次留存"], cues: [["批次", "相对周期", "初始基数", "未成熟", "仍活跃"], ["第0周", "后面的周数", "空白", "早期流失"]] },
  "box-plot": { aliases: ["箱线图", "盒须图", "box plot", "boxplot"], cues: [["中位数", "四分位", "中间50%", "离散", "异常值", "须线", "分布"]] },
  histogram: { aliases: ["直方图", "histogram"], cues: [["连续数值", "分箱", "区间", "集中", "偏态", "长尾", "多峰", "缺失值", "样本"]] },
  "box-plot-jitter": { aliases: ["箱线图加散点", "箱线图＋抖动散点", "box plot jitter"], cues: [["组别", "原始观测", "中位数", "四分位", "异常值", "样本量", "分布", "每位"]] },
  "correlation-matrix": { aliases: ["相关矩阵", "相关性矩阵", "correlation matrix"], cues: [["一起变化", "方向相反", "关系较弱", "最强正", "最强负", "系数", "pearson", "spearman"]] },
  "scatter-regression": { aliases: ["散点回归", "线性回归", "scatter regression"], cues: [["两个连续指标", "关系方向", "关系强度", "偏离趋势", "离群", "可解释范围", "样本内关联"]] },
  "confidence-band": { aliases: ["置信带", "置信区间带", "confidence band"], cues: [["中心估计", "上下界", "区间宽度", "不确定性", "阈值", "重抽样"], ["estimate", "lower", "upper", "interval"]] },
  "small-multiples": { aliases: ["小倍数", "small multiples", "3×3 微型图"], cues: [["多个对象", "统一刻度", "迷你折线", "矩阵", "基准"]] },
  "sankey-flow": { aliases: ["桑基图", "sankey"], cues: [["流带", "分流", "损耗", "转化率", "四层节点"]] },
  "chord-dependency": { aliases: ["弦图", "依赖轮", "chord"], cues: [["双向依赖", "交互强度", "圆周", "部门协作"]] },
  "market-funnel": { aliases: ["tam sam som", "市场漏斗", "市场空间漏斗"], cues: [["tam", "sam", "som", "渗透率", "客单价"]] },
  "region-map-table": { aliases: ["地图明细", "分布地图", "区域地图"], cues: [["城市", "区域", "地图", "气泡", "明细表"]] },
  "industry-value-chain": { aliases: ["产业价值链", "价值链图", "value chain"], cues: [["上游", "中游", "下游", "参与者", "利润率"]] },
  "spiral-maturity": { aliases: ["螺旋成熟度", "螺旋线", "spiral maturity"], cues: [["多轮迭代", "四圈", "设计", "执行", "度量", "沉淀"]] },
  "gantt-dependency": { aliases: ["甘特图", "gantt"], cues: [["任务", "月份", "依赖", "关键路径", "里程碑"]] },
  "hr-age-gender-pyramid": { aliases: ["年龄性别金字塔", "人口金字塔", "人员金字塔"], cues: [["年龄段", "男性", "女性", "人数", "人员结构"]] },
  "hr-workforce-reconciliation": { aliases: ["人员对账", "编制对账", "人头对账"], cues: [["期初", "入职", "离职", "转出", "转入", "期末"]] },
  "hr-new-hire-survival": { aliases: ["新人留存生存曲线", "留存生存曲线", "cohort survival"], cues: [["入职后", "留存率", "批次", "司龄", "存活"]] },
  "hr-supply-demand-gap": { aliases: ["人力供需缺口", "编制供需", "人才供需"], cues: [["需求预测", "内部供给", "自然流失", "退休", "外部补充"]] },
  "hr-level-function-matrix": { aliases: ["职级职能矩阵", "岗位体系矩阵"], cues: [["职级", "职能序列", "管理跨度", "人数倒挂", "层级"]] },
  "hr-from-to-mobility": { aliases: ["from-to 人才流动", "from-to 方阵", "人才流动方阵", "内部流动矩阵"], cues: [["流出部门", "流入部门", "跨部门转岗", "转岗后质量", "转岗率", "留任人数", "人才孤岛"]] },
  "hr-eligibility-matrix": { aliases: ["资格覆盖矩阵", "政策覆盖矩阵", "eligibility matrix"], cues: [["资格条件", "覆盖人群", "政策", "例外", "是否适用"]] },
  "hr-service-catalog": { aliases: ["hr 服务目录", "人力资源服务目录", "service catalog"], cues: [["服务目录", "服务层级", "渠道", "时效承诺", "自动化"]] },
  "hr-ticket-intake": { aliases: ["hr 工单受理", "工单入口", "ticket intake"], cues: [["受理渠道", "工单量", "一次解决率", "积压", "受理"]] },
  "hr-ticket-classification": { aliases: ["hr 工单分类", "工单分类流", "ticket classification"], cues: [["工单分类", "重分类率", "服务水平", "优先级", "分派"]] },
};

function normalizeText(value) {
  return String(value ?? "").toLowerCase().replace(/[：:／/、，,；;（）()\[\]【】"']/g, " ").replace(/\s+/g, " ").trim();
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
  const relationshipCue = ["结构", "构成", "占比", "组合", "mix", "share", "composition"].some((cue) => text.includes(cue));
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
  const relationshipCue = ["批次", "相对", "加入", "入职", "获客", "激活", "留存", "存续", "流失"].some((cue) => text.includes(cue));
  if (!relationshipCue) return null;
  return ["inferred:aligned_relative_periods", "inferred:cohort_initial_bases", "cue:cohort_comparison"];
}

function inferBoxPlot(data, text) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (groups.length < 3 || groups.length > 8) return null;
  const complete = groups.every((group) => group && typeof group === "object" && ["q1", "median", "q3", "whisker_low", "whisker_high", "sample_size", "missing_count"].every((key) => Number.isFinite(Number(group[key]))));
  if (!complete) return null;
  const relationshipCue = ["分布", "中间50%", "中位数", "四分位", "离散", "波动", "异常值"].some((cue) => text.includes(cue));
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
  const relationshipCue = ["分布", "集中", "偏态", "长尾", "多峰", "区间", "distribution", "skew", "tail", "mode"].some((cue) => text.includes(cue));
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
  const relationshipCue = ["分布", "中位数", "四分位", "异常值", "离散", "个体观测", "每位", "样本量", "密度"].some((cue) => text.includes(cue));
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
  const cue = ["一起变化", "方向相反", "关系", "关联", "系数", "pearson", "spearman", "正相关", "负相关"].some((item) => text.includes(item));
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
  const relationshipCue = ["关系", "方向", "强度", "偏离", "离群", "关联", "一起变化", "外推"].some((cue) => text.includes(cue));
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
  const relationshipCue = ["中心估计", "上下界", "区间宽度", "不确定性", "阈值", "重抽样", "estimate", "lower", "upper", "interval"].some((cue) => text.includes(cue));
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
    .map((item) => inferredHistogram && item.moduleId === "histogram"
      ? { ...item, score: Math.max(item.score, 70), evidence: [...item.evidence, ...inferredHistogram] }
      : item)
    .map((item) => item.moduleId === "histogram" && !inferredHistogram && !item.evidence.some((evidence) => evidence.startsWith("explicit:"))
      ? { ...item, score: 0 }
      : item)
    .map((item) => inferredJitter && item.moduleId === "box-plot-jitter"
      ? { ...item, score: Math.max(item.score, 70), evidence: [...item.evidence, ...inferredJitter] }
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
