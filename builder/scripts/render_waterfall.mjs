import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planWaterfall } from "./plan_waterfall.mjs";
import {
  COLORS,
  addChartLine,
  addTextBox,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";

function barColor(kind) {
  if (kind === "increase") return COLORS.blue;
  if (kind === "decrease") return COLORS.orange;
  return COLORS.navy;
}

function formatValue(value, unit, signed = true) {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
}

export async function renderWaterfall(data, output) {
  const plan = planWaterfall(data);
  const { presentation, slide } = createPresentation(output.background);
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true });

  addChartLine(slide, {
    name: "zero-baseline",
    from: { x: plan.chart.left, y: plan.baseline },
    to: { x: plan.chart.left + plan.chart.width, y: plan.baseline },
    line: { style: "solid", fill: COLORS.border, width: 1 },
  });
  for (let index = 0; index < plan.bars.length - 1; index += 1) {
    const current = plan.bars[index];
    const next = plan.bars[index + 1];
    addChartLine(slide, {
      name: `bridge-${index + 1}`,
      from: { x: current.left + current.width, y: current.connector_y },
      to: { x: next.left, y: current.connector_y },
      line: { style: "dashed", fill: COLORS.line, width: 1.2 },
    });
  }
  plan.bars.forEach((bar, index) => {
    slide.shapes.add({
      name: `bar-${bar.id ?? index + 1}`,
      geometry: "rect",
      position: { left: bar.left, top: bar.top, width: bar.width, height: bar.height },
      fill: barColor(bar.kind),
      line: { style: "solid", fill: barColor(bar.kind), width: 1 },
    });
    const value = bar.kind === "total" ? bar.end_value : bar.value;
    addTextBox(slide, {
      name: `value-${index + 1}`,
      text: formatValue(value, plan.unit, bar.kind !== "total"),
      position: { left: bar.left - 20, top: Math.max(108, bar.top - 32), width: bar.width + 40, height: 26 },
      fontSize: 16,
      bold: true,
      alignment: "center",
      color: barColor(bar.kind),
    });
    addTextBox(slide, {
      name: `label-${index + 1}`,
      text: bar.text,
      position: { left: bar.left - 34, top: 520, width: bar.width + 68, height: 34 },
      fontSize: 16,
      alignment: "center",
    });
  });

  slide.shapes.add({
    name: "insight-rail",
    geometry: "rect",
    position: plan.insightRail,
    fill: COLORS.soft,
    line: { style: "solid", fill: COLORS.border, width: 1 },
  });
  addTextBox(slide, {
    name: "insight-title",
    text: "key insights",
    position: { left: 968, top: 170, width: 238, height: 28 },
    fontSize: 18,
    bold: true,
    color: COLORS.blue,
  });
  plan.insights.forEach((insight, index) => {
    addTextBox(slide, {
      name: `insight-${index + 1}`,
      text: insight.text,
      position: { left: 968, top: 218 + index * 88, width: 238, height: 72 },
      fontSize: 14,
      bold: index === 0,
    });
  });
  if (plan.bottom) {
    addTextBox(slide, {
      name: "bottom-conclusion",
      text: plan.bottom.text,
      position: plan.bottom,
      fontSize: 18,
      bold: true,
      fill: COLORS.blueLight,
      line: { style: "solid", fill: COLORS.blue, width: 1.5 },
    });
  }
  plan.footnotes.forEach((footnote, index) => {
    addTextBox(slide, {
      name: `source-footnote-${index + 1}`,
      text: footnote.text,
      position: footnote,
      textRole: "source",
      fontSize: 12,
      color: COLORS.muted,
      maxLines: 1,
      singleLine: true,
    });
  });
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(options.input, "utf8"));
  const plan = await renderWaterfall(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: "waterfall-attribution", bars: plan.bars.length })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
