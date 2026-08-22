import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addChartLine,
  addContainer,
  addTextBox,
  createPresentation,
  exportPresentation,
  registerPeerGroupLayout,
} from "./pptx_core.mjs";
import { planNavigationPage } from "./plan_navigation_page.mjs";
import { planStructurePage } from "./plan_structure_page.mjs";
import { STRUCTURE_TYPE_SCALE } from "./structure_page_common.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const findRole = (components, role) => components.find((item) => item.role === role);
const findRoles = (components, roles) => components.filter((item) => roles.includes(item.role));

function renderBookend(slide, plan) {
  const components = plan.normalized.page_contract.visible_components;
  const theme = plan.theme;
  const rules = findRoles(components, ["structural_rule"]);
  const eyebrow = findRole(components, "eyebrow");
  const title = findRole(components, "page_title");
  const subtitle = findRole(components, "subtitle") ?? components.filter((item) => item.role === "page_title")[1];
  const metadata = components.filter((item) => ![...rules, eyebrow, title, subtitle].includes(item));
  if (rules[0]) addContainer(slide, { name: `${rules[0].id}-title-accent`, position: { left: 78, top: 128, width: 8, height: 322 }, fill: theme.accent, border: theme.accent, borderWidth: 0 });
  if (eyebrow) addTextBox(slide, { name: `${eyebrow.id}-brand-eyebrow`, text: eyebrow.text, position: { left: 118, top: 118, width: 700, height: 32 }, textRole: "body", fontSize: 14, bold: true, color: theme.accent, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (title) addTextBox(slide, { name: title.id, text: title.text, position: { left: 118, top: 172, width: 1010, height: 122 }, textRole: "pageTitle", fontSize: plan.pageType === "ending" ? STRUCTURE_TYPE_SCALE.endingTitle : STRUCTURE_TYPE_SCALE.coverTitle, bold: true, color: theme.text, maxLines: 2, minLastLineChars: 6, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (subtitle) addTextBox(slide, { name: subtitle.id, text: subtitle.text, position: { left: 118, top: 304, width: 990, height: 68 }, textRole: "pageSubtitle", fontSize: STRUCTURE_TYPE_SCALE.bookendSubtitle, color: theme.secondary, maxLines: 2, minLastLineChars: 6, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (rules[1]) addChartLine(slide, { name: rules[1].id, from: { x: 118, y: 407 }, to: { x: 745, y: 407 }, line: { style: "solid", fill: theme.rule, width: 1.2 } });
  metadata.slice(0, 3).forEach((item, index) => addTextBox(slide, { name: item.id, text: item.text, position: { left: 118, top: 430 + index * 38, width: 650, height: 28 }, fontSize: STRUCTURE_TYPE_SCALE.metadata, color: theme.secondary, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } }));
}

function normalizedPeerItems(components) {
  const direct = components.find((item) => Array.isArray(item.items));
  if (direct) return { component: direct, items: direct.items };
  const texts = components.filter((item) => ["main_message", "supporting_message"].includes(item.role)).flatMap((item) => String(item.text).split(new RegExp("[\\u003B\\uFF1B]", "u")));
  const items = texts.filter(Boolean).map((text, index) => {
    const parts = text.split(new RegExp("[\\u007C\\uFF5C]", "u"));
    return { index: String(index + 1).padStart(2, "0"), label: parts.slice(1).join(String.fromCodePoint(0xff5c)).trim() || text.trim() };
  });
  return { component: direct ?? components[components.length - 1], items };
}

function renderNavigation(slide, plan) {
  const contract = plan.normalized.page_contract;
  const components = contract.visible_components;
  const theme = plan.theme;
  const title = findRole(components, "page_title");
  if (title) addTextBox(slide, { name: title.id, text: title.text, position: { left: 62, top: 38, width: 760, height: 58 }, textRole: "pageTitle", fontSize: 34, bold: true, color: theme.text, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  const { component } = normalizedPeerItems(components);
  const navigation = plan.navigation;
  const rowMembers = Array.from({ length: navigation.rows }, () => []);
  navigation.items.forEach((item) => {
    const itemNumber = item.sourceIndex + 1;
    const indexName = `${component.id}-index-${itemNumber}`;
    const labelName = `${component.id}-label-${itemNumber}`;
    addTextBox(slide, { name: indexName, text: item.index, position: item.badgePosition, fontSize: navigation.numberFontSize, bold: true, color: theme.badgeText, alignment: "center", verticalAlignment: "middle", fill: theme.badge, line: { style: "solid", fill: theme.badge, width: 0 }, geometry: "ellipse", singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    addTextBox(slide, { name: labelName, text: item.label, position: item.labelPosition, fontSize: navigation.labelFontSize, bold: true, color: theme.text, singleLine: navigation.columns === 1, maxLines: navigation.columns === 1 ? 1 : 2, minLastLineChars: 4, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    rowMembers[item.row].push(labelName);
  });
  registerPeerGroupLayout({
    name: component.id,
    headingName: title?.id,
    rows: rowMembers,
    sparse: navigation.sparse,
    maximumSparseGap: 28,
    minimumHeadingGapRatio: 1.35,
    centerRange: [360, 430],
  });
  if (contract.page_type === "numbered_recap") addChartLine(slide, { name: "callback-rule", from: { x: 116, y: 626 }, to: { x: 978, y: 626 }, line: { style: "solid", fill: theme.accent, width: 2 } });
}

const SUMMARY_ICON_MAP = Object.freeze({
  "背景与方向": "compass",
  "风险与张力": "alert-triangle",
  "核心回应": "bulb",
  "关键支撑": "list-check",
  "决策落点": "target",
});

function flattenSummaryParagraphs(components) {
  return components.slice(1).flatMap((component) => Array.isArray(component.items) ? component.items : [component]);
}

async function addSummaryIcon(slide, item, position, color) {
  const iconId = SUMMARY_ICON_MAP[item.paragraph_leading_icon?.concept];
  if (!iconId) return false;
  const iconPath = path.join(scriptDir, "..", "assets", "icons", "tabler", "outline", `${iconId}.svg`);
  let svg;
  try { svg = await fs.readFile(iconPath, "utf8"); } catch (error) { if (error?.code === "ENOENT") return false; throw error; }
  svg = svg.replace(/currentColor/gu, color).replace(/stroke-width="2"/gu, 'stroke-width="1.25"');
  slide.images.add({ name: `${item.id}-paragraph-icon`, blob: new TextEncoder().encode(svg), contentType: "image/svg+xml", alt: item.paragraph_leading_icon.selection_reason, fit: "contain", position });
  return true;
}

async function renderSummary(slide, plan) {
  const contract = plan.normalized.page_contract;
  const components = contract.visible_components;
  const theme = plan.theme;
  const title = findRole(components, "page_title");
  if (title) addTextBox(slide, { name: title.id, text: title.text, position: { left: 62, top: 38, width: 1120, height: 58 }, textRole: "pageTitle", fontSize: 34, bold: true, color: theme.text, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  const paragraphs = flattenSummaryParagraphs(components);
  const bodyFontSize = STRUCTURE_TYPE_SCALE.summaryBody;
  const glyphHeight = bodyFontSize * 4 / 3;
  const iconRatio = Number(contract.layout_intent?.paragraph_icon_height_ratio ?? 1.5);
  const iconSize = Math.round(glyphHeight * Math.max(1.4, Math.min(1.6, iconRatio)) * 10) / 10;
  const iconOpticalLift = Math.round(glyphHeight * 0.1 * 10) / 10;
  const top = 126;
  const bottom = 628;
  const gap = paragraphs.length <= 5 ? 15 : 9;
  const rowHeight = (bottom - top - gap * (paragraphs.length - 1)) / paragraphs.length;
  const iconLeft = 78;
  const textLeft = 132;
  for (let index = 0; index < paragraphs.length; index += 1) {
    const item = paragraphs[index];
    const rowTop = top + index * (rowHeight + gap);
    const iconTop = rowTop + Math.max(0, (glyphHeight - iconSize) / 2) + 4 - iconOpticalLift;
    const hasIcon = await addSummaryIcon(slide, item, { left: iconLeft, top: iconTop, width: iconSize, height: iconSize }, theme.accent);
    addTextBox(slide, { name: item.id, text: item.text, position: { left: hasIcon ? textLeft : iconLeft, top: rowTop, width: hasIcon ? 980 : 1034, height: rowHeight }, fontSize: bodyFontSize, bold: false, color: theme.text, verticalAlignment: "top", maxLines: 3, minLastLineChars: 6, fill: "none", line: { style: "solid", fill: "none", width: 0 }, insets: { left: 0, right: 0, top: 4, bottom: 0 } });
  }
}

function renderTransition(slide, plan) {
  const components = plan.normalized.page_contract.visible_components;
  const theme = plan.theme;
  const number = findRole(components, "number_label") ?? components[0];
  const rule = findRole(components, "structural_rule");
  const title = findRoles(components, ["peer_label", "page_title"])[0];
  const guidance = findRole(components, "guidance") ?? components.find((item) => ![number, rule, title].includes(item));
  addTextBox(slide, { name: `${number.id}-title-accent`, text: number.text, position: { left: 92, top: 120, width: 300, height: 178 }, fontSize: STRUCTURE_TYPE_SCALE.transitionNumber, bold: true, color: theme.accent, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (rule) addChartLine(slide, { name: `${rule.id}-heading-rule`, from: { x: 98, y: 324 }, to: { x: 570, y: 324 }, line: { style: "solid", fill: theme.text, width: 3 } });
  if (title) addTextBox(slide, { name: title.id, text: title.text, position: { left: 98, top: 354, width: 780, height: 82 }, textRole: "pageTitle", fontSize: STRUCTURE_TYPE_SCALE.transitionTitle, bold: true, color: theme.text, singleLine: true, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (guidance) addTextBox(slide, { name: guidance.id, text: guidance.text, position: { left: 98, top: 458, width: 860, height: 56 }, textRole: "pageSubtitle", fontSize: STRUCTURE_TYPE_SCALE.transitionGuidance, color: theme.secondary, maxLines: 2, insets: { left: 0, right: 0, top: 0, bottom: 0 } });
}

export async function renderStructurePage(data, output, expectedModule) {
  const plan = expectedModule === "navigation-page" ? planNavigationPage(data) : planStructurePage(data, expectedModule);
  const { presentation, slide } = createPresentation(plan.theme.background);
  if (expectedModule === "bookend-page") renderBookend(slide, plan);
  else if (expectedModule === "summary-page") await renderSummary(slide, plan);
  else if (expectedModule === "navigation-page") renderNavigation(slide, plan);
  else renderTransition(slide, plan);
  await exportPresentation(presentation, output);
  return plan;
}
