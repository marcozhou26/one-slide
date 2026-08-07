export const SLIDE = Object.freeze({ width: 1280, height: 720 });
export const FONT_SIZES = Object.freeze({
  pageTitle: 32,
  pageSubtitle: 14,
  hero: 24,
  sectionTitle: 18,
  body: 14,
  compact: 12,
  source: 12,
});
export const MIN_FONT_BY_ROLE = Object.freeze({
  pageTitle: 24,
  pageSubtitle: 12,
  hero: 20,
  sectionTitle: 16,
  body: 12,
  compact: 12,
  source: 12,
});
export const MIN_BODY_FONT_SIZE = MIN_FONT_BY_ROLE.body;
export const MIN_VISIBLE_FONT_SIZE = 12;
export const POWERPOINT_POINT_TO_ARTIFACT_UNIT = 4 / 3;

export function toArtifactFontSize(points) {
  return Math.max(points, MIN_VISIBLE_FONT_SIZE) * POWERPOINT_POINT_TO_ARTIFACT_UNIT;
}

export function validateTypography(role, fontSize) {
  const minimum = MIN_FONT_BY_ROLE[role];
  if (minimum === undefined) {
    throw new Error(`Unsupported text role: ${role}`);
  }
  if (!Number.isFinite(fontSize) || fontSize < minimum) {
    throw new Error(`${role} text cannot be smaller than ${minimum} pt`);
  }
  return { role, fontSize, minimum };
}

export function fitPageTitleFontSize(text) {
  const length = Array.from(String(text ?? "")).length;
  if (length > 36) return 24;
  if (length > 32) return 26;
  return 30;
}
