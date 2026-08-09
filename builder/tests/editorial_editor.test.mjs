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
const confidenceSource = path.join(builderRoot, "assets/reference-pages/confidence-band.pptx");
const planScript = path.join(skillRoot, "editorial/scripts/plan_editorial_run.py");
const inspectScript = path.join(skillRoot, "editorial/scripts/inspect_editorial_slide.mjs");
const patchScript = path.join(skillRoot, "editorial/scripts/apply_editorial_patch.mjs");
const verifyScript = path.join(skillRoot, "editorial/scripts/verify_editorial_roundtrip.py");
const contrastScript = path.join(skillRoot, "editorial/scripts/audit_editorial_contrast.py");

async function hash(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

test("editorial planner accepts a one-slide PPTX without asking for style inputs", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-plan-"));
  const result = spawnSync("python3", [planScript, "--input", source, "--output-dir", path.join(directory, "run")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, "EDITORIAL_READY");
  assert.equal(plan.qa_mode, "targeted");
  assert.equal(plan.qa_mode_basis, "complexity_derived");
  assert.equal(plan.handoff_basis, "derive_from_slide_if_unambiguous_and_record_in_diagnosis");
});

test("editorial input contract blocks missing, conflicting and abnormal critical files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-input-"));
  const missing = spawnSync("python3", [planScript, "--input", path.join(directory, "missing.pptx"), "--output-dir", path.join(directory, "missing-run")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.equal(JSON.parse(missing.stdout).status, "SOURCE_REQUIRED");

  const corrupt = path.join(directory, "corrupt.pptx");
  await fs.writeFile(corrupt, "not a PowerPoint package");
  const abnormal = spawnSync("python3", [planScript, "--input", corrupt, "--output-dir", path.join(directory, "corrupt-run")], { encoding: "utf8" });
  assert.equal(abnormal.status, 4);
  assert.equal(JSON.parse(abnormal.stdout).status, "SOURCE_INVALID");

  const conflict = spawnSync("python3", [planScript, "--input", source, "--output-dir", path.join(directory, "conflict-run"), "--handoff", path.join(directory, "missing-handoff.json")], { encoding: "utf8" });
  assert.equal(conflict.status, 9);
  assert.equal(JSON.parse(conflict.stdout).status, "SOURCE_VERSION_CONFLICT");

  const mismatchedHandoff = path.join(directory, "mismatched-handoff.json");
  await fs.writeFile(mismatchedHandoff, JSON.stringify({
    source_pptx_sha256: "0".repeat(64), central_message: "结论", primary_relationship: "变化",
    protected_content: ["数字"], source_ids: ["source-1"],
  }));
  const mismatch = spawnSync("python3", [planScript, "--input", source, "--output-dir", path.join(directory, "mismatch-run"), "--handoff", mismatchedHandoff], { encoding: "utf8" });
  assert.equal(mismatch.status, 9);
  assert.equal(JSON.parse(mismatch.stdout).status, "SOURCE_VERSION_CONFLICT");
});

test("editorial patch performs a source-locked grouped native edit", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-patch-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", source, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const title = inventory.find((item) => item.name === "关键洞察-title");
  assert.ok(title);
  const patchPath = path.join(directory, "patch.json");
  await fs.writeFile(patchPath, JSON.stringify({
    version: 1,
    source_sha256: await hash(source),
    primary_issue: "侧栏层级过重",
    edit_hypothesis: "弱化侧栏背景并微调标题可提高主图权重",
    operations: [
      { op: "text-color", target: "name/%E5%85%B3%E9%94%AE%E6%B4%9E%E5%AF%9F-title", expected_bbox: title.bbox, color: "#2F6FB2", reason: "用文字色弱化辅助标题而不改容器" },
      { op: "font-weight", target: "name/%E5%85%B3%E9%94%AE%E6%B4%9E%E5%AF%9F-title", expected_bbox: title.bbox, weight: "normal", reason: "降低辅助标题与主证据的竞争" },
      { op: "move", target: "name/%E5%85%B3%E9%94%AE%E6%B4%9E%E5%AF%9F-title", expected_bbox: title.bbox, dx: 0, dy: 4, reason: "与侧栏首项建立更稳定间距" },
    ],
  }, null, 2));
  const output = path.join(directory, "edited.pptx");
  const audit = path.join(directory, "audit.json");
  const result = spawnSync("node", [patchScript, "--workspace", skillRoot, "--input", source, "--patch", patchPath, "--output", output, "--audit", audit], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const record = JSON.parse(await fs.readFile(audit, "utf8"));
  assert.equal(record.operations.length, 3);
  assert.notEqual(record.source_sha256, record.output_sha256);
  assert.equal((await fs.stat(output)).size > 0, true);
  const candidate = path.join(directory, "candidate");
  const candidateInspect = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", output, "--output-dir", candidate], { encoding: "utf8" });
  assert.equal(candidateInspect.status, 0, candidateInspect.stderr || candidateInspect.stdout);
  const verificationPath = path.join(directory, "verification.json");
  const verification = spawnSync("python3", [
    verifyScript,
    "--workspace", skillRoot,
    "--source-pptx", source,
    "--candidate-pptx", output,
    "--source-inspect-manifest", path.join(baseline, "inspect-manifest.json"),
    "--candidate-inspect-manifest", path.join(candidate, "inspect-manifest.json"),
    "--audit", audit,
    "--output", verificationPath,
  ], { encoding: "utf8" });
  assert.equal(verification.status, 0, verification.stderr || verification.stdout);
  assert.equal(JSON.parse(await fs.readFile(verificationPath, "utf8")).verification_pass, true);
});

