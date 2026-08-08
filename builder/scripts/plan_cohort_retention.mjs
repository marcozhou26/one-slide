import { SLIDE } from "./layout_constants.mjs";
import { validateCohortRetention } from "./validate_cohort_retention.mjs";

export function planCohortRetention(data) {
  const normalized = validateCohortRetention(data).normalized;
  return {
    normalized,
    slide: SLIDE,
    title: { ...normalized.title, left: 54, top: 26, width: 1172, height: 58 },
    subtitle: normalized.subtitle ? { ...normalized.subtitle, left: 54, top: 84, width: 1172, height: 26 } : null,
    chart: { left: 54, top: 126, width: 886, height: 458 },
    rail: { left: 966, top: 126, width: 260, height: 458 },
    footer: { left: 54, top: 610, width: 1172, height: 66 },
  };
}
