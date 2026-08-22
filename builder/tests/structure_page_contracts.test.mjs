import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBookendPage } from "../scripts/validate_bookend_page.mjs";
import { validateNavigationPage } from "../scripts/validate_navigation_page.mjs";
import { validateSectionTransition } from "../scripts/validate_section_transition.mjs";
import { validateSummaryPage } from "../scripts/validate_summary_page.mjs";
import { planNavigationPage } from "../scripts/plan_navigation_page.mjs";
import { renderBookendPage } from "../scripts/render_bookend_page.mjs";
import { renderNavigationPage } from "../scripts/render_navigation_page.mjs";
import { renderSectionTransition } from "../scripts/render_section_transition.mjs";
import { renderSummaryPage } from "../scripts/render_summary_page.mjs";
import { routeInput } from "../scripts/route_input.mjs";
import { compileOutlinePage, renderBuilderPrompt } from "../../producer/scripts/compile_outline_handoff.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const semanticAudit = path.join(skillRoot, "scripts/audit_pptx_semantics.py");
const component = (id, role, text) => ({ id, role, text, required: true });
const base = (module_id, page_type, visible_components, extra = {}) => ({
  version: "1.0",
  module_id,
  theme: "light",
  deck_context: { current_slide: 1, total_slides: 20, chapter_id: "opening", previous_page_job: null, next_page_job: "继续", callback_to: null, ...extra.deck_context },
  page_contract: {
    page_type,
    page_job: "完成本页听众任务",
    audience_shift: { before: "未知", after: "理解" },
    central_message: "页面中心结论",
    source_ids: ["S01-C001"],
    visible_components,
    forbidden_components: ["logo", "page_number", "decorative_block"],
    peer_groups: [],
    layout_intent: { group_translation: "none", preserve_internal_spacing: true, must_not_center: false },
    theme_preference: "inherit_or_neutral",
    speaker_notes: "",
    completion_checks: ["必需部件可见"],
    ...extra.page_contract,
  },
});

