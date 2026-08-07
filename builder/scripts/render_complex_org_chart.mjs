import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { validateOrgModel, validateOrgOverlays } from "./validate_org_model.mjs";

const execFileAsync = promisify(execFile);

const BOX = { width: 140, height: 38 };
const NESTED_BOX = { width: 150, height: 42 };

function descendantCount(id, children) {
  return (children.get(id) ?? []).reduce((sum, child) => sum + 1 + descendantCount(child, children), 0);
}

function place(plan, model, id, position, localMode, fontSize = 14) {
  const source = model.nodes.find((node) => node.id === id);
  plan.set(id, { id, text: source.label, kind: source.kind, ...position, localMode, fontSize });
}

function primaryTree(model) {
  const primary = model.relationships.filter((item) => item.type === "primary_reporting");
  const children = new Map(model.nodes.map((node) => [node.id, []]));
  const parented = new Set();
  for (const relation of primary) {
    children.get(relation.source).push(relation.target);
    parented.add(relation.target);
  }
  const roots = model.nodes.map((node) => node.id).filter((id) => !parented.has(id));
  if (roots.length !== 1) throw Object.assign(new Error("Organization chart requires one formal root"), { code: "ORG_ROOT_CONFLICT" });
  return { root: roots[0], children };
}

function balancedFunctionalGridShape(model, root, children) {
  const topLevel = children.get(root) ?? [];
  if (topLevel.length < 3 || topLevel.length > 6 || (model.temporary_groups ?? []).length) return null;
  const leafByParent = new Map();
  for (const parentId of topLevel) {
    const branchChildren = children.get(parentId) ?? [];
    if (branchChildren.length !== 1) return null;
    const leafId = branchChildren[0];
    if ((children.get(leafId) ?? []).length) return null;
    leafByParent.set(parentId, leafId);
  }
  const leafIds = new Set(leafByParent.values());
  const outgoing = new Map([...leafIds].map((id) => [id, 0]));
  const incoming = new Map([...leafIds].map((id) => [id, 0]));
  const functionalRelations = model.relationships.filter((item) => item.type === "functional_guidance");
  for (const relation of functionalRelations) {
    if (!leafIds.has(relation.source) || !leafIds.has(relation.target)) continue;
    outgoing.set(relation.source, outgoing.get(relation.source) + 1);
    incoming.set(relation.target, incoming.get(relation.target) + 1);
  }
  const mixedDirectionNode = [...leafIds].find((id) => outgoing.get(id) > 0 && incoming.get(id) > 0);
  if (functionalRelations.length > 1 && mixedDirectionNode) {
    throw Object.assign(new Error(`Functional guidance direction needs separate lanes or upstream confirmation: ${mixedDirectionNode}`), { code: "ORG_FUNCTIONAL_ROUTE_AMBIGUOUS" });
  }
  const laneSources = new Set([...leafIds].filter((id) => outgoing.get(id) >= 2 && incoming.get(id) === 0));
  return { topLevel, leafByParent, leafIds: [...leafIds], laneSources };
}

function planBalancedFunctionalGridNodes(model, root, children, grid) {
  const placed = new Map();
  place(placed, model, root, { left: 540, top: 112, width: 200, height: 42 }, "root", 18);
  const left = 60;
  const right = 1220;
  const parentWidth = 160;
  const childWidth = 170;
  const step = grid.topLevel.length === 1 ? 0 : (right - left - parentWidth) / (grid.topLevel.length - 1);
  const peerTop = 390;
  const laneSourceTop = 480;
  grid.topLevel.forEach((parentId, index) => {
    const parentLeft = left + index * step;
    const centerX = parentLeft + parentWidth / 2;
    place(placed, model, parentId, { left: parentLeft, top: 210, width: parentWidth, height: 44 }, "horizontal_band", 16);
    const childId = grid.leafByParent.get(parentId);
    place(placed, model, childId, {
      left: centerX - childWidth / 2,
      top: grid.laneSources.has(childId) ? laneSourceTop : peerTop,
      width: childWidth,
      height: BOX.height,
    }, grid.laneSources.has(childId) ? "functional_lane_source" : "aligned_leaf");
  });
  return {
    nodes: [...placed.values()],
    nodeMap: placed,
    root,
    topLevel: grid.topLevel,
    dense: null,
    denseChildren: [],
    children,
    balancedFunctionalGrid: true,
    alignedPeerIds: grid.leafIds.filter((id) => !grid.laneSources.has(id)),
    functionalLaneSourceIds: [...grid.laneSources],
  };
}

function placeFocusDescendants(plan, model, children, focusId) {
  const functionalTargets = new Set(model.relationships
    .filter((relation) => relation.type === "functional_guidance")
    .map((relation) => relation.target));
  const nested = (id, left, top, depth = 1, box = NESTED_BOX) => {
    place(plan, model, id, { left, top, ...box }, "nested_columns");
    let bottom = top + box.height;
    const descendants = children.get(id) ?? [];
    if (descendants.length === 1 && depth === 1) {
      const child = descendants[0];
      const horizontalOffset = functionalTargets.has(child) ? 195 : 155;
      return Math.max(bottom, nested(child, left + horizontalOffset, top + 8, depth + 1));
    }
    if (descendants.length === 1 && functionalTargets.has(id)) {
      return Math.max(bottom, nested(
        descendants[0],
        left - 45,
        bottom + 8,
        depth + 1,
        { width: 100, height: NESTED_BOX.height },
      ));
    }
    let childTop = bottom + 8;
    for (const child of descendants) {
      bottom = Math.max(bottom, nested(child, left + 10, childTop, depth + 1));
      childTop = bottom + 8;
    }
    return bottom;
  };
  let row = 255;
  for (const child of children.get(focusId) ?? []) row = nested(child, 230, row) + 8;
}

