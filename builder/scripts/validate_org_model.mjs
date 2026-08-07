import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const NODE_KINDS = new Set(["org_unit", "position", "person"]);
const RELATION_KINDS = new Set(["primary_reporting", "functional_guidance", "temporary_membership"]);
const OVERLAY_TYPES = new Set(["placement_evidence", "node_risk_encoding", "hybrid_interface_overlay"]);
const HYBRID_FORMS = new Set(["functional", "divisional", "matrix", "platform", "legal_entity"]);

export class OrgModelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function need(condition, code, message, details = {}) {
  if (!condition) throw new OrgModelError(code, message, details);
}

function requireText(value, field) {
  need(typeof value === "string" && value.trim(), "ORG_MODEL_INVALID", `${field} is required`, { field });
}

function requireNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  need(Number.isFinite(value) && value >= min && value <= max, "ORG_OVERLAY_FORMAT_INVALID", `${field} must be a finite number`, {
    field, value: value ?? null, min, max,
  });
}

function requireBoolean(value, field) {
  need(typeof value === "boolean", "ORG_OVERLAY_FORMAT_INVALID", `${field} must be boolean`, { field, value: value ?? null });
}

function normalizeOverlayInput(input) {
  if (input == null) return [];
  const rawOverlays = Array.isArray(input) ? input : Array.isArray(input?.overlays) ? input.overlays : [input];
  need(rawOverlays.every((item) => item && typeof item === "object" && !Array.isArray(item)), "ORG_OVERLAY_FORMAT_INVALID", "Overlay input must be an object or array");
  const overlays = rawOverlays.map((item) => ({
    ...item,
    type: item.type ?? (item.formal_relationship_source && item.zones && item.interfaces ? "hybrid_interface_overlay" : undefined),
  }));
  const types = new Set();
  for (const overlay of overlays) {
    need(OVERLAY_TYPES.has(overlay.type), "ORG_OVERLAY_TYPE_UNSUPPORTED", `Unsupported overlay type: ${overlay.type}`, { type: overlay.type ?? null });
    need(!types.has(overlay.type), "ORG_OVERLAY_DUPLICATE", `Duplicate overlay type: ${overlay.type}`, { type: overlay.type });
    types.add(overlay.type);
  }
  return overlays;
}

function requireNodeRefs(nodeIds, refs, field) {
  need(Array.isArray(refs) && refs.length > 0, "ORG_OVERLAY_FORMAT_INVALID", `${field} must contain node IDs`, { field });
  const seen = new Set();
  for (const id of refs) {
    requireText(id, field);
    need(nodeIds.has(id), "ORG_OVERLAY_REFERENCE_NOT_FOUND", `${field} references unknown node: ${id}`, { field, nodeId: id });
    need(!seen.has(id), "ORG_OVERLAY_REFERENCE_DUPLICATE", `${field} repeats node: ${id}`, { field, nodeId: id });
    seen.add(id);
  }
}

