import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { requireCondition } from "./source_fidelity.mjs";

export const STRUCTURE_MODULE_TYPES = Object.freeze({
  "bookend-page": new Set(["cover", "ending"]),
  "summary-page": new Set(["summary"]),
  "navigation-page": new Set(["agenda", "numbered_overview", "numbered_recap"]),
  "section-transition": new Set(["section_transition"]),
});

export const STRUCTURE_THEMES = Object.freeze({
  light: Object.freeze({ background: "#FFFFFF", text: "#15375F", secondary: "#697386", accent: "#2F8F6B", rule: "#D7DEE8", badge: "#15375F", badgeText: "#FFFFFF" }),
  navy: Object.freeze({ background: "#15375F", text: "#FFFFFF", secondary: "#B9C8D9", accent: "#E8872D", rule: "#6380A0", badge: "#FFFFFF", badgeText: "#15375F" }),
  inherit_template: Object.freeze({ background: "#FFFFFF", text: "#15375F", secondary: "#697386", accent: "#2F8F6B", rule: "#D7DEE8", badge: "#15375F", badgeText: "#FFFFFF" }),
});

export const STRUCTURE_TYPE_SCALE = Object.freeze({
  coverTitle: 46,
  endingTitle: 42,
  bookendSubtitle: 21,
  metadata: 15,
  navigationIndex: 17,
  navigationIndexDense: 14,
  navigationLabelDense: 19,
  navigationLabel: 22,
  navigationLabelCompact: 16,
  summaryBody: 16,
  transitionNumber: 104,
  transitionTitle: 42,
  transitionGuidance: 20,
});

const fail = (condition, code, message) => requireCondition(condition, code, message);
const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s_\-：:、，,；;（）()“”"']/gu, "");

export function moduleForPageType(pageType) {
  for (const [moduleId, types] of Object.entries(STRUCTURE_MODULE_TYPES)) if (types.has(pageType)) return moduleId;
  return null;
}