function planNodes(model) {
  const { root, children } = primaryTree(model);
  const balancedGrid = balancedFunctionalGridShape(model, root, children);
  if (balancedGrid) return planBalancedFunctionalGridNodes(model, root, children, balancedGrid);
  const temporaryMemberSources = new Set(model.relationships
    .filter((relation) => relation.type === "temporary_membership")
    .map((relation) => relation.source));
  const functionalSources = new Set(model.relationships
    .filter((relation) => relation.type === "functional_guidance")
    .map((relation) => relation.source));
  const placed = new Map();
  place(placed, model, root, { left: 520, top: 108, width: 200, height: 42 }, "root", 18);
  const top = children.get(root) ?? [];
  const dense = [...top].sort((a, b) => descendantCount(b, children) - descendantCount(a, children))[0];
  place(placed, model, dense, { left: 40, top: 185, width: 170, height: 44 }, "horizontal_band", 16);
  top.filter((id) => id !== dense).forEach((id, index) => {
    place(placed, model, id, { left: 675 + index * 150, top: 185, width: 130, height: 44 }, "horizontal_band", 16);
  });

  const denseChildren = children.get(dense) ?? [];
  denseChildren.forEach((id, index) => place(
    placed,
    model,
    id,
    { left: 50, top: 255 + index * 55, width: 170, height: BOX.height },
    "vertical_rail",
  ));
  const focus = [...denseChildren].sort((a, b) => descendantCount(b, children) - descendantCount(a, children))[0];
  if (focus) placeFocusDescendants(placed, model, children, focus);
  let spillY = 560;
  for (const branch of denseChildren.filter((id) => id !== focus)) {
    for (const child of children.get(branch) ?? []) {
      place(placed, model, child, { left: 230, top: spillY, ...BOX }, "nested_columns");
      spillY += 48;
    }
  }

  for (const branch of top.filter((id) => id !== dense)) {
    const branchBox = placed.get(branch);
    const branchChildCount = (children.get(branch) ?? []).length;
    const branchHasFunctionalSource = (children.get(branch) ?? [])
      .some((id) => functionalSources.has(id));
    let row = branchHasFunctionalSource ? 280 : 260;
    const branchChildren = [...(children.get(branch) ?? [])].sort((a, b) => (
      Number(temporaryMemberSources.has(a)) - Number(temporaryMemberSources.has(b))
    ));
    const queue = branchChildren.map((id) => ({ id, depth: 0 }));
    while (queue.length) {
      const item = queue.shift();
      place(placed, model, item.id, {
        left: branchBox.left + (branchChildCount > 1 ? 10 : 0) + Math.min(item.depth, 1) * 8,
        top: row,
        width: branchChildCount > 1 ? 130 : BOX.width,
        height: BOX.height,
      }, "nested_columns");
      row += 55;
      (children.get(item.id) ?? []).forEach((id) => queue.push({ id, depth: item.depth + 1 }));
    }
  }
  if (placed.size !== model.nodes.length) {
    throw Object.assign(new Error("Not every formal node could be placed"), { code: "ORG_CHART_FIT_FAIL" });
  }
  return { nodes: [...placed.values()], nodeMap: placed, root, topLevel: top, dense, denseChildren, children };
}

function baseTreeLayout(model, placed, root, children, topLevel) {
  return {
    nodes: [...placed.values()], nodeMap: placed, root, topLevel,
    dense: null, denseChildren: [], children,
  };
}

function planPlacementNodes(model) {
  const { root, children } = primaryTree(model);
  const placed = new Map();
  const rootChildren = children.get(root) ?? [];
  const operatingRoot = [...rootChildren]
    .sort((a, b) => (children.get(b) ?? []).length - (children.get(a) ?? []).length)
    .find((id) => (children.get(id) ?? []).length > 1);
  const coordinates = {
    "group-governance": { left: 415, top: 108, width: 250, height: 42 },
    ceo: { left: 455, top: 178, width: 170, height: 42 },
    "incubator-f": { left: 995, top: 178, width: 190, height: 42 },
    "business-a": { left: 50, top: 270, width: 170, height: 42 },
    "business-b": { left: 250, top: 270, width: 170, height: 42 },
    "business-c": { left: 450, top: 270, width: 170, height: 42 },
    "hq-function": { left: 650, top: 270, width: 170, height: 42 },
    "incubator-a": { left: 850, top: 270, width: 170, height: 42 },
    "incubator-b": { left: 65, top: 355, width: 140, height: 38 },
    "incubator-c": { left: 265, top: 355, width: 140, height: 38 },
    "incubator-d": { left: 465, top: 355, width: 140, height: 38 },
    "incubator-e": { left: 665, top: 355, width: 140, height: 38 },
  };
  for (const node of model.nodes) {
    const position = coordinates[node.id];
    if (!position) throw Object.assign(new Error(`Placement overlay has no layout slot for ${node.id}`), { code: "ORG_CHART_FIT_FAIL" });
    const localMode = node.id === root ? "root" : (children.get(root) ?? []).includes(node.id) ? "horizontal_band" : "nested_columns";
    place(placed, model, node.id, position, localMode, localMode === "root" ? 18 : localMode === "horizontal_band" ? 16 : 14);
  }
  const layout = baseTreeLayout(model, placed, root, children, rootChildren);
  return { ...layout, operatingRoots: operatingRoot ? [operatingRoot] : [] };
}

