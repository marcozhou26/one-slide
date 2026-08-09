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
const ganttTaskNames = Array.from({ length: 10 }, (_, index) => `task-t${index + 1}`);
const ganttMetricNames = ["gantt-metric-1", "gantt-metric-2", "gantt-metric-3"];

function ganttDiagnosticBasis() {
  return {
    visual_groups: [
      {
        group_id: "gantt-progress-bars",
        source_ids: ganttTaskNames,
        semantic_role: "进度条中的进度与负责人",
        uniform_properties: ["font-size", "alignment", "text-insets"],
        content_fit: "多个短条出现越界或异常换行",
        container_semantics: "宽度编码任务持续时间，不可为文字任意扩张",
      },
      {
        group_id: "gantt-key-path-cards",
        source_ids: ganttMetricNames,
        semantic_role: "同级关键路径摘要",
        uniform_properties: ["font-size", "font-weight hierarchy"],
        content_fit: "第三张卡片文字更长",
        container_semantics: "普通信息容器可以按内容扩容",
      },
    ],
  };
}

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
    diagnostic_basis: { visual_groups: [] },
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
    diagnostic_basis: ganttDiagnosticBasis(),
    confidence: "high",
    primary_issue: {
      group_id: "gantt-progress-bars",
      problem: "多个短进度条中的进度与负责人越界或异常换行",
      evidence: "业务蓝图、平台选型和试点培训等短条无法在条内稳定容纳同一角色文字",
      materiality: "主图的重复性缺陷覆盖多个任务，妨碍沿时间轴快速读取",
      source_ids: ganttTaskNames,
    },
    builder_brief: {
      mode: "local-repair",
      objective: "让所有进度条的进度与负责人在条内清楚、稳定地呈现",
      rationale: "问题发生在同一重复组，应整组处理而不是只修最短的一条",
      protected_strengths: ["每个进度条宽度所编码的任务持续时间", "全组统一的字体、对齐和边距", "甘特主图、侧栏和底部结论"],
      success_criteria: ["所有短条文字均不越界、不裁切、不异常换行", "全部进度条使用同一字号与组内边距", "进度条长度和位置不变"],
      forbidden_changes: ["只缩小个别进度条文字", "扩大进度条宽度破坏时间编码", "改变事实、文字、来源或主图"],
    },
  }, null, 2));
}

