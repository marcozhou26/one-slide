import fs from "node:fs/promises";
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
import { planCohortRetention } from "./plan_cohort_retention.mjs";
import { loadCohortRetentionInput } from "./validate_cohort_retention.mjs";

const SERIES_COLORS = [COLORS.navy, COLORS.orange, COLORS.blue, "#5B8E7D", "#6A5D8C", "#A45B5B", "#3F7C85", "#8A6D3B"];
const panel = (slide, name, position, fill = COLORS.white, border = COLORS.border) => slide.shapes.add({ name, geometry: "rect", position, fill, line: { style: "solid", fill: border, width: 1 } });
const line = (slide, name, from, to, color = COLORS.line, width = 1, style = "solid") => addChartLine(slide, { name, from, to, line: { style, fill: color, width } });

function point(plot, index, count, rate) {
  return { x: plot.left + index / Math.max(1, count - 1) * plot.width, y: plot.top + plot.height - rate / 100 * plot.height };
}

function circle(slide, name, center, color, hollow = false) {
  return slide.shapes.add({ name, geometry: "ellipse", position: { left: center.x - 4, top: center.y - 4, width: 8, height: 8 }, fill: hollow ? COLORS.white : color, line: { style: "solid", fill: color, width: 1.5 } });
}

function renderHeader(slide, plan) {
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true, color: COLORS.navy, maxLines: 2 });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 16, color: COLORS.muted, maxLines: 1 });
}

function renderRail(slide, plan, diagram) {
  panel(slide, "insight-rail", plan.rail, COLORS.soft);
  addTextBox(slide, { name: "insight-title", text: "读图结论", position: { left: plan.rail.left + 16, top: plan.rail.top + 16, width: plan.rail.width - 32, height: 28 }, fontSize: 18, bold: true, color: COLORS.navy, singleLine: true });
  diagram.insights.forEach((item, index) => {
    addTextBox(slide, { name: `insight-index-${index + 1}`, text: String(index + 1).padStart(2, "0"), position: { left: plan.rail.left + 16, top: plan.rail.top + 62 + index * 104, width: 36, height: 24 }, fontSize: 14, bold: true, color: COLORS.blue, singleLine: true });
    addTextBox(slide, { name: `insight-${index + 1}`, text: item.text, position: { left: plan.rail.left + 58, top: plan.rail.top + 56 + index * 104, width: plan.rail.width - 74, height: 78 }, fontSize: 16, bold: false, color: COLORS.text, verticalAlignment: "top", maxLines: 4 });
  });
  if (diagram.censoring_note) {
    addTextBox(slide, { name: "censoring-legend", text: diagram.censoring_note.text, position: { left: plan.rail.left + 16, top: plan.rail.top + plan.rail.height - 72, width: plan.rail.width - 32, height: 52 }, fontSize: 14, bold: true, color: COLORS.orange, verticalAlignment: "top", maxLines: 3 });
  }
}

