import test from "node:test";
import assert from "node:assert/strict";
import { routeInput } from "../scripts/route_input.mjs";

const blindCases = [
  ["causal-chain", { input_mode: "text", text: "Improved store scheduling accuracy will reduce temporary shifts, thereby reducing overtime costs and ultimately improving profit margins" }],
  ["issue-tree", { input_mode: "text", text: "Divide the decline in customer renewal into three branches: product adaptation, delivery experience and business conditions, and list sub-topics under each branch." }],
  ["stage-process", { input_mode: "text", text: "List the stage process, milestones and stage gates according to the five steps of diagnosis, design, pilot, promotion and solidification" }],
  ["waterfall-attribution", { input_mode: "mixed", text: "Explain the differences item by item from budget to actual", data: { "starting point": 8.2, "end point": 6.7, "increase or decrease": [-0.4, -0.7, -0.4], even: true } }],
  ["route-tradeoff", { input_mode: "text", text: "Compare the two routes of self-construction and outsourced procurement, and make a choice based on cost, cycle, adaptation risk and capacity accumulation." }],
  ["scqa-roadmap", { input_mode: "text", text: "The first half writes about situations, conflicts, questions and answers in sequence, and the second half follows the three-stage implementation path." }],
  ["bubble-heatmap", { input_mode: "text", text: "Put the twelve initiatives into a two-dimensional bubble matrix of value and difficulty, and use a heat score table to prioritize them on the right" }],
  ["chart-insight", { input_mode: "text", text: "The bar chart on the left is overlaid with a line, and three insight cards on the right connect to specific data points with leader lines." }],
  ["scenario-planning", { input_mode: "data", data: { pessimistic: {}, benchmark: {}, optimistic: {}, "probability of occurrence": [25, 55, 20], "leading indicators": [], "no-regrets moves": [] } }],
  ["marimekko", { input_mode: "text", text: "The horizontal breadth of the five customer segments is based on market size, and each segment is divided into shares among ourselves, competitors and others." }],
  ["tornado-sensitivity", { input_mode: "mixed", text: "The eight parameters take low and high values respectively.", data: { "Base case": 100, variable: [], Univariate: true } }],
  ["radar-capability", { input_mode: "text", text: "Nine capability dimensions compare current levels, industry medians and twelve-month targets, grouped by maturity" }],
  ["dumbbell-gap", { input_mode: "text", text: "The ten indicators list the current status, goals and benchmarks respectively, sort by the absolute value of the gap and indicate the difficulty of improvement." }],
  ["bump-ranking", { input_mode: "text", text: "Compare the top ten list rankings at two points in time, marking increases, decreases, new entries and exits" }],
  ["composition-shift", { input_mode: "text", text: "compare2022Arrive2025Structural changes in the proportion of the four types of income in the year, total for each period100%" }],
  ["cohort-retention", { input_mode: "text", text: "In batches according to the month of first activation, starting from the0Weekly comparison1, 2, 4, 8The number of people who are still active in each week; the number of weeks after the newer batch has not been observed yet, so blanks cannot be used as0" }],
  ["box-plot", { input_mode: "text", text: "Compare the median and middle order cycles of the five regions50%Range, dispersion, and outliers" }],
  ["histogram", { input_mode: "mixed", text: "Check which intervals a batch of continuous measurement values are concentrated in, and whether they are skewed and have long tails", data: { metric: "Processing time", unit: "minutes", period: "2026year7month", values: [4, 7, 11, 14, 18, 22, 25, 29, 33, 39, 45, 58, 72] } }],
  ["box-plot-jitter", { input_mode: "text", text: "Compare the distribution of processing time per employee across four work groups, with medians, quartiles, sample sizes, and outliers plotted" }],
  ["scatter-regression", { input_mode: "text", text: "Determine the direction and strength of the relationship between two continuous indicators, find outlier records that deviate from the trend, and explain the interpretable range of the association within the sample" }],
  ["small-multiples", { input_mode: "text", text: "Nine business lines are put into3×3Matrix, each cell repeats the same mini-polyline and unifies the scale and company benchmarks" }],
  ["sankey-flow", { input_mode: "text", text: "Shows the four-layer diversion from customer acquisition channels to screening to transaction and contract renewal. The width of the flow belt is based on the number of people, and the loss flows downward." }],
  ["chord-dependency", { input_mode: "data", data: { circumference: ["sales", "Products", "Delivery", "Finance", "manpower"], "Two-way dependency": [], "interaction strength": [] } }],
  ["gantt-dependency", { input_mode: "text", text: "18Monthly project plan, with tasks arranged in four swim lanes, marking completion and start dependencies, milestones and critical paths" }],
  ["market-funnel", { input_mode: "text", text: "from TAM Arrive SAM, SOM Then the three-year target is converged layer by layer. On the right side, the number of customers, penetration rate and unit price are used to derive revenue." }],
  ["region-map-table", { input_mode: "text", text: "On the left, bubbles are placed on the map by city and region, and on the right, the detailed table compares the number of people, costs and output." }],
  ["industry-value-chain", { input_mode: "text", text: "Expand the industrial value chain by upstream, midstream, and downstream, and compare the coverage and profit margins of each participant" }],
  ["spiral-maturity", { input_mode: "text", text: "Use four circles and multiple rounds of iteration to express the four actions of design, execution, measurement, and precipitation to gradually upgrade in maturity." }],
  ["hr-age-gender-pyramid", { input_mode: "mixed", text: "Inspect the workforce structure", data: { "age group": [], male: [], women: [], "Number of people": [] } }],
  ["hr-workforce-reconciliation", { input_mode: "data", data: { "Beginning of period": 820, Onboarding: 20, Resign: 14, "transfer out": 2, "transfer in": 1, "End of term": 825 } }],
  ["hr-new-hire-survival", { input_mode: "text", text: "Four recruitment channels according to post-employment0Arrive24Plot the retention rate of newcomers every month and compare the survival inflection points of different batches" }],
  ["hr-supply-demand-gap", { input_mode: "data", data: { "demand forecast": [], "internal supply": [], "natural loss": [], retire: [], "external supplement": [] } }],
  ["hr-level-function-matrix", { input_mode: "text", text: "Use ranks and functional sequences to make a two-dimensional grid to check management span, headcount inversion and hierarchical faults" }],
  ["hr-from-to-mobility", { input_mode: "mixed", text: "internal talent market", data: { "outflow department": [], "Inflow sector": [], "Job transfer rate": 0.08, "Number of people retained": [] } }],
  ["hr-eligibility-matrix", { input_mode: "text", text: "Check the applicability and exceptions of the policy according to the qualification conditions and covered groups to form a qualification coverage matrix" }],
  ["hr-service-catalog", { input_mode: "text", text: "Organize the human resources service catalog and list service levels, channels, timeliness commitments and automated coverage item by item." }],
  ["hr-ticket-intake", { input_mode: "text", text: "Compare ticket volume, first-time resolution rate and backlog of acceptance channels such as phone, email and robots" }],
  ["hr-ticket-classification", { input_mode: "text", text: "Statistics on reclassification rate, priority and service level by work order classification such as salary, recruitment, employee relations, etc." }],
];

