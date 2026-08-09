import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const builderRoot = fileURLToPath(new URL("../", import.meta.url));
const skillRoot = path.dirname(builderRoot);
const source = path.join(builderRoot, "assets/reference-pages/composition-shift.pptx");
const ganttSource = path.join(builderRoot, "assets/reference-pages/gantt-dependency.pptx");
const planScript = path.join(skillRoot, "editorial/scripts/plan_editorial_run.py");
const inspectScript = path.join(skillRoot, "editorial/scripts/inspect_editorial_slide.mjs");
const qaScript = path.join(skillRoot, "editorial/scripts/validate_editorial_qa.py");
const revisionScript = path.join(builderRoot, "scripts/apply_editorial_revision.mjs");
const verifyScript = path.join(skillRoot, "editorial/scripts/verify_editorial_roundtrip.py");
const contrastScript = path.join(skillRoot, "editorial/scripts/audit_editorial_contrast.py");

async function hash(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function writePassQa(file, pptx) {
  await fs.writeFile(file, JSON.stringify({
    version: 1,
    role: "EDITORIAL_QA",
    source_sha256: await hash(pptx),
    decision: "PASS_AS_IS",
    page_strengths: ["主图和标题形成清楚的单一叙事", "右侧洞察板块具有稳定的对齐和间距秩序"],
    confidence: "high",
    primary_issue: null,
    builder_brief: null,
  }, null, 2));
}

async function writeGanttQa(file) {
  await fs.writeFile(file, JSON.stringify({
    version: 1,
    role: "EDITORIAL_QA",
    source_sha256: await hash(ganttSource),
    decision: "BUILDER_LOCAL_REPAIR",
    page_strengths: ["甘特主图和关键路径侧栏分工明确", "三张侧栏卡片的几何、间距和对齐形成稳定秩序"],
    confidence: "high",
    primary_issue: {
      problem: "第三条长文本在固定卡片中明显拥挤",
      evidence: "第三条信息量显著高于同组前两条，但沿用同一大字号，行距和边距过紧",
      materiality: "妨碍快速读取最可能延期的三项任务",
      source_ids: ["gantt-metric-3"],
    },
    builder_brief: {
      mode: "local-repair",
      objective: "恢复第三条长文本的舒展阅读，同时保持侧栏卡片组秩序",
      rationale: "问题仅发生在第三条文字适配，不需要重排整页",
      protected_strengths: ["三张卡片的位置、尺寸、边框和间距", "前两条卡片的文字层级", "甘特主图和底部结论"],
      success_criteria: ["第三条文字不拥挤、不裁切", "三张卡片仍被识别为同一板块", "整页其他对象不发生变化"],
      forbidden_changes: ["移动或缩放卡片", "放大任何洞察卡", "改变事实、文字、来源或主图"],
    },
  }, null, 2));
}

test("Editorial QA planner accepts a one-slide PPTX without asking for style inputs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-plan-"));
  const result = spawnSync("python3", [planScript, "--input", source, "--output-dir", path.join(directory, "run")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).status, "EDITORIAL_READY");
});

test("Editorial QA validates a mature page as PASS_AS_IS with no Builder work", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-pass-"));
  const qa = path.join(directory, "qa.json");
  await writePassQa(qa, source);
  const result = spawnSync("python3", [qaScript, "--source", source, "--qa", qa], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).decision, "PASS_AS_IS");
});

test("Editorial QA emits one high-value Builder brief without execution parameters", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-brief-"));
  const qa = path.join(directory, "qa.json");
  await writeGanttQa(qa);
  const result = spawnSync("python3", [qaScript, "--source", ganttSource, "--qa", qa], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const unsafe = JSON.parse(await fs.readFile(qa, "utf8"));
  unsafe.builder_brief.target_pt = 13;
  await fs.writeFile(qa, JSON.stringify(unsafe));
  const rejected = spawnSync("python3", [qaScript, "--source", ganttSource, "--qa", qa], { encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout, /must not contain execution parameters/);
});

test("Editorial QA blocks source conflicts and low-confidence revision requests", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-conflict-"));
  const qa = path.join(directory, "qa.json");
  await writeGanttQa(qa);
  const record = JSON.parse(await fs.readFile(qa, "utf8"));
  record.source_sha256 = "0".repeat(64);
  record.confidence = "medium";
  await fs.writeFile(qa, JSON.stringify(record));
  const result = spawnSync("python3", [qaScript, "--source", ganttSource, "--qa", qa], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /source_sha256 does not match/);
  assert.match(result.stdout, /requires high confidence/);
});

test("Builder refuses to modify a page when Editorial QA says PASS_AS_IS", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-builder-refuse-"));
  const qa = path.join(directory, "qa.json");
  await writePassQa(qa, source);
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({ version: 1, source_sha256: await hash(source), editorial_qa_sha256: await hash(qa), execution_rationale: "不应执行", operations: [{ op: "font-size", target: "name/%E5%85%B3%E9%94%AE%E6%B4%9E%E5%AF%9F-title", expected_bbox: [994, 142, 214, 30], target_pt: 13, reason: "不应执行" }] }));
  const result = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", source, "--qa", qa, "--plan", plan, "--output", path.join(directory, "edited.pptx"), "--audit", path.join(directory, "audit.json")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not authorize BUILDER_LOCAL_REPAIR/);
});

