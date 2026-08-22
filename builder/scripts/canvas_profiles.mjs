export const CANVAS_PROFILES = Object.freeze({
  presentation_16_9: Object.freeze({
    id: "presentation_16_9",
    label: "演示汇报",
    width: 1280,
    height: 720,
    powerpoint_width_in: 13.333333,
    powerpoint_height_in: 7.5,
    orientation: "landscape",
  }),
  short_video_broll_9_16: Object.freeze({
    id: "short_video_broll_9_16",
    label: "短视频 B-roll",
    width: 720,
    height: 1280,
    powerpoint_width_in: 7.5,
    powerpoint_height_in: 13.333333,
    orientation: "portrait",
  }),
  knowledge_graphic_3_4: Object.freeze({
    id: "knowledge_graphic_3_4",
    label: "知识图文",
    width: 720,
    height: 960,
    powerpoint_width_in: 7.5,
    powerpoint_height_in: 10,
    orientation: "portrait",
  }),
});

const ALIASES = new Map([
  ["16:9", "presentation_16_9"],
  ["presentation", "presentation_16_9"],
  ["presentation_16_9", "presentation_16_9"],
  ["9:16", "short_video_broll_9_16"],
  ["b-roll", "short_video_broll_9_16"],
  ["broll", "short_video_broll_9_16"],
  ["short_video_broll_9_16", "short_video_broll_9_16"],
  ["3:4", "knowledge_graphic_3_4"],
  ["4:3竖版", "knowledge_graphic_3_4"],
  ["knowledge_graphic_3_4", "knowledge_graphic_3_4"],
]);

export function resolveCanvasProfile(value = "presentation_16_9") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    value = value.id ?? value.profile;
  }
  const key = String(value ?? "presentation_16_9").trim().toLowerCase();
  const id = ALIASES.get(key);
  if (!id) {
    const error = new Error(`Unsupported canvas profile: ${value}`);
    error.code = "CANVAS_PROFILE_FAIL";
    throw error;
  }
  return CANVAS_PROFILES[id];
}

export function isPortraitCanvas(value) {
  return resolveCanvasProfile(value).orientation === "portrait";
}
