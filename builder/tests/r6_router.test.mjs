import test from "node:test";
import assert from "node:assert/strict";
import { routeInput } from "../scripts/route_input.mjs";

const blindCases = [
  ["causal-chain", { input_mode: "text", text: "门店排班准确率提升会减少临时调班，继而降低加班成本，最终改善利润率" }],
  ["issue-tree", { input_mode: "text", text: "把客户续约下降拆解为产品适配、交付体验和商务条件三个分支，每个分支下再列子议题" }],
  ["stage-process", { input_mode: "text", text: "按诊断、设计、试点、推广、固化五个步骤列出阶段流程、里程碑和阶段门" }],
  ["waterfall-attribution", { input_mode: "mixed", text: "从预算到实际逐项解释差额", data: { 起点: 8.2, 终点: 6.7, 增减: [-0.4, -0.7, -0.4], 对平: true } }],
  ["route-tradeoff", { input_mode: "text", text: "比较自建和外采两条路线，按成本、周期、适配风险和能力沉淀横向对比后给出取舍" }],
  ["scqa-roadmap", { input_mode: "text", text: "上半部依次写情境、冲突、问题和答案，下半部接三阶段落地路径" }],
  ["bubble-heatmap", { input_mode: "text", text: "把十二项举措放入价值和难度二维气泡矩阵，右侧用热力评分表列优先级" }],
  ["chart-insight", { input_mode: "text", text: "左侧柱状图叠加折线，右侧三张洞察卡通过引线锚定具体数据" }],
  ["scenario-planning", { input_mode: "data", data: { 悲观: {}, 基准: {}, 乐观: {}, 发生概率: [25, 55, 20], 领先指标: [], 无悔举措: [] } }],
  ["marimekko", { input_mode: "text", text: "五个客户细分的横向宽度按市场规模占比，每个细分内部再按我方、对手和其他的份额构成" }],
  ["tornado-sensitivity", { input_mode: "mixed", text: "八个参数分别取低值和高值", data: { 基准情形: 100, 变量: [], 单变量: true } }],
  ["radar-capability", { input_mode: "text", text: "九个能力维度比较当前水平、行业中位和十二个月目标，并按成熟度分组" }],
  ["dumbbell-gap", { input_mode: "text", text: "十项指标分别列现状、目标和标杆，按差距绝对值排序并标明改善难度" }],
  ["bump-ranking", { input_mode: "text", text: "比较两个时点的前十榜单排名，标出上升、下降、新进入与退出" }],
  ["composition-shift", { input_mode: "text", text: "比较2022到2025年四类收入占比的结构变化，每期合计100%" }],
  ["cohort-retention", { input_mode: "text", text: "按首次激活月份分批，从第0周起比较第1、2、4、8周仍活跃的人数；较新批次后面的周数尚未观察，空白不能当0" }],
  ["box-plot", { input_mode: "text", text: "比较五个区域订单周期的中位数、中间50%范围、离散程度和异常值" }],
  ["histogram", { input_mode: "mixed", text: "查看一批连续测量值集中在哪些区间，是否偏斜并有长尾", data: { metric: "处理时长", unit: "分钟", period: "2026年7月", values: [4, 7, 11, 14, 18, 22, 25, 29, 33, 39, 45, 58, 72] } }],
  ["box-plot-jitter", { input_mode: "text", text: "比较四个班组每位员工的处理时长分布，同时标出中位数、四分位、样本量和异常值" }],
  ["scatter-regression", { input_mode: "text", text: "判断两个连续指标的关系方向和关系强度，找出偏离趋势的离群记录，并说明样本内关联的可解释范围" }],
  ["small-multiples", { input_mode: "text", text: "九条业务线放进3×3矩阵，每格重复同一迷你折线并统一刻度和公司基准" }],
  ["sankey-flow", { input_mode: "text", text: "展示获客渠道到筛选再到成交和续约的四层分流，流带宽度按人数，损耗流向下方" }],
  ["chord-dependency", { input_mode: "data", data: { 圆周: ["销售", "产品", "交付", "财务", "人力"], 双向依赖: [], 交互强度: [] } }],
  ["gantt-dependency", { input_mode: "text", text: "18个月项目计划，任务按四条泳道排列，标出完成开始依赖、里程碑和关键路径" }],
  ["market-funnel", { input_mode: "text", text: "从 TAM 到 SAM、SOM 再到三年目标逐层收敛，右侧用客户数、渗透率和客单价推导收入" }],
  ["region-map-table", { input_mode: "text", text: "左侧按城市和区域在地图上放气泡，右侧明细表比较人数、成本和产出" }],
  ["industry-value-chain", { input_mode: "text", text: "按上游、中游、下游展开产业价值链，比较各参与者覆盖环节和利润率" }],
  ["spiral-maturity", { input_mode: "text", text: "用四圈多轮迭代表达设计、执行、度量、沉淀四项动作在成熟度上逐级升级" }],
  ["hr-age-gender-pyramid", { input_mode: "mixed", text: "检查人员结构", data: { 年龄段: [], 男性: [], 女性: [], 人数: [] } }],
  ["hr-workforce-reconciliation", { input_mode: "data", data: { 期初: 820, 入职: 20, 离职: 14, 转出: 2, 转入: 1, 期末: 825 } }],
  ["hr-new-hire-survival", { input_mode: "text", text: "四个招聘渠道按入职后0到24个月绘制新人留存率，比较不同批次的存活拐点" }],
  ["hr-supply-demand-gap", { input_mode: "data", data: { 需求预测: [], 内部供给: [], 自然流失: [], 退休: [], 外部补充: [] } }],
  ["hr-level-function-matrix", { input_mode: "text", text: "用职级和职能序列做双维格子，检查管理跨度、人数倒挂和层级断层" }],
  ["hr-from-to-mobility", { input_mode: "mixed", text: "内部人才市场", data: { 流出部门: [], 流入部门: [], 转岗率: 0.08, 留任人数: [] } }],
  ["hr-eligibility-matrix", { input_mode: "text", text: "按资格条件和覆盖人群核对政策是否适用及例外情形，形成资格覆盖矩阵" }],
  ["hr-service-catalog", { input_mode: "text", text: "整理人力资源服务目录，逐项列服务层级、渠道、时效承诺和自动化覆盖" }],
  ["hr-ticket-intake", { input_mode: "text", text: "比较电话、邮件和机器人等受理渠道的工单量、一次解决率与积压" }],
  ["hr-ticket-classification", { input_mode: "text", text: "按薪酬、招聘、员工关系等工单分类统计重分类率、优先级和服务水平" }],
];

