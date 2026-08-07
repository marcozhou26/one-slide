import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planStageProcess } from "./plan_stage_process.mjs";
import {
  COLORS,
  addNode,
  addTextBox,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";

const STEP_FILLS = ["#15375F", "#255481", "#3D6F9E", "#628AAE", "#8EABC5", "#B7C9D9"];

function stepText(step) {
  const lines = [];
  if (step.action) lines.push(step.action.text);
  for (const activity of step.activities ?? []) lines.push(`• ${activity.text}`);
  if (step.deliverable) lines.push(step.deliverable.text);
  if (step.owner_period) lines.push(step.owner_period.text);
  return lines.join("\n");
}

export async function renderStageProcess(data, output) {
  const plan = planStageProcess(data);
  const { presentation, slide } = createPresentation(output.background);
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 18, color: COLORS.muted });

  const stepShapes = [];
  for (const step of plan.steps) {
    const emphasized = step.emphasis === "bottleneck";
    stepShapes.push(
      addNode(slide, {
        name: `step-${step.id}`,
        text: "",
        position: step,
        geometry: "chevron",
        fill: emphasized ? COLORS.orange : STEP_FILLS[step.index],
        border: COLORS.white,
        borderWidth: 2,
        fontSize: 16,
      }),
    );
  }
  plan.steps.forEach((step, index) => {
    const emphasized = step.emphasis === "bottleneck";
    const leftInset = Math.max(50, step.width * 0.22);
    const rightInset = Math.max(34, step.width * 0.12);
    const titleBox = addTextBox(slide, {
      name: `step-title-${step.id}`,
      text: step.text,
      position: {
        left: step.left + leftInset,
        top: step.top + 34,
        width: step.width - leftInset - rightInset,
        height: 46,
      },
      fontSize: 18,
      bold: true,
      color: emphasized || index < 4 ? COLORS.white : COLORS.text,
      alignment: "center",
    });
    titleBox.bringToFront();
    const detailBox = addTextBox(slide, {
      name: `step-detail-${step.id}`,
      text: stepText(step),
      position: {
        left: step.left + 26,
        top: step.top + step.height + 28,
        width: step.width - 52,
        height: 108,
      },
      fontSize: emphasized ? 18 : 16,
      bold: emphasized,
      color: emphasized ? COLORS.orange : COLORS.text,
      alignment: "center",
      fill: emphasized ? COLORS.orangeLight : COLORS.white,
      line: { style: "solid", fill: emphasized ? COLORS.orange : COLORS.border, width: emphasized ? 1.8 : 1.2 },
    });
    detailBox.bringToFront();
  });

  plan.gates.forEach((gate, index) => {
    if (!gate.gate) return;
    slide.shapes.add({
      name: `gate-${index + 1}`,
      geometry: "diamond",
      position: gate,
      fill: COLORS.orange,
      line: { style: "solid", fill: COLORS.orange, width: 1.5 },
    });
    addTextBox(slide, {
      name: `gate-label-${index + 1}`,
      text: gate.gate.text,
      position: { left: gate.left - 70, top: gate.top - 36, width: 160, height: 30 },
      fontSize: 16,
      bold: true,
      alignment: "center",
      color: COLORS.orange,
    });
  });

  if (plan.bottomStrip.items.length > 0) {
    slide.shapes.add({
      name: "bottom-strip",
      geometry: "rect",
      position: plan.bottomStrip,
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: 1 },
    });
    const itemWidth = plan.bottomStrip.width / plan.bottomStrip.items.length;
    plan.bottomStrip.items.forEach((item, index) => {
      addTextBox(slide, {
        name: `bottom-item-${index + 1}`,
        text: item.text,
        position: {
          left: plan.bottomStrip.left + index * itemWidth + 16,
          top: plan.bottomStrip.top + 12,
          width: itemWidth - 32,
          height: plan.bottomStrip.height - 24,
        },
        fontSize: 16,
        bold: index === 0,
      });
    });
  }
  if (plan.loopback) {
    connectNative(slide, stepShapes.at(-1), stepShapes[0], {
      kind: "curved",
      role: "relationship",
      fromSide: "bottom",
      toSide: "bottom",
      line: { style: "dashed", fill: COLORS.orange, width: 1.8 },
    });
    addTextBox(slide, {
      name: "loopback-label",
      text: plan.loopback.text,
      position: { left: 510, top: 655, width: 260, height: 28 },
      fontSize: 16,
      bold: true,
      alignment: "center",
      color: COLORS.orange,
    });
  }
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(options.input, "utf8"));
  const plan = await renderStageProcess(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: "stage-process", steps: plan.steps.length })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
