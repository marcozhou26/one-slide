import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { routeV3 } from "../scripts/route_v3.mjs";
import {
  FONT_SIZES,
  MIN_FONT_BY_ROLE,
  fitPageTitleFontSize,
  toArtifactFontSize,
  validateTypography,
} from "../scripts/layout_constants.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

test("structured composite handoff uses direct composition without a second page model", async () => {
  const data = JSON.parse(await fs.readFile(path.join(root, "assets/test-fixtures/v3-composite-handoff.json"), "utf8"));
  const result = await routeV3(data);
  assert.equal(result.route, "direct_composition");
  assert.equal(result.source_mode, "structured_handoff");
  assert.deepEqual(result.load_only, ["references/visual-grammar.md", "references/direct-composition.md"]);
  assert.equal(JSON.stringify(result).includes("module-registry"), false);
});

test("structured handoff cannot request a productized module without its executable payload", async () => {
  const result = await routeV3({ subject: "归因", story: "利润变化由四项因素解释", source_ids: ["S01"], requested_module: "waterfall-attribution", data: { start: 100, end: 90 } });
  assert.equal(result.status, "blocked");
  assert.equal(result.route, "MODULE_PAYLOAD_INCOMPLETE");
  assert.equal(result.module_id, "waterfall-attribution");
});

test("raw source may still request a productized module and must continue to its validator", async () => {
  const result = await routeV3({ text: "请用瀑布图呈现利润从100下降到90的四项影响因素。", requested_module: "waterfall-attribution", data: { start: 100, end: 90 } });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.source_mode, "raw_source");
  assert.equal(result.module_id, "waterfall-attribution");
  assert.equal(result.load_only.length, 1);
  assert.match(result.renderer, /render_waterfall\.mjs$/);
});

test("executable module payload wins over generic display block count", async () => {
  const result = await routeV3({
    subject: "利润归因",
    story: "利润由三项因素桥接",
    source_ids: ["S01"],
    requested_module: "waterfall-attribution",
    structure: { primary_exhibit: "waterfall-attribution" },
    display_blocks: [{ budget_role: "primary_exhibit" }, { budget_role: "supporting_evidence" }],
    module_payload: { version: "1.0", module_id: "waterfall-attribution", source_anchors: [{ id: "S01", text: "利润归因" }], title: { text: "利润归因" }, diagram: { type: "waterfall" } },
  });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_id, "waterfall-attribution");
  assert.equal(result.module_input, "module_payload");
});

test("conflicting executable module payload is blocked", async () => {
  const result = await routeV3({
    subject: "利润归因",
    story: "利润由三项因素桥接",
    source_ids: ["S01"],
    requested_module: "dumbbell-gap",
    structure: { primary_exhibit: "waterfall-attribution" },
    module_payload: { version: "1.0", module_id: "waterfall-attribution" },
  });
  assert.equal(result.route, "ROUTE_CONFLICT");
});

test("sparse raw source routes without requesting style fields", async () => {
  const result = await routeV3({ text: "请把这组明确的因果链做成一页：需求频繁变更导致交付周期延长。" });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_id, "causal-chain");
});

test("retired fixed templates remain usable only as direct-composition patterns", async () => {
  const result = await routeV3({ text: "比较自建和外采两条路线，按成本、周期和风险做取舍。" });
  assert.equal(result.route, "direct_composition");
  assert.equal(result.preferred_pattern, "route-tradeoff");
  assert.ok(result.load_only.includes("references/direct-composition-patterns.md"));
});

test("legacy HR template requests converge on the unified matrix and maps remain blocked", async () => {
  const merged = await routeV3({ text: "逐项比较服务量和一次解决率", requested_module: "hr-ticket-intake" });
  assert.equal(merged.route, "deterministic_module");
  assert.equal(merged.module_id, "hr-operating-diagnostic-matrix");
  const map = await routeV3({ text: "按区域比较数据", requested_module: "region-map-table" });
  assert.equal(map.status, "blocked");
  assert.equal(map.route, "SENSITIVE_MAP_MODULE_RETIRED");
});

test("missing source blocks instead of inventing content", async () => {
  const result = await routeV3({});
  assert.equal(result.status, "blocked");
  assert.equal(result.route, "SOURCE_BASELINE_FAIL");
});

test("a module name without source data does not bypass the source gate", async () => {
  const result = await routeV3({ requested_module: "waterfall-attribution" });
  assert.equal(result.status, "blocked");
  assert.equal(result.route, "SOURCE_BASELINE_FAIL");
});

