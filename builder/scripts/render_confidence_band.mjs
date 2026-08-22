import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COLORS, addChartLine, addDataSourceFooter, addNode, addTextBox, createPresentation, exportPresentation,
  fitPageTitleFontSize, parseCliArgs, setSpeakerNotes,
} from "./pptx_core.mjs";
import { planConfidenceBand } from "./plan_confidence_band.mjs";
import { loadConfidenceBandInput } from "./validate_confidence_band.mjs";

const panel = (slide, name, position, fill = COLORS.white, border = COLORS.border) => slide.shapes.add({ name, geometry: "rect", position, fill, line: { style: "solid", fill: border, width: 1 } });
const line = (slide, name, from, to, color = COLORS.line, width = 1, style = "solid") => addChartLine(slide, { name, from, to, line: { style, fill: color, width } });
const fmt = (value) => Number(value).toFixed(1).replace(/\.0$/u, "");

function bandSegment(slide, name, points, color) {
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const width = Math.max(1, Math.max(...points.map((point) => point.x)) - left);
  const height = Math.max(1, Math.max(...points.map((point) => point.y)) - top);
  const local = points.map((point) => ({ x: point.x - left, y: point.y - top }));
  return slide.shapes.add({
    name, geometry: "custom", position: { left, top, width, height }, fill: `${color}/24`,
    line: { style: "solid", fill: `${color}/55`, width: 0.8 },
    customPaths: [{ width, height, commands: [{ moveTo: local[0] }, ...local.slice(1).map((point) => ({ lineTo: point })), { close: {} }] }],
  });
}

