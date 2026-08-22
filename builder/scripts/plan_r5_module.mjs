import { SLIDE } from "./layout_constants.mjs";
import { validateR5Module } from "./validate_r5_module.mjs";
export function planR5Module(data) {
  validateR5Module(data);
  const base = {
    slide: SLIDE,
    title: { ...data.title, left: 54, top: 26, width: 1172, height: 58 },
    subtitle: data.subtitle
      ? { ...data.subtitle, left: 54, top: 84, width: 1172, height: 26 }
      : null,
  };
  if (
    [
      "hr-age-gender-pyramid",
      "hr-supply-demand-gap",
      "hr-level-function-matrix",
    ].includes(data.module_id)
  ) {
    return {
      ...base,
      main: { left: 54, top: 126, width: 880, height: 468 },
      rail: { left: 960, top: 126, width: 266, height: 468 },
      bottom: { left: 54, top: 622, width: 1172, height: 42 },
    };
  }
  if (data.module_id === "hr-workforce-reconciliation") {
    return {
      ...base,
      main: { left: 54, top: 126, width: 914, height: 468 },
      rail: { left: 994, top: 126, width: 232, height: 468 },
      bottom: { left: 54, top: 622, width: 1172, height: 42 },
    };
  }
  if (data.module_id === "hr-from-to-mobility") {
    return {
      ...base,
      matrix: { left: 54, top: 126, width: 720, height: 468 },
      network: { left: 800, top: 126, width: 426, height: 468 },
      bottom: { left: 54, top: 622, width: 1172, height: 42 },
    };
  }
  return {
    ...base,
    main: { left: 54, top: 126, width: 866, height: 468 },
    rail: { left: 946, top: 126, width: 280, height: 468 },
    bottom: { left: 54, top: 622, width: 1172, height: 42 },
  };
}
