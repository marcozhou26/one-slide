import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileReferenceList, loadReferenceBundle } from "../../producer/scripts/compile_reference_list.mjs";
import { validateReferenceList, loadReferenceListInput } from "../scripts/validate_reference_list.mjs";
import { planReferenceList } from "../scripts/plan_reference_list.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const fixture = async (name) => JSON.parse(await fs.readFile(path.join(skillRoot, "assets/test-fixtures", name), "utf8"));
const source = (id, kind, citation, page = "P03") => ({ page_label: page, entries: [{ source_id: id, kind, statement: citation.title, citation }] });

test("complete reference list validates and plans one uncluttered 16:9 page", async () => {
  const data = await fixture("reference-list-valid.json");
  assert.equal(validateReferenceList(data).ok, true);
  const plan = planReferenceList(data);
  assert.deepEqual(plan.slide, { width: 1280, height: 720 });
  assert.equal(plan.normalized.diagram.references.length, 5);
  assert.ok(plan.list.entryHeight >= 60);
});

test("Producer compiler deduplicates the same source and preserves page backlinks", () => {
  const citation = { organization: "OECD", title: "Employment Outlook 2025", date: "2025", url: "https://www.oecd.org/employment-outlook/2025" };
  const payload = compileReferenceList({ ledgers: [source("E01", "externally_verified", citation, "P03"), source("E09", "externally_verified", citation, "P07"), source("E02", "externally_verified", { organization: "NIST", title: "AI RMF", date: "2023", doi: "10.6028/NIST.AI.100-1" }, "P06")] });
  assert.equal(payload.diagram.references.length, 2);
  assert.deepEqual(payload.diagram.references[0].supporting_pages, ["P03", "P07"]);
  assert.deepEqual(payload.diagram.references[0].source_ids, ["E01", "E09"]);
  assert.equal(validateReferenceList(payload).ok, true);
});

test("calculated, derived, synthetic and ordinary prompt anchors are not turned into references", () => {
  const ledgers = [{ page_label: "P02", entries: [
    { source_id: "C01", kind: "calculated", statement: "计算结论" },
    { source_id: "D01", kind: "derived_from_source", statement: "稳定推导" },
    { source_id: "G01", kind: "synthetic_generated", statement: "示例内容" },
    { source_id: "U01", kind: "user_supplied", statement: "普通用户提示词" },
    { source_id: "E01", kind: "externally_verified", statement: "来源一", citation: { organization: "机构甲", title: "报告甲", date: "2026", url: "https://example.com/a" } },
    { source_id: "E02", kind: "externally_verified", statement: "来源二", citation: { organization: "机构乙", title: "报告乙", date: "2026", url: "https://example.com/b" } }
  ] }];
  const payload = compileReferenceList({ ledgers });
  assert.deepEqual(payload.diagram.references.flatMap((item) => item.source_ids), ["E01", "E02"]);
});

test("sparse natural-language request routes without naming a module or visual", async () => {
  const text = "把这次实际用过的资料去重编号，列出作者或机构、标题、日期和可核验链接，并标明分别支持了哪些正文页。不要添加分析、图形或新的观点。";
  assert.doesNotMatch(text, /reference-list|模块|图表/i);
  const result = await routeInput({ input_mode: "text", text });
  assert.equal(result.module.module_id, "reference-list");
});

test("missing provenance ledgers blocks instead of asking the user to rewrite a list", () => {
  assert.throws(() => compileReferenceList({ ledgers: [] }), (error) => error.code === "SOURCE_BASELINE_FAIL");
});

test("missing citation metadata is blocked without invention", () => {
  const ledgers = [{ page_label: "P02", entries: [{ source_id: "E01", kind: "externally_verified", statement: "来源一", citation: { url: "https://example.com/a" } }] }];
  assert.throws(() => compileReferenceList({ ledgers }), (error) => error.code === "REFERENCE_METADATA_FAIL");
});

test("more than eight unique sources stays within the one-page gate", () => {
  const ledgers = Array.from({ length: 9 }, (_, index) => source(`E${index + 1}`, "externally_verified", { organization: "机构", title: `报告${index + 1}`, date: "2026", url: `https://example.com/${index + 1}` }, `P${index + 1}`));
  assert.throws(() => compileReferenceList({ ledgers }), (error) => error.code === "SINGLE_SLIDE_SCOPE_OVERLOAD");
});

test("style fields are non-blocking and a complete Producer handoff routes to the renderer", async () => {
  const data = await fixture("reference-list-valid.json");
  assert.equal(validateReferenceList(data).ok, true);
  const result = await routeV3({ subject: "报告引用来源", story: "列出实际使用资料", source_ids: ["D99", "E01"], requested_module: "reference-list", structure: { primary_exhibit: "reference-list" }, module_payload: data });
  assert.equal(result.route, "deterministic_module");
  assert.equal(result.module_input, "module_payload");
});

test("malformed JSON is rejected as an abnormal input format", async () => {
  await assert.rejects(() => loadReferenceListInput(path.join(skillRoot, "assets/test-fixtures/reference-list-invalid-format.json")), SyntaxError);
  const badBundle = path.join(skillRoot, "assets/test-fixtures/reference-list-invalid-format.json");
  await assert.rejects(() => loadReferenceBundle(badBundle), SyntaxError);
});