test("unfamiliar text, data and mixed inputs route across every module category", async () => {
  for (const [expected, input] of blindCases) {
    let result;
    try {
      result = await routeInput(input);
    } catch (error) {
      assert.fail(JSON.stringify({ expected, input, code: error.code, message: error.message }));
    }
    assert.equal(result.decision, "selected", JSON.stringify({ expected, result }));
    assert.equal(result.module.module_id, expected, JSON.stringify({ expected, result }));
  }
});

test("explicit visual choice wins without fabricating missing data", async () => {
  const result = await routeInput({ text: "Please make one page Marimekko, the data is then completed" });
  assert.equal(result.module.module_id, "marimekko");
  assert.equal(result.confidence, "explicit_visual");
});

test("RC1 blind-test misses remain fixed as exact natural-language regressions", async () => {
  const cases = [
    ["waterfall-attribution", "Price, sales volume, mix, labor, raw materials and other factors are explained item by item from budgeted profit to actual profit and must be balanced."],
    ["tornado-sensitivity", "The eight parameters take low and high values respectively, changing only one variable at a time, and comparing the deviation from the baseline results."],
    ["hr-from-to-mobility", "Use department From-To The phalanx checks internal transfers, retention and post-transfer quality."],
  ];
  for (const [expected, source] of cases) {
    let result;
    try {
      result = await routeInput({ input_mode: "text", text: source });
    } catch (error) {
      assert.fail(JSON.stringify({ expected, source, code: error.code, message: error.message }));
    }
    assert.equal(result.decision, "selected", JSON.stringify({ expected, result }));
    assert.equal(result.module.module_id, expected, JSON.stringify({ expected, result }));
  }
});

test("genuine visual ambiguity returns at most two candidates", async () => {
  const result = await routeInput({ text: "This set of materials can consider radar charts or dumbbell charts" });
  assert.equal(result.decision, "needs_structure_choice");
  assert.equal(result.code, "ROUTE_AMBIGUITY_REVIEW");
  assert.equal(result.candidates.length, 2);
});

test("missing source and unknown structure stop instead of guessing", async () => {
  await assert.rejects(() => routeInput({}), (error) => error.code === "SOURCE_BASELINE_FAIL");
  await assert.rejects(() => routeInput({ text: "Please help me make it more advanced" }), (error) => error.code === "ROUTE_EVIDENCE_INSUFFICIENT");
});