test("equally explicit raw structures require an upstream brief", async () => {
  const result = await routeV3({ text: "请同时考虑因果链与议题树，两种结构都要比较。" });
  assert.equal(result.route, "BRIEF_REQUIRED");
  assert.ok(result.candidates.length <= 2);
  assert.equal(result.next_skill, "consulting-slide-prompt-architect");
});

test("a detailed raw composite request requires an approved brief", async () => {
  const result = await routeV3({ text: "请生成一页组织层级诊断。左侧展示十一层人员金字塔，右侧比较最长链、最短链和同规模企业中位，下方展示冗余来源、决策周期、三张洞察卡以及压层收益；所有字段必须可编辑并保持同一口径。" });
  assert.equal(result.route, "BRIEF_REQUIRED");
  assert.equal(result.source_mode, "raw_source");
  assert.equal(result.next_skill, "consulting-slide-prompt-architect");
});

test("Prompt Architect datasets count as a structured handoff", async () => {
  const result = await routeV3({
    subject: "城市增长",
    story: "重点城市增长更快",
    audience_task: "识别重点城市",
    source_ids: ["S01"],
    structure: { primary_exhibit: "bubble-chart", primary_relationship: "city x growth x talent" },
    datasets: [{ dataset_id: "D01", path: "data/cities.csv", encoding: { x: "growth", y: "talent" } }],
  });
  assert.equal(result.source_mode, "structured_handoff");
  assert.equal(result.route, "direct_composition");
  assert.equal(result.family, "bubble-chart");
});

test("visual source and context budgets pass", async () => {
  const visual = JSON.parse((await exec("node", [path.join(root, "scripts/audit_visual_source.mjs")])).stdout);
  assert.equal(visual.ok, true);
  const budget = JSON.parse((await exec("python3", [path.join(root, "scripts/check_token_budget.py")])).stdout);
  assert.equal(budget.ok, true);
  assert.ok(budget.core_chars < budget.limits.core_chars);
  assert.ok(budget.direct_route_chars < budget.limits.direct_route_chars);
});

test("visual grammar isolates rounded rectangles to explicit status tags", async () => {
  const source = await fs.readFile(path.join(root, "scripts/pptx_core.mjs"), "utf8");
  assert.match(source, /function addNode[\s\S]*?geometry = "rect"/);
  assert.equal([...source.matchAll(/roundRect/g)].length, 1);
  assert.match(source, /function addStatusTag[\s\S]*?geometry: "roundRect"/);
  assert.match(source, /replace\(\/\\s\*｜/);
});

test("typography uses role-based hierarchy instead of a universal 16 pt floor", () => {
  assert.deepEqual(FONT_SIZES, {
    pageTitle: 32,
    pageSubtitle: 14,
    hero: 24,
    sectionTitle: 18,
    body: 14,
    compact: 12,
    dataLabel: 10,
    source: 12,
  });
  assert.equal(MIN_FONT_BY_ROLE.body, 12);
  assert.doesNotThrow(() => validateTypography("body", 12));
  assert.doesNotThrow(() => validateTypography("source", 12));
  assert.doesNotThrow(() => validateTypography("dataLabel", 10));
  assert.throws(() => validateTypography("body", 11), /cannot be smaller than 12 pt/);
  assert.throws(() => validateTypography("dataLabel", 9), /cannot be smaller than 10 pt/);
  assert.equal(toArtifactFontSize(12), 16);
  assert.ok(Math.abs(toArtifactFontSize(34) - 45.33333333333333) < 1e-9);
  assert.equal(fitPageTitleFontSize("短标题"), 30);
  assert.equal(fitPageTitleFontSize("这是一个长度明显超过三十六个字符并且需要自动缩小字号以保持单行阅读的行动标题"), 24);
});

test("renderer font literals stay on the consulting typography scale", async () => {
  const scripts = await fs.readdir(path.join(root, "scripts"));
  const renderers = scripts.filter((name) => /^render.*\.mjs$/.test(name));
  const allowed = new Set([10, 12, 14, 16, 18, 24, 26, 28, 30, 32, 34, 35]);
  for (const renderer of renderers) {
    const source = await fs.readFile(path.join(root, "scripts", renderer), "utf8");
    const expressions = [...source.matchAll(/fontSize\s*[:=]\s*([^,\n}]+)/g)].map((match) => match[1]);
    const sizes = expressions
      .flatMap((expression) => [...expression.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((match) => Number(match[1])))
      .filter((size) => size >= 10);
    assert.deepEqual(sizes.filter((size) => !allowed.has(size)), [], renderer);
  }
});
