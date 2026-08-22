import { resolveSemanticIcon } from "./resolve_semantic_icon.mjs";

const HANDOFF_STATUS = new Set(["requested", "none", "decorative_only", "blocked"]);
const SPEC_ROLES = new Set(["module", "object", "action", "state", "question", "support", "boundary"]);
const FALLBACKS = new Set(["text_only", "omit_icon", "ask"]);
const STYLES = new Set(["line", "filled", "user_specified"]);

const ROLE_MAP = Object.freeze({
  module: "object_identifier",
  object: "object_identifier",
  question: "object_identifier",
  support: "object_identifier",
  boundary: "status_marker",
  action: "action_marker",
  state: "status_marker",
});

const STYLE_MAP = Object.freeze({
  line: "outline",
  filled: "filled",
  user_specified: "outline",
});

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function sourceIds(item) {
  return Array.isArray(item?.source_ids) ? item.source_ids.filter((id) => text(id)) : [];
}

function targetId(item) {
  return text(item?.target_id) || null;
}

function validateRequestedItem(item, index) {
  if (!text(item?.concept)) fail("ICON_HANDOFF_INPUT_FAIL", `icon_handoff.items[${index}].concept is required`);
  if (!SPEC_ROLES.has(item?.role)) fail("ICON_ROLE_NOT_ALLOWED", `Unsupported icon_handoff role: ${item?.role ?? "missing"}`);
  if (!text(item?.peer_group)) fail("ICON_HANDOFF_INPUT_FAIL", `icon_handoff.items[${index}].peer_group is required`);
  if (typeof item?.required !== "boolean") fail("ICON_HANDOFF_INPUT_FAIL", `icon_handoff.items[${index}].required must be boolean`);
  if (!STYLES.has(item?.style)) fail("ICON_HANDOFF_INPUT_FAIL", `Unsupported icon_handoff style: ${item?.style ?? "missing"}`);
  if (!FALLBACKS.has(item?.fallback)) fail("ICON_HANDOFF_INPUT_FAIL", `Unsupported icon_handoff fallback: ${item?.fallback ?? "missing"}`);
  if (sourceIds(item).length === 0) fail("ICON_HANDOFF_INPUT_FAIL", `icon_handoff.items[${index}] must preserve source_ids`);
}

export function validateIconHandoff(iconHandoff) {
  if (!iconHandoff || typeof iconHandoff !== "object" || Array.isArray(iconHandoff)) {
    return { ok: true, status: "NO_ICON", reason: "ICON_HANDOFF_ABSENT", items: [] };
  }
  if (!HANDOFF_STATUS.has(iconHandoff.status)) fail("ICON_HANDOFF_STATUS_FAIL", `Unsupported icon_handoff.status: ${iconHandoff.status ?? "missing"}`);
  if (iconHandoff.status === "none") {
    return { ok: true, status: "NO_ICON", reason: "ICON_HANDOFF_NONE", items: [] };
  }
  if (iconHandoff.status === "decorative_only") {
    if (!text(iconHandoff.reason) && !text(iconHandoff.trigger_reason)) fail("ICON_HANDOFF_INPUT_FAIL", "decorative_only icon_handoff requires reason or trigger_reason");
    return { ok: true, status: "NO_ICON", reason: "DECORATIVE_ONLY", items: [] };
  }
  if (iconHandoff.status === "blocked") {
    if (!text(iconHandoff.reason)) fail("ICON_HANDOFF_INPUT_FAIL", "blocked icon_handoff requires reason");
    return { ok: true, status: "ICON_HANDOFF_UNSUPPORTED", reason: iconHandoff.reason, items: [] };
  }
  if (!text(iconHandoff.trigger_reason)) fail("ICON_HANDOFF_INPUT_FAIL", "requested icon_handoff requires trigger_reason");
  if (!Array.isArray(iconHandoff.items) || iconHandoff.items.length === 0) fail("ICON_HANDOFF_INPUT_FAIL", "requested icon_handoff requires items");
  if (iconHandoff.items.length > 6) fail("ICON_HANDOFF_INPUT_FAIL", "icon_handoff supports at most six items");
  const peerRules = new Map();
  iconHandoff.items.forEach((item, index) => {
    validateRequestedItem(item, index);
    const existing = peerRules.get(item.peer_group);
    const rule = `${item.role}|${item.style}`;
    if (existing && existing !== rule) fail("ICON_PEER_GROUP_INCONSISTENT", `icon_handoff peer_group ${item.peer_group} mixes role or style`);
    peerRules.set(item.peer_group, rule);
  });
  return { ok: true, status: "requested", trigger_reason: iconHandoff.trigger_reason, items: iconHandoff.items };
}

export async function resolveIconHandoff(iconHandoff) {
  const validation = validateIconHandoff(iconHandoff);
  if (validation.status !== "requested") return validation;
  const items = [];
  for (const [index, item] of validation.items.entries()) {
    const role = ROLE_MAP[item.role];
    const style = STYLE_MAP[item.style];
    const resolved = await resolveSemanticIcon({ concept: item.concept, role, style, icon_id: item.icon_id ?? null, limit: 3 });
    if (resolved.status === "ready") {
      items.push({
        index,
        status: "ready",
        concept: item.concept,
        source_ids: sourceIds(item),
        spec_role: item.role,
        one_slide_role: role,
        peer_group: item.peer_group,
        target_id: targetId(item),
        required: item.required,
        style: item.style,
        fallback: item.fallback,
        icon_id: resolved.selected.icon_id,
        asset_file: resolved.selected.asset_file,
        selection_reason: `icon_handoff ${item.role} mapped to ${role}; ${resolved.selected.matched_concept}`,
      });
      continue;
    }
    if (item.required && item.fallback === "ask") {
      fail("ICON_HANDOFF_UNSUPPORTED", `Required icon_handoff item cannot be resolved and fallback=ask: ${item.concept}`);
    }
    if (item.required && item.fallback === "omit_icon") {
      fail("ICON_REQUIRED_OMIT_FORBIDDEN", `Required icon_handoff item cannot use omit_icon fallback: ${item.concept}`);
    }
    items.push({
      index,
      status: item.fallback === "omit_icon" ? "omitted" : "fallback_text_only",
      concept: item.concept,
      source_ids: sourceIds(item),
      spec_role: item.role,
      one_slide_role: role,
      peer_group: item.peer_group,
      target_id: targetId(item),
      required: item.required,
      style: item.style,
      fallback: item.fallback,
      reason: resolved.reason ?? "NO_ICON",
    });
  }
  const readyCount = items.filter((item) => item.status === "ready").length;
  const missingRequired = items.filter((item) => item.required && item.status !== "ready");
  return {
    ok: true,
    status: missingRequired.length ? "resolved_with_fallback" : "ready",
    trigger_reason: validation.trigger_reason,
    ready_count: readyCount,
    item_count: items.length,
    items,
  };
}