test("editorial verification blocks a render manifest not bound to its PPTX", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-bind-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", source, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const fake = JSON.parse(await fs.readFile(path.join(baseline, "inspect-manifest.json"), "utf8"));
  fake.png_sha256 = "0".repeat(64);
  const fakePath = path.join(directory, "fake-inspect.json");
  await fs.writeFile(fakePath, JSON.stringify(fake));
  const audit = path.join(directory, "audit.json");
  await fs.writeFile(audit, JSON.stringify({ source_sha256: await hash(source), output_sha256: await hash(source), operations: [] }));
  const result = spawnSync("python3", [verifyScript,
    "--workspace", skillRoot,
    "--source-pptx", source, "--candidate-pptx", source,
    "--source-inspect-manifest", fakePath,
    "--candidate-inspect-manifest", path.join(baseline, "inspect-manifest.json"),
    "--audit", audit, "--output", path.join(directory, "verification.json"),
  ], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(result.stdout).inspect_binding_pass, false);
});

test("editorial patch blocks unsupported or unproved destructive operations", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-block-"));
  const patchPath = path.join(directory, "patch.json");
  await fs.writeFile(patchPath, JSON.stringify({
    version: 1,
    source_sha256: await hash(source),
    primary_issue: "测试",
    edit_hypothesis: "测试",
    operations: [{ op: "delete-nontext", target: "name/composition-1-1", expected_bbox: [169.2, 388.5, 88, 139.5], reason: "危险的数据图形删除", information_contribution_proof: "none" }],
  }));
  const result = spawnSync("node", [patchScript, "--workspace", skillRoot, "--input", source, "--patch", patchPath, "--output", path.join(directory, "blocked.pptx"), "--audit", path.join(directory, "audit.json")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported operation: delete-nontext/);

  const dataStylePatch = path.join(directory, "data-style-patch.json");
  await fs.writeFile(dataStylePatch, JSON.stringify({
    version: 1,
    source_sha256: await hash(source),
    primary_issue: "测试",
    edit_hypothesis: "测试",
    operations: [{ op: "shape-fill", target: "name/composition-1-1", expected_bbox: [188.5, 397.8, 88, 130.2], color: "#FFFFFF", reason: "危险的数据编码隐藏" }],
  }));
  const dataStyleResult = spawnSync("node", [patchScript, "--workspace", skillRoot, "--input", source, "--patch", dataStylePatch, "--output", path.join(directory, "data-style-blocked.pptx"), "--audit", path.join(directory, "data-style-audit.json")], { encoding: "utf8" });
  assert.notEqual(dataStyleResult.status, 0);
  assert.match(dataStyleResult.stderr, /Unsupported operation: shape-fill/);

  const disclosurePatch = path.join(directory, "disclosure-patch.json");
  await fs.writeFile(disclosurePatch, JSON.stringify({
    version: 1,
    source_sha256: await hash(source),
    primary_issue: "测试",
    edit_hypothesis: "测试",
    operations: [{
      op: "replace-repeated-text",
      target: "name/composition-disclosure",
      expected_bbox: [430, 558, 500, 22],
      expected_text: "合成示例数据，非真实客户数据",
      replacement_text: "合成示例数据",
      reason: "危险的限定删除",
    }],
  }));
  const disclosureResult = spawnSync("node", [patchScript, "--workspace", skillRoot, "--input", source, "--patch", disclosurePatch, "--output", path.join(directory, "disclosure-blocked.pptx"), "--audit", path.join(directory, "disclosure-audit.json")], { encoding: "utf8" });
  assert.notEqual(disclosureResult.status, 0);
  assert.match(disclosureResult.stderr, /Unsupported operation: replace-repeated-text/);
});

