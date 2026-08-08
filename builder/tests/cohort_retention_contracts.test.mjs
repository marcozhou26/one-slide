import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCohortRetention, loadCohortRetentionInput } from "../scripts/validate_cohort_retention.mjs";
import { planCohortRetention } from "../scripts/plan_cohort_retention.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));

test("complete cohort counts validate, normalize and plan one 16:9 page", async () => {
  const data = await fixture("cohort-retention-valid.json");
  const result = validateCohortRetention(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unmappedSourceIds, []);
  assert.equal(result.normalized.diagram.cohorts[0].retention_rates[1], 85);
  const plan = planCohortRetention(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.ok(plan.chart.width > plan.rail.width);
});

test("sparse rates-only input derives counts without requiring style fields", async () => {
  const data = await fixture("cohort-retention-valid.json");
  delete data.style;
  data.diagram.cohorts.forEach((cohort) => {
    cohort.retention_rates = cohort.retained_counts.map((count) => count === null ? null : Number((count / cohort.initial_count * 100).toFixed(2)));
    delete cohort.retained_counts;
  });
  const normalized = validateCohortRetention(data).normalized;
  assert.equal(normalized.diagram.cohorts[1].retained_counts[1], 147);
});

test("missing initial base is a real blocking input", async () => {
  const data = await fixture("cohort-retention-missing-base.json");
  assert.throws(() => validateCohortRetention(data), (error) => error.code === "DATA_CONTRACT_FAIL");
});

test("a value after an unobserved period is blocked instead of treated as zero", async () => {
  const data = await fixture("cohort-retention-null-gap.json");
  assert.throws(() => validateCohortRetention(data), (error) => error.code === "CENSORING_CONTRACT_FAIL");
});

test("conflicting counts and rates are blocked", async () => {
  const data = await fixture("cohort-retention-conflict.json");
  assert.throws(() => validateCohortRetention(data), (error) => error.code === "COHORT_RECONCILIATION_FAIL");
});

test("survival cannot rise while period retention may contain a real rebound", async () => {
  const data = await fixture("cohort-retention-valid.json");
  data.diagram.cohorts[0].retained_counts[2] = 175;
  assert.throws(() => validateCohortRetention(data), (error) => error.code === "SURVIVAL_CURVE_FAIL");
  data.diagram.curve_mode = "period_retention";
  assert.equal(validateCohortRetention(data).ok, true);
});

test("representative natural language routes without naming a module or visual", async () => {
  const text = "我们按客户首次激活月份分了五批，从第0周起记录第1、2、4、8和12周仍活跃的人数。请比较各批的早期流失、差异和异常拐点；较新的批次还没走到后面的周数，不能把空白算成0。";
  assert.doesNotMatch(text, /cohort|retention|曲线|折线|图表|模块/i);
  const result = await routeInput({ input_mode: "text", text });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "cohort-retention");
});

test("structured cohort arrays infer the module without visual hints", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "请比较各加入批次在相对周数上的早期流失和长期差异，后续尚未观察的周期保留为空。",
    data: {
      relative_periods: [0, 1, 2, 4, 8, 12],
      cohorts: [
        { label: "1月", initial_count: 100, retained_counts: [100, 84, 76, 68, 60, 55] },
        { label: "2月", initial_count: 90, retained_counts: [90, 72, 64, 55, 48, null] },
        { label: "3月", initial_count: 110, retained_counts: [110, 91, 82, 74, null, null] }
      ]
    }
  });
  assert.equal(result.module.module_id, "cohort-retention");
  assert.match(result.evidence.join(" "), /aligned_relative_periods/);
});

test("executable Producer handoff keeps the three module fields aligned", async () => {
  const data = await fixture("cohort-retention-valid.json");
  const result = await routeV3({ subject: "分群比较", story: data.title.text, source_ids: ["S01"], requested_module: "cohort-retention", structure: { primary_exhibit: "cohort-retention" }, module_payload: data });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_input, "module_payload");
});

test("malformed JSON is rejected as an abnormal file format", async () => {
  await assert.rejects(() => loadCohortRetentionInput(path.join(skillRoot, "assets/test-fixtures/cohort-retention-invalid-format.json")), SyntaxError);
});
