import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileReferenceList } from "./compile_reference_list.mjs";

const output = process.argv[2];
if (!output) throw new Error("Usage: create_reference_list_representative_run.mjs <new-run-directory>");
try { await fs.access(output); throw new Error(`Run directory already exists: ${output}`); } catch (error) { if (error.code !== "ENOENT") throw error; }

const citations = [
  { source_id: "U01", title: "OneSlide 使用与执行规则", file_name: "SKILL.md", supports: ["功能边界"] },
  { source_id: "U02", title: "OneSlide 输入契约", file_name: "input-contract.md", supports: ["输入处理"] },
  { source_id: "U03", title: "单页范围契约", file_name: "single-slide-contract.md", supports: ["单页门禁"] },
  { source_id: "U04", title: "来源追溯契约", file_name: "provenance-contract.md", supports: ["来源去重与追溯"] },
  { source_id: "U05", title: "Producer 与 Builder 交接契约", file_name: "output-contract.md", supports: ["正式交接"] },
];
const ledgers = citations.map((item) => ({
  page_label: item.supports[0],
  entries: [{
    source_id: item.source_id,
    kind: "user_supplied",
    statement: item.title,
    citation: { organization: "OneSlide", title: item.title, date: "2026-08-10", file_name: item.file_name },
  }],
}));
const payload = compileReferenceList({
  title: "引用资料",
  subtitle: "本次功能开发实际使用的 5 项资料",
  source_note: "仅列本次功能开发实际使用并可定位的资料，按首次出现顺序排列",
  ledgers,
});
const sourceIds = payload.source_anchors.map((item) => item.id);
const handoff = {
  schema_version: "1.0",
  product: "single-consulting-slide-producer",
  output_mode: "PPT_DRAFT",
  generation_mode: "SOURCE_ONLY",
  single_slide: true,
  subject: "本次功能开发引用资料",
  story: "按首次使用顺序列出本次功能开发实际使用且可定位的资料",
  audience_task: "核查本次功能设计依据了哪些资料，并快速定位原文件",
  source_ids: sourceIds,
  content: { title: payload.title, subtitle: payload.subtitle, insights: [], actions: [], footnotes: [payload.diagram.source_note] },
  structure: { primary_question: "本次功能设计实际依据了哪些资料", primary_relationship: "实际使用顺序与可核验来源定位", primary_exhibit: "reference-list", visual_intent: "单列编号引用清单", layout_intent: "从上到下单列阅读" },
  information_budget: { primary_exhibit_count: 1, supporting_evidence_count: 0, action_or_condition_count: 0, status: "pass" },
  display_blocks: [{
    block_id: "B01",
    budget_role: "primary_exhibit",
    display_intent: "ordered-reference-list",
    source_ids: sourceIds,
    items: payload.diagram.references.map((item, index) => ({ item_id: `M${String(index + 1).padStart(2, "0")}`, label: item.citation.text, value: item.locator.text, source_ids: item.source_ids })),
  }],
  datasets: [],
  review_marking: { required: false, synthetic_data_disclosure: null, qualitative_marker: null },
  constraints: { must_include: ["编号", "引用正文", "定位信息"], must_avoid: ["图表", "卡片", "缩略图", "复杂补充分析", "第二页"], slide_count: 1 },
  requested_module: "reference-list",
  module_payload: payload,
};
const run = path.resolve(output);
for (const directory of ["brief", "handoff", "review", "internal", "internal/verify"]) await fs.mkdir(path.join(run, directory), { recursive: true });
const writes = {
  "brief/slide-brief.md": "# 单页 Brief\n\n只制作一页引用资料清单。读者需要核查本次功能开发实际使用了哪些资料并定位原文件。页面保持单列编号列表，不加入数据明细、补充分析、图表、卡片或第二页。\n",
  "handoff/builder-prompt.md": "# 单页 Builder Prompt\n\n只生成一页 16:9 原生可编辑 PowerPoint。使用单列编号列表，从上到下列出实际使用的五项资料；每项只保留引用正文、定位信息和支持范围。不得加入图表、卡片、图标、缩略图、洞察栏、补充分析或第二页。\n",
  "handoff/builder-handoff.json": `${JSON.stringify(handoff, null, 2)}\n`,
  "review/content-review.md": "# 单页内容确认\n\n- 用户提供：本次功能开发实际读取的五项 OneSlide 规则与契约。\n- 格式转换：按首次使用顺序去重、编号并显示文件名和支持范围。\n- 未加入：数据明细、复杂分析、模型补全、外部资料、图表、卡片或第二页。\n",
  "internal/reference-list-module-payload.json": `${JSON.stringify(payload, null, 2)}\n`,
  "internal/source-baseline.json": `${JSON.stringify({ schema_version: "1.0", sources: citations.map((item) => ({ source_id: item.source_id, type: "user_supplied_file", status: "read", description: item.title, file_name: item.file_name })) }, null, 2)}\n`,
  "internal/provenance-ledger.json": `${JSON.stringify({ schema_version: "1.0", entries: [
    ...citations.map((item) => ({ source_id: item.source_id, kind: "user_supplied", statement: item.title, origin: item.file_name, status: "locked", affects: ["display_blocks.B01", "module_payload.diagram.references"], citation: { organization: "OneSlide", title: item.title, date: "2026-08-10", file_name: item.file_name } })),
    { source_id: "D99", kind: "derived_from_source", statement: "引用资料页标题、数量和收录范围", origin: "count and ordering derived from U01-U05", status: "locked", affects: ["content.title", "content.subtitle", "module_payload.diagram.source_note"] },
  ] }, null, 2)}\n`,
  "internal/generation-ledger.json": `${JSON.stringify({ generation_mode: "SOURCE_ONLY", gaps: [] }, null, 2)}\n`,
};
for (const [relative, content] of Object.entries(writes)) await fs.writeFile(path.join(run, relative), content);
const handoffHash = crypto.createHash("sha256").update(await fs.readFile(path.join(run, "handoff/builder-handoff.json"))).digest("hex");
const manifest = { schema_version: "1.0", product: "single-consulting-slide-producer", output_mode: "PPT_DRAFT", generation_mode: "SOURCE_ONLY", single_slide: true, synthetic_content: false, synthetic_data: false, status: "ready", builder_target: "single-consulting-slide-builder", entrypoints: { builder_prompt: "builder-prompt.md", builder_handoff: "builder-handoff.json", content_review: "../review/content-review.md" }, files: [] };
await fs.writeFile(path.join(run, "handoff/handoff-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(run, "internal/source-baseline.sha256"), `${handoffHash}  handoff/builder-handoff.json\n`);
process.stdout.write(`${JSON.stringify({ ok: true, run, payload: "internal/reference-list-module-payload.json" })}\n`);
