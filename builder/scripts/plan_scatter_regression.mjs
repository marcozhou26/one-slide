import { SLIDE } from "./layout_constants.mjs";
import { validateScatterRegression } from "./validate_scatter_regression.mjs";

export function planScatterRegression(data) {
  const validation = validateScatterRegression(data);
  return {
    validation,
    slide: SLIDE,
    title: { ...data.title, left: 54, top: 26, width: 1172, height: 58 },
    subtitle: data.subtitle ? { ...data.subtitle, left: 54, top: 84, width: 1172, height: 26 } : null,
    chart: { left: 54, top: 126, width: 858, height: 458 },
    rail: { left: 938, top: 126, width: 288, height: 458 },
    footer: { left: 54, top: 608, width: 1172, height: 68 },
  };
}
