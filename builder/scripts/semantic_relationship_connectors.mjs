import { COLORS, SlideContractError, connectNative } from "./pptx_core.mjs";

export const RELATIONSHIP_ROUTES = Object.freeze([
  "direct",
  "upper_arc",
  "lower_arc",
  "feedback_arc",
  "outer_loop",
]);

const ROUTE_DEFAULTS = Object.freeze({
  direct: { kind: "curved", fromSide: "right", toSide: "left", sourceClock: 3, targetClock: 9, arcHeight: 72 },
  upper_arc: { kind: "curved", fromSide: "floating", toSide: "floating", sourceClock: 2, targetClock: 10, arcHeight: 104 },
  lower_arc: { kind: "curved", fromSide: "floating", toSide: "floating", sourceClock: 8, targetClock: 4, arcHeight: 104 },
  feedback_arc: { kind: "curved", fromSide: "floating", toSide: "floating", sourceClock: 8, targetClock: 4, arcHeight: 126 },
  outer_loop: { kind: "curved", fromSide: "floating", toSide: "floating", sourceClock: 7.5, targetClock: 4.5, arcHeight: 154 },
});

function center(node) {
  return {
    x: node.left + node.width / 2,
    y: node.top + node.height / 2,
  };
}

function clockVector(clock) {
  const radians = ((Number(clock) * 30) - 90) * Math.PI / 180;
  return { x: Math.cos(radians), y: Math.sin(radians) };
}

function floatingPoint(position, clock, gap) {
  const vector = clockVector(clock);
  const nodeCenter = center(position);
  return {
    point: {
      x: nodeCenter.x + vector.x * (position.width / 2 + gap),
      y: nodeCenter.y + vector.y * (position.height / 2 + gap),
    },
    vector,
  };
}

function cubicPoint(start, c1, c2, end, t = 0.5) {
  const u = 1 - t;
  return {
    x: u ** 3 * start.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * end.x,
    y: u ** 3 * start.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * end.y,
  };
}

export function trueArcGeometry(start, end, route, arcHeight) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) throw new SlideContractError("RELATIONSHIP_ARC_SPAN_FAIL", "Arc endpoints must be distinct");
  let normal = { x: -dy / length, y: dx / length };
  const upper = route === "upper_arc";
  const desiredY = upper ? -1 : 1;
  if (Math.sign(normal.y || desiredY) !== desiredY) normal = { x: -normal.x, y: -normal.y };
  const handle = Math.max(24, arcHeight) * 4 / 3;
  const c1 = { x: start.x + normal.x * handle, y: start.y + normal.y * handle };
  const c2 = { x: end.x + normal.x * handle, y: end.y + normal.y * handle };
  return { start, c1, c2, end, midpoint: cubicPoint(start, c1, c2, end), arcHeight, normal };
}

function addBezierArc(slide, name, fromPosition, toPosition, route, line, spec = {}) {
  const defaults = ROUTE_DEFAULTS[route];
  const sourceClock = spec.sourceClock ?? defaults.sourceClock;
  const targetClock = spec.targetClock ?? defaults.targetClock;
  const gap = spec.gap ?? 18;
  const arcHeight = spec.arcHeight ?? defaults.arcHeight;
  const source = floatingPoint(fromPosition, sourceClock, gap);
  const target = floatingPoint(toPosition, targetClock, gap);
  const start = source.point;
  const end = target.point;
  const geometry = trueArcGeometry(start, end, route, arcHeight);
  const { c1, c2 } = geometry;
  const minX = Math.min(start.x, end.x, c1.x, c2.x);
  const minY = Math.min(start.y, end.y, c1.y, c2.y);
  const maxX = Math.max(start.x, end.x, c1.x, c2.x);
  const maxY = Math.max(start.y, end.y, c1.y, c2.y);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const local = (point) => ({ x: point.x - minX, y: point.y - minY });
  const curve = slide.shapes.add({
    name,
    geometry: "custom",
    position: { left: minX, top: minY, width, height },
    fill: "none",
    line,
    customPaths: [{
      width,
      height,
      fill: "none",
      commands: [
        { moveTo: local(start) },
        { cubicBezTo: { x1: c1.x - minX, y1: c1.y - minY, x2: c2.x - minX, y2: c2.y - minY, ...local(end) } },
      ],
    }],
  });
  return {
    curve,
    midpoint: geometry.midpoint,
    anchors: { sourceClock, targetClock, gap, start, end, arcHeight },
  };
}

export function validateRelationshipSpec(spec, nodeMap) {
  if (!spec?.id || !spec.from || !spec.to) {
    throw new SlideContractError("RELATIONSHIP_INPUT_FAIL", "Every relationship needs id, from, and to");
  }
  if (!RELATIONSHIP_ROUTES.includes(spec.route)) {
    throw new SlideContractError("RELATIONSHIP_ROUTE_FAIL", `Unsupported relationship route: ${spec.route}`);
  }
  if (spec.from === spec.to) {
    throw new SlideContractError("SELF_LOOP_NOT_IN_MVP", "The MVP supports relationships between distinct icon nodes only");
  }
  if (!nodeMap.has(spec.from) || !nodeMap.has(spec.to)) {
    throw new SlideContractError("RELATIONSHIP_NODE_MISSING", `Unknown relationship endpoint: ${spec.from} -> ${spec.to}`);
  }
  return spec;
}

export function addSemanticRelationship(slide, spec, nodeMap, {
  color = COLORS.blue,
  width = 1.5,
  style = "solid",
} = {}) {
  validateRelationshipSpec(spec, nodeMap);
  const from = nodeMap.get(spec.from);
  const to = nodeMap.get(spec.to);
  const route = ROUTE_DEFAULTS[spec.route];
  const line = { style: spec.style ?? style, fill: spec.color ?? color, width: spec.width ?? width };
  const exactArc = spec.route !== "direct";
  const rendered = exactArc
    ? addBezierArc(slide, `relationship-${spec.id}`, from.position, to.position, spec.route, line, spec)
    : connectNative(slide, from.shape, to.shape, {
      ...route,
      role: "relationship",
      line,
      placement: "back",
    });
  const connector = exactArc ? rendered.curve : rendered;
  connector.name = `relationship-${spec.id}`;
  return {
    connector,
    labelPosition: exactArc
      ? { left: rendered.midpoint.x - 92, top: rendered.midpoint.y + (spec.route === "upper_arc" ? -38 : 12), width: 184, height: 26 }
      : { left: (center(from.position).x + center(to.position).x) / 2 - 90, top: (center(from.position).y + center(to.position).y) / 2 - 34, width: 180, height: 26 },
    route: spec.route,
    fromSide: route.fromSide,
    toSide: route.toSide,
    geometryMode: exactArc ? "native_bezier_shape" : "native_connector",
    arrowhead: exactArc ? "native_line_property_pending_export" : "native_connector_property",
    anchors: exactArc ? rendered.anchors : null,
  };
}

export function addSemanticRelationships(slide, specs, nodeMap, options = {}) {
  if (!(nodeMap instanceof Map) || nodeMap.size < 2 || nodeMap.size > 6) {
    throw new SlideContractError("RELATIONSHIP_NODE_COUNT_FAIL", "The MVP supports 2 to 6 icon nodes");
  }
  const ids = new Set();
  return specs.map((spec) => {
    if (ids.has(spec.id)) throw new SlideContractError("RELATIONSHIP_ID_DUPLICATE", `Duplicate relationship id: ${spec.id}`);
    ids.add(spec.id);
    return addSemanticRelationship(slide, spec, nodeMap, options);
  });
}