function planRiskNodes(model, overlay) {
  const { root, children } = primaryTree(model);
  const placed = new Map();
  place(placed, model, root, { left: 540, top: 112, width: 200, height: 42 }, "root", 18);
  const sectionOrderHint = model.layout_hints?.find((item) => item.type === "section_order")?.sections;
  const riskNodes = overlay.node_ids.map((id) => model.nodes.find((node) => node.id === id));
  const sections = sectionOrderHint ?? [...new Set(riskNodes.map((node) => node.attributes.section))];
  const maxHeadcount = Math.max(...riskNodes.map((node) => node.attributes.headcount));
  const sectionFrames = [];
  sections.forEach((section, sectionIndex) => {
    const members = riskNodes
      .filter((node) => node.attributes.section === section)
      .sort((a, b) => a.attributes.sort_order - b.attributes.sort_order);
    const left = 35 + sectionIndex * 307;
    sectionFrames.push({ section, left, top: 190, width: 286, height: 440 });
    members.forEach((node, index) => {
      const ratio = Math.sqrt(node.attributes.headcount / maxHeadcount);
      const width = 114 + ratio * 18;
      const height = 62 + ratio * 4;
      const column = index % 2;
      const row = Math.floor(index / 2);
      place(placed, model, node.id, {
        left: left + 7 + column * 140 + (132 - width) / 2,
        top: 230 + row * 68,
        width,
        height,
      }, "risk_column", 12);
    });
  });
  const layout = baseTreeLayout(model, placed, root, children, children.get(root) ?? []);
  return { ...layout, sectionFrames };
}

function planHybridNodes(model, overlay) {
  const { root, children } = primaryTree(model);
  const placed = new Map();
  place(placed, model, root, { left: 540, top: 112, width: 200, height: 42 }, "root", 18);
  const slots = {
    functional: [{ left: 60, top: 274, width: 175, height: 48 }],
    divisional: [{ left: 300, top: 274, width: 175, height: 48 }],
    matrix: [{ left: 535, top: 264, width: 175, height: 44 }, { left: 535, top: 326, width: 175, height: 44 }],
    platform: [{ left: 780, top: 274, width: 175, height: 48 }],
    legal_entity: [{ left: 1025, top: 274, width: 175, height: 48 }],
  };
  const zoneFrames = [];
  for (const zone of overlay.zones) {
    const memberSlots = slots[zone.form];
    needRender(memberSlots && memberSlots.length >= zone.member_node_ids.length, "ORG_CHART_FIT_FAIL", `No hybrid layout slot for ${zone.zone_id}`);
    zone.member_node_ids.forEach((id, index) => place(placed, model, id, memberSlots[index], "hybrid_zone", 14));
    const left = Math.min(...memberSlots.slice(0, zone.member_node_ids.length).map((item) => item.left)) - 18;
    const top = Math.min(...memberSlots.slice(0, zone.member_node_ids.length).map((item) => item.top)) - 48;
    const right = Math.max(...memberSlots.slice(0, zone.member_node_ids.length).map((item) => item.left + item.width)) + 18;
    const bottom = Math.max(...memberSlots.slice(0, zone.member_node_ids.length).map((item) => item.top + item.height)) + 42;
    zoneFrames.push({ ...zone, left, top, width: right - left, height: bottom - top });
  }
  if (placed.size !== model.nodes.length) throw Object.assign(new Error("Hybrid overlay must place every formal node"), { code: "ORG_CHART_FIT_FAIL" });
  const layout = baseTreeLayout(model, placed, root, children, children.get(root) ?? []);
  return { ...layout, zoneFrames };
}

function needRender(condition, code, message) {
  if (!condition) throw Object.assign(new Error(message), { code });
}

function primaryConnectorSides(relation, layout, source, target) {
  if (relation.source === layout.root && layout.topLevel.includes(relation.target)) {
    return { fromSide: "bottom", toSide: "top", routing: "first_level_bus" };
  }
  if ((layout.operatingRoots ?? []).includes(relation.source)
      && (layout.children.get(relation.source) ?? []).includes(relation.target)) {
    return { fromSide: "bottom", toSide: "top", routing: "operating_root_bus" };
  }
  if (relation.source === layout.dense && layout.denseChildren.includes(relation.target)) {
    return { kind: "elbow3", fromSide: "left", toSide: "left", routing: "vertical_rail" };
  }
  if (target.left >= source.left + source.width) {
    return { fromSide: "right", toSide: "left", routing: "horizontal_chain" };
  }
  if (target.left + target.width <= source.left) {
    return { fromSide: "left", toSide: "right", routing: "horizontal_chain" };
  }
  if ((layout.children.get(relation.source) ?? []).length === 1) {
    return { fromSide: "bottom", toSide: "top", routing: "vertical_direct" };
  }
  return { fromSide: "left", toSide: "left", routing: "vertical_left_rail" };
}