export async function renderConfidenceBand(data, output) {
  const plan = planConfidenceBand(data);
  const d = plan.normalized.diagram;
  const { presentation, slide } = createPresentation(output.background);
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true, color: COLORS.navy, maxLines: 2 });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 16, color: COLORS.muted, maxLines: 1 });
  panel(slide, "interval-chart-frame", plan.chart);
  addTextBox(slide, { name: "metric-definition", text: `${d.metric.text}（${d.unit.text}）`, position: { left: plan.chart.left + 18, top: plan.chart.top + 14, width: 300, height: 26 }, fontSize: 16, bold: true, color: COLORS.navy, singleLine: true });
  addTextBox(slide, { name: "interval-definition", text: "阴影表示估计范围", position: { left: plan.chart.left + 326, top: plan.chart.top + 14, width: 260, height: 26 }, fontSize: 14, color: COLORS.blue, singleLine: true });

  const observed = d.periods.filter((period) => period.estimate !== null);
  const values = observed.flatMap((period) => [period.lower, period.upper]);
  if (d.threshold) values.push(d.threshold.value);
  const rawMin = Math.min(...values); const rawMax = Math.max(...values); const span = Math.max(1, rawMax - rawMin);
  const min = rawMin - span * 0.14; const max = rawMax + span * 0.14;
  const plot = { left: plan.chart.left + 70, top: plan.chart.top + 70, width: plan.chart.width - 100, height: 292 };
  const x = (index) => plot.left + index / Math.max(1, d.periods.length - 1) * plot.width;
  const y = (value) => plot.top + plot.height - (value - min) / (max - min) * plot.height;
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = min + (max - min) * tick / 4; const yy = y(value);
    line(slide, `grid-${tick}`, { x: plot.left, y: yy }, { x: plot.left + plot.width, y: yy }, COLORS.border, 0.7, tick === 0 ? "solid" : "dashed");
    addTextBox(slide, { name: `y-label-${tick}`, text: fmt(value), position: { left: plot.left - 58, top: yy - 10, width: 50, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  }
  for (let index = 1; index < d.periods.length; index += 1) {
    const a = d.periods[index - 1]; const b = d.periods[index];
    if (a.estimate === null || b.estimate === null) continue;
    bandSegment(slide, `interval-band-${index}`, [{ x: x(index - 1), y: y(a.upper) }, { x: x(index), y: y(b.upper) }, { x: x(index), y: y(b.lower) }, { x: x(index - 1), y: y(a.lower) }], COLORS.blue);
    line(slide, `estimate-line-${index}`, { x: x(index - 1), y: y(a.estimate) }, { x: x(index), y: y(b.estimate) }, COLORS.navy, 2.8);
  }
  if (d.threshold) {
    const yy = y(d.threshold.value);
    line(slide, "threshold-line", { x: plot.left, y: yy }, { x: plot.left + plot.width, y: yy }, COLORS.orange, 2, "dashed");
    addTextBox(slide, { name: "threshold-label", text: `${d.threshold.label.text} ${fmt(d.threshold.value)}${d.unit.text}`, position: { left: plot.left + plot.width - 188, top: yy - 28, width: 184, height: 24 }, fontSize: 14, bold: true, color: COLORS.orange, alignment: "right", singleLine: true });
  }
  d.periods.forEach((period, index) => {
    const xx = x(index);
    line(slide, `x-tick-${index + 1}`, { x: xx, y: plot.top + plot.height }, { x: xx, y: plot.top + plot.height + 5 }, COLORS.line, 0.8);
    addTextBox(slide, { name: `x-label-${index + 1}`, text: period.label.text, position: { left: xx - 38, top: plot.top + plot.height + 8, width: 76, height: 22 }, fontSize: 12, color: period.estimate === null ? COLORS.orange : COLORS.muted, alignment: "center", singleLine: true });
    if (period.estimate !== null) {
      slide.shapes.add({ name: `estimate-point-${index + 1}`, geometry: "ellipse", position: { left: xx - 4, top: y(period.estimate) - 4, width: 8, height: 8 }, fill: COLORS.white, line: { style: "solid", fill: COLORS.navy, width: 2 } });
      addTextBox(slide, { name: `estimate-label-${index + 1}`, text: fmt(period.estimate), position: { left: xx - 28, top: y(period.estimate) - 28, width: 56, height: 20 }, fontSize: 12, bold: true, color: COLORS.navy, alignment: "center", singleLine: true });
    }
  });
  addTextBox(slide, { name: "visual-legend", text: "实线与圆点：估计值　半透明带：估计范围　虚线：关注线", position: { left: plot.left, top: plot.top + plot.height + 40, width: plot.width, height: 22 }, fontSize: 12, color: COLORS.muted, singleLine: true });

  panel(slide, "interpretation-rail", plan.rail, COLORS.soft);
  addTextBox(slide, { name: "rail-title", text: "关键发现", position: { left: plan.rail.left + 16, top: plan.rail.top + 16, width: plan.rail.width - 32, height: 28 }, fontSize: 18, bold: true, color: COLORS.navy, singleLine: true });
  d.insights.slice(0, 2).forEach((item, index) => addNode(slide, { name: `insight-${index + 1}`, text: item.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 58 + index * 116, width: plan.rail.width - 32, height: 96 }, fill: COLORS.white, border: COLORS.border, borderWidth: 1, fontSize: 14, bold: false, color: COLORS.text, alignment: "left" }));
  if (d.conclusion) addTextBox(slide, { name: "conclusion", text: d.conclusion.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 308, width: plan.rail.width - 32, height: 120 }, fontSize: 16, bold: true, color: COLORS.navy, fill: COLORS.orangeLight, line: { style: "solid", fill: COLORS.orange, width: 1 }, verticalAlignment: "middle", maxLines: 6 });
  addDataSourceFooter(slide, { source: d.source_note, disclosure: d.disclosure, position: plan.footer });
  setSpeakerNotes(slide, [
    { title: "专业术语", items: [`${d.interval_label.text}：${d.interval_definition.text}`] },
    { title: "口径解释", items: [d.sample_definition, d.population_definition, d.threshold?.semantics, d.missing_value_note] },
    { title: "计算方法", items: [d.estimation_method] },
  ]);
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = await loadConfidenceBandInput(options.input);
  const plan = await renderConfidenceBand(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, slide: plan.slide })}\n`);
}
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`); process.exitCode = 1; });
