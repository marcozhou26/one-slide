import { SLIDE } from "./layout_constants.mjs";
import { validateR2Module } from "./validate_r2_module.mjs";

export function planR2Module(data) {
  validateR2Module(data);
  const base = {
    slide: SLIDE,
    title: { ...data.title, left: 54, top: 28, width: 1172, height: 52 },
    subtitle: data.subtitle ? { ...data.subtitle, left: 54, top: 82, width: 1172, height: 28 } : null,
  };
  if (data.module_id === "route-tradeoff") {
    return { ...base, panels: [{ left: 54, top: 130, width: 430, height: 430 }, { left: 796, top: 130, width: 430, height: 430 }], conflict: { left: 516, top: 130, width: 248, height: 430 }, convergence: { left: 160, top: 590, width: 960, height: 76 } };
  }
  if (data.module_id === "scqa-roadmap") {
    return { ...base, scqa: { left: 54, top: 125, width: 1172, height: 132 }, roadmap: { left: 54, top: 300, width: 1172, height: 330 } };
  }
  if (data.module_id === "bubble-heatmap") {
    return { ...base, matrix: { left: 54, top: 132, width: 650, height: 440 }, table: { left: 742, top: 132, width: 484, height: 440 }, bottom: { left: 54, top: 604, width: 1172, height: 58 } };
  }
  if (data.module_id === "chart-insight") {
    return { ...base, chart: { left: 62, top: 150, width: 760, height: 410 }, insight: { left: 850, top: 130, width: 376, height: 460 }, bottom: { left: 54, top: 614, width: 1172, height: 48 } };
  }
  return { ...base, scenarios: { left: 54, top: 148, width: 1172, height: 420 }, bottom: { left: 54, top: 596, width: 920, height: 68 }, contingent: { left: 994, top: 576, width: 232, height: 88 } };
}