function planRelationships(model, layout, temporaryGroups) {
  const ledger = [];
  for (const relation of model.relationships) {
    const source = layout.nodeMap.get(relation.source);
    const target = layout.nodeMap.get(relation.target);
    if (relation.type === "functional_guidance") {
      const targetIsLeft = target.left + target.width <= source.left;
      const sourceIsLower = source.top > target.top + 1;
      ledger.push({
        relationshipId: relation.id,
        type: relation.type,
        style: "dotted",
        connector: {
          id: `org-rel-${relation.id}`,
          from: relation.source,
          to: relation.target,
          kind: "elbow",
          fromSide: targetIsLeft ? "left" : "right",
          toSide: sourceIsLower ? "bottom" : (targetIsLeft ? "right" : "left"),
          routing: sourceIsLower ? "functional_lower_source_lane" : "functional_guidance",
        },
      });
      continue;
    }
    if (relation.type === "temporary_membership") {
      const group = temporaryGroups.find((item) => item.id === relation.target);
      const ref = group.members.find((item) => item.nodeId === relation.source);
      const hasFunctionalInbound = model.relationships.some((candidate) => (
        candidate.type === "functional_guidance" && candidate.target === relation.source
      ));
      const useVerticalDrop = source.left >= 600 || hasFunctionalInbound;
      ledger.push({
        relationshipId: relation.id,
        type: relation.type,
        style: "dotted",
        connector: {
          id: `org-rel-${relation.id}`,
          from: relation.source,
          to: `team:${group.id}:${ref.nodeId}`,
          kind: "elbow",
          fromSide: useVerticalDrop ? "bottom" : "right",
          toSide: useVerticalDrop ? "top" : "left",
          routing: useVerticalDrop ? "temporary_vertical_drop" : "temporary_side_lane",
        },
      });
      continue;
    }
    const sides = primaryConnectorSides(relation, layout, source, target);
    const lockedRail = sides.routing === "vertical_rail" ? {
      sourceX: source.left,
      sourceY: source.top + source.height / 2,
      targetX: target.left,
      targetY: target.top + target.height / 2,
    } : undefined;
    ledger.push({
      relationshipId: relation.id,
      type: relation.type,
      style: "solid",
      connector: {
        id: `org-rel-${relation.id}`,
        from: relation.source,
        to: relation.target,
        kind: "elbow",
        ...sides,
        ...(lockedRail ? { lockedRail } : {}),
      },
    });
  }
  return ledger;
}

function assertOrganizationLayout(model, layout, relationshipLedger) {
  const centerX = (node) => node.left + node.width / 2;
  if (layout.balancedFunctionalGrid) {
    const peerTops = layout.alignedPeerIds.map((id) => layout.nodeMap.get(id).top);
    if (peerTops.length && Math.max(...peerTops) - Math.min(...peerTops) > 1) {
      throw Object.assign(new Error("Peer departments in a balanced organization row are not aligned"), { code: "ORG_PEER_ROW_MISALIGNMENT" });
    }
    for (const relation of model.relationships.filter((item) => item.type === "primary_reporting")) {
      const source = layout.nodeMap.get(relation.source);
      const target = layout.nodeMap.get(relation.target);
      if (!source || !target || (layout.children.get(relation.source) ?? []).length !== 1) continue;
      if (Math.abs(centerX(source) - centerX(target)) > 1) {
        throw Object.assign(new Error(`Direct report is not vertically aligned: ${relation.id}`), { code: "ORG_DIRECT_REPORT_DOGLEG" });
      }
    }
  }
  for (const relation of relationshipLedger.filter((item) => item.connector.routing === "functional_lower_source_lane")) {
    const source = layout.nodeMap.get(relation.connector.from);
    const target = layout.nodeMap.get(relation.connector.to);
    if (!source || !target || source.top <= target.top || relation.connector.toSide !== "bottom") {
      throw Object.assign(new Error(`Functional lane does not enter the raised target from below: ${relation.relationshipId}`), { code: "ORG_FUNCTIONAL_ROUTE_AMBIGUOUS" });
    }
    const laneY = source.top + source.height / 2;
    const blocked = layout.nodes.some((node) => node.id !== source.id && node.id !== target.id
      && node.top < laneY && node.top + node.height > laneY
      && node.left < Math.max(source.left, target.left) && node.left + node.width > Math.min(source.left + source.width, target.left + target.width));
    if (blocked) {
      throw Object.assign(new Error(`Functional lane crosses an unrelated node: ${relation.relationshipId}`), { code: "ORG_FUNCTIONAL_ROUTE_AMBIGUOUS" });
    }
  }
}

