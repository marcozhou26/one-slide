import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveIconHandoff, validateIconHandoff } from "../scripts/icon_handoff_core.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(testDir, "../assets/test-fixtures");

function handoff(overrides = {}) {
  return {
    status: "requested",
    trigger_reason: "低密度页面有可命名语义锚点，需要降低识别成本。",
    items: [
      { concept: "人工智能", role: "object", peer_group: "claim_markers", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] },
      { concept: "分析", role: "object", peer_group: "claim_markers", required: true, style: "line", fallback: "text_only", source_ids: ["S2"] },
    ],
    ...overrides,
  };
}

function routeInput(icon_handoff = handoff()) {
  return {
    subject: "AI退到后台，专业判断走到前台",
    story: "不再出售AI知识，而是出售被AI放大的专业判断。",
    source_ids: ["S1", "S2"],
    structure: { primary_exhibit: "composite" },
    display_blocks: [{ display_intent: "claim-highlight" }],
    icon_handoff,
  };
}

test("requested icon_handoff maps slide-spec roles to OneSlide semantic roles", async () => {
  const result = await resolveIconHandoff(handoff());
  assert.equal(result.status, "ready");
  assert.equal(result.item_count, 2);
  assert.equal(result.items[0].one_slide_role, "object_identifier");
  assert.equal(result.items[0].status, "ready");
  assert.ok(result.items[0].source_ids.includes("S1"));
});

test("resolver preserves item target ids for renderer binding", async () => {
  const result = await resolveIconHandoff(handoff({
    items: [
      { concept: "客户", role: "question", peer_group: "issues", target_id: "question-1", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] },
    ],
  }));
  assert.equal(result.items[0].target_id, "question-1");
});

test("none and decorative_only do not produce icons", async () => {
  assert.equal((await resolveIconHandoff({ status: "none" })).status, "NO_ICON");
  const decorative = await resolveIconHandoff({ status: "decorative_only", reason: "只是为了丰富页面" });
  assert.equal(decorative.status, "NO_ICON");
  assert.equal(decorative.reason, "DECORATIVE_ONLY");
});

test("missing trigger_reason and unknown role are blocked", () => {
  assert.throws(() => validateIconHandoff(handoff({ trigger_reason: "" })), /trigger_reason/u);
  assert.throws(() => validateIconHandoff(handoff({ items: [{ concept: "客户", role: "logo", peer_group: "x", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] }] })), /Unsupported icon_handoff role/u);
});

test("peer_group must keep role and style consistent", () => {
  assert.throws(() => validateIconHandoff(handoff({
    items: [
      { concept: "客户", role: "question", peer_group: "issues", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] },
      { concept: "风险", role: "state", peer_group: "issues", required: true, style: "line", fallback: "text_only", source_ids: ["S2"] },
    ],
  })), /peer_group/u);
});

test("required icon cannot be silently omitted", async () => {
  await assert.rejects(
    () => resolveIconHandoff(handoff({ items: [{ concept: "量子泡泡糖", role: "object", peer_group: "x", required: true, style: "line", fallback: "omit_icon", source_ids: ["S1"] }] })),
    /cannot use omit_icon/u,
  );
  const fallback = await resolveIconHandoff(handoff({ items: [{ concept: "量子泡泡糖", role: "object", peer_group: "x", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] }] }));
  assert.equal(fallback.status, "resolved_with_fallback");
  assert.equal(fallback.items[0].status, "fallback_text_only");
});

test("route_v3 consumes icon_handoff instead of ignoring it", async () => {
  const result = await routeV3(routeInput());
  assert.equal(result.status, "ready");
  assert.equal(result.icon_handoff.status, "ready");
  assert.equal(result.icon_handoff.resolver, "scripts/icon_handoff_core.mjs");
  assert.ok(result.load_only.includes("references/semantic-icon-library.md"));
});

test("route_v3 returns explicit icon_handoff block status", async () => {
  const result = await routeV3(routeInput(handoff({ items: [{ concept: "客户", role: "logo", peer_group: "x", required: true, style: "line", fallback: "text_only", source_ids: ["S1"] }] })));
  assert.equal(result.status, "blocked");
  assert.equal(result.route, "ICON_ROLE_NOT_ALLOWED");
});

test("claim-p07 source concept is not rewritten to hit icon aliases", () => {
  const sample = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "claim-p07-icon-handoff.json"), "utf8"));
  const concepts = sample.icon_handoff.items.map((item) => item.concept);
  assert.ok(concepts.includes("专业判断"));
  assert.ok(!concepts.includes("分析"));
});

test("issue-p09 question icons declare concrete target bindings", () => {
  const sample = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "issue-p09-icon-handoff.json"), "utf8"));
  const bindings = sample.icon_handoff.items.map((item) => [item.concept, item.target_id]);
  assert.deepEqual(bindings, [["客户", "question-1"], ["产品", "question-2"], ["风险", "question-5"]]);
});
