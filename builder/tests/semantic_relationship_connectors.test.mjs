import assert from "node:assert/strict";
import test from "node:test";
import {
  RELATIONSHIP_ROUTES,
  addSemanticRelationships,
  trueArcGeometry,
  validateRelationshipSpec,
} from "../scripts/semantic_relationship_connectors.mjs";

function fixtureNode(left) {
  return {
    shape: { id: `shape-${left}` },
    position: { left, top: 220, width: 180, height: 180 },
  };
}

function mockSlide() {
  const calls = [];
  return {
    calls,
    shapes: {
      add(options) {
        calls.push({ add: options });
        return {};
      },
      connect(from, to, options) {
        calls.push({ from, to, options });
        return { sendToBack() {}, bringToFront() {} };
      },
    },
  };
}

test("MVP exposes only the approved semantic routes", () => {
  assert.deepEqual(RELATIONSHIP_ROUTES, ["direct", "upper_arc", "lower_arc", "feedback_arc", "outer_loop"]);
});

test("upper and lower cycle edges use one editable PowerPoint Bezier shape each", () => {
  const slide = mockSlide();
  const nodes = new Map([["a", fixtureNode(100)], ["b", fixtureNode(500)]]);
  const result = addSemanticRelationships(slide, [
    { id: "forward", from: "a", to: "b", route: "upper_arc" },
    { id: "return", from: "b", to: "a", route: "lower_arc" },
  ], nodes);
  assert.equal(slide.calls[0].add.geometry, "custom");
  assert.ok(slide.calls[0].add.customPaths[0].commands.some((command) => command.cubicBezTo));
  assert.equal(slide.calls.length, 2);
  assert.equal(result[0].geometryMode, "native_bezier_shape");
  assert.equal(result[1].geometryMode, "native_bezier_shape");
  assert.equal(result[0].arrowhead, "native_line_property_pending_export");
  assert.equal(result[0].anchors.sourceClock, 2);
  assert.equal(result[0].anchors.targetClock, 10);
  assert.ok(result[0].anchors.start.y < nodes.get("a").position.top + nodes.get("a").position.height / 2);
  assert.ok(result[1].anchors.start.y > nodes.get("b").position.top + nodes.get("b").position.height / 2);
});

test("arc controls form a continuously turning half ellipse instead of a rounded polyline", () => {
  const upper = trueArcGeometry({ x: 100, y: 300 }, { x: 500, y: 300 }, "upper_arc", 100);
  const lower = trueArcGeometry({ x: 500, y: 420 }, { x: 100, y: 420 }, "lower_arc", 100);
  assert.equal(upper.c1.x, upper.start.x);
  assert.equal(upper.c2.x, upper.end.x);
  assert.ok(upper.c1.y < upper.start.y);
  assert.ok(upper.c2.y < upper.end.y);
  assert.equal(Math.round(upper.midpoint.y), 200);
  assert.equal(lower.c1.x, lower.start.x);
  assert.equal(lower.c2.x, lower.end.x);
  assert.ok(lower.c1.y > lower.start.y);
  assert.ok(lower.c2.y > lower.end.y);
  assert.equal(Math.round(lower.midpoint.y), 520);
});

test("unknown endpoints and unsupported self loops fail explicitly", () => {
  const nodes = new Map([["a", fixtureNode(100)], ["b", fixtureNode(500)]]);
  assert.throws(
    () => validateRelationshipSpec({ id: "x", from: "a", to: "missing", route: "direct" }, nodes),
    (error) => error.code === "RELATIONSHIP_NODE_MISSING",
  );
  assert.throws(
    () => validateRelationshipSpec({ id: "x", from: "a", to: "a", route: "upper_arc" }, nodes),
    (error) => error.code === "SELF_LOOP_NOT_IN_MVP",
  );
});

test("node count stays inside the consultation-page MVP boundary", () => {
  const slide = mockSlide();
  const nodes = new Map([["a", fixtureNode(100)]]);
  assert.throws(
    () => addSemanticRelationships(slide, [], nodes),
    (error) => error.code === "RELATIONSHIP_NODE_COUNT_FAIL",
  );
});
