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

test("explicit productized module returns only the selected module contract", async () => {
  const result = await routeV3({ subject: "attribution", story: "Profit changes are explained by four factors", source_ids: ["S01"], requested_module: "waterfall-attribution", data: { start: 100, end: 90 } });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_id, "waterfall-attribution");
  assert.equal(result.load_only.length, 1);
  assert.match(result.renderer, /render_waterfall\.mjs$/);
});

test("executable module payload wins over generic display block count", async () => {
  const result = await routeV3({
    subject: "profit attribution",
    story: "Profit is bridged by three factors",
    source_ids: ["S01"],
    requested_module: "waterfall-attribution",
    structure: { primary_exhibit: "waterfall-attribution" },
    display_blocks: [{ budget_role: "primary_exhibit" }, { budget_role: "supporting_evidence" }],
    module_payload: { version: "1.0", module_id: "waterfall-attribution", source_anchors: [{ id: "S01", text: "profit attribution" }], title: { text: "profit attribution" }, diagram: { type: "waterfall" } },
  });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_id, "waterfall-attribution");
  assert.equal(result.module_input, "module_payload");
});

test("conflicting executable module payload is blocked", async () => {
  const result = await routeV3({
    subject: "profit attribution",
    story: "Profit is bridged by three factors",
    source_ids: ["S01"],
    requested_module: "dumbbell-gap",
    structure: { primary_exhibit: "waterfall-attribution" },
    module_payload: { version: "1.0", module_id: "waterfall-attribution" },
  });
  assert.equal(result.route, "ROUTE_CONFLICT");
});

test("sparse raw source routes without requesting style fields", async () => {
  const result = await routeV3({ text: "Please make this clear set of cause and effect chains into one page: Frequent changes in requirements lead to extended delivery cycles." });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_id, "causal-chain");
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
  const result = await routeV3({ text: "Please consider both the causal chain and the issue tree, and compare both structures." });
  assert.equal(result.route, "BRIEF_REQUIRED");
  assert.ok(result.candidates.length <= 2);
  assert.equal(result.next_skill, "consulting-slide-prompt-architect");
});

test("a detailed raw composite request requires an approved brief", async () => {
  const result = await routeV3({ text: "Please generate one page of organizational level diagnostics. The left side shows the eleven-layer personnel pyramid, the right side compares the longest chain, the shortest chain and the median of enterprises of the same size. The bottom side shows redundant sources, decision-making cycles, three insight cards and layer-by-layer benefits; all fields must be editable and maintain the same caliber." });
  assert.equal(result.route, "BRIEF_REQUIRED");
  assert.equal(result.source_mode, "raw_source");
  assert.equal(result.next_skill, "consulting-slide-prompt-architect");
});

test("Prompt Architect datasets count as a structured handoff", async () => {
  const result = await routeV3({
    subject: "urban growth",
    story: "Key cities are growing faster",
    audience_task: "Identify key cities",
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
    source: 12,
  });
  assert.equal(MIN_FONT_BY_ROLE.body, 12);
  assert.doesNotThrow(() => validateTypography("body", 12));
  assert.doesNotThrow(() => validateTypography("source", 12));
  assert.throws(() => validateTypography("body", 11), /cannot be smaller than 12 pt/);
  assert.equal(toArtifactFontSize(12), 16);
  assert.ok(Math.abs(toArtifactFontSize(34) - 45.33333333333333) < 1e-9);
  assert.equal(fitPageTitleFontSize("short title"), 30);
  assert.equal(fitPageTitleFontSize("This is an action title that is significantly longer than thirty-six characters and requires automatic font size reduction to remain readable on a single line."), 24);
});

test("renderer font literals stay on the consulting typography scale", async () => {
  const scripts = await fs.readdir(path.join(root, "scripts"));
  const renderers = scripts.filter((name) => /^render.*\.mjs$/.test(name));
  const allowed = new Set([12, 14, 16, 18, 24, 26, 28, 30, 32, 34, 35]);
  for (const renderer of renderers) {
    const source = await fs.readFile(path.join(root, "scripts", renderer), "utf8");
    const expressions = [...source.matchAll(/fontSize\s*[:=]\s*([^,\n}]+)/g)].map((match) => match[1]);
    const sizes = expressions
      .flatMap((expression) => [...expression.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((match) => Number(match[1])))
      .filter((size) => size >= 10);
    assert.deepEqual(sizes.filter((size) => !allowed.has(size)), [], renderer);
  }
});