test("editorial contrast audit blocks invisible affected text", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-contrast-"));
  const layout = path.join(directory, "layout.json");
  const audit = path.join(directory, "audit.json");
  const output = path.join(directory, "contrast.json");
  await fs.writeFile(layout, JSON.stringify({ elements: [{
    order: 1, scope: "slide", name: "decision-text", bbox: [10, 10, 200, 40], text: "关键结论",
    fillColor: "#FFFFFF", resolvedFontSize: 16,
    paragraphs: [{ resolvedTextStyle: { color: "#FFFFFF", fontSize: 16, bold: false } }],
  }] }));
  await fs.writeFile(audit, JSON.stringify({ operations: [{ op: "text-color", target: "name/decision-text" }] }));
  const result = spawnSync("python3", [contrastScript, "--layout", layout, "--audit", audit, "--output", output], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  const record = JSON.parse(await fs.readFile(output, "utf8"));
  assert.equal(record.code, "EDITORIAL_CONTRAST_FAIL");
  assert.equal(record.findings[0].pass, false);
});

test("editorial contrast audit uses actual run colors instead of stale paragraph colors", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-run-color-"));
  const layout = path.join(directory, "layout.json");
  const audit = path.join(directory, "audit.json");
  const output = path.join(directory, "contrast.json");
  await fs.writeFile(layout, JSON.stringify({ elements: [{
    order: 1, scope: "slide", name: "gantt-label", bbox: [10, 10, 200, 40], text: "风险任务",
    fillColor: "#FFFFFF", resolvedFontSize: 16,
    paragraphs: [{
      text: "风险任务", resolvedTextStyle: { color: "#172033", fontSize: 16, bold: false },
      runs: [{ text: "风险", color: "#E8872D", fontSize: 16 }, { text: "任务", color: "#172033", fontSize: 16 }],
    }],
  }] }));
  await fs.writeFile(audit, JSON.stringify({ operations: [{ op: "text-color", target: "name/gantt-label" }] }));
  const result = spawnSync("python3", [contrastScript, "--layout", layout, "--audit", audit, "--output", output], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  const record = JSON.parse(await fs.readFile(output, "utf8"));
  assert.equal(record.findings.length, 2);
  assert.equal(record.findings[0].contrast_ratio < 4.5, true);
  assert.equal(record.findings[0].pass, false);
  assert.equal(record.findings[1].pass, true);
});

test("editorial contrast audit rechecks moved text against its new background", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-move-contrast-"));
  const layout = path.join(directory, "layout.json");
  const audit = path.join(directory, "audit.json");
  const output = path.join(directory, "contrast.json");
  await fs.writeFile(layout, JSON.stringify({ elements: [{
    order: 1, scope: "slide", name: "moved-label", bbox: [300, 10, 200, 40], text: "白色标签",
    fillColor: "#FFFFFF", paragraphs: [{ text: "白色标签", runs: [{ text: "白色标签", color: "#FFFFFF", fontSize: 16 }] }],
  }] }));
  await fs.writeFile(audit, JSON.stringify({ operations: [{ op: "move", target: "name/moved-label" }] }));
  const result = spawnSync("python3", [contrastScript, "--layout", layout, "--audit", audit, "--output", output], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(JSON.parse(await fs.readFile(output, "utf8")).findings[0].pass, false);
});

test("editorial patch cannot style a confidence interval data band as a container", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-editorial-data-band-"));
  const baseline = path.join(directory, "baseline");
  const inspected = spawnSync("node", [inspectScript, "--workspace", skillRoot, "--input", confidenceSource, "--output-dir", baseline], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
  const inventory = (await fs.readFile(path.join(baseline, "inventory.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  const band = inventory.find((item) => item.name === "interval-band-1");
  assert.ok(band);
  const patchPath = path.join(directory, "patch.json");
  await fs.writeFile(patchPath, JSON.stringify({
    version: 1, source_sha256: await hash(confidenceSource), primary_issue: "测试", edit_hypothesis: "测试",
    operations: [{ op: "shape-fill", target: "name/interval-band-1", expected_bbox: band.bbox, color: "#FFFFFF", reason: "危险的数据带隐藏" }],
  }));
  const result = spawnSync("node", [patchScript, "--workspace", skillRoot, "--input", confidenceSource, "--patch", patchPath, "--output", path.join(directory, "blocked.pptx"), "--audit", path.join(directory, "audit.json")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported operation: shape-fill/);
});