const cover = base("bookend-page", "cover", [
  component("accent-rule", "structural_rule", "绿色竖线"),
  component("eyebrow", "eyebrow", "候选讲师培训"),
  component("title", "page_title", "从创始人主讲到讲师独立交付"),
  component("subtitle", "subtitle", "候选讲师的三阶段专业成长路径"),
  component("divider", "structural_rule", "浅灰分隔线"),
  component("author", "visible_text", "作者：示例作者"),
  component("time", "visible_text", "时间：2026年8月"),
  component("place", "visible_text", "地点：待定"),
]);
const ending = base("bookend-page", "ending", [component("accent-rule", "structural_rule", "绿色竖线"), component("eyebrow", "eyebrow", "候选讲师培训"), component("title", "page_title", "从专业判断开始，走向独立交付"), component("subtitle", "subtitle", "期待与你一起，把真实HR问题做成可验证、可复制的专业课程")]);
const agendaItems = { id: "agenda_items", role: "ordered_peer_list", required: true, items: [
  { index: "01", label: "体系总览" }, { index: "02", label: "第一阶段：观察与识别证据" }, { index: "03", label: "第二阶段：聚焦与承担模块" }, { index: "04", label: "第三阶段：复制与独立交付" },
] };
const agenda = base("navigation-page", "agenda", [component("title", "page_title", "目录"), agendaItems], { page_contract: { peer_groups: [{ component_id: "agenda_items", default_behavior: "homogeneous", allowed_emphasis: null }], layout_intent: { group_translation: "relative_only", preserve_internal_spacing: true, must_not_center: true, number_container_height_ratio: 1.5, number_font_delta_pt: -3, number_font_delta_range_pt: [-4, -2], number_alignment: "optical_center_with_first_line" } } });
const summaryIcon = (id, concept) => ({ enabled: true, role: "summary_paragraph_marker", concept, selection_reason: `帮助识别${concept}`, component_id: id });
const summary = base("summary-page", "summary", [
  component("title", "page_title", "从扩张内容转向验证交付"),
  { ...component("orientation", "summary_orientation", "团队已经形成完整课程框架，现在需要决定下一轮开发重点。"), paragraph_leading_icon: summaryIcon("orientation", "背景与方向") },
  { ...component("tension", "summary_tension", "继续扩充主题会增加口径分散和返工，现有内容却尚未经过真实交付验证。"), paragraph_leading_icon: summaryIcon("tension", "风险与张力") },
  { ...component("response", "summary_response", "先用一组核心页面完成真实交付验证，再决定是否扩展。"), paragraph_leading_icon: summaryIcon("response", "核心回应") },
  { id: "support_units", role: "summary_support_units", required: true, items: [
    { id: "support_1", text: "框架已经覆盖关键经营问题。", paragraph_leading_icon: summaryIcon("support_1", "关键支撑") },
    { id: "support_2", text: "统一页面语言和证据规则已经具备。", paragraph_leading_icon: summaryIcon("support_2", "关键支撑") },
  ] },
  { ...component("decision_or_implication", "summary_decision", "批准核心页面试点，并以真实反馈决定后续扩展顺序。"), paragraph_leading_icon: summaryIcon("decision_or_implication", "决策落点") },
], { page_contract: { summary_narrative: { summary_type: "decision", orientation: "团队已经形成完整课程框架，现在需要决定下一轮开发重点。", tension: "继续扩充主题会增加口径分散和返工，现有内容却尚未经过真实交付验证。", response: "先用一组核心页面完成真实交付验证，再决定是否扩展。", support_units: [{ text: "框架已经覆盖关键经营问题。" }, { text: "统一页面语言和证据规则已经具备。" }], decision_or_implication: "批准核心页面试点，并以真实反馈决定后续扩展顺序。", narrative_relation: "背景到张力再到回应", source_ids: ["S01-C001"], proof_page_ids: ["P03"] }, layout_intent: { paragraph_icon_position: "leading_left", paragraph_icon_height_ratio: 1.5, paragraph_icon_height_ratio_range: [1.4, 1.6], paragraph_icon_align: "optical_center_with_first_line" } } });
const overview = base("navigation-page", "numbered_overview", [component("title", "page_title", "三阶段成长路径"), { ...agendaItems, id: "overview_items", items: agendaItems.items.slice(0, 3) }], { page_contract: { peer_groups: [{ component_id: "overview_items", default_behavior: "homogeneous", allowed_emphasis: null }] } });
const recap = base("navigation-page", "numbered_recap", [component("title", "page_title", "三阶段分别证明验证、聚焦和复制"), { ...agendaItems, id: "recap_items", items: agendaItems.items.slice(0, 3) }], { deck_context: { callback_to: "P07" }, page_contract: { peer_groups: [{ component_id: "recap_items", default_behavior: "homogeneous", allowed_emphasis: null }] } });
const transition = base("section-transition", "section_transition", [component("number", "number_label", "01"), component("rule", "structural_rule", "深蓝横线"), component("chapter", "peer_label", "体系总览"), component("guidance", "guidance", "先看懂专业体系，再谈讲师成长")]);

test("all seven structure page types validate in their independent modules", () => {
  assert.equal(validateBookendPage(cover).ok, true);
  assert.equal(validateBookendPage(ending).ok, true);
  assert.equal(validateNavigationPage(agenda).ok, true);
  assert.equal(validateNavigationPage(overview).ok, true);
  assert.equal(validateNavigationPage(recap).ok, true);
  assert.equal(validateSummaryPage(summary).ok, true);
  assert.equal(validateSectionTransition(transition).ok, true);
});

test("light and navy plans preserve identical content semantics", () => {
  const light = planNavigationPage(agenda);
  const navy = planNavigationPage({ ...agenda, theme: "navy" });
  assert.deepEqual(light.normalized.page_contract, navy.normalized.page_contract);
  assert.notEqual(light.theme.background, navy.theme.background);
});