test("Builder executes the Gantt repair from a hash-bound QA brief and plan", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-builder-gantt-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", ganttSource, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const metric = inventory.find((item) => item.name === "gantt-metric-3");
  assert.ok(metric);

  const qa = path.join(directory, "qa.json");
  await writeGanttQa(qa);
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({
    version: 1,
    source_sha256: await hash(ganttSource),
    editorial_qa_sha256: await hash(qa),
    execution_rationale: "Builder 选择只缩小第三条文字，保持侧栏卡片组的几何秩序",
    operations: [{ op: "font-size", target: "name/gantt-metric-3", expected_bbox: metric.bbox, target_pt: 13, intent: "fit-repair", reason: "修复长文本拥挤" }],
  }, null, 2));
  const output = path.join(directory, "edited.pptx");
  const audit = path.join(directory, "audit.json");
  const result = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", ganttSource, "--qa", qa, "--plan", plan, "--output", output, "--audit", audit], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(await fs.readFile(audit, "utf8"));
  assert.equal(record.role, "BUILDER_REVISION_EXECUTOR");
  assert.equal(record.operations[0].after_px < record.operations[0].before_px, true);

  const unzipped = spawnSync("unzip", ["-p", output, "ppt/slides/slide1.xml"], { encoding: "utf8" });
  assert.equal(unzipped.status, 0, unzipped.stderr || unzipped.stdout);
  const targetShape = unzipped.stdout.match(/<p:sp>.*?<p:cNvPr[^>]*name="gantt-metric-3".*?<\/p:sp>/s)?.[0];
  assert.ok(targetShape, "gantt-metric-3 must remain a native PowerPoint shape");
  assert.match(targetShape, /<a:defRPr[^>]*sz="1300"/);
  assert.match(targetShape, /<a:rPr[^>]*sz="1300"/);

  const candidate = path.join(directory, "candidate");
  const candidateInspect = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", output, "--output-dir", candidate], { encoding: "utf8" });
  assert.equal(candidateInspect.status, 0, candidateInspect.stderr || candidateInspect.stdout);
  const verification = spawnSync("python3", [verifyScript, "--workspace", skillRoot, "--source-pptx", ganttSource, "--candidate-pptx", output, "--source-inspect-manifest", path.join(baseline, "inspect-manifest.json"), "--candidate-inspect-manifest", path.join(candidate, "inspect-manifest.json"), "--audit", audit, "--output", path.join(directory, "verification.json")], { encoding: "utf8" });
  assert.equal(verification.status, 0, verification.stderr || verification.stdout);
});

test("Builder keeps sidebar geometry and data encodings protected", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-builder-protect-"));
  const baseline = path.join(directory, "baseline");
  spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", source, "--output-dir", baseline], { encoding: "utf8" });
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const insight = inventory.find((item) => item.name === "关键洞察-item-1");
  const qa = path.join(directory, "qa.json");
  const unsafeQa = {
    version: 1, role: "EDITORIAL_QA", source_sha256: await hash(source), decision: "BUILDER_LOCAL_REPAIR",
    page_strengths: ["主图清楚", "侧栏有序"], confidence: "high",
    primary_issue: { problem: "测试", evidence: "测试证据", materiality: "测试影响", source_ids: ["关键洞察-item-1"] },
    builder_brief: { mode: "local-repair", objective: "测试", rationale: "测试", protected_strengths: ["侧栏"], success_criteria: ["不破坏"], forbidden_changes: ["不移动"] },
  };
  await fs.writeFile(qa, JSON.stringify(unsafeQa));
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({ version: 1, source_sha256: await hash(source), editorial_qa_sha256: await hash(qa), execution_rationale: "危险测试", operations: [{ op: "move", target: `name/${encodeURIComponent(insight.name)}`, expected_bbox: insight.bbox, dx: -120, dy: 0, reason: "危险测试" }] }));
  const result = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", source, "--qa", qa, "--plan", plan, "--output", path.join(directory, "blocked.pptx"), "--audit", path.join(directory, "audit.json")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SIDEBAR_GEOMETRY_PROTECTED/);
});

test("contrast audit still checks every affected text run", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-contrast-"));
  const layout = path.join(directory, "layout.json");
  const audit = path.join(directory, "audit.json");
  const output = path.join(directory, "contrast.json");
  await fs.writeFile(layout, JSON.stringify({ elements: [{ order: 1, scope: "slide", name: "label", bbox: [10, 10, 200, 40], text: "风险任务", fillColor: "#FFFFFF", paragraphs: [{ text: "风险任务", runs: [{ text: "风险", color: "#E8872D", fontSize: 16 }, { text: "任务", color: "#172033", fontSize: 16 }] }] }] }));
  await fs.writeFile(audit, JSON.stringify({ operations: [{ op: "text-color", target: "name/label" }] }));
  const result = spawnSync("python3", [contrastScript, "--layout", layout, "--audit", audit, "--output", output], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(await fs.readFile(output, "utf8")).findings.length, 2);
});
