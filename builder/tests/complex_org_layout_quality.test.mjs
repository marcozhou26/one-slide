import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planComplexOrgChart } from "../scripts/render_complex_org_chart.mjs";

const fixture = async () => JSON.parse(await readFile(
  new URL("../assets/test-fixtures/complex-org-chart-functional-lane.json", import.meta.url),
  "utf8",
));

const centerX = (node) => node.left + node.width / 2;

test("aligns peer departments and keeps every one-child reporting line vertical", async () => {
  const model = await fixture();
  const plan = planComplexOrgChart(model);
  const nodes = new Map(plan.nodes.map((node) => [node.id, node]));
  const peers = ["regional-sales", "project-delivery", "customer-ops", "integrated-support"].map((id) => nodes.get(id));
  assert.equal(new Set(peers.map((node) => node.top)).size, 1);
  assert.ok(nodes.get("product-dept").top > peers[0].top);
  for (const [parent, child] of [
    ["product-center", "product-dept"],
    ["sales-center", "regional-sales"],
    ["delivery-center", "project-delivery"],
    ["customer-center", "customer-ops"],
    ["support-center", "integrated-support"],
  ]) {
    assert.ok(Math.abs(centerX(nodes.get(parent)) - centerX(nodes.get(child))) <= 1, `${parent} → ${child}`);
  }
});

test("routes shared-source functional guidance from the source side into target bottoms", async () => {
  const model = await fixture();
  const plan = planComplexOrgChart(model);
  const functional = plan.relationshipLedger.filter((item) => item.type === "functional_guidance");
  assert.equal(functional.length, 2);
  for (const relation of functional) {
    assert.equal(relation.connector.from, "product-dept");
    assert.equal(relation.connector.fromSide, "right");
    assert.equal(relation.connector.toSide, "bottom");
    assert.equal(relation.connector.routing, "functional_lower_source_lane");
  }
});

test("blocks mixed inbound and outbound guidance that the current visual grammar cannot route clearly", async () => {
  const model = await fixture();
  const second = model.relationships.find((item) => item.id === "f02");
  second.source = "customer-ops";
  second.target = "product-dept";
  assert.throws(
    () => planComplexOrgChart(model),
    (error) => error.code === "ORG_FUNCTIONAL_ROUTE_AMBIGUOUS",
  );
});