export function validateStructurePage(data, expectedModule) {
  fail(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported structure-page version");
  fail(data?.module_id === expectedModule, "LOGIC_STRUCTURE_FAIL", `Expected ${expectedModule} module_id`);
  const contract = data?.page_contract;
  fail(contract && typeof contract === "object", "DATA_CONTRACT_FAIL", "page_contract is required");
  fail(STRUCTURE_MODULE_TYPES[expectedModule]?.has(contract.page_type), "DATA_CONTRACT_FAIL", `${contract?.page_type ?? "missing page_type"} does not belong to ${expectedModule}`);
  fail(Object.hasOwn(STRUCTURE_THEMES, data.theme), "DATA_CONTRACT_FAIL", "theme must be light, navy, or inherit_template");
  fail(typeof contract.page_job === "string" && contract.page_job.trim(), "MISSING_REQUIRED_COMPONENT_FAIL", "page_job is required");
  fail(typeof contract.central_message === "string" && contract.central_message.trim(), "MISSING_REQUIRED_COMPONENT_FAIL", "central_message is required");
  fail(Array.isArray(contract.visible_components) && contract.visible_components.length > 0, "MISSING_REQUIRED_COMPONENT_FAIL", "visible_components must be a non-empty exhaustive allowlist");
  fail(Array.isArray(contract.forbidden_components), "DATA_CONTRACT_FAIL", "forbidden_components must be an array");
  fail(Array.isArray(contract.peer_groups), "DATA_CONTRACT_FAIL", "peer_groups must be an array");
  const ids = new Set();
  const forbidden = new Set(contract.forbidden_components.map(normalize));
  for (const component of contract.visible_components) {
    fail(typeof component.id === "string" && component.id.trim() && !ids.has(component.id), "UNDECLARED_COMPONENT_FAIL", "Every visible component needs a unique id");
    ids.add(component.id);
    fail(component.required === true, "MISSING_REQUIRED_COMPONENT_FAIL", `${component.id} must be required in a structure-page allowlist`);
    fail(Boolean(component.text || (Array.isArray(component.items) && component.items.length)), "MISSING_REQUIRED_COMPONENT_FAIL", `${component.id} has no visible content`);
    fail(!forbidden.has(normalize(component.id)) && !forbidden.has(normalize(component.role)), "UNDECLARED_COMPONENT_FAIL", `${component.id} conflicts with forbidden_components`);
    if (["number_label", "eyebrow"].includes(component.role)) {
      fail(!String(component.text ?? "").includes("\n") && String(component.text ?? "").length <= 24, "SHORT_LABEL_WRAP_FAIL", `${component.id} must remain a short single-line label`);
    }
    if (Array.isArray(component.items)) {
      const maximumItems = expectedModule === "navigation-page" ? 18 : 6;
      fail(component.items.length >= 2 && component.items.length <= maximumItems, "SINGLE_SLIDE_SCOPE_OVERLOAD", `${component.id} needs 2-${maximumItems} peer items`);
      if (expectedModule === "navigation-page") for (const item of component.items) {
        fail(typeof item.index === "string" && !item.index.includes("\n") && item.index.length <= 4, "SHORT_LABEL_WRAP_FAIL", "Peer indices must remain single-line short labels");
        fail(typeof item.label === "string" && item.label.trim(), "MISSING_REQUIRED_COMPONENT_FAIL", "Every peer item needs a label");
      }
    }
  }
  for (const group of contract.peer_groups) {
    fail(ids.has(group.component_id), "PEER_GEOMETRY_INCONSISTENCY_FAIL", `Peer group ${group.component_id} is not a visible component`);
    fail(group.default_behavior === "homogeneous" || Boolean(group.allowed_emphasis), "UNAUTHORIZED_PEER_EMPHASIS_FAIL", "Peer groups default to homogeneous unless emphasis is explicitly authorized");
    if (group.allowed_emphasis) {
      fail(group.allowed_emphasis.target && group.allowed_emphasis.reason && group.allowed_emphasis.method, "UNAUTHORIZED_PEER_EMPHASIS_FAIL", "Authorized emphasis needs target, reason, and method");
    }
    if (group.layout_policy?.columns !== undefined) {
      fail([1, 2, 3].includes(group.layout_policy.columns), "PEER_GROUP_LAYOUT_POLICY_FAIL", "Peer-group columns must be 1, 2, or 3");
    }
  }
  if (expectedModule === "navigation-page") {
    const itemComponents = contract.visible_components.filter((component) => Array.isArray(component.items));
    fail(itemComponents.length === 1, "PEER_GROUP_DECLARATION_FAIL", "Navigation pages need exactly one declared peer-item component");
    fail(contract.peer_groups.some((group) => group.component_id === itemComponents[0].id), "PEER_GROUP_DECLARATION_FAIL", "Navigation peer items must be declared in peer_groups");
  }
  if (expectedModule === "summary-page") {
    fail(Boolean(contract.summary_narrative), "SUMMARY_NARRATIVE_FAIL", "summary-page needs summary_narrative");
    const paragraphComponents = contract.visible_components.slice(1).flatMap((component) => Array.isArray(component.items) ? component.items : [component]);
    fail(paragraphComponents.length >= 4 && paragraphComponents.length <= 8, "SINGLE_SLIDE_SCOPE_OVERLOAD", "summary-page needs 4-8 visible paragraph units");
    for (const component of paragraphComponents) {
      const icon = component.paragraph_leading_icon;
      fail(icon?.enabled === true && icon.role === "summary_paragraph_marker" && icon.component_id === component.id, "SUMMARY_PARAGRAPH_ICON_FAIL", `${component.id} needs a linked summary paragraph icon`);
    }
    const intent = contract.layout_intent ?? {};
    fail(intent.paragraph_icon_position === "leading_left", "SUMMARY_PARAGRAPH_ICON_FAIL", "summary icons must use a leading-left slot");
    fail(Number(intent.paragraph_icon_height_ratio) >= 1.4 && Number(intent.paragraph_icon_height_ratio) <= 1.6, "SUMMARY_PARAGRAPH_ICON_FAIL", "summary icon ratio must be 1.4-1.6");
    fail(intent.paragraph_icon_align === "optical_center_with_first_line", "SUMMARY_PARAGRAPH_ICON_FAIL", "summary icons must optically center with the first line");
  }
  if (expectedModule === "navigation-page" && contract.page_type === "agenda") {
    const intent = contract.layout_intent ?? {};
    const ratio = Number(intent.number_container_height_ratio ?? 1.5);
    const delta = Number(intent.number_font_delta_pt ?? -3);
    const alignment = intent.number_alignment ?? "optical_center_with_first_line";
    fail(ratio === 1.5, "AGENDA_NUMBER_SCALE_FAIL", "agenda number container ratio must be 1.5");
    fail(delta >= -4 && delta <= -2, "AGENDA_NUMBER_SCALE_FAIL", "agenda number font delta must be -4 to -2pt");
    fail(alignment === "optical_center_with_first_line", "AGENDA_NUMBER_ALIGNMENT_FAIL", "agenda numbers must optically center with the label first line");
  }
  if (contract.layout_intent?.group_translation === "relative_only") {
    fail(contract.layout_intent.must_not_center === true, "RELATIVE_LAYOUT_INTENT_FAIL", "Relative translation must preserve horizontal non-centering when the contract forbids it; vertical optical centering remains allowed");
  }
  if (contract.page_type === "numbered_recap") {
    fail(Boolean(data.deck_context?.callback_to), "DECK_CALLBACK_FAIL", "numbered_recap needs deck_context.callback_to");
  }
  return { ok: true, module_id: expectedModule, normalized: data };
}

export async function loadStructureInput(inputPath, expectedModule) {
  return validateStructurePage(JSON.parse(await fs.readFile(inputPath, "utf8")), expectedModule).normalized;
}

export function runValidatorCli(expectedModule) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error(`Usage: validate_${expectedModule.replaceAll("-", "_")}.mjs <input.json>`);
  return fs.readFile(inputPath, "utf8").then((text) => validateStructurePage(JSON.parse(text), expectedModule));
}

export function isDirectRun(metaUrl) {
  return process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;
}