export function planComplexOrgChart(model, overlayInput, pageContext = {}) {
  const validation = validateOrgModel(model, { overlay: overlayInput });
  const normalized = validateOrgOverlays(model, overlayInput);
  const placementOverlay = normalized.overlays.find((item) => item.type === "placement_evidence");
  const riskOverlay = normalized.overlays.find((item) => item.type === "node_risk_encoding");
  const hybridOverlay = normalized.overlays.find((item) => item.type === "hybrid_interface_overlay");
  const layout = hybridOverlay
    ? planHybridNodes(model, hybridOverlay)
    : riskOverlay
      ? planRiskNodes(model, riskOverlay)
      : placementOverlay
        ? planPlacementNodes(model)
        : planNodes(model);
  if (riskOverlay) {
    const computed = validation.overlays.find((item) => item.type === "node_risk_encoding")?.computed ?? [];
    const byId = new Map(computed.map((item) => [item.nodeId, item]));
    for (const node of layout.nodes) {
      const risk = byId.get(node.id);
      if (!risk) continue;
      node.risk = risk;
      node.metricText = `${risk.headcount}人 ${risk.turnoverRatePct}%`;
      if (node.localMode !== "risk_column") {
        const maxHeadcount = Math.max(...computed.map((item) => item.headcount));
        const ratio = Math.sqrt(risk.headcount / maxHeadcount);
        const centerX = node.left + node.width / 2;
        const centerY = node.top + node.height / 2;
        node.width = 140 + ratio * 50;
        node.height = 34 + ratio * 8;
        node.left = centerX - node.width / 2;
        node.top = centerY - node.height / 2;
      }
    }
  }
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const temporaryGroups = model.temporary_groups.map((group) => ({
    id: group.id,
    text: group.label,
    localMode: "external_team_zone",
    left: 680,
    top: 525,
    width: 540,
    height: 135,
    validity: group.validity,
    titleFontSize: 16,
    validityFontSize: 12,
    memberFontSize: 14,
    members: group.members.map((member, index) => ({
      nodeId: member.node_id,
      text: nodeById.get(member.node_id).label,
      index,
      left: 700 + index * 165,
      top: 600,
      width: 150,
      height: 42,
    })),
  }));
  const interfaceRoutes = hybridOverlay ? hybridOverlay.interfaces.map((item, index) => {
    const sourceNode = layout.nodes.find((node) => node.id === item.from_node);
    const targetNode = layout.nodes.find((node) => node.id === item.to_node);
    const sourceZone = hybridOverlay.zones.find((zone) => zone.member_node_ids.includes(item.from_node));
    const targetZone = hybridOverlay.zones.find((zone) => zone.member_node_ids.includes(item.to_node));
    const offset = (index % 3 - 1) * 14;
    const sourceX = sourceNode.left + sourceNode.width / 2 + offset;
    const targetX = targetNode.left + targetNode.width / 2 - offset;
    const laneY = 420 + index * 30;
    return {
      ...item,
      sourceZoneLabel: sourceZone.label,
      targetZoneLabel: targetZone.label,
      sourceX,
      targetX,
      laneY,
      label: `${item.interface_id} ${sourceZone.label}→${targetZone.label} · ${item.conflict_type} · ${item.rule_status === "missing" ? "缺书面规则" : "已有书面规则"}`,
      labelLeft: 82,
    };
  }) : [];
  const relationshipLedger = planRelationships(model, layout, temporaryGroups);
  assertOrganizationLayout(model, layout, relationshipLedger);
  return {
    title: { text: pageContext.title ?? model.title.text, left: 60, top: 12, width: 1160, height: 58 },
    subtitle: pageContext.subtitle ? { text: pageContext.subtitle, left: 60, top: 72, width: 1160, height: 20 } : null,
    headerRule: { from: { x: 60, y: 96 }, to: { x: 1220, y: 96 } },
    rootId: layout.root,
    firstLevelIds: layout.topLevel,
    nodes: layout.nodes,
    temporaryGroups,
    relationshipLedger,
    overlays: normalized.overlays,
    overlayValidation: validation.overlays,
    sectionFrames: layout.sectionFrames ?? [],
    zoneFrames: layout.zoneFrames ?? [],
    interfaceRoutes,
    relationshipRenderMode: riskOverlay && model.relationships.every((item) => (
      item.type === "primary_reporting" && item.source === layout.root
    )) ? "condensed_direct_reports" : "full",
    legend: {
      text: "实线：直接汇报    虚线：职能管理 / 临时项目成员",
      left: 40,
      top: 680,
      width: 700,
      height: 24,
      fontSize: 12,
    },
  };
}

function setNodeText(shape, node, pptx) {
  shape.text = node.text;
  shape.text.style = {
    fontSize: pptx.toArtifactFontSize(node.fontSize),
    bold: node.bold ?? (node.localMode === "horizontal_band" || node.localMode === "root"),
    color: node.textColor ?? pptx.COLORS.text,
    alignment: "center",
  };
  shape.text.verticalAlignment = node.risk ? "top" : "middle";
}

function riskFill(rate, colors) {
  if (rate > 20) return "#F4B183";
  if (rate >= 15) return "#F9D6B8";
  if (rate >= 10) return "#FCE9D9";
  return colors.blueLight;
}

function evidenceText(item) {
  return `${item.label}（${item.node_ids.length}个）\n授权 ${item.authorization_score}分 · 周期 ${item.cycle_months}月 · 里程碑 ${item.milestone_rate_pct}%\n${item.governance_conditions.join("；")}`;
}