async function writeGanttCardQa(file) {
  await fs.writeFile(file, JSON.stringify({
    version: 1,
    role: "EDITORIAL_QA",
    source_sha256: await hash(ganttSource),
    decision: "BUILDER_LOCAL_REPAIR",
    page_strengths: ["甘特主图和关键路径侧栏分工明确", "三张侧栏卡片使用统一的文字层级"],
    diagnostic_basis: ganttDiagnosticBasis(),
    confidence: "high",
    primary_issue: {
      group_id: "gantt-key-path-cards",
      problem: "第三张同级卡片的内容空间不足",
      evidence: "第三张文字明显多于前两张，固定等高容器造成拥挤",
      materiality: "最可能延期的三项任务无法舒展读取",
      source_ids: ganttMetricNames,
    },
    builder_brief: {
      mode: "local-repair",
      objective: "保持三张卡片字体层级一致，通过内容驱动容器解决第三张拥挤",
      rationale: "同级关系由统一字体层级表达，不由机械等高表达",
      protected_strengths: ["三张卡片的统一字号", "侧栏宽度、颜色和对齐", "甘特主图和底部结论"],
      success_criteria: ["第三张文字不拥挤", "三张卡片字号完全一致", "第三张容器扩容后不与其他对象碰撞"],
      forbidden_changes: ["只缩小第三张卡片字号", "改变卡片文字", "覆盖侧栏其他对象"],
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

test("Builder repairs the complete Gantt progress-bar group with uniform typography", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-builder-gantt-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", ganttSource, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const tasks = ganttTaskNames.map((name) => inventory.find((item) => item.name === name));
  assert.equal(tasks.every(Boolean), true);

  const qa = path.join(directory, "qa.json");
  await writeGanttQa(qa);
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({
    version: 1,
    source_sha256: await hash(ganttSource),
    editorial_qa_sha256: await hash(qa),
    execution_rationale: "Builder 将进度条识别为同一语义组，统一字号和组内边距，同时保持时间编码几何",
    group_contracts: [{ group_id: "gantt-progress-bars", members: ganttTaskNames, policy: "uniform-typography" }],
    operations: [
      ...tasks.map((item) => ({ op: "font-size", target: `name/${item.name}`, expected_bbox: item.bbox, target_pt: 10, group_id: "gantt-progress-bars", intent: "fit-repair", reason: "整组统一修复短进度条文字适配" })),
      ...tasks.map((item) => ({ op: "text-insets", target: `name/${item.name}`, expected_bbox: item.bbox, insets: { left: 2, right: 2, top: 0, bottom: 0 }, group_id: "gantt-progress-bars", intent: "fit-repair", reason: "整组统一收紧文字边距" })),
    ],
  }, null, 2));
  const output = path.join(directory, "edited.pptx");
  const audit = path.join(directory, "audit.json");
  const result = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", ganttSource, "--qa", qa, "--plan", plan, "--output", output, "--audit", audit], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(await fs.readFile(audit, "utf8"));
  assert.equal(record.role, "BUILDER_REVISION_EXECUTOR");
  assert.equal(record.operations.filter((item) => item.op === "font-size").length, ganttTaskNames.length);
  assert.equal(new Set(record.operations.filter((item) => item.op === "font-size").map((item) => item.after_px)).size, 1);

  const unzipped = spawnSync("unzip", ["-p", output, "ppt/slides/slide1.xml"], { encoding: "utf8" });
  assert.equal(unzipped.status, 0, unzipped.stderr || unzipped.stdout);
  for (const name of ganttTaskNames) {
    const targetShape = unzipped.stdout.match(new RegExp(`<p:sp>.*?<p:cNvPr[^>]*name="${name}".*?<\\/p:sp>`, "s"))?.[0];
    assert.ok(targetShape, `${name} must remain a native PowerPoint shape`);
    assert.match(targetShape, /<a:defRPr[^>]*sz="1000"/);
    assert.match(targetShape, /<a:rPr[^>]*sz="1000"/);
  }

  const candidate = path.join(directory, "candidate");
  const candidateInspect = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", output, "--output-dir", candidate], { encoding: "utf8" });
  assert.equal(candidateInspect.status, 0, candidateInspect.stderr || candidateInspect.stdout);
  const verification = spawnSync("python3", [verifyScript, "--workspace", skillRoot, "--source-pptx", ganttSource, "--candidate-pptx", output, "--source-inspect-manifest", path.join(baseline, "inspect-manifest.json"), "--candidate-inspect-manifest", path.join(candidate, "inspect-manifest.json"), "--audit", audit, "--output", path.join(directory, "verification.json")], { encoding: "utf8" });
  assert.equal(verification.status, 0, verification.stderr || verification.stdout);
});

test("Builder preserves peer-card typography and expands the long card container", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-builder-gantt-card-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", ganttSource, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const metric = inventory.find((item) => item.name === "gantt-metric-3");
  assert.ok(metric);
  const qa = path.join(directory, "qa.json");
  await writeGanttCardQa(qa);
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({
    version: 1,
    source_sha256: await hash(ganttSource),
    editorial_qa_sha256: await hash(qa),
    execution_rationale: "Builder 保持同级字号，扩大第三张普通信息容器",
    group_contracts: [{ group_id: "gantt-key-path-cards", members: ganttMetricNames, policy: "content-driven-containers" }],
    operations: [{ op: "resize", target: "name/gantt-metric-3", expected_bbox: metric.bbox, dw: 0, dh: 34, group_id: "gantt-key-path-cards", intent: "fit-repair", reason: "通过内容驱动扩容解决长文本拥挤" }],
  }, null, 2));
  const output = path.join(directory, "edited.pptx");
  const audit = path.join(directory, "audit.json");
  const result = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", ganttSource, "--qa", qa, "--plan", plan, "--output", output, "--audit", audit], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const unzipped = spawnSync("unzip", ["-p", output, "ppt/slides/slide1.xml"], { encoding: "utf8" });
  const targetShape = unzipped.stdout.match(/<p:sp>.*?<p:cNvPr[^>]*name="gantt-metric-3".*?<\/p:sp>/s)?.[0];
  assert.ok(targetShape);
  assert.match(targetShape, /<a:defRPr[^>]*sz="1600"/);
  assert.match(targetShape, /<a:rPr[^>]*sz="1600"/);
  const candidate = path.join(directory, "candidate");
  const candidateInspect = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", output, "--output-dir", candidate], { encoding: "utf8" });
  assert.equal(candidateInspect.status, 0, candidateInspect.stderr || candidateInspect.stdout);
  const afterInventory = (await fs.readFile(path.join(candidate, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(afterInventory.find((item) => item.name === "gantt-metric-3").bbox[3] > metric.bbox[3], true);

  const rejectedPlan = path.join(directory, "rejected-plan.json");
  await fs.writeFile(rejectedPlan, JSON.stringify({
    version: 1,
    source_sha256: await hash(ganttSource),
    editorial_qa_sha256: await hash(qa),
    execution_rationale: "错误地只缩小第三张同级卡片",
    group_contracts: [{ group_id: "gantt-key-path-cards", members: ganttMetricNames, policy: "content-driven-containers" }],
    operations: [{ op: "font-size", target: "name/gantt-metric-3", expected_bbox: metric.bbox, target_pt: 13, group_id: "gantt-key-path-cards", intent: "fit-repair", reason: "错误示例" }],
  }));
  const rejected = spawnSync("node", [revisionScript, "--workspace", skillRoot, "--input", ganttSource, "--qa", qa, "--plan", rejectedPlan, "--output", path.join(directory, "rejected.pptx"), "--audit", path.join(directory, "rejected-audit.json")], { encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /expand the content container before changing peer typography/);
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
    diagnostic_basis: { visual_groups: [] },
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
