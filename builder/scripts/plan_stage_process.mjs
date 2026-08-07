import { SLIDE } from "./layout_constants.mjs";
import { validateStageProcess } from "./validate_stage_process.mjs";

export function planStageProcess(data) {
  validateStageProcess(data);
  const count = data.diagram.steps.length;
  const left = 56;
  const right = 1224;
  const gap = -14;
  const width = (right - left - gap * (count - 1)) / count;
  if (width < 176) {
    const error = new Error("Steps cannot fit at the minimum text size");
    error.code = "SINGLE_SLIDE_FIT_FAIL";
    throw error;
  }
  const steps = data.diagram.steps.map((step, index) => ({
    ...step,
    left: left + index * (width + gap),
    top: 216,
    width,
    height: 120,
    index,
  }));
  return {
    slide: SLIDE,
    title: { ...data.title, left: 56, top: 38, width: 1168, height: 58, fontSize: 30 },
    subtitle: data.subtitle ? { ...data.subtitle, left: 56, top: 100, width: 1168, height: 30, fontSize: 18 } : null,
    steps,
    gates: steps.map((step) => ({
      step_id: step.id,
      gate: step.gate,
      left: step.left + step.width / 2 - 10,
      top: 166,
      width: 20,
      height: 20,
    })),
    bottomStrip: {
      items: data.diagram.bottom_strip ?? [],
      left: 56,
      top: 548,
      width: 1168,
      height: 92,
    },
    loopback: data.diagram.loopback ?? null,
  };
}
