import { SLIDE } from "./layout_constants.mjs";
import { validateConfidenceBand } from "./validate_confidence_band.mjs";

export function planConfidenceBand(data) {
  const normalized = validateConfidenceBand(data).normalized;
  return {
    normalized,
    slide: SLIDE,
    title: { ...normalized.title, left: 54, top: 26, width: 1172, height: 58 },
    subtitle: normalized.subtitle ? { ...normalized.subtitle, left: 54, top: 84, width: 1172, height: 26 } : null,
    chart: { left: 54, top: 126, width: 864, height: 458 },
    rail: { left: 944, top: 126, width: 282, height: 458 },
    footer: { left: 54, top: 652, width: 1088, height: 20 },
  };
}