function validatePlacementOverlay(overlay, nodeIds) {
  need(Array.isArray(overlay.placements) && overlay.placements.length > 0, "ORG_OVERLAY_FORMAT_INVALID", "placement_evidence.placements must be a non-empty array");
  const keys = new Set();
  for (const item of overlay.placements) {
    requireText(item?.placement_key, "placements[].placement_key");
    need(!keys.has(item.placement_key), "ORG_OVERLAY_ID_DUPLICATE", `Duplicate placement key: ${item.placement_key}`, { placementKey: item.placement_key });
    keys.add(item.placement_key);
    requireText(item.label, `${item.placement_key}.label`);
    requireNodeRefs(nodeIds, item.node_ids, `${item.placement_key}.node_ids`);
    requireNumber(item.authorization_score, `${item.placement_key}.authorization_score`, { min: 0, max: 10 });
    requireNumber(item.cycle_months, `${item.placement_key}.cycle_months`, { min: 0 });
    requireNumber(item.milestone_rate_pct, `${item.placement_key}.milestone_rate_pct`, { min: 0, max: 100 });
    if (item.resource_crowding != null) {
      need(item.resource_crowding && typeof item.resource_crowding === "object" && !Array.isArray(item.resource_crowding), "ORG_OVERLAY_FORMAT_INVALID", `${item.placement_key}.resource_crowding must be an object`);
      for (const [key, value] of Object.entries(item.resource_crowding)) requireNumber(value, `${item.placement_key}.resource_crowding.${key}`, { min: 0 });
    }
    need(Array.isArray(item.governance_conditions) && item.governance_conditions.length > 0, "ORG_OVERLAY_FORMAT_INVALID", `${item.placement_key}.governance_conditions must be a non-empty array`);
    item.governance_conditions.forEach((value, index) => requireText(value, `${item.placement_key}.governance_conditions[${index}]`));
  }
  if (overlay.shared_evidence != null) {
    const shared = overlay.shared_evidence;
    need(shared && typeof shared === "object" && !Array.isArray(shared), "ORG_OVERLAY_FORMAT_INVALID", "placement_evidence.shared_evidence must be an object");
    requireText(shared.scope_label, "shared_evidence.scope_label");
    requireNodeRefs(nodeIds, shared.node_ids, "shared_evidence.node_ids");
    requireNumber(shared.talent_reassigned_events, "shared_evidence.talent_reassigned_events", { min: 0 });
    requireNumber(shared.budget_withheld_pct, "shared_evidence.budget_withheld_pct", { min: 0, max: 100 });
    const duplicated = overlay.placements.filter((item) => item.resource_crowding != null).map((item) => item.placement_key);
    need(!duplicated.length, "ORG_OVERLAY_FORMULA_CONFLICT", "Shared resource evidence cannot be duplicated into placement records", { duplicatedPlacementKeys: duplicated });
  }
  return { type: overlay.type, placementKeys: [...keys].sort(), referencedNodeIds: [...new Set([
    ...overlay.placements.flatMap((item) => item.node_ids),
    ...(overlay.shared_evidence?.node_ids ?? []),
  ])].sort() };
}