test("declared sparse peer groups form a compact vertically balanced cluster", () => {
  const plan = planNavigationPage(overview);
  assert.equal(plan.navigation.columns, 1);
  assert.equal(plan.navigation.rows, 3);
  assert.equal(plan.navigation.gap, 24);
  assert.equal(plan.navigation.groupCenter, 390);
  assert.ok(plan.navigation.groupTop - 96 > plan.navigation.gap);
  assert.equal(plan.navigation.items[0].label, "体系总览");
  assert.equal(typeof plan.navigation.items[0].labelPosition.top, "number");
});

test("agenda number geometry is derived from label typography", () => {
  const five = { ...agenda, page_contract: { ...agenda.page_contract, visible_components: [component("title", "page_title", "目录"), { ...agendaItems, items: [...agendaItems.items, { index: "05", label: "终局检验：结果与持续迭代" }] }] } };
  const navigation = planNavigationPage(five).navigation;
  assert.equal(navigation.labelFontSize, 19);
  assert.equal(navigation.numberFontSize, 16);
  assert.ok(Math.abs(navigation.badgeSize / (navigation.labelFontSize * 4 / 3) - 1.5) < 0.01);
  assert.ok(navigation.opticalLift > 0);
});

test("numbered overviews use deterministic two- and three-column layouts", () => {
  const sixItems = Array.from({ length: 6 }, (_, index) => ({ index: String(index + 1).padStart(2, "0"), label: `议题${index + 1}` }));
  const fifteenItems = Array.from({ length: 15 }, (_, index) => ({ index: String(index + 1).padStart(2, "0"), label: `议题${index + 1}` }));
  const six = { ...overview, page_contract: { ...overview.page_contract, visible_components: [component("title", "page_title", "六项总览"), { ...agendaItems, id: "overview_items", items: sixItems }] } };
  const fifteen = { ...overview, page_contract: { ...overview.page_contract, visible_components: [component("title", "page_title", "十五项总览"), { ...agendaItems, id: "overview_items", items: fifteenItems }] } };
  assert.equal(planNavigationPage(six).navigation.columns, 2);
  assert.equal(planNavigationPage(six).navigation.rows, 3);
  assert.equal(planNavigationPage(fifteen).navigation.columns, 3);
  assert.equal(planNavigationPage(fifteen).navigation.rows, 5);
});

test("explicit peer-group column policy is bounded and ordinary auto-detection is not used", () => {
  const explicit = { ...overview, page_contract: { ...overview.page_contract, peer_groups: [{ ...overview.page_contract.peer_groups[0], layout_policy: { columns: 2 } }] } };
  assert.equal(planNavigationPage(explicit).navigation.columns, 2);
  assert.throws(() => validateNavigationPage({ ...explicit, page_contract: { ...explicit.page_contract, peer_groups: [{ ...explicit.page_contract.peer_groups[0], layout_policy: { columns: 4 } }] } }), (error) => error.code === "PEER_GROUP_LAYOUT_POLICY_FAIL");
  assert.throws(() => validateNavigationPage({ ...overview, page_contract: { ...overview.page_contract, peer_groups: [] } }), (error) => error.code === "PEER_GROUP_DECLARATION_FAIL");
});

test("the 19-page case-library structure set keeps the intended navigation rhythms", () => {
  const cases = [
    ["P03", "agenda", 5, 1, 5],
    ["P05", "numbered_overview", 14, 2, 7],
    ["P20", "numbered_recap", 3, 1, 3],
    ["P22", "numbered_overview", 15, 3, 5],
    ["P38", "numbered_recap", 4, 1, 4],
    ["P40", "numbered_overview", 15, 3, 5],
    ["P56", "numbered_recap", 4, 1, 4],
    ["P58", "numbered_overview", 14, 2, 7],
    ["P73", "numbered_recap", 4, 1, 4],
    ["P75", "numbered_overview", 6, 2, 3],
    ["P82", "numbered_recap", 2, 1, 2],
  ];
  for (const [page, pageType, count, columns, rows] of cases) {
    const id = `${page.toLowerCase()}_items`;
    const items = Array.from({ length: count }, (_, index) => ({ index: String(index + 1).padStart(2, "0"), label: `${page}议题${index + 1}` }));
    const data = base("navigation-page", pageType, [component("title", "page_title", `${page}结构页`), { id, role: "ordered_peer_list", required: true, items }], {
      deck_context: { callback_to: pageType === "numbered_recap" ? `${page}-overview` : null },
      page_contract: { peer_groups: [{ component_id: id, default_behavior: "homogeneous", allowed_emphasis: null }] },
    });
    const navigation = planNavigationPage(data).navigation;
    assert.equal(navigation.columns, columns, `${page} columns`);
    assert.equal(navigation.rows, rows, `${page} rows`);
    assert.ok(navigation.groupCenter >= 360 && navigation.groupCenter <= 430, `${page} vertical center`);
    if (navigation.sparse) assert.ok(navigation.gap <= 28, `${page} sparse gap`);
    assert.ok(navigation.groupTop - 96 >= navigation.gap * 1.35, `${page} heading-to-group hierarchy`);
  }
});