export async function renderComplexOrgChart(model, output, overlayInput, pageContext = {}) {
  const pptx = await import("./pptx_core.mjs");
  const {
    COLORS, addChartLine, addContainer, addNode, addTextBox, connectNative,
    createPresentation, exportPresentation, fitPageTitleFontSize,
  } = pptx;
  const plan = planComplexOrgChart(model, overlayInput, pageContext);
  const { presentation, slide } = createPresentation(output.background);
  const pageTitleSize = plan.title.text.length > 44 ? 24 : plan.title.text.length > 34 ? 26 : fitPageTitleFontSize(plan.title.text);
  addTextBox(slide, {
    name: "page-title",
    text: plan.title.text,
    position: plan.title,
    fontSize: pageTitleSize,
    bold: true,
    color: COLORS.navy,
  });
  if (plan.subtitle) {
    addTextBox(slide, {
      name: "page-subtitle",
      text: plan.subtitle.text,
      position: plan.subtitle,
      fontSize: 12,
      color: COLORS.muted,
    });
  }
  addChartLine(slide, {
    name: "page-title-rule",
    from: plan.headerRule.from,
    to: plan.headerRule.to,
    line: { style: "solid", fill: COLORS.border, width: 1 },
  });

  const sectionShapes = new Map();
  for (const frame of plan.sectionFrames) {
    const container = addContainer(slide, {
      name: `org-risk-section-${frame.section}`,
      position: frame,
      fill: COLORS.soft,
      border: COLORS.border,
      borderWidth: 0.8,
    });
    sectionShapes.set(frame.section, container);
    container.sendToBack();
    addTextBox(slide, {
      name: `org-risk-section-label-${frame.section}`,
      text: frame.section,
      position: { left: frame.left + 10, top: frame.top + 5, width: frame.width - 20, height: 22 },
      fontSize: 14,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
  }
  for (const frame of plan.zoneFrames) {
    const container = addContainer(slide, {
      name: `org-hybrid-zone-${frame.zone_id}`,
      position: frame,
      fill: frame.form === "matrix" ? COLORS.orangeLight : COLORS.soft,
      border: frame.form === "matrix" ? COLORS.orange : COLORS.border,
      borderWidth: 1.2,
    });
    container.sendToBack();
    const unit = frame.unit_count == null ? `${frame.headcount}人 · 双线覆盖` : `${frame.unit_count}${frame.unit_label} · ${frame.headcount}人`;
    addTextBox(slide, {
      name: `org-hybrid-zone-label-${frame.zone_id}`,
      text: `${frame.label}\n${unit}`,
      position: { left: frame.left + 8, top: frame.top + 5, width: frame.width - 16, height: 38 },
      fontSize: 12,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
  }

  const shapes = new Map();
  for (const node of plan.nodes) {
    const isRoot = node.id === plan.rootId;
    const isFirstLevel = plan.firstLevelIds.includes(node.id);
    const fill = isRoot ? COLORS.navy : node.risk ? riskFill(node.risk.turnoverRatePct, COLORS) : isFirstLevel ? COLORS.blueLight : COLORS.white;
    const border = isRoot ? COLORS.navy : node.risk?.tripleBreakpoint ? COLORS.orange : isFirstLevel ? COLORS.navy : COLORS.border;
    node.textColor = isRoot ? COLORS.white : COLORS.text;
    node.bold = isRoot || isFirstLevel;
    shapes.set(node.id, addNode(slide, {
      name: `org-node-${node.id}`,
      text: "",
      position: node,
      fill,
      border,
      borderWidth: isRoot ? 1.5 : node.risk?.tripleBreakpoint ? 2.4 : isFirstLevel ? 1.4 : 1,
      fontSize: node.fontSize,
    }));
  }

  for (const group of plan.temporaryGroups) {
    const groupShape = addContainer(slide, {
      name: `org-team-${group.id}`,
      position: group,
      fill: COLORS.orangeLight,
      border: COLORS.orange,
      borderWidth: 1.2,
    });
    groupShape.sendToBack();
    for (const member of group.members) {
      shapes.set(`team:${group.id}:${member.nodeId}`, addNode(slide, {
        name: `org-team-${group.id}-${member.nodeId}`,
        text: "",
        position: member,
        fill: COLORS.white,
        border: COLORS.orange,
        fontSize: group.memberFontSize,
      }));
    }
  }

  if (plan.relationshipRenderMode === "condensed_direct_reports") {
    addTextBox(slide, {
      name: "org-risk-direct-report-note",
      text: "31个一级部门均为CEO直属；四个业务分组仅用于风险阅读，不新增组织层级",
      position: { left: 350, top: 153, width: 580, height: 24 },
      fontSize: 12,
      color: COLORS.muted,
      alignment: "center",
    });
    for (const [section, sectionShape] of sectionShapes) {
      const connector = connectNative(slide, shapes.get(plan.rootId), sectionShape, {
        kind: "straight", fromSide: "bottom", toSide: "top", role: "relationship",
        arrow: false, placement: "front", line: { style: "solid", fill: COLORS.line, width: 1.3 },
      });
      connector.name = `org-risk-section-link-${section}`;
    }
  }
  for (const relation of plan.relationshipRenderMode === "condensed_direct_reports" ? [] : plan.relationshipLedger) {
    const line = {
      style: relation.style === "dotted" ? "dashed" : "solid",
      fill: relation.type === "temporary_membership" ? COLORS.orange : relation.type === "functional_guidance" ? COLORS.blue : COLORS.line,
      width: relation.type === "primary_reporting" ? 1.5 : 1.8,
    };
    const connector = relation.connector.kind === "elbow3"
      ? slide.shapes.connect(shapes.get(relation.connector.from), shapes.get(relation.connector.to), {
        kind: "elbow3",
        fromSide: relation.connector.fromSide,
        toSide: relation.connector.toSide,
        line,
      })
      : connectNative(slide, shapes.get(relation.connector.from), shapes.get(relation.connector.to), {
      kind: relation.connector.kind,
      fromSide: relation.connector.fromSide,
      toSide: relation.connector.toSide,
      role: "relationship",
      arrow: false,
      placement: "front",
      line,
    });
    if (relation.connector.kind === "elbow3") connector.bringToFront();
    connector.name = relation.connector.id;
  }

  const interfaceMarkers = [];
  if (plan.interfaceRoutes.length) {
    plan.interfaceRoutes.forEach((item) => {
      const sourceNode = plan.nodes.find((node) => node.id === item.from_node);
      const targetNode = plan.nodes.find((node) => node.id === item.to_node);
      const { sourceX, targetX, laneY } = item;
      const color = item.rule_status === "missing" ? COLORS.orange : COLORS.blue;
      addChartLine(slide, { name: `org-interface-${item.interface_id}-source`, from: { x: sourceX, y: sourceNode.top + sourceNode.height }, to: { x: sourceX, y: laneY }, line: { style: "dashed", fill: color, width: 1.4 } });
      addChartLine(slide, { name: `org-interface-${item.interface_id}-lane`, from: { x: sourceX, y: laneY }, to: { x: targetX, y: laneY }, line: { style: "dashed", fill: color, width: 1.8 } });
      addChartLine(slide, { name: `org-interface-${item.interface_id}-target`, from: { x: targetX, y: laneY }, to: { x: targetX, y: targetNode.top + targetNode.height }, line: { style: "dashed", fill: color, width: 1.4 } });
      interfaceMarkers.push({
        ...item,
        left: item.labelLeft,
        top: laneY - 13,
      });
    });
  }

  for (const shape of shapes.values()) shape.bringToFront();
  for (const node of plan.nodes) setNodeText(shapes.get(node.id), node, pptx);
  const riskOverlayShapes = [];
  for (const node of plan.nodes.filter((item) => item.risk)) {
    const badges = [
      [node.risk.successorGap, "继", COLORS.orange],
      [node.risk.keyRoleDense, "岗", COLORS.navy],
      [node.risk.newManager, "新", COLORS.blue],
    ].filter(([active]) => active);
    riskOverlayShapes.push(addTextBox(slide, {
      name: `org-risk-metric-${node.id}`,
      text: node.metricText,
      position: { left: node.left + 4, top: node.top + 28, width: node.width - 8, height: 16 },
      fontSize: 12,
      color: COLORS.text,
      alignment: "center",
    }));
    const badgeLeft = node.left + (node.width - badges.length * 22) / 2;
    badges.forEach(([, label, color], index) => riskOverlayShapes.push(addNode(slide, {
      name: `org-risk-badge-${node.id}-${label}`,
      text: label,
      position: { left: badgeLeft + index * 22, top: node.top + node.height - 20, width: 20, height: 18 },
      fill: color,
      border: COLORS.white,
      borderWidth: 1,
      fontSize: 8,
      bold: false,
      color: COLORS.white,
      geometry: "ellipse",
    })));
  }
  for (const marker of interfaceMarkers) {
    addNode(slide, {
      name: `org-interface-marker-${marker.interface_id}`,
      text: "",
      position: { left: 60, top: marker.top + 2, width: 18, height: 18 },
      fill: marker.rule_status === "missing" ? COLORS.orange : COLORS.blue,
      border: COLORS.white,
      borderWidth: 1,
      fontSize: 12,
      bold: true,
      color: COLORS.white,
      geometry: marker.marker === "warm_triangle" ? "triangle" : "diamond",
    });
    addTextBox(slide, {
      name: `org-interface-label-${marker.interface_id}`,
      text: marker.label,
      position: { left: marker.left, top: marker.top, width: 720, height: 22 },
      fontSize: 12,
      bold: true,
      color: marker.rule_status === "missing" ? COLORS.orange : COLORS.blue,
      fill: COLORS.white,
    });
  }
  const placementOverlay = plan.overlays.find((item) => item.type === "placement_evidence");
  if (placementOverlay) {
    const cardSlots = {
      ceo_direct: { left: 820, top: 335, width: 195, height: 90 },
      legal_entity: { left: 1030, top: 250, width: 190, height: 112 },
      division_attached: { left: 70, top: 440, width: 520, height: 100 },
      function_attached: { left: 635, top: 440, width: 365, height: 100 },
    };
    for (const item of placementOverlay.placements) {
      const slot = cardSlots[item.placement_key];
      if (!slot) continue;
      addNode(slide, {
        name: `org-placement-evidence-${item.placement_key}`,
        text: evidenceText(item),
        position: slot,
        fill: item.authorization_score < 5 ? COLORS.orangeLight : COLORS.blueLight,
        border: item.authorization_score < 5 ? COLORS.orange : COLORS.blue,
        borderWidth: 1.2,
        fontSize: 12,
        bold: false,
        color: COLORS.text,
        alignment: "left",
      });
    }
    if (placementOverlay.shared_evidence) {
      const shared = placementOverlay.shared_evidence;
      addNode(slide, {
        name: "org-placement-shared-evidence",
        text: `${shared.scope_label}\n人力被母体挪用 ${shared.talent_reassigned_events}次；预算被截留比例平均 ${shared.budget_withheld_pct}%——这是4个挂靠型单元的合计/汇总，不分别归属事业部挂靠或职能挂靠`,
        position: { left: 70, top: 555, width: 930, height: 62 },
        fill: COLORS.soft,
        border: COLORS.line,
        borderWidth: 1,
        fontSize: 12,
        color: COLORS.text,
        alignment: "left",
      });
    }
  }
  for (const group of plan.temporaryGroups) {
    addTextBox(slide, {
      name: `org-label-${group.id}`,
      text: group.text,
      position: { left: group.left + 45, top: group.top + 8, width: group.width - 63, height: 22 },
      fontSize: group.titleFontSize,
      bold: true,
      color: COLORS.orange,
    });
    addTextBox(slide, {
      name: `org-validity-${group.id}`,
      text: `${group.validity?.start ?? ""}—${group.validity?.end ?? ""}`,
      position: { left: group.left + 45, top: group.top + 30, width: group.width - 63, height: 18 },
      fontSize: group.validityFontSize,
      color: COLORS.orange,
    });
    for (const member of group.members) setNodeText(
      shapes.get(`team:${group.id}:${member.nodeId}`),
      { ...member, fontSize: group.memberFontSize },
      pptx,
    );
  }
  for (const shape of riskOverlayShapes) shape.bringToFront();
  addTextBox(slide, {
    name: "org-label-legend",
    text: plan.legend.text,
    position: plan.legend,
    fontSize: plan.legend.fontSize,
    color: COLORS.muted,
  });
  if (plan.overlays.some((item) => item.type === "node_risk_encoding")) {
    addTextBox(slide, {
      name: "org-risk-overlay-legend",
      text: "面积：人数　填色：流失率　徽标：继=无继任关键岗　岗=关键岗密集　新=新任管理者　橙框=三重风险",
      position: { left: 355, top: 650, width: 865, height: 26 },
      fontSize: 12,
      color: COLORS.muted,
      alignment: "right",
    });
  }
  if (plan.overlays.some((item) => item.type === "hybrid_interface_overlay")) {
    addTextBox(slide, {
      name: "org-hybrid-overlay-legend",
      text: "实线：正式汇报　蓝色虚线：职能指导　橙色三角：缺书面规则　蓝色菱形：已有书面规则",
      position: { left: 470, top: 650, width: 750, height: 26 },
      fontSize: 12,
      color: COLORS.muted,
      alignment: "right",
    });
  }

  await fs.mkdir(path.dirname(output.ledger), { recursive: true });
  await fs.writeFile(output.ledger, `${JSON.stringify(plan.relationshipLedger, null, 2)}\n`);
  await exportPresentation(presentation, output);
  await execFileAsync("python3", [
    fileURLToPath(new URL("./normalize_org_connectors.py", import.meta.url)),
    "--pptx", output.pptx,
    "--ledger", output.ledger,
  ]);
  const { FileBlob, PresentationFile } = await import("@oai/artifact-tool");
  const normalized = await PresentationFile.importPptx(await FileBlob.load(output.pptx));
  const normalizedSlide = normalized.slides.items[0];
  if (output.preview) {
    const blob = await normalizedSlide.export({ format: "png", scale: 1 });
    await fs.writeFile(output.preview, new Uint8Array(await blob.arrayBuffer()));
  }
  if (output.layout) {
    await fs.writeFile(output.layout, await (await normalizedSlide.export({ format: "layout" })).text());
  }
  return plan;
}

export async function loadOrgHandoff(handoffPath) {
  const handoff = JSON.parse(await fs.readFile(handoffPath, "utf8"));
  const base = path.dirname(handoffPath);
  const datasets = Array.isArray(handoff.datasets) ? handoff.datasets : [];
  const orgDataset = datasets.find((item) => item.path === "data/org-model.json");
  if (!orgDataset) throw Object.assign(new Error("Handoff does not declare data/org-model.json"), { code: "ORG_HANDOFF_INPUT_INVALID" });
  const overlayDatasets = datasets.filter((item) => item !== orgDataset && (
    item.overlay_type || /(?:overlay|hybrid-org-model)\.json$/i.test(item.path ?? "")
  ));
  if (!overlayDatasets.length) throw Object.assign(new Error("Handoff does not declare an organization overlay dataset"), { code: "ORG_HANDOFF_OVERLAY_MISSING" });
  const model = JSON.parse(await fs.readFile(path.join(base, orgDataset.path), "utf8"));
  const overlays = await Promise.all(overlayDatasets.map(async (item) => {
    const overlay = JSON.parse(await fs.readFile(path.join(base, item.path), "utf8"));
    return overlay.type || !item.overlay_type ? overlay : { ...overlay, type: item.overlay_type };
  }));
  return {
    model,
    overlay: overlays.length === 1 ? overlays[0] : overlays,
    overlays,
    pageContext: { title: handoff.content?.title, subtitle: handoff.content?.subtitle },
    handoff,
  };
}

async function main() {
  const { parseCliArgs } = await import("./pptx_core.mjs");
  const options = parseCliArgs(process.argv.slice(2), ["pptx", "preview", "layout", "ledger"]);
  if (!options.handoff && !options.input) throw Object.assign(new Error("Provide --handoff or --input"), { code: "ORG_HANDOFF_INPUT_INVALID" });
  const loaded = options.handoff
    ? await loadOrgHandoff(options.handoff)
    : {
      model: JSON.parse(await fs.readFile(options.input, "utf8")),
      overlay: options.overlay ? JSON.parse(await fs.readFile(options.overlay, "utf8")) : undefined,
      pageContext: {},
    };
  const plan = await renderComplexOrgChart(loaded.model, options, loaded.overlay, loaded.pageContext);
  process.stdout.write(`${JSON.stringify({ ok: true, module: "complex-org-chart", handoff: options.handoff ?? null, overlays: plan.overlays.map((item) => item.type), nodes: plan.nodes.length, relationships: plan.relationshipLedger.length })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