test("unfamiliar text, data and mixed inputs route across every module category", async () => {
  for (const [expected, input] of blindCases) {
    const result = await routeInput(input);
    assert.equal(result.decision, "selected", JSON.stringify({ expected, result }));
    assert.equal(result.module.module_id, expected, JSON.stringify({ expected, result }));
  }
});

test("explicit visual choice wins without fabricating missing data", async () => {
  const result = await routeInput({ text: "请做一页 Marimekko，数据随后补齐" });
  assert.equal(result.module.module_id, "marimekko");
  assert.equal(result.confidence, "explicit_visual");
});

test("RC1 blind-test misses remain fixed as exact natural-language regressions", async () => {
  const cases = [
    ["waterfall-attribution", "从预算利润到实际利润逐项解释价格、销量、组合、人工、原料和其他因素，必须对平。"],
    ["tornado-sensitivity", "八个参数分别取低值和高值，一次只变一个变量，比较相对基准结果的偏离。"],
    ["hr-from-to-mobility", "用部门 From-To 方阵核对内部转岗、留任和转岗后质量。"],
  ];
  for (const [expected, source] of cases) {
    const result = await routeInput({ input_mode: "text", text: source });
    assert.equal(result.decision, "selected", JSON.stringify({ expected, result }));
    assert.equal(result.module.module_id, expected, JSON.stringify({ expected, result }));
  }
});

test("genuine visual ambiguity returns at most two candidates", async () => {
  const result = await routeInput({ text: "这组材料可以考虑雷达图或哑铃图" });
  assert.equal(result.decision, "needs_structure_choice");
  assert.equal(result.code, "ROUTE_AMBIGUITY_REVIEW");
  assert.equal(result.candidates.length, 2);
});

test("missing source and unknown structure stop instead of guessing", async () => {
  await assert.rejects(() => routeInput({}), (error) => error.code === "SOURCE_BASELINE_FAIL");
  await assert.rejects(() => routeInput({ text: "请帮我做得高级一点" }), (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT");
});