test("allowlist conflicts, random emphasis, callback gaps, and translation drift block", () => {
  assert.throws(() => validateBookendPage({ ...cover, page_contract: { ...cover.page_contract, forbidden_components: ["page_title"] } }), (error) => error.code === "UNDECLARED_COMPONENT_FAIL");
  assert.throws(() => validateNavigationPage({ ...agenda, page_contract: { ...agenda.page_contract, peer_groups: [{ component_id: "agenda_items", default_behavior: "differentiated", allowed_emphasis: null }] } }), (error) => error.code === "UNAUTHORIZED_PEER_EMPHASIS_FAIL");
  assert.throws(() => validateNavigationPage({ ...recap, deck_context: { ...recap.deck_context, callback_to: null } }), (error) => error.code === "DECK_CALLBACK_FAIL");
  assert.throws(() => validateNavigationPage({ ...agenda, page_contract: { ...agenda.page_contract, layout_intent: { group_translation: "relative_only", preserve_internal_spacing: true, must_not_center: false } } }), (error) => error.code === "RELATIVE_LAYOUT_INTENT_FAIL");
});

test("effective page spec compiles one report page without re-asking or redesigning", () => {
  const spec = {
    schema_version: "effective-page-spec-1.0",
    mode: "REPORT_PAGE",
    deck_id: "candidate",
    page_id: "P01",
    deck_context: cover.deck_context,
    director_inheritance: { source_schema: "director-package-1.0", locked_fields: { sequence: 1, page_type: cover.page_contract.page_type, central_message: cover.page_contract.central_message } },
    page_contract: cover.page_contract,
  };
  const compiled = compileOutlinePage(spec, 1, "navy");
  assert.equal(compiled.requested_module, "bookend-page");
  assert.equal(compiled.module_payload.page_contract.central_message, cover.page_contract.central_message);
  const prompt = renderBuilderPrompt(compiled);
  assert.match(prompt, /只能呈现 page_contract\.visible_components/u);
  assert.match(prompt, /原生自动页码属于报告系统层/u);
  assert.throws(() => compileOutlinePage({ schema_version: "1.0", pages: [] }, 1, "navy"), (error) => error.code === "EFFECTIVE_PAGE_SPEC_REQUIRED");
});

test("structured page contracts route directly to the correct module", async () => {
  assert.equal((await routeInput({ input_mode: "data", data: { page_contract: { page_type: "cover" } } })).module.module_id, "bookend-page");
  assert.equal((await routeInput({ input_mode: "data", data: { page_contract: { page_type: "agenda" } } })).module.module_id, "navigation-page");
  assert.equal((await routeInput({ input_mode: "data", data: { page_contract: { page_type: "summary" } } })).module.module_id, "summary-page");
  assert.equal((await routeInput({ input_mode: "data", data: { page_contract: { page_type: "section_transition" } } })).module.module_id, "section-transition");
});

test("representative modules render native editable PPTX with automatic page number", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-structure-page-"));
  for (const [name, data, render] of [["cover", cover, renderBookendPage], ["summary", summary, renderSummaryPage], ["agenda", { ...agenda, theme: "navy" }, renderNavigationPage], ["transition", transition, renderSectionTransition]]) {
    const output = { pptx: path.join(directory, `${name}.pptx`), preview: path.join(directory, `${name}.png`), layout: path.join(directory, `${name}.json`) };
    await render(data, output);
    const audit = spawnSync("python3", [semanticAudit, output.pptx], { encoding: "utf8" });
    assert.equal(audit.status, 0, audit.stdout || audit.stderr);
    assert.equal(JSON.parse(audit.stdout).code, "SEMANTIC_AUDIT_PASS");
  }
});

