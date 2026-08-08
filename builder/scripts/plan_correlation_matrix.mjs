import { SLIDE } from "./layout_constants.mjs";
import { validateCorrelationMatrix } from "./validate_correlation_matrix.mjs";
export function planCorrelationMatrix(data) {
  const normalized = validateCorrelationMatrix(data).normalized;
  return { normalized, slide: SLIDE, title: { ...normalized.title, left: 54, top: 26, width: 1172, height: 58 }, subtitle: normalized.subtitle ? { ...normalized.subtitle, left: 54, top: 84, width: 1172, height: 26 } : null, matrix: { left: 54, top: 126, width: 848, height: 450 }, rail: { left: 930, top: 126, width: 296, height: 450 }, footer: { left: 54, top: 600, width: 1172, height: 78 } };
}