function rounded(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateRiskOverlay(overlay, model, nodeIds) {
  requireNodeRefs(nodeIds, overlay.node_ids, "node_risk_encoding.node_ids");
  const rules = overlay.rules;
  need(rules && typeof rules === "object" && !Array.isArray(rules), "ORG_OVERLAY_FORMAT_INVALID", "node_risk_encoding.rules must be an object");
  requireNumber(rules.high_turnover_threshold_pct, "rules.high_turnover_threshold_pct", { min: 0, max: 100 });
  requireNumber(rules.key_role_dense_min_count, "rules.key_role_dense_min_count", { min: 0 });
  requireNumber(rules.key_role_dense_min_pct, "rules.key_role_dense_min_pct", { min: 0, max: 100 });
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const computed = [];
  for (const id of overlay.node_ids) {
    const attrs = nodeById.get(id).attributes;
    need(attrs && typeof attrs === "object" && !Array.isArray(attrs), "ORG_OVERLAY_FORMAT_INVALID", `${id}.attributes are required for node risk encoding`, { nodeId: id });
    requireNumber(attrs.headcount, `${id}.attributes.headcount`, { min: 0 });
    requireNumber(attrs.turnover_rate_pct, `${id}.attributes.turnover_rate_pct`, { min: 0, max: 100 });
    requireNumber(attrs.key_role_count, `${id}.attributes.key_role_count`, { min: 0 });
    requireNumber(attrs.key_roles_with_successor, `${id}.attributes.key_roles_with_successor`, { min: 0 });
    need(attrs.key_roles_with_successor <= attrs.key_role_count, "ORG_OVERLAY_FORMULA_CONFLICT", `${id} has more successors than key roles`, { nodeId: id });
    requireBoolean(attrs.manager_tenure_lt_6m, `${id}.attributes.manager_tenure_lt_6m`);
    const successorGap = attrs.key_roles_with_successor < attrs.key_role_count;
    const densityPct = attrs.headcount === 0 ? 0 : attrs.key_role_count / attrs.headcount * 100;
    const keyRoleDense = attrs.key_role_count >= rules.key_role_dense_min_count && densityPct >= rules.key_role_dense_min_pct;
    const highTurnover = attrs.turnover_rate_pct > rules.high_turnover_threshold_pct;
    const triple = highTurnover && successorGap && keyRoleDense;
    for (const [field, expected] of [
      ["has_unsucceeded_key_role", successorGap],
      ["key_role_dense", keyRoleDense],
      ["triple_breakpoint", triple],
    ]) {
      if (field in attrs) {
        requireBoolean(attrs[field], `${id}.attributes.${field}`);
        need(attrs[field] === expected, "ORG_OVERLAY_FORMULA_CONFLICT", `${id}.${field} conflicts with recomputed business rule`, {
          nodeId: id, field, supplied: attrs[field], recomputed: expected,
        });
      }
    }
    computed.push({ nodeId: id, headcount: attrs.headcount, turnoverRatePct: attrs.turnover_rate_pct, keyRoleCount: attrs.key_role_count, successorGap, keyRoleDense, newManager: attrs.manager_tenure_lt_6m, highTurnover, tripleBreakpoint: triple });
  }
  const summary = {
    nodeCount: computed.length,
    headcount: computed.reduce((sum, item) => sum + item.headcount, 0),
    weightedTurnoverRatePct: rounded(computed.reduce((sum, item) => sum + item.headcount * item.turnoverRatePct, 0) / computed.reduce((sum, item) => sum + item.headcount, 0), 1),
    highTurnoverCount: computed.filter((item) => item.highTurnover).length,
    tripleBreakpointCount: computed.filter((item) => item.tripleBreakpoint).length,
    tripleHeadcount: computed.filter((item) => item.tripleBreakpoint).reduce((sum, item) => sum + item.headcount, 0),
    tripleKeyRoleCount: computed.filter((item) => item.tripleBreakpoint).reduce((sum, item) => sum + item.keyRoleCount, 0),
  };
  for (const [field, expected] of Object.entries(overlay.expected_summary ?? {})) {
    need(field in summary && summary[field] === expected, "ORG_OVERLAY_FORMULA_CONFLICT", `expected_summary.${field} conflicts with recomputed value`, { field, supplied: expected, recomputed: summary[field] ?? null });
  }
  return { type: overlay.type, referencedNodeIds: [...overlay.node_ids].sort(), computed, summary };
}

function validateHybridOverlay(overlay, nodeIds) {
  const forbidden = ["nodes", "relationships", "primary_reporting", "functional_guidance"].filter((field) => field in overlay);
  need(forbidden.length === 0, "ORG_OVERLAY_DOUBLE_TRUTH", "Hybrid overlay cannot define formal nodes or relationships", { forbidden });
  need(overlay.formal_relationship_source === "data/org-model.json", "ORG_OVERLAY_DOUBLE_TRUTH", "formal_relationship_source must point to data/org-model.json", { value: overlay.formal_relationship_source ?? null });
  need(Array.isArray(overlay.zones) && overlay.zones.length > 0, "ORG_OVERLAY_FORMAT_INVALID", "hybrid_interface_overlay.zones must be a non-empty array");
  need(Array.isArray(overlay.interfaces) && overlay.interfaces.length > 0, "ORG_OVERLAY_FORMAT_INVALID", "hybrid_interface_overlay.interfaces must be a non-empty array");
  const zoneIds = new Set();
  const forms = new Set();
  const referencedNodeIds = new Set();
  for (const zone of overlay.zones) {
    requireText(zone?.zone_id, "zones[].zone_id");
    need(!zoneIds.has(zone.zone_id), "ORG_OVERLAY_ID_DUPLICATE", `Duplicate zone id: ${zone.zone_id}`, { zoneId: zone.zone_id });
    zoneIds.add(zone.zone_id);
    requireText(zone.label, `${zone.zone_id}.label`);
    need(HYBRID_FORMS.has(zone.form), "ORG_OVERLAY_FORMAT_INVALID", `Unsupported hybrid form: ${zone.form}`, { zoneId: zone.zone_id, form: zone.form ?? null });
    forms.add(zone.form);
    requireNodeRefs(nodeIds, zone.member_node_ids, `${zone.zone_id}.member_node_ids`);
    zone.member_node_ids.forEach((id) => referencedNodeIds.add(id));
    if (zone.unit_count != null) requireNumber(zone.unit_count, `${zone.zone_id}.unit_count`, { min: 0 });
    requireNumber(zone.headcount, `${zone.zone_id}.headcount`, { min: 0 });
    requireText(zone.headcount_scope, `${zone.zone_id}.headcount_scope`);
  }
  const interfaceIds = new Set();
  let documented = 0;
  for (const item of overlay.interfaces) {
    requireText(item?.interface_id, "interfaces[].interface_id");
    need(!interfaceIds.has(item.interface_id), "ORG_OVERLAY_ID_DUPLICATE", `Duplicate interface id: ${item.interface_id}`, { interfaceId: item.interface_id });
    interfaceIds.add(item.interface_id);
    requireNodeRefs(nodeIds, [item.from_node, item.to_node], `${item.interface_id}.endpoints`);
    need(item.from_node !== item.to_node, "ORG_OVERLAY_FORMAT_INVALID", `${item.interface_id} endpoints must differ`);
    referencedNodeIds.add(item.from_node);
    referencedNodeIds.add(item.to_node);
    need(["missing", "documented"].includes(item.rule_status), "ORG_OVERLAY_FORMAT_INVALID", `${item.interface_id}.rule_status is invalid`);
    const expectedMarker = item.rule_status === "missing" ? "warm_triangle" : "diamond";
    need(item.marker === expectedMarker, "ORG_OVERLAY_FORMULA_CONFLICT", `${item.interface_id}.marker conflicts with rule status`, { supplied: item.marker ?? null, recomputed: expectedMarker });
    requireNumber(item.annual_events, `${item.interface_id}.annual_events`, { min: 0 });
    documented += Number(item.rule_status === "documented");
  }
  const summary = { zoneCount: zoneIds.size, formCount: forms.size, interfaceCount: interfaceIds.size, documentedRuleCount: documented, missingRuleCount: interfaceIds.size - documented };
  const reconciliation = overlay.reconciliation ?? {};
  for (const [field, computed] of [["interface_count", summary.interfaceCount], ["documented_rule_count", summary.documentedRuleCount], ["missing_rule_count", summary.missingRuleCount]]) {
    if (field in reconciliation) need(reconciliation[field] === computed, "ORG_OVERLAY_FORMULA_CONFLICT", `reconciliation.${field} conflicts with recomputed value`, { field, supplied: reconciliation[field], recomputed: computed });
  }
  return { type: overlay.type, referencedNodeIds: [...referencedNodeIds].sort(), zoneIds: [...zoneIds].sort(), interfaceIds: [...interfaceIds].sort(), summary };
}

export function validateOrgOverlays(model, overlayInput) {
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const overlays = normalizeOverlayInput(overlayInput);
  const results = overlays.map((overlay) => {
    if (overlay.type === "placement_evidence") return validatePlacementOverlay(overlay, nodeIds);
    if (overlay.type === "node_risk_encoding") return validateRiskOverlay(overlay, model, nodeIds);
    return validateHybridOverlay(overlay, nodeIds);
  });
  return { overlays, results, types: results.map((item) => item.type) };
}

function addId(id, kind, ids) {
  requireText(id, `${kind}.id`);
  need(!ids.has(id), "ORG_ID_DUPLICATE", `Duplicate ${kind} id: ${id}`, { id, kind });
  ids.add(id);
}

function requireSources(item, visibleId, anchors) {
  const sourceIds = item?.source_ids;
  const undeclared = Array.isArray(sourceIds) ? sourceIds.filter((id) => !anchors.has(id)) : [];
  need(
    Array.isArray(sourceIds) && sourceIds.length > 0 && undeclared.length === 0,
    "ORG_SOURCE_ANCHOR_MISSING",
    `${visibleId} requires declared source anchors`,
    { visibleId, sourceIds: undeclared.length ? undeclared : sourceIds ?? null },
  );
}

function requireReference(ids, id, relationshipId, endpoint) {
  need(ids.has(id), "ORG_REFERENCE_NOT_FOUND", `${relationshipId} ${endpoint} not found: ${id}`, {
    relationshipId, endpoint, id,
  });
}

function requireAcyclic(primary, nodeIds) {
  const children = new Map([...nodeIds].map((id) => [id, []]));
  for (const { source, target } of primary) children.get(source).push(target);
  const active = new Set();
  const done = new Set();
  const visit = (id, path) => {
    if (active.has(id)) {
      const cycle = [...path.slice(path.indexOf(id)), id];
      throw new OrgModelError("ORG_REPORTING_CYCLE", `Primary reporting cycle: ${cycle.join(" -> ")}`, { cycle });
    }
    if (done.has(id)) return;
    active.add(id);
    for (const child of children.get(id)) visit(child, [...path, id]);
    active.delete(id);
    done.add(id);
  };
  for (const id of nodeIds) visit(id, []);
}

export function validateOrgModel(model, options = {}) {
  need(model && typeof model === "object" && !Array.isArray(model), "ORG_MODEL_INVALID", "Model must be an object");
  need(model.version === "0.1", "ORG_VERSION_UNSUPPORTED", "Version must be 0.1", { version: model.version ?? null });
  for (const field of ["nodes", "relationships", "temporary_groups", "source_anchors"]) {
    need(Array.isArray(model[field]), "ORG_MODEL_INVALID", `${field} must be an array`, { field });
  }

  const anchorIds = new Set();
  for (const anchor of model.source_anchors) {
    addId(anchor?.id, "source anchor", anchorIds);
    requireText(anchor?.text, `source_anchors.${anchor.id}.text`);
  }
  const visibleIds = [];
  const sourced = (item, id) => {
    requireSources(item, id, anchorIds);
    visibleIds.push(id);
  };
  requireText(model.title?.text, "title.text");
  sourced(model.title, "title");

  const entityIds = new Set();
  const nodeIds = new Set();
  for (const node of model.nodes) {
    addId(node?.id, "node", entityIds);
    nodeIds.add(node.id);
    requireText(node?.label, `nodes.${node.id}.label`);
    need(NODE_KINDS.has(node?.kind), "ORG_NODE_KIND_UNSUPPORTED", `Unsupported node kind: ${node?.kind}`, {
      id: node.id, kind: node?.kind ?? null,
    });
    sourced(node, `node:${node.id}`);
  }

  const groupIds = new Set();
  const groupMembers = new Map();
  for (const group of model.temporary_groups) {
    addId(group?.id, "temporary group", entityIds);
    groupIds.add(group.id);
    requireText(group?.label, `temporary_groups.${group.id}.label`);
    need(group?.type === "temporary_team", "ORG_MODEL_INVALID", `Unsupported temporary group: ${group?.type}`);
    need(Array.isArray(group.members), "ORG_MODEL_INVALID", `${group.id}.members must be an array`);
    sourced(group, `temporary_group:${group.id}`);
    const { start, end } = group.validity ?? {};
    need(start == null || end == null || start <= end, "ORG_VALIDITY_CONFLICT", `${group.id} validity conflicts`, {
      id: group.id, start: start ?? null, end: end ?? null,
    });
    const members = new Set();
    for (const [index, member] of group.members.entries()) {
      const extra = Object.keys(member ?? {}).filter((key) => !["node_id", "source_ids"].includes(key));
      need(!extra.length, "ORG_TEMPORARY_MEMBER_CLONE", `${group.id} member must be a node reference`, {
        groupId: group.id, index, fields: extra,
      });
      requireText(member?.node_id, `${group.id}.members.${index}.node_id`);
      requireReference(nodeIds, member.node_id, group.id, `member[${index}]`);
      sourced(member, `temporary_member:${group.id}:${member.node_id}`);
      members.add(member.node_id);
    }
    groupMembers.set(group.id, members);
  }

  const relationshipIds = new Set();
  const keys = new Set();
  const formalPairs = new Map();
  const parents = new Map();
  const primary = [];
  for (const relation of model.relationships) {
    addId(relation?.id, "relationship", relationshipIds);
    requireText(relation?.source, `${relation.id}.source`);
    requireText(relation?.target, `${relation.id}.target`);
    need(RELATION_KINDS.has(relation?.type), "ORG_RELATION_KIND_UNSUPPORTED", `Unsupported relationship: ${relation?.type}`, {
      id: relation.id, type: relation?.type ?? null,
    });
    sourced(relation, `relationship:${relation.id}`);
    if (relation.type === "temporary_membership") {
      requireReference(nodeIds, relation.source, relation.id, "source");
      requireReference(groupIds, relation.target, relation.id, "target temporary group");
      need(groupMembers.get(relation.target).has(relation.source), "ORG_REFERENCE_NOT_FOUND", `${relation.id} member is undeclared`, {
        relationshipId: relation.id, nodeId: relation.source, groupId: relation.target,
      });
    } else {
      requireReference(nodeIds, relation.source, relation.id, "source");
      requireReference(nodeIds, relation.target, relation.id, "target");
    }
    const key = `${relation.type}\u0000${relation.source}\u0000${relation.target}`;
    need(!keys.has(key), "ORG_RELATION_DUPLICATE", `Duplicate relationship: ${relation.id}`, { id: relation.id });
    keys.add(key);
    if (relation.type !== "temporary_membership") {
      const pair = `${relation.source}\u0000${relation.target}`;
      const prior = formalPairs.get(pair);
      need(!prior || prior === relation.type, "ORG_RELATION_DUPLICATE", `Primary-functional duplicate: ${relation.id}`, {
        id: relation.id, prior, type: relation.type,
      });
      formalPairs.set(pair, relation.type);
    }
    if (relation.type === "primary_reporting") {
      const prior = parents.get(relation.target);
      need(!prior, "ORG_PRIMARY_PARENT_CONFLICT", `${relation.target} has two primary parents`, {
        target: relation.target, relationshipIds: [prior, relation.id],
      });
      parents.set(relation.target, relation.id);
      primary.push(relation);
    }
  }
  requireAcyclic(primary, nodeIds);
  const overlayValidation = validateOrgOverlays(model, options.overlays ?? options.overlay);
  return {
    model,
    nodeIds: [...nodeIds].sort(),
    relationshipIds: [...relationshipIds].sort(),
    sourceCoverage: { visible: visibleIds.length, mapped: visibleIds.length, missingIds: [] },
    warnings: [],
    overlays: overlayValidation.results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const index = args.indexOf("--input");
    need(index >= 0 && args[index + 1], "ORG_INPUT_INVALID", "Usage: validate_org_model.mjs --input <file>", { args });
    const model = JSON.parse(await readFile(args[index + 1], "utf8"));
    const overlayIndex = args.indexOf("--overlay");
    const overlay = overlayIndex >= 0 && args[overlayIndex + 1]
      ? JSON.parse(await readFile(args[overlayIndex + 1], "utf8"))
      : undefined;
    process.stdout.write(`${JSON.stringify(validateOrgModel(model, { overlay }))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      code: error.code ?? "ORG_INPUT_INVALID", message: error.message, details: error.details ?? {},
    })}\n`);
    process.exitCode = 2;
  }
}