test("sparse and dense navigation representatives render with the new group geometry", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-navigation-layout-"));
  const cases = [["sparse-overview", "numbered_overview", 6], ["dense-overview", "numbered_overview", 15], ["sparse-recap", "numbered_recap", 2]];
  for (const [name, pageType, count] of cases) {
    const id = `${name}-items`;
    const items = Array.from({ length: count }, (_, index) => ({ index: String(index + 1).padStart(2, "0"), label: `议题${index + 1}：经营分析` }));
    const data = base("navigation-page", pageType, [component("title", "page_title", `${name}布局验证`), { id, role: "ordered_peer_list", required: true, items }], {
      deck_context: { callback_to: pageType === "numbered_recap" ? "P00" : null },
      page_contract: { peer_groups: [{ component_id: id, default_behavior: "homogeneous", allowed_emphasis: null }] },
    });
    const output = { pptx: path.join(directory, `${name}.pptx`), preview: path.join(directory, `${name}.png`), layout: path.join(directory, `${name}.json`) };
    await renderNavigationPage(data, output);
    const layout = JSON.parse(await fs.readFile(output.layout, "utf8"));
    assert.equal(layout.slide.frame.width, 1280);
    assert.equal(layout.slide.frame.height, 720);
    assert.ok(layout.elements.some((element) => element.text === "议题1：经营分析"));
    assert.ok(!layout.elements.some((element) => element.text === "[object Object]"));
  }
});

test("rendered summary icons and five-item agenda satisfy relative typography ratios", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "oneslide-format-acceptance-"));
  const summaryOutput = { pptx: path.join(directory, "summary.pptx"), preview: path.join(directory, "summary.png"), layout: path.join(directory, "summary.json") };
  await renderSummaryPage(summary, summaryOutput);
  const summaryLayout = JSON.parse(await fs.readFile(summaryOutput.layout, "utf8"));
  const icons = summaryLayout.elements.filter((element) => element.kind === "image");
  const body = summaryLayout.elements.filter((element) => ["orientation", "tension", "response", "support_1", "support_2", "decision_or_implication"].includes(element.name));
  assert.equal(icons.length, body.length);
  assert.ok(body.every((element) => element.resolvedTextStyle?.bold !== true));
  assert.ok(body.every((element) => !element.fillColor));
  for (let index = 0; index < icons.length; index += 1) {
    assert.ok(icons[index].bbox[0] + icons[index].bbox[2] < body[index].bbox[0]);
    assert.ok(Math.abs(icons[index].bbox[3] / body[index].resolvedFontSize - 1.5) < 0.02);
  }

  const fiveItems = [...agendaItems.items, { index: "05", label: "终局检验：结果与持续迭代" }];
  const fiveAgenda = { ...agenda, page_contract: { ...agenda.page_contract, visible_components: [component("title", "page_title", "目录"), { ...agendaItems, items: fiveItems }] } };
  const agendaOutput = { pptx: path.join(directory, "agenda.pptx"), preview: path.join(directory, "agenda.png"), layout: path.join(directory, "agenda.json") };
  await renderNavigationPage(fiveAgenda, agendaOutput);
  const agendaLayout = JSON.parse(await fs.readFile(agendaOutput.layout, "utf8"));
  for (let index = 1; index <= 5; index += 1) {
    const badge = agendaLayout.elements.find((element) => element.name === `agenda_items-index-${index}`);
    const label = agendaLayout.elements.find((element) => element.name === `agenda_items-label-${index}`);
    assert.ok(Math.abs(badge.bbox[3] / label.resolvedFontSize - 1.5) < 0.01);
    assert.ok(Math.abs((label.resolvedFontSize - badge.resolvedFontSize) / (4 / 3) - 3) < 0.01);
  }
});