export async function renderCohortRetention(data, output) {
  const plan = planCohortRetention(data);
  const normalized = plan.normalized;
  const d = normalized.diagram;
  const { presentation, slide } = createPresentation(output.background);
  renderHeader(slide, plan);
  panel(slide, "cohort-chart-frame", plan.chart);
  const metaTop = plan.chart.top + 14;
  addTextBox(slide, { name: "cohort-definition", text: `批次：${d.cohort_definition.text}`, position: { left: plan.chart.left + 18, top: metaTop, width: 250, height: 40 }, fontSize: 14, bold: true, color: COLORS.navy, maxLines: 2 });
  addTextBox(slide, { name: "measure-definition", text: `指标：${d.measure.text}`, position: { left: plan.chart.left + 278, top: metaTop, width: 390, height: 40 }, fontSize: 14, color: COLORS.muted, maxLines: 2 });
  addTextBox(slide, { name: "denominator-definition", text: `分母：${d.denominator.text}`, position: { left: plan.chart.left + 678, top: metaTop, width: 190, height: 40 }, fontSize: 14, color: COLORS.muted, alignment: "right", maxLines: 2 });
  const plot = { left: plan.chart.left + 66, top: plan.chart.top + 90, width: plan.chart.width - 100, height: 252 };
  [0, 25, 50, 75, 100].forEach((tick) => {
    const y = point(plot, 0, d.relative_periods.length, tick).y;
    line(slide, `grid-${tick}`, { x: plot.left, y }, { x: plot.left + plot.width, y }, COLORS.border, 0.7, tick === 0 ? "solid" : "dashed");
    addTextBox(slide, { name: `y-axis-${tick}`, text: `${tick}%`, position: { left: plot.left - 62, top: y - 10, width: 54, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  });
  d.relative_periods.forEach((period, index) => {
    const x = point(plot, index, d.relative_periods.length, 0).x;
    line(slide, `x-tick-${index + 1}`, { x, y: plot.top + plot.height }, { x, y: plot.top + plot.height + 5 }, COLORS.line, 0.8);
    addTextBox(slide, { name: `x-label-${index + 1}`, text: period.label.text, position: { left: x - 34, top: plot.top + plot.height + 8, width: 68, height: 22 }, fontSize: 12, color: COLORS.muted, alignment: "center", singleLine: true });
  });
  addTextBox(slide, { name: "x-axis-unit", text: `相对周期（${d.relative_period_unit.text}）`, position: { left: plot.left + plot.width - 154, top: plot.top + plot.height + 31, width: 154, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });

  d.cohorts.forEach((cohort, cohortIndex) => {
    const color = SERIES_COLORS[cohortIndex];
    const observed = cohort.retention_rates.map((rate, index) => rate === null ? null : { index, rate, count: cohort.retained_counts[index] }).filter(Boolean);
    observed.slice(1).forEach((current, index) => {
      const prior = observed[index];
      line(slide, `cohort-line-${cohortIndex + 1}-${index + 1}`, point(plot, prior.index, d.relative_periods.length, prior.rate), point(plot, current.index, d.relative_periods.length, current.rate), color, cohortIndex === 0 ? 2.8 : 2.1);
    });
    observed.forEach((item, index) => circle(slide, `cohort-point-${cohortIndex + 1}-${index + 1}`, point(plot, item.index, d.relative_periods.length, item.rate), color, index === observed.length - 1 && observed.length < d.relative_periods.length));
    const last = observed.at(-1);
    const lastPoint = point(plot, last.index, d.relative_periods.length, last.rate);
    addTextBox(slide, { name: `cohort-end-${cohortIndex + 1}`, text: `${Math.round(last.rate)}%`, position: { left: Math.min(lastPoint.x + 5, plot.left + plot.width - 48), top: lastPoint.y - 12, width: 50, height: 22 }, fontSize: 12, bold: true, color, singleLine: true });
  });

  const legendTop = plan.chart.top + 385;
  const legendWidth = (plan.chart.width - 36) / d.cohorts.length;
  d.cohorts.forEach((cohort, index) => {
    const lastIndex = cohort.retention_rates.reduce((found, value, itemIndex) => value === null ? found : itemIndex, 0);
    const matureLabel = lastIndex === d.relative_periods.length - 1 ? "已观察完整" : `观察至${d.relative_periods[lastIndex].label.text}`;
    addTextBox(slide, { name: `cohort-legend-${index + 1}`, text: `${cohort.label.text}\nn=${cohort.initial_count} · ${matureLabel}`, position: { left: plan.chart.left + 18 + index * legendWidth, top: legendTop, width: legendWidth - 6, height: 48 }, fontSize: 12, bold: true, color: SERIES_COLORS[index], alignment: "center", maxLines: 2 });
  });
  renderRail(slide, plan, d);
  const footerCopy = [d.source_note.text, d.disclosure?.text].filter(Boolean).join("；");
  addTextBox(slide, { name: "source-note", text: footerCopy, position: { left: plan.footer.left, top: plan.footer.top, width: plan.footer.width, height: 24 }, fontSize: 12, color: d.disclosure ? COLORS.orange : COLORS.muted, maxLines: 1 });
  if (d.conclusion) addTextBox(slide, { name: "cohort-conclusion", text: d.conclusion.text, position: { left: plan.footer.left, top: plan.footer.top + 28, width: plan.footer.width, height: 34 }, fontSize: 16, bold: true, color: COLORS.navy, fill: COLORS.orangeLight, line: { style: "solid", fill: COLORS.orange, width: 1 }, alignment: "center", maxLines: 2 });
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = await loadCohortRetentionInput(options.input);
  const plan = await renderCohortRetention(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, slide: plan.slide })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
