import { SLIDE } from "./layout_constants.mjs";
import { validateR2Module } from "./validate_r2_module.mjs";

export function planR2Module(data) {
  validateR2Module(data);
  const base = {
    slide: SLIDE,
    title: { ...data.title, left: 54, top: 28, width: 1172, height: 52 },
    subtitle: data.subtitle ? { ...data.subtitle, left: 54, top: 82, width: 1172, height: 28 } : null,
  };
  if (data.module_id === "bubble-heatmap") {
    return { ...base, matrix: { left: 54, top: 132, width: 650, height: 440 }, table: { left: 742, top: 132, width: 484, height: 440 }, bottom: { left: 54, top: 604, width: 1172, height: 58 } };
  }
  if (data.module_id === "chart-insight") {
    return { ...base, chart: { left: 62, top: 150, width: 760, height: 410 }, insight: { left: 850, top: 130, width: 376, height: 460 }, bottom: { left: 54, top: 614, width: 1172, height: 48 } };
  }
  throw new Error(`Unsupported R2 module: ${data.module_id}`);
}
