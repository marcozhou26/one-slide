import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COLORS,
  addChartLine,
  addTextBox,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";
import { planScatterRegression } from "./plan_scatter_regression.mjs";
import { loadScatterRegressionInput } from "./validate_scatter_regression.mjs";

const panel = (slide, name, position, fill = COLORS.white, border = COLORS.border) => slide.shapes.add({ name, geometry: "rect", position, fill, line: { style: "solid", fill: border, width: 1 } });
const line = (slide, name, from, to, color = COLORS.line, width = 1, style = "solid") => addChartLine(slide, { name, from, to, line: { style, fill: color, width } });
const padRange = (min, max) => { const pad = Math.max((max - min) * 0.1, 1); return { min: min - pad, max: max + pad }; };

function renderHeader(slide, plan) {
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true, color: COLORS.navy, maxLines: 2 });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 16, color: COLORS.muted, maxLines: 1 });
}

function renderRail(slide, plan, d, calculated) {
  panel(slide, "regression-rail", plan.rail, COLORS.soft);
  addTextBox(slide, { name: "model-title", text: "线性拟合结果", position: { left: plan.rail.left + 16, top: plan.rail.top + 14, width: plan.rail.width - 32, height: 28 }, fontSize: 18, bold: true, color: COLORS.navy, singleLine: true });
  const sign = calculated.intercept < 0 ? "−" : "+";
  addTextBox(slide, { name: "model-equation", text: `y = ${calculated.slope.toFixed(2)}x ${sign} ${Math.abs(calculated.intercept).toFixed(2)}`, position: { left: plan.rail.left + 16, top: plan.rail.top + 54, width: plan.rail.width - 32, height: 36 }, fontSize: 18, bold: true, color: COLORS.blue, alignment: "center", singleLine: true });
  addTextBox(slide, { name: "model-r2", text: `R²=${calculated.r_squared.toFixed(3)} · n=${calculated.valid.length}`, position: { left: plan.rail.left + 16, top: plan.rail.top + 92, width: plan.rail.width - 32, height: 28 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center", singleLine: true });
  d.insights.forEach((item, index) => {
    addTextBox(slide, { name: `insight-index-${index + 1}`, text: String(index + 1).padStart(2, "0"), position: { left: plan.rail.left + 16, top: plan.rail.top + 142 + index * 76, width: 34, height: 22 }, fontSize: 14, bold: true, color: COLORS.blue, singleLine: true });
    addTextBox(slide, { name: `insight-${index + 1}`, text: item.text, position: { left: plan.rail.left + 56, top: plan.rail.top + 136 + index * 76, width: plan.rail.width - 72, height: 60 }, fontSize: 16, bold: false, color: COLORS.text, verticalAlignment: "top", maxLines: 3 });
  });
  addTextBox(slide, { name: "interpretation-boundary", text: d.interpretation_boundary.text, position: { left: plan.rail.left + 16, top: plan.rail.top + plan.rail.height - 72, width: plan.rail.width - 32, height: 56 }, fontSize: 14, bold: true, color: COLORS.orange, verticalAlignment: "top", maxLines: 3 });
}

export async function renderScatterRegression(data, output) {
  const plan = planScatterRegression(data);
  const calculated = plan.validation.calculated;
  const d = data.diagram;
  const { presentation, slide } = createPresentation(output.background);
  renderHeader(slide, plan);
  panel(slide, "scatter-frame", plan.chart);
  const plot = { left: plan.chart.left + 76, top: plan.chart.top + 60, width: plan.chart.width - 112, height: plan.chart.height - 142 };
  const xRange = padRange(Math.min(...calculated.valid.map((item) => item.x)), Math.max(...calculated.valid.map((item) => item.x)));
  const yRange = padRange(Math.min(...calculated.valid.map((item) => item.y)), Math.max(...calculated.valid.map((item) => item.y)));
  const x = (value) => plot.left + (value - xRange.min) / (xRange.max - xRange.min) * plot.width;
  const y = (value) => plot.top + (yRange.max - value) / (yRange.max - yRange.min) * plot.height;
  for (let tick = 0; tick <= 4; tick += 1) {
    const xv = xRange.min + tick / 4 * (xRange.max - xRange.min);
    const yv = yRange.max - tick / 4 * (yRange.max - yRange.min);
    const xx = x(xv); const yy = y(yv);
    line(slide, `grid-x-${tick}`, { x: xx, y: plot.top }, { x: xx, y: plot.top + plot.height }, COLORS.border, 0.7, "dashed");
    line(slide, `grid-y-${tick}`, { x: plot.left, y: yy }, { x: plot.left + plot.width, y: yy }, COLORS.border, 0.7, "dashed");
    addTextBox(slide, { name: `x-tick-${tick}`, text: xv.toFixed(0), position: { left: xx - 30, top: plot.top + plot.height + 7, width: 60, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "center", singleLine: true });
    addTextBox(slide, { name: `y-tick-${tick}`, text: yv.toFixed(0), position: { left: plot.left - 58, top: yy - 10, width: 50, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  }
  line(slide, "x-axis", { x: plot.left, y: plot.top + plot.height }, { x: plot.left + plot.width, y: plot.top + plot.height }, COLORS.navy, 1.2);
  line(slide, "y-axis", { x: plot.left, y: plot.top }, { x: plot.left, y: plot.top + plot.height }, COLORS.navy, 1.2);
  const yStart = calculated.intercept + calculated.slope * xRange.min;
  const yEnd = calculated.intercept + calculated.slope * xRange.max;
  line(slide, "regression-line", { x: x(xRange.min), y: y(yStart) }, { x: x(xRange.max), y: y(yEnd) }, COLORS.blue, 2.8);
  const highlighted = new Set(d.highlight_ids);
  calculated.valid.forEach((item, index) => {
    const isHighlight = highlighted.has(item.id);
    const radius = isHighlight ? 6 : 4.5;
    slide.shapes.add({ name: `observation-${index + 1}`, geometry: "ellipse", position: { left: x(item.x) - radius, top: y(item.y) - radius, width: radius * 2, height: radius * 2 }, fill: isHighlight ? COLORS.orange : COLORS.navy, line: { style: "solid", fill: COLORS.white, width: 0.8 } });
    if (isHighlight) {
      const source = d.observations.find((observation) => observation.id === item.id);
      const labelLeft = Math.min(x(item.x) + 10, plot.left + plot.width - 174);
      const labelTop = Math.max(plot.top + 4, y(item.y) - 38);
      line(slide, `highlight-leader-${item.id}`, { x: x(item.x) + 4, y: y(item.y) - 4 }, { x: labelLeft, y: labelTop + 18 }, COLORS.orange, 1.1);
      addTextBox(slide, { name: `highlight-label-${item.id}`, text: source.label.text, position: { left: labelLeft, top: labelTop, width: 174, height: 36 }, fontSize: 12, bold: true, color: COLORS.orange, fill: COLORS.white, line: { style: "solid", fill: COLORS.orange, width: 1 }, maxLines: 2 });
    }
  });
  addTextBox(slide, { name: "x-axis-title", text: `${d.x_metric.text}（${d.x_unit.text}）`, position: { left: plot.left, top: plot.top + plot.height + 31, width: plot.width, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy, alignment: "center", singleLine: true });
  addTextBox(slide, { name: "y-axis-title", text: `${d.y_metric.text}（${d.y_unit.text}）`, position: { left: plan.chart.left + 16, top: plan.chart.top + 14, width: 320, height: 26 }, fontSize: 14, bold: true, color: COLORS.navy, singleLine: true });
  addTextBox(slide, { name: "sample-meta", text: `${d.population.text} · ${d.period.text} · n=${d.sample.valid}/${d.sample.total} · 缺失${d.sample.missing} · 重复${d.sample.duplicate_pairs}`, position: { left: plan.chart.left + 326, top: plan.chart.top + 14, width: plan.chart.width - 342, height: 26 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  addTextBox(slide, { name: "outlier-rule", text: d.outlier_rule.text, position: { left: plan.chart.left + 18, top: plan.chart.top + plan.chart.height - 34, width: plan.chart.width - 36, height: 22 }, fontSize: 12, color: COLORS.muted, singleLine: true });
  renderRail(slide, plan, d, calculated);
  const footer = [`样本：${d.sample_definition.text}`, d.source_note.text, d.disclosure?.text].filter(Boolean).join("；");
  addTextBox(slide, { name: "source-note", text: footer, position: { left: plan.footer.left, top: plan.footer.top, width: plan.footer.width, height: 20 }, fontSize: 12, color: d.disclosure ? COLORS.orange : COLORS.muted, singleLine: true });
  addTextBox(slide, { name: "reconciliation-note", text: d.reconciliation_rule.text, position: { left: plan.footer.left, top: plan.footer.top + 19, width: plan.footer.width, height: 18 }, fontSize: 12, color: COLORS.muted, singleLine: true });
  if (d.conclusion) addTextBox(slide, { name: "conclusion", text: d.conclusion.text, position: { left: plan.footer.left, top: plan.footer.top + 38, width: plan.footer.width, height: 28 }, fontSize: 16, bold: true, color: COLORS.navy, fill: COLORS.orangeLight, line: { style: "solid", fill: COLORS.orange, width: 1 }, alignment: "center", singleLine: true });
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${d.source_note.text}\n- ${d.reconciliation_rule.text}`);
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = await loadScatterRegressionInput(options.input);
  const plan = await renderScatterRegression(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, slide: plan.slide })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
