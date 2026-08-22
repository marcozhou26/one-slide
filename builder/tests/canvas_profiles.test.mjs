import test from "node:test";
import assert from "node:assert/strict";
import { resolveCanvasProfile } from "../scripts/canvas_profiles.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";
import { validatePortraitOnePoint } from "../scripts/render_portrait_one_point.mjs";

test("resolves the three native canvas profiles and normalizes high-4 wide-3", () => {
  assert.deepEqual(resolveCanvasProfile("16:9"), resolveCanvasProfile("presentation_16_9"));
  assert.deepEqual(resolveCanvasProfile("9:16"), resolveCanvasProfile("short_video_broll_9_16"));
  assert.deepEqual(resolveCanvasProfile("4:3竖版"), resolveCanvasProfile("knowledge_graphic_3_4"));
  assert.deepEqual(
    [resolveCanvasProfile("4:3竖版").width, resolveCanvasProfile("4:3竖版").height],
    [720, 960],
  );
});

test("portrait handoff routes to vertical direct composition instead of a fixed landscape module", async () => {
  const result = await routeV3({
    subject: "审批效率",
    story: "审批等待是主要耗时",
    source_ids: ["U01"],
    requested_module: "waterfall-attribution",
    module_payload: { module_id: "waterfall-attribution" },
    canvas_profile: "short_video_broll_9_16",
    display_blocks: [{ display_intent: "comparison" }],
  });
  assert.equal(result.route, "direct_composition");
  assert.match(result.reason, /portrait canvases require native vertical recomposition/u);
});

test("one-point B-roll rejects more than three support items", () => {
  assert.throws(() => validatePortraitOnePoint({
    title: "一个观点",
    core_point: "核心结论",
    data_source: "用户提供",
    supporting_points: ["一", "二", "三", "四"],
  }), (error) => error.code === "SINGLE_SLIDE_SCOPE_OVERLOAD");
});
