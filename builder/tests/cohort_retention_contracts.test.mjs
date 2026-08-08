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
  const text = "We divided the customers into five batches according to the first activation month, starting from the0Record number from week1, 2, 4, 8and12The number of people who are still active during the week. Please compare the early churn, differences and abnormal turning points of each batch; newer batches have not reached the later weeks and cannot count blanks as0.";
  assert.doesNotMatch(text, /cohort|retention|Curve|Polyline|chart|module/i);
  const result = await routeInput({ input_mode: "text", text });
  assert.equal(result.decision, "selected");
  assert.equal(result.module.module_id, "cohort-retention");
});

test("structured cohort arrays infer the module without visual hints", async () => {
  const result = await routeInput({
    input_mode: "mixed",
    text: "Please compare the early churn and long-term differences in relative weeks for each joining batch. Subsequent unobserved periods are left empty.",
    data: {
      relative_periods: [0, 1, 2, 4, 8, 12],
      cohorts: [
        { label: "1month", initial_count: 100, retained_counts: [100, 84, 76, 68, 60, 55] },
        { label: "2month", initial_count: 90, retained_counts: [90, 72, 64, 55, 48, null] },
        { label: "3month", initial_count: 110, retained_counts: [110, 91, 82, 74, null, null] }
      ]
    }
  });
  assert.equal(result.module.module_id, "cohort-retention");
  assert.match(result.evidence.join(" "), /aligned_relative_periods/);
});

test("executable Producer handoff keeps the three module fields aligned", async () => {
  const data = await fixture("cohort-retention-valid.json");
  const result = await routeV3({ subject: "Group comparison", story: data.title.text, source_ids: ["S01"], requested_module: "cohort-retention", structure: { primary_exhibit: "cohort-retention" }, module_payload: data });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_input, "module_payload");
});

test("malformed JSON is rejected as an abnormal file format", async () => {
  await assert.rejects(() => loadCohortRetentionInput(path.join(skillRoot, "assets/test-fixtures/cohort-retention-invalid-format.json")), SyntaxError);
});
