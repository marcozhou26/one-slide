import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, addChartLine, addDataSourceFooter, addNode, addTextBox, createPresentation, exportPresentation, fitPageTitleFontSize, parseCliArgs, setSpeakerNotes } from "./pptx_core.mjs";
import { planR3Module } from "./plan_r3_module.mjs";
import { calculateHistogram, loadR3ModuleInput } from "./validate_r3_module.mjs";

const STACK = [COLORS.orange, COLORS.navy, COLORS.blue, COLORS.line, COLORS.soft];
const COMPOSITION_STACK = [COLORS.orange, COLORS.navy, COLORS.blue, "#5B8E7D", COLORS.line, "#6A5D8C"];
const PALE_ORANGE = COLORS.orangeLight;
const PALE_BLUE = COLORS.blueLight;
const PART_TO_WHOLE_COLORS = [COLORS.blue, COLORS.navy, "#5B8E7D", "#6A5D8C", COLORS.muted, COLORS.line];

function header(slide, plan) {
  const fitted = fitPageTitleFontSize(plan.title.text);
  const titleFontSize = plan.title.text.length > 36 ? Math.min(fitted, 24) : fitted;
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: titleFontSize, bold: true, color: COLORS.navy });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 16, color: COLORS.muted });
}
function panel(slide, name, position, fill = COLORS.white, border = COLORS.border, width = 1.1) { return slide.shapes.add({ name, geometry: "rect", position, fill, line: { style: "solid", fill: border, width } }); }
function line(slide, name, x1, y1, x2, y2, style = "solid", color = COLORS.line, width = 1) { return addChartLine(slide, { name, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, line: { style, fill: color, width } }); }
function insights(slide, position, items, title = "关键洞察") {
  panel(slide, `${title}-rail`, position, COLORS.soft);
  addTextBox(slide, { name: `${title}-title`, text: title, position: { left: position.left + 18, top: position.top + 14, width: position.width - 36, height: 30 }, fontSize: 18, bold: true, color: COLORS.navy });
  items.slice(0, 3).forEach((item, index) => addNode(slide, { name: `${title}-item-${index + 1}`, text: item.text, position: { left: position.left + 16, top: position.top + 60 + index * 122, width: position.width - 32, height: 96 }, fill: COLORS.white, border: COLORS.border, borderWidth: 1, fontSize: 16, bold: false, color: COLORS.text, alignment: "left" }));
}
function bottom(slide, position, item) { if (item) addNode(slide, { name: "bottom-conclusion", text: item.text, position, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.3, fontSize: 18, bold: true, color: COLORS.navy }); }
function plainGrowth(text) {
  return String(text ?? "").replace(/CAGR\s*([+\-]?\s*\d+(?:\.\d+)?%)/giu, "年均增长 $1");
}

function renderMekko(slide, data, plan) {
  panel(slide, "mekko-frame", plan.chart);
  const plot = { left: plan.chart.left + 54, top: plan.chart.top + 66, width: plan.chart.width - 78, height: plan.chart.height - 120 };
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = plot.top + (tick / 4) * plot.height;
    line(slide, `mekko-grid-${tick}`, plot.left, y, plot.left + plot.width, y, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `mekko-tick-${tick}`, text: `${100 - tick * 25}%`, position: { left: plan.chart.left - 20, top: y - 12, width: 70, height: 24 }, fontSize: 14, color: COLORS.muted, alignment: "right", singleLine: true });
  }
  let cursor = plot.left;
  data.diagram.segments.forEach((segment, segmentIndex) => {
    const width = plot.width * segment.size_share / 100;
    let y = plot.top + plot.height;
    segment.stacks.forEach((stack, stackIndex) => {
      const height = plot.height * stack.share / 100;
      y -= height;
      slide.shapes.add({ name: `mekko-${segmentIndex + 1}-${stackIndex + 1}`, geometry: "rect", position: { left: cursor, top: y, width, height }, fill: STACK[stackIndex], line: { style: "solid", fill: COLORS.white, width: 1.2 } });
      const narrowStack = width < 130;
      if (height >= 36 && width >= 70) addTextBox(slide, { name: `mekko-label-${segmentIndex + 1}-${stackIndex + 1}`, text: width < 110 ? `${stack.share}%` : `${stack.label.text} ${stack.share}%`, position: { left: cursor + 2, top: y + height / 2 - 12, width: width - 4, height: 24 }, fontSize: narrowStack ? 12 : 14, bold: stackIndex === 0, color: stackIndex < 3 ? COLORS.white : COLORS.text, alignment: "center", singleLine: true });
    });
    addTextBox(slide, { name: `mekko-top-${segmentIndex + 1}`, text: `${segment.absolute_size.text}\n${plainGrowth(segment.growth.text)}`, position: { left: cursor, top: plan.chart.top + 10, width, height: 48 }, fontSize: 16, bold: true, color: segment.priority ? COLORS.orange : COLORS.navy, alignment: "center" });
    addTextBox(slide, { name: `mekko-bottom-${segmentIndex + 1}`, text: `${segment.label.text}\n${segment.size_share}%`, position: { left: cursor, top: plot.top + plot.height + 8, width, height: 40 }, fontSize: 16, bold: segment.priority, color: segment.priority ? COLORS.orange : COLORS.text, alignment: "center" });
    if (segment.priority) slide.shapes.add({ name: `mekko-priority-${segmentIndex + 1}`, geometry: "rect", position: { left: cursor - 3, top: plot.top - 3, width: width + 6, height: plot.height + 6 }, fill: "none", line: { style: "solid", fill: COLORS.orange, width: 3 } });
    cursor += width;
  });
  insights(slide, plan.rail, (data.diagram.insights ?? []).slice(0, 2));
  if (data.diagram.conclusion) addNode(slide, { name: "mekko-conclusion", text: data.diagram.conclusion.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 326, width: plan.rail.width - 32, height: 112 }, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.3, fontSize: 16, bold: true, color: COLORS.navy });
  addDataSourceFooter(slide, { source: data.diagram.source_note, disclosure: data.diagram.disclosure, position: plan.footer });
  setSpeakerNotes(slide, [
    { title: "专业术语", items: ["CAGR 是复合年均增长率，页面已改写为“年均增长”。"] },
    { title: "计算方法", items: ["年均增长率 =（期末值 ÷ 期初值）的 1/年数 次方 − 1。", ...(data.diagram.segments ?? []).map((segment) => `${segment.label.text}：${segment.growth.text}`)] },
  ]);
}

function renderPartToWhole(slide, data, plan) {
  const diagram = data.diagram;
  panel(slide, "part-to-whole-exhibit", plan.exhibit);
  const priorityIndex = diagram.parts.findIndex((part) => part.priority === true);
  const colors = diagram.parts.map((_, index) => {
    if (index === priorityIndex) return COLORS.orange;
    const paletteIndex = priorityIndex >= 0 && index > priorityIndex ? index - 1 : index;
    return PART_TO_WHOLE_COLORS[paletteIndex % PART_TO_WHOLE_COLORS.length];
  });
  const percentages = diagram.parts.map((part) => part.value / diagram.total_value * 100);
  slide.charts.add(diagram.chart_type, {
    position: plan.chart,
    categories: diagram.parts.map((part) => part.label.text),
    series: [{ name: diagram.total_label.text, values: diagram.parts.map((part) => part.value), points: colors.map((fill, idx) => ({ idx, fill, line: { style: "solid", fill: COLORS.white, width: 1.2 } })) }],
    hasLegend: false,
    dataLabels: { showPercent: false, showCategoryName: false, showValue: false },
    pieOptions: diagram.chart_type === "pie" ? { firstSliceAngle: 0 } : undefined,
    doughnutOptions: diagram.chart_type === "doughnut" ? { holeSize: 55, firstSliceAngle: 0 } : undefined,
  });
  if (diagram.chart_type === "doughnut") {
    const center = { left: plan.chart.left + plan.chart.width * .29, top: plan.chart.top + plan.chart.height * .34, width: plan.chart.width * .42, height: plan.chart.height * .3 };
    addTextBox(slide, { name: "part-center-value", text: diagram.center_value.text, position: { ...center, height: center.height * .58 }, fontSize: 30, bold: true, color: priorityIndex >= 0 ? COLORS.orange : COLORS.navy, alignment: "center", verticalAlignment: "bottom", singleLine: true });
    addTextBox(slide, { name: "part-center-label", text: diagram.center_label.text, position: { left: center.left, top: center.top + center.height * .58, width: center.width, height: center.height * .42 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center", verticalAlignment: "top", singleLine: true });
  }
  addTextBox(slide, { name: "part-breakdown-title", text: diagram.total_label.text, position: { left: plan.breakdown.left, top: plan.breakdown.top, width: plan.breakdown.width, height: 30 }, fontSize: 18, bold: true, color: COLORS.navy, singleLine: true });
  const totalText = diagram.unit === "%" ? `${compactNumber(diagram.total_value)}%` : `${compactNumber(diagram.total_value)} ${diagram.unit}`;
  addTextBox(slide, { name: "part-total", text: `总量 ${totalText}`, position: { left: plan.breakdown.left, top: plan.breakdown.top + 34, width: plan.breakdown.width, height: 30 }, fontSize: 16, bold: true, color: COLORS.text, singleLine: true });
  addTextBox(slide, { name: "part-period", text: diagram.period.text, position: { left: plan.breakdown.left, top: plan.breakdown.top + 64, width: plan.breakdown.width, height: 24 }, fontSize: 14, color: COLORS.muted, singleLine: true });
  const rowsTop = plan.breakdown.top + 104;
  const rowGap = 8;
  const rowHeight = Math.min(54, (plan.breakdown.height - 104 - rowGap * (diagram.parts.length - 1)) / diagram.parts.length);
  diagram.parts.forEach((part, index) => {
    const top = rowsTop + index * (rowHeight + rowGap);
    const emphasized = part.priority === true;
    slide.shapes.add({ name: `part-swatch-${index + 1}`, geometry: "rect", position: { left: plan.breakdown.left, top: top + 8, width: 14, height: 14 }, fill: colors[index], line: { style: "solid", fill: colors[index], width: 0 } });
    addTextBox(slide, { name: `part-label-${index + 1}`, text: part.label.text, position: { left: plan.breakdown.left + 24, top, width: plan.breakdown.width * .48, height: 30 }, fontSize: 16, bold: emphasized, color: emphasized ? COLORS.orange : COLORS.text, singleLine: true });
    const valueText = diagram.unit === "%" ? `${compactNumber(part.value)}%` : `${compactNumber(part.value)} ${diagram.unit}`;
    const shareText = diagram.unit === "%" ? valueText : `${valueText}　${compactNumber(percentages[index])}%`;
    addTextBox(slide, { name: `part-value-${index + 1}`, text: shareText, position: { left: plan.breakdown.left + plan.breakdown.width * .48, top, width: plan.breakdown.width * .52, height: 30 }, fontSize: 16, bold: emphasized, color: emphasized ? COLORS.orange : COLORS.navy, alignment: "right", singleLine: true });
  });
  if (!plan.rail && (diagram.insights?.length ?? 0) === 1) {
    const top = rowsTop + diagram.parts.length * (rowHeight + rowGap) + 4;
    addTextBox(slide, { name: "part-inline-insight", text: `关键判断：${diagram.insights[0].text}`, position: { left: plan.breakdown.left, top, width: plan.breakdown.width, height: Math.max(34, plan.breakdown.top + plan.breakdown.height - top) }, fontSize: 14, bold: true, color: COLORS.orange, verticalAlignment: "top", maxLines: 3 });
  }
  if (plan.rail) {
    panel(slide, "part-insight-rail", plan.rail, COLORS.soft);
    addTextBox(slide, { name: "part-insight-title", text: "构成洞察", position: { left: plan.rail.left + 18, top: plan.rail.top + 16, width: plan.rail.width - 36, height: 30 }, fontSize: 18, bold: true, color: COLORS.navy, singleLine: true });
    (diagram.insights ?? []).forEach((item, index) => addTextBox(slide, { name: `part-insight-${index + 1}`, text: item.text, position: { left: plan.rail.left + 18, top: plan.rail.top + 72 + index * 112, width: plan.rail.width - 36, height: 82 }, fontSize: 14, bold: false, color: COLORS.text, verticalAlignment: "top", maxLines: 4 }));
  }
  bottom(slide, plan.bottom, diagram.conclusion);
}

function renderTornado(slide, data, plan) {
  panel(slide, "tornado-frame", plan.chart);
  const vars = data.diagram.variables;
  const base = data.diagram.base_value;
  const deviations = vars.flatMap((v) => [Math.abs(v.low_result - base), Math.abs(v.high_result - base)]);
  const max = Math.max(...deviations) * 1.15;
  const center = plan.chart.left + 461;
  const half = 170;
  const top = plan.chart.top + 68;
  const rowH = (plan.chart.height - 94) / vars.length;
  const placeholder = (item) => item?.text === "待客户补充";
  const missingMetadata = vars.some((item) => placeholder(item.range) || placeholder(item.controllability) || placeholder(item.confidence));
  line(slide, "tornado-base", center, plan.chart.top + 48, center, plan.chart.top + plan.chart.height - 22, "solid", COLORS.navy, 1.7);
  addTextBox(slide, { name: "tornado-base-label", text: `基准 ${base}`, position: { left: center - 56, top: plan.chart.top + 12, width: 112, height: 28 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
  let cumulative = 0;
  const total = vars.reduce((sum, v) => sum + Math.max(Math.abs(v.low_result - base), Math.abs(v.high_result - base)), 0);
  const pareto = [];
  vars.forEach((v, index) => {
    const y = top + index * rowH;
    if (index < 2) slide.shapes.add({ name: `priority-row-${index + 1}`, geometry: "rect", position: { left: plan.chart.left + 8, top: y - 3, width: plan.chart.width - 16, height: rowH - 2 }, fill: PALE_ORANGE, line: { style: "solid", fill: "none", width: 0 } });
    addTextBox(slide, { name: `var-${index + 1}`, text: placeholder(v.range) ? v.label.text : `${v.label.text}\n${v.range.text}`, position: { left: plan.chart.left + 18, top: y, width: 210, height: rowH - 4 }, fontSize: 16, bold: index < 2, color: COLORS.text });
    const leftW = Math.abs(v.low_result - base) / max * half;
    const rightW = Math.abs(v.high_result - base) / max * half;
    slide.shapes.add({ name: `low-${index + 1}`, geometry: "rect", position: { left: center - leftW, top: y + 5, width: leftW, height: rowH - 16 }, fill: COLORS.muted, line: { style: "solid", fill: COLORS.muted, width: 0 } });
    slide.shapes.add({ name: `high-${index + 1}`, geometry: "rect", position: { left: center, top: y + 5, width: rightW, height: rowH - 16 }, fill: COLORS.blue, line: { style: "solid", fill: COLORS.blue, width: 0 } });
    addTextBox(slide, { name: `low-label-${index + 1}`, text: String(v.low_result), position: { left: center - leftW - 92, top: y + 4, width: 86, height: rowH - 12 }, fontSize: 16, bold: true, color: COLORS.muted, alignment: "right" });
    addTextBox(slide, { name: `high-label-${index + 1}`, text: String(v.high_result), position: { left: center + rightW + 6, top: y + 4, width: 86, height: rowH - 12 }, fontSize: 16, bold: true, color: COLORS.blue });
    const metadata = [v.controllability, v.confidence].filter((item) => !placeholder(item)).map((item) => item.text).join("\n");
    if (metadata) addTextBox(slide, { name: `control-${index + 1}`, text: metadata, position: { left: plan.chart.left + plan.chart.width - 164, top: y - 2, width: 146, height: rowH }, fontSize: 16, color: COLORS.text, alignment: "right" });
    cumulative += Math.max(Math.abs(v.low_result - base), Math.abs(v.high_result - base));
    pareto.push({ x: plan.chart.left + 250 + index * ((plan.chart.width - 330) / Math.max(1, vars.length - 1)), y: plan.chart.top + 44 - cumulative / total * 32 });
  });
  if (missingMetadata) addTextBox(slide, { name: "tornado-metadata-missing", text: "各变量取值区间、可控性和置信度：待客户补充", position: { left: plan.chart.left + 18, top: plan.chart.top + 12, width: 350, height: 28 }, fontSize: 16, color: COLORS.muted });
  pareto.slice(1).forEach((p, i) => line(slide, `pareto-${i + 1}`, pareto[i].x, pareto[i].y, p.x, p.y, "solid", COLORS.orange, 1.8));
  insights(slide, plan.rail, data.diagram.insights ?? []);
  bottom(slide, plan.bottom, data.diagram.action);
}

function polygon(slide, name, cx, cy, radius, values, fill, stroke, style = "solid", width = 2) {
  const n = values.length;
  const points = values.map((value, index) => { const angle = (-90 + index * 360 / n) * Math.PI / 180; const r = radius * value; return { x: radius + Math.cos(angle) * r, y: radius + Math.sin(angle) * r }; });
  const commands = [{ moveTo: points[0] }, ...points.slice(1).map((point) => ({ lineTo: point })), { close: {} }];
  return slide.shapes.add({ name, geometry: "custom", position: { left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2 }, fill, line: { style, fill: stroke, width }, customPaths: [{ width: radius * 2, height: radius * 2, commands }] });
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function compactNumber(value) { return Number(value).toFixed(1).replace(/\.0$/u, ""); }
function renderRankingEvidence(slide, evidence, plan, scale) {
  panel(slide, "radar-supporting-evidence", plan.rail, COLORS.soft);
  addTextBox(slide, { name: "ranking-role", text: "支持证据", position: { left: plan.rail.left + 16, top: plan.rail.top + 12, width: 120, height: 22 }, fontSize: 14, bold: true, color: COLORS.orange });
  addTextBox(slide, { name: "ranking-title", text: evidence.title.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 34, width: plan.rail.width - 32, height: 30 }, fontSize: 18, bold: true, color: COLORS.navy });
  addTextBox(slide, { name: "ranking-scale", text: `${scale.min}–${scale.max}${scale.unit}，按分权指数降序`, position: { left: plan.rail.left + 16, top: plan.rail.top + 66, width: plan.rail.width - 32, height: 22 }, fontSize: 12, color: COLORS.muted });
  const rows = evidence.items.slice(0, 8);
  const top = plan.rail.top + 96;
  const rowHeight = Math.min(50, (plan.rail.height - 112) / rows.length);
  const labelWidth = 126; const plotLeft = plan.rail.left + 16 + labelWidth; const plotWidth = plan.rail.width - labelWidth - 78;
  rows.forEach((item, index) => {
    const y = top + index * rowHeight;
    const fill = item.pilot_candidate ? COLORS.orange : item.label.text === "总部职能" ? COLORS.navy : COLORS.blue;
    addTextBox(slide, { name: `ranking-label-${index + 1}`, text: item.label.text, position: { left: plan.rail.left + 16, top: y, width: labelWidth - 8, height: 22 }, fontSize: 14, bold: item.pilot_candidate || item.label.text === "总部职能", color: COLORS.text });
    slide.shapes.add({ name: `ranking-track-${index + 1}`, geometry: "rect", position: { left: plotLeft, top: y + 3, width: plotWidth, height: 12 }, fill: COLORS.border, line: { style: "solid", fill: COLORS.border, width: 0 } });
    slide.shapes.add({ name: `ranking-bar-${index + 1}`, geometry: "rect", position: { left: plotLeft, top: y + 3, width: plotWidth * (item.value - scale.min) / (scale.max - scale.min), height: 12 }, fill, line: { style: "solid", fill, width: 0 } });
    addTextBox(slide, { name: `ranking-value-${index + 1}`, text: compactNumber(item.value), position: { left: plotLeft + plotWidth + 6, top: y - 2, width: 48, height: 22 }, fontSize: 14, bold: true, color: fill, alignment: "right" });
    const detail = item.revenue_applicable ? `${compactNumber(item.revenue)}亿元　${item.headcount}人` : `营收不适用　${item.headcount}人`;
    addTextBox(slide, { name: `ranking-detail-${index + 1}`, text: detail, position: { left: plotLeft, top: y + 18, width: plotWidth + 40, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right" });
  });
}
function renderConditionArea(slide, condition, conclusion, footnotes, position) {
  panel(slide, "radar-condition-area", position, PALE_ORANGE, COLORS.orange, 1.2);
  addTextBox(slide, { name: "condition-title", text: condition.title.text, position: { left: position.left + 16, top: position.top + 6, width: 242, height: 24 }, fontSize: 16, bold: true, color: COLORS.navy });
  const itemLeft = position.left + 258; const available = position.width - 274; const gap = 18; const itemWidth = (available - gap * (condition.items.length - 1)) / condition.items.length;
  condition.items.forEach((item, index) => {
    const left = itemLeft + index * (itemWidth + gap);
    addTextBox(slide, { name: `condition-label-${index + 1}`, text: item.label.text, position: { left, top: position.top + 5, width: itemWidth, height: 22 }, fontSize: 14, bold: true, color: COLORS.orange });
    addTextBox(slide, { name: `condition-value-${index + 1}`, text: item.value.text, position: { left, top: position.top + 28, width: itemWidth, height: 48 }, fontSize: 14, color: COLORS.text, verticalAlignment: "top" });
  });
  if (conclusion) addTextBox(slide, { name: "radar-action", text: conclusion.text, position: { left: position.left + 16, top: position.top + position.height + 8, width: position.width * .56, height: 24 }, fontSize: 12, bold: true, color: COLORS.navy });
  if (footnotes?.length) {
    const footnoteText = `${footnotes.map((item) => item.text.replace(/[。；]+$/u, "")).join("；")}。`;
    addTextBox(slide, { name: "radar-footnote", text: footnoteText, position: { left: position.left + position.width * .57, top: position.top + position.height + 8, width: position.width * .43, height: 32 }, fontSize: 12, color: COLORS.muted, alignment: "right" });
  }
}
function renderRadar(slide, data, plan) {
  const dims = data.diagram.dimensions; const n = dims.length; const scale = data.diagram.scale; const radar = plan.radar; const cx = radar.left + radar.width * .47; const cy = radar.top + radar.height * .575; const radius = Math.min(132, radar.height * .32); const normalize = (value) => (value - scale.min) / (scale.max - scale.min);
  panel(slide, "radar-primary-frame", radar);
  addTextBox(slide, { name: "radar-scale-label", text: `主图：${n === 6 ? "六" : n}维雷达（${scale.min}–${scale.max}${scale.unit}）`, position: { left: radar.left + 16, top: radar.top + 10, width: 300, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy });
  const legend = [["current", COLORS.navy, "solid"], ["benchmark", COLORS.muted, "dashed"], ["target", COLORS.orange, "dotted"]];
  legend.forEach(([key, color, style], index) => {
    line(slide, `radar-legend-line-${key}`, radar.left + 150 + index * 148, radar.top + 52, radar.left + 178 + index * 148, radar.top + 52, style, color, key === "current" ? 2.4 : 1.8);
    const composite = data.diagram.composite?.[key];
    addTextBox(slide, { name: `radar-legend-${key}`, text: `${data.diagram.series_labels[key].text}${Number.isFinite(composite) ? ` ${compactNumber(composite)}` : ""}`, position: { left: radar.left + 184 + index * 148, top: radar.top + 40, width: 136, height: 24 }, fontSize: 14, bold: key === "current", color });
  });
  for (let level = 1; level <= 5; level += 1) polygon(slide, `radar-grid-${level}`, cx, cy, radius, Array(n).fill(level / 5), "none", COLORS.border, "solid", .7);
  dims.forEach((d, index) => { const angle = (-90 + index * 360 / n) * Math.PI / 180; line(slide, `radar-axis-${index + 1}`, cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, "solid", COLORS.line, .8); });
  polygon(slide, "radar-target", cx, cy, radius, dims.map((d) => normalize(d.target)), PALE_ORANGE, COLORS.orange, "dotted", 2);
  polygon(slide, "radar-benchmark", cx, cy, radius, dims.map((d) => normalize(d.benchmark)), "none", COLORS.muted, "dashed", 1.7);
  polygon(slide, "radar-current", cx, cy, radius, dims.map((d) => normalize(d.current)), PALE_BLUE, COLORS.navy, "solid", 2.4);
  [scale.min, scale.min + (scale.max - scale.min) / 2, scale.max].forEach((value, index) => addTextBox(slide, { name: `radar-tick-${index + 1}`, text: compactNumber(value), position: { left: cx + 10, top: cy - radius * index / 2 - 9, width: 50, height: 20 }, fontSize: 12, color: COLORS.muted }));
  dims.forEach((d, index) => {
    const angle = (-90 + index * 360 / n) * Math.PI / 180;
    const labelRadius = radius + 48; const boxWidth = d.priority ? 170 : n > 9 ? 106 : 126; const boxHeight = d.priority ? 48 : 32;
    const left = clamp(cx + Math.cos(angle) * labelRadius - boxWidth / 2, radar.left + 6, radar.left + radar.width - boxWidth - 6);
    const top = clamp(cy + Math.sin(angle) * labelRadius - boxHeight / 2, radar.top + 42, radar.top + radar.height - boxHeight - 6);
    const labelText = d.priority ? `${d.label.text}\n${compactNumber(d.current)} / ${compactNumber(d.benchmark)} / ${compactNumber(d.target)}` : d.label.text;
    addTextBox(slide, { name: `radar-label-${index + 1}`, text: labelText, position: { left, top, width: boxWidth, height: boxHeight }, fontSize: 14, bold: d.priority, color: COLORS.text, alignment: "center", fill: d.priority ? PALE_ORANGE : "none", line: { style: "solid", fill: "none", width: 0 } });
  });
  if (data.diagram.supporting_evidence) renderRankingEvidence(slide, data.diagram.supporting_evidence, plan, scale);
  else {
    panel(slide, "radar-rail", plan.rail, COLORS.soft);
    (data.diagram.group_cards ?? []).forEach((card, index) => addNode(slide, { name: `group-card-${index + 1}`, text: `${card.group.text}\n均分 ${card.average}\n${card.problem.text}\n${card.action.text}`, position: { left: plan.rail.left + 16, top: plan.rail.top + 18 + index * 150, width: plan.rail.width - 32, height: 128 }, fill: COLORS.white, border: COLORS.border, borderWidth: 1, fontSize: 16, bold: false, color: COLORS.text, alignment: "left" }));
  }
  if (plan.condition) renderConditionArea(slide, data.diagram.condition, data.diagram.conclusion, data.diagram.footnotes, plan.condition);
  else bottom(slide, plan.bottom, data.diagram.conclusion);
}

function renderDumbbell(slide, data, plan) {
  panel(slide, "dumbbell-frame", plan.chart);
  const metrics = data.diagram.metrics; const vals = metrics.flatMap((m) => [m.current, m.target]); const min = Math.min(...vals); const max = Math.max(...vals); const plotL = plan.chart.left + 270; const plotR = plan.chart.left + plan.chart.width - 200; const top = plan.chart.top + 36;
  const rowHeights = metrics.map((_, index) => index < 3 ? 58 : 36);
  const x = (value) => plotL + (value - min) / Math.max(1e-6, max - min) * (plotR - plotL);
  addTextBox(slide, { name: "dumbbell-gap-head", text: "差距", position: { left: plotR + 8, top: plan.chart.top + 6, width: 62, height: 24 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "right" });
  addTextBox(slide, { name: "dumbbell-difficulty-head", text: "改善难度", position: { left: plotR + 78, top: plan.chart.top + 6, width: 116, height: 24 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "right" });
  let cursorY = top;
  metrics.forEach((m, index) => {
    const rowH = rowHeights[index];
    const y = cursorY + rowH / 2;
    if (index < 3) slide.shapes.add({ name: `dumbbell-priority-${index + 1}`, geometry: "rect", position: { left: plan.chart.left + 8, top: y - rowH / 2 + 2, width: plan.chart.width - 16, height: rowH - 4 }, fill: PALE_ORANGE, line: { style: "solid", fill: "none", width: 0 } });
    addTextBox(slide, { name: `metric-${index + 1}`, text: `${m.domain.text}　${m.label.text}${m.direction === "lower" ? " (↓)" : ""}${m.root_cause && index < 3 ? `\n根因：${m.root_cause.text}` : ""}`, position: { left: plan.chart.left + 16, top: y - rowH / 2, width: 244, height: rowH }, fontSize: 16, bold: index < 3, color: COLORS.text });
    line(slide, `dumbbell-line-${index + 1}`, x(m.current), y, x(m.target), y, "solid", index < 3 ? COLORS.orange : COLORS.line, index < 3 ? 3 : 2);
    addTextBox(slide, { name: `current-dot-${index + 1}`, text: "", position: { left: x(m.current) - 7, top: y - 7, width: 14, height: 14 }, fontSize: 16, geometry: "ellipse", fill: COLORS.white, line: { style: "solid", fill: COLORS.navy, width: 2 } });
    addTextBox(slide, { name: `current-${index + 1}`, text: String(m.current), position: { left: x(m.current) - 22, top: y - 22, width: 44, height: 20 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
    addTextBox(slide, { name: `target-dot-${index + 1}`, text: "", position: { left: x(m.target) - 7, top: y - 7, width: 14, height: 14 }, fontSize: 16, geometry: "ellipse", fill: COLORS.blue, line: { style: "solid", fill: COLORS.blue, width: 1 } });
    addTextBox(slide, { name: `target-${index + 1}`, text: String(m.target), position: { left: x(m.target) - 22, top: y - 22, width: 44, height: 20 }, fontSize: 16, bold: true, color: COLORS.blue, alignment: "center" });
    addTextBox(slide, { name: `gap-${index + 1}`, text: String(Math.abs(m.target - m.current)), position: { left: plotR + 8, top: y - rowH / 2, width: 62, height: rowH }, fontSize: 16, bold: index < 3, color: index < 3 ? COLORS.orange : COLORS.muted, alignment: "right" });
    addTextBox(slide, { name: `difficulty-${index + 1}`, text: m.difficulty.text.replace(/^改善难度\s*/, ""), position: { left: plotR + 78, top: y - rowH / 2, width: 116, height: rowH }, fontSize: 16, bold: index < 3, color: index < 3 ? COLORS.orange : COLORS.muted, alignment: "right" });
    cursorY += rowH;
  });
  insights(slide, plan.rail, data.diagram.insights ?? []);
  bottom(slide, plan.bottom, data.diagram.conclusion);
}

function renderBump(slide, data, plan) {
  panel(slide, "bump-frame", plan.chart);
  const periods = data.diagram.periods; const objects = data.diagram.objects;
  const top = plan.chart.top + 66; const bottomY = plan.chart.top + plan.chart.height - 30;
  const x1 = plan.chart.left + 250; const x2 = plan.chart.left + plan.chart.width - 280;
  const maxRank = Math.max(...objects.flatMap((object) => object.ranks.filter(Number.isInteger)));
  const x = (index) => x1 + index / Math.max(1, periods.length - 1) * (x2 - x1);
  const y = (rank) => top + (rank - 1) / Math.max(1, maxRank - 1) * (bottomY - top);
  periods.forEach((period, index) => addTextBox(slide, { name: `bump-period-${index + 1}`, text: period.text, position: { left: x(index) - 70, top: plan.chart.top + 12, width: 140, height: 32 }, fontSize: 18, bold: true, color: COLORS.navy, alignment: "center" }));
  objects.forEach((object, objectIndex) => {
    const ranks = object.ranks; const states = object.states ?? ranks.map((rank) => Number.isInteger(rank) ? "active" : "not_ranked");
    const active = ranks.map((rank, index) => Number.isInteger(rank) && ["active", "new"].includes(states[index]));
    const first = active.findIndex(Boolean); const last = active.length - 1 - [...active].reverse().findIndex(Boolean);
    const change = first >= 0 && last >= 0 ? ranks[first] - ranks[last] : 0;
    const color = change > 0 ? COLORS.blue : change < 0 ? COLORS.orange : COLORS.muted;
    for (let index = 1; index < ranks.length; index += 1) {
      if (active[index - 1] && active[index]) line(slide, `bump-${objectIndex + 1}-${index}`, x(index - 1), y(ranks[index - 1]), x(index), y(ranks[index]), "solid", color, object.priority ? 3.5 : 1.8);
    }
    ranks.forEach((rank, index) => {
      if (!active[index]) return;
      addTextBox(slide, { name: `bump-node-${objectIndex + 1}-${index + 1}`, text: String(rank), position: { left: x(index) - 14, top: y(rank) - 14, width: 28, height: 28 }, fontSize: 14, bold: true, geometry: "ellipse", fill: color, line: { style: "solid", fill: COLORS.white, width: 1.3 }, color: COLORS.white, alignment: "center" });
    });
    if (first >= 0) {
      const firstValue = object.values?.[first];
      addTextBox(slide, { name: `bump-left-rank-${objectIndex + 1}`, text: String(ranks[first]), position: { left: plan.chart.left + 8, top: y(ranks[first]) - 14, width: 28, height: 28 }, fontSize: 16, bold: true, color, alignment: "right" });
      addTextBox(slide, { name: `bump-left-label-${objectIndex + 1}`, text: object.label.text, position: { left: plan.chart.left + 42, top: y(ranks[first]) - 14, width: 130, height: 28 }, fontSize: 16, bold: object.priority, color, alignment: "left" });
      if (firstValue !== null && firstValue !== undefined) addTextBox(slide, { name: `bump-left-value-${objectIndex + 1}`, text: String(firstValue), position: { left: plan.chart.left + 176, top: y(ranks[first]) - 14, width: 66, height: 28 }, fontSize: 16, bold: object.priority, color, alignment: "right" });
    }
    if (last >= 0 && last !== first) {
      const lastValue = object.values?.[last];
      addTextBox(slide, { name: `bump-right-rank-${objectIndex + 1}`, text: String(ranks[last]), position: { left: x2 + 4, top: y(ranks[last]) - 14, width: 24, height: 28 }, fontSize: 16, bold: true, color, alignment: "right" });
      addTextBox(slide, { name: `bump-right-label-${objectIndex + 1}`, text: object.label.text, position: { left: x2 + 32, top: y(ranks[last]) - 14, width: 128, height: 28 }, fontSize: 16, bold: object.priority, color, alignment: "left" });
      if (lastValue !== null && lastValue !== undefined) addTextBox(slide, { name: `bump-right-value-${objectIndex + 1}`, text: String(lastValue), position: { left: x2 + 164, top: y(ranks[last]) - 14, width: 64, height: 28 }, fontSize: 16, bold: object.priority, color, alignment: "right" });
      addTextBox(slide, { name: `bump-right-change-${objectIndex + 1}`, text: change > 0 ? `+${change}` : String(change), position: { left: x2 + 232, top: y(ranks[last]) - 14, width: 48, height: 28 }, fontSize: 16, bold: true, color, alignment: "right" });
    }
  });
  insights(slide, plan.rail, data.diagram.insights ?? []);
  bottom(slide, plan.bottom, data.diagram.conclusion);
}

function renderCompositionShift(slide, data, plan) {
  panel(slide, "composition-frame", plan.chart);
  const periods = data.diagram.periods;
  const components = data.diagram.components;
  const plot = { left: plan.chart.left + 76, top: plan.chart.top + 82, width: plan.chart.width - 116, height: plan.chart.height - 142 };
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = plot.top + tick / 4 * plot.height;
    line(slide, `composition-grid-${tick}`, plot.left, y, plot.left + plot.width, y, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `composition-tick-${tick}`, text: `${100 - tick * 25}%`, position: { left: plan.chart.left + 2, top: y - 12, width: 62, height: 24 }, fontSize: 14, color: COLORS.muted, alignment: "right" });
  }
  const legendWidth = Math.min(150, (plot.width - 24) / components.length);
  components.forEach((component, index) => {
    const color = COMPOSITION_STACK[index];
    const left = plot.left + index * legendWidth;
    slide.shapes.add({ name: `composition-legend-swatch-${index + 1}`, geometry: "rect", position: { left, top: plan.chart.top + 24, width: 16, height: 16 }, fill: color, line: { style: "solid", fill: color, width: 0 } });
    addTextBox(slide, { name: `composition-legend-${index + 1}`, text: component.label.text, position: { left: left + 22, top: plan.chart.top + 17, width: legendWidth - 24, height: 30 }, fontSize: 14, bold: component.id === data.diagram.focus_component_id, color: component.id === data.diagram.focus_component_id ? COLORS.orange : COLORS.text });
  });
  const slot = plot.width / periods.length;
  const columnWidth = Math.min(88, slot * .58);
  periods.forEach((period, periodIndex) => {
    const left = plot.left + periodIndex * slot + (slot - columnWidth) / 2;
    let cursorY = plot.top + plot.height;
    components.forEach((component, componentIndex) => {
      const share = component.shares[periodIndex];
      const height = plot.height * share / 100;
      cursorY -= height;
      const color = COMPOSITION_STACK[componentIndex];
      if (height > 0) slide.shapes.add({ name: `composition-${periodIndex + 1}-${componentIndex + 1}`, geometry: "rect", position: { left, top: cursorY, width: columnWidth, height }, fill: color, line: { style: "solid", fill: COLORS.white, width: 1.2 } });
      if (height >= 28) addTextBox(slide, { name: `composition-label-${periodIndex + 1}-${componentIndex + 1}`, text: `${share}%`, position: { left: left + 3, top: cursorY + height / 2 - 12, width: columnWidth - 6, height: 24 }, fontSize: 14, bold: component.id === data.diagram.focus_component_id, color: [0, 1, 2, 3, 5].includes(componentIndex) ? COLORS.white : COLORS.text, alignment: "center" });
    });
    if (data.diagram.basis === "absolute") addTextBox(slide, { name: `composition-total-${periodIndex + 1}`, text: `${data.diagram.totals[periodIndex]} ${data.diagram.unit.text}`, position: { left: left - 20, top: plot.top - 30, width: columnWidth + 40, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy, alignment: "center" });
    addTextBox(slide, { name: `composition-period-${periodIndex + 1}`, text: period.text, position: { left: left - 18, top: plot.top + plot.height + 8, width: columnWidth + 36, height: 30 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
  });
  addTextBox(slide, { name: "composition-denominator", text: `分母：${data.diagram.denominator.text}`, position: { left: plan.chart.left + 18, top: plan.chart.top + plan.chart.height - 30, width: 340, height: 22 }, fontSize: 12, color: COLORS.muted });
  if (data.diagram.disclosure) addTextBox(slide, { name: "composition-disclosure", text: data.diagram.disclosure.text, position: { left: plan.chart.left + 370, top: plan.chart.top + plan.chart.height - 30, width: plan.chart.width - 388, height: 22 }, fontSize: 12, bold: true, color: COLORS.orange, alignment: "right" });
  insights(slide, plan.rail, data.diagram.insights);
  bottom(slide, plan.bottom, data.diagram.conclusion);
}

function renderBoxPlot(slide, data, plan) {
  panel(slide, "box-plot-frame", plan.chart);
  const groups = data.diagram.groups;
  const observed = groups.flatMap((group) => [group.whisker_low, group.whisker_high, ...group.outliers]);
  const dataMin = Math.min(...observed);
  const dataMax = Math.max(...observed);
  const range = Math.max(1e-6, dataMax - dataMin);
  const axisMin = dataMin - range * .08;
  const axisMax = dataMax + range * .1;
  const plot = { left: plan.chart.left + 72, top: plan.chart.top + 54, width: plan.chart.width - 104, height: plan.chart.height - 132 };
  const y = (value) => plot.top + (axisMax - value) / (axisMax - axisMin) * plot.height;
  const tickCount = 5;
  for (let index = 0; index < tickCount; index += 1) {
    const value = axisMax - index / (tickCount - 1) * (axisMax - axisMin);
    const yy = y(value);
    line(slide, `box-grid-${index + 1}`, plot.left, yy, plot.left + plot.width, yy, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `box-tick-${index + 1}`, text: compactNumber(value), position: { left: plan.chart.left + 4, top: yy - 11, width: 58, height: 22 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  }
  addTextBox(slide, { name: "box-unit", text: data.diagram.unit.text, position: { left: plan.chart.left + 12, top: plan.chart.top + 14, width: 230, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy, singleLine: true });
  const slot = plot.width / groups.length;
  groups.forEach((group, index) => {
    const cx = plot.left + slot * (index + .5);
    const boxWidth = Math.min(66, slot * .52);
    const upperY = y(group.whisker_high);
    const lowerY = y(group.whisker_low);
    const q3Y = y(group.q3);
    const q1Y = y(group.q1);
    line(slide, `box-whisker-${index + 1}`, cx, upperY, cx, lowerY, "solid", COLORS.navy, 1.6);
    line(slide, `box-cap-high-${index + 1}`, cx - boxWidth * .3, upperY, cx + boxWidth * .3, upperY, "solid", COLORS.navy, 1.6);
    line(slide, `box-cap-low-${index + 1}`, cx - boxWidth * .3, lowerY, cx + boxWidth * .3, lowerY, "solid", COLORS.navy, 1.6);
    slide.shapes.add({ name: `box-iqr-${index + 1}`, geometry: "rect", position: { left: cx - boxWidth / 2, top: q3Y, width: boxWidth, height: Math.max(2, q1Y - q3Y) }, fill: PALE_BLUE, line: { style: "solid", fill: COLORS.blue, width: 1.8 } });
    line(slide, `box-median-${index + 1}`, cx - boxWidth / 2, y(group.median), cx + boxWidth / 2, y(group.median), "solid", COLORS.orange, 3);
    addTextBox(slide, { name: `box-median-label-${index + 1}`, text: compactNumber(group.median), position: { left: cx + boxWidth / 2 + 4, top: y(group.median) - 11, width: 48, height: 22 }, fontSize: 12, bold: true, color: COLORS.orange, singleLine: true });
    group.outliers.forEach((value, outlierIndex) => {
      const pointY = y(value);
      addTextBox(slide, { name: `box-outlier-dot-${index + 1}-${outlierIndex + 1}`, text: "", position: { left: cx - 5, top: pointY - 5, width: 10, height: 10 }, fontSize: 12, geometry: "ellipse", fill: COLORS.white, line: { style: "solid", fill: COLORS.orange, width: 1.6 } });
      addTextBox(slide, { name: `box-outlier-label-${index + 1}-${outlierIndex + 1}`, text: `异常值 ${compactNumber(value)}`, position: { left: cx + 8, top: pointY - 10, width: Math.min(104, slot * .7), height: 20 }, fontSize: 12, bold: true, color: COLORS.orange, singleLine: true });
    });
    addTextBox(slide, { name: `box-group-${index + 1}`, text: group.label.text, position: { left: cx - slot * .46, top: plot.top + plot.height + 8, width: slot * .92, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy, alignment: "center", singleLine: true });
    addTextBox(slide, { name: `box-sample-${index + 1}`, text: `有效 ${group.sample_size}　缺失 ${group.missing_count}`, position: { left: cx - slot * .48, top: plot.top + plot.height + 32, width: slot * .96, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "center", singleLine: true });
  });

  panel(slide, "box-insight-rail", plan.rail, COLORS.soft);
  addTextBox(slide, { name: "box-insight-title", text: "关键发现", position: { left: plan.rail.left + 16, top: plan.rail.top + 16, width: plan.rail.width - 32, height: 30 }, fontSize: 18, bold: true, color: COLORS.navy });
  (data.diagram.insights ?? []).slice(0, 2).forEach((item, index) => addNode(slide, { name: `box-insight-${index + 1}`, text: item.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 64 + index * 122, width: plan.rail.width - 32, height: 100 }, fill: COLORS.white, border: COLORS.border, borderWidth: 1, fontSize: 14, bold: false, color: COLORS.text, alignment: "left" }));
  if (data.diagram.conclusion) addNode(slide, { name: "box-conclusion", text: data.diagram.conclusion.text, position: { left: plan.rail.left + 16, top: plan.rail.top + 326, width: plan.rail.width - 32, height: 110 }, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.3, fontSize: 16, bold: true, color: COLORS.navy, alignment: "left" });
  addDataSourceFooter(slide, { source: data.diagram.source_note, disclosure: data.diagram.disclosure, position: plan.footer });
  setSpeakerNotes(slide, [
    { title: "专业术语", items: ["IQR 是四分位距，也就是中间 50% 数据的跨度。", "Q1 和 Q3 分别是下四分位数和上四分位数；箱体表示两者之间的范围。"] },
    { title: "口径解释", items: [data.diagram.period, data.diagram.denominator, data.diagram.sample_definition, data.diagram.missing_policy] },
    { title: "计算方法", items: [data.diagram.quartile_method, data.diagram.whisker_rule] },
  ]);
}

function renderHistogram(slide, data, plan) {
  panel(slide, "histogram-frame", plan.chart);
  const diagram = data.diagram;
  const calculated = calculateHistogram(diagram);
  const counts = calculated.counts;
  const edges = diagram.binning.edges;
  const plot = { left: plan.chart.left + 72, top: plan.chart.top + 78, width: plan.chart.width - 112, height: plan.chart.height - 174 };
  const displayValues = diagram.frequency_basis === "frequency" ? counts.map((count) => count / calculated.valid * 100) : counts;
  const maxValue = Math.max(...displayValues, 1);
  const tickMax = Math.ceil(maxValue / 5) * 5;
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = tickMax * (4 - tick) / 4;
    const y = plot.top + tick / 4 * plot.height;
    line(slide, `histogram-grid-${tick}`, plot.left, y, plot.left + plot.width, y, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `histogram-y-${tick}`, text: diagram.frequency_basis === "frequency" ? `${value.toFixed(0)}%` : String(Math.round(value)), position: { left: plan.chart.left + 4, top: y - 12, width: 58, height: 24 }, fontSize: 14, color: COLORS.muted, alignment: "right" });
  }
  addTextBox(slide, { name: "histogram-axis-title", text: diagram.frequency_basis === "frequency" ? "频率（有效样本占比）" : "频数（个）", position: { left: plot.left, top: plan.chart.top + 20, width: 260, height: 28 }, fontSize: 16, bold: true, color: COLORS.navy });
  const slot = plot.width / counts.length;
  counts.forEach((count, index) => {
    const height = plot.height * displayValues[index] / tickMax;
    const left = plot.left + index * slot;
    const top = plot.top + plot.height - height;
    const isMode = count === Math.max(...counts);
    slide.shapes.add({ name: `histogram-bar-${index + 1}`, geometry: "rect", position: { left, top, width: slot, height }, fill: isMode ? COLORS.orange : COLORS.blue, line: { style: "solid", fill: COLORS.white, width: .8 } });
    addTextBox(slide, { name: `histogram-count-${index + 1}`, text: diagram.frequency_basis === "frequency" ? `${displayValues[index].toFixed(1)}%` : String(count), position: { left: left - 2, top: Math.max(plot.top - 2, top - 27), width: slot + 4, height: 24 }, fontSize: 14, bold: isMode, color: isMode ? COLORS.orange : COLORS.navy, alignment: "center", singleLine: true });
    addTextBox(slide, { name: `histogram-bin-${index + 1}`, text: index === counts.length - 1 && diagram.binning.last_bin_inclusive ? `${edges[index]}–${edges[index + 1]}` : `${edges[index]}–<${edges[index + 1]}`, position: { left: left - 8, top: plot.top + plot.height + 8, width: slot + 16, height: 30 }, fontSize: 12, color: COLORS.text, alignment: "center", singleLine: true });
  });
  addTextBox(slide, { name: "histogram-x-title", text: `${diagram.metric.text}（${diagram.unit.text}）`, position: { left: plot.left, top: plot.top + plot.height + 42, width: plot.width, height: 26 }, fontSize: 14, bold: true, color: COLORS.navy, alignment: "center" });
  addTextBox(slide, { name: "histogram-method", text: `样本 ${calculated.total}，有效 ${calculated.valid}，缺失 ${calculated.missing}；左闭右开，末箱含上界；期间：${diagram.period.text}`, position: { left: plan.chart.left + 16, top: plan.chart.top + plan.chart.height - 30, width: plan.chart.width - 32, height: 22 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
  insights(slide, plan.rail, diagram.insights, "分布解读");
  bottom(slide, plan.bottom, diagram.conclusion);
  slide.speakerNotes.textFrame.setText(`[Sources]\n- ${diagram.disclosure?.text ?? "用户提供数据"}\n- 指标：${diagram.metric.text}；单位：${diagram.unit.text}；期间：${diagram.period.text}；分箱边界：${edges.join(", ")}。`);
}

function median(values) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function tukeySummary(observations) {
  const sorted = [...observations].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const lowerHalf = sorted.slice(0, middle);
  const upperHalf = sorted.slice(sorted.length % 2 ? middle + 1 : middle);
  const q1 = median(lowerHalf);
  const q2 = median(sorted);
  const q3 = median(upperHalf);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  return { q1, q2, q3, low: inliers[0], high: inliers[inliers.length - 1], lowerFence, upperFence };
}

function renderBoxPlotJitter(slide, data, plan) {
  panel(slide, "distribution-frame", plan.chart);
  const groups = data.diagram.groups;
  const allValues = groups.flatMap((group) => group.observations);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const padding = Math.max((rawMax - rawMin) * .12, 1);
  const axisMin = rawMin - padding;
  const axisMax = rawMax + padding;
  const plot = { left: plan.chart.left + 82, top: plan.chart.top + 54, width: plan.chart.width - 118, height: plan.chart.height - 150 };
  const y = (value) => plot.top + (axisMax - value) / Math.max(1e-6, axisMax - axisMin) * plot.height;
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = axisMax - tick / 4 * (axisMax - axisMin);
    const tickY = y(value);
    line(slide, `distribution-grid-${tick}`, plot.left, tickY, plot.left + plot.width, tickY, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `distribution-tick-${tick}`, text: Number.isInteger(value) ? String(value) : value.toFixed(1), position: { left: plan.chart.left + 4, top: tickY - 12, width: 66, height: 24 }, fontSize: 14, color: COLORS.muted, alignment: "right" });
  }
  addTextBox(slide, { name: "distribution-unit", text: data.diagram.unit.text, position: { left: plan.chart.left + 14, top: plan.chart.top + 14, width: 180, height: 26 }, fontSize: 14, bold: true, color: COLORS.navy });
  addTextBox(slide, { name: "distribution-sample-definition", text: `样本：${data.diagram.sample_definition.text}`, position: { left: plan.chart.left + 156, top: plan.chart.top + 14, width: plan.chart.width - 174, height: 26 }, fontSize: 14, color: COLORS.muted, alignment: "right", singleLine: true });
  const slot = plot.width / groups.length;
  groups.forEach((group, groupIndex) => {
    const center = plot.left + slot * (groupIndex + .5);
    const summary = tukeySummary(group.observations);
    const boxWidth = Math.min(58, slot * .34);
    line(slide, `distribution-whisker-${groupIndex + 1}`, center, y(summary.low), center, y(summary.high), "solid", COLORS.navy, 1.8);
    line(slide, `distribution-cap-low-${groupIndex + 1}`, center - boxWidth * .34, y(summary.low), center + boxWidth * .34, y(summary.low), "solid", COLORS.navy, 1.8);
    line(slide, `distribution-cap-high-${groupIndex + 1}`, center - boxWidth * .34, y(summary.high), center + boxWidth * .34, y(summary.high), "solid", COLORS.navy, 1.8);
    slide.shapes.add({ name: `distribution-box-${groupIndex + 1}`, geometry: "rect", position: { left: center - boxWidth / 2, top: y(summary.q3), width: boxWidth, height: Math.max(2, y(summary.q1) - y(summary.q3)) }, fill: PALE_BLUE, line: { style: "solid", fill: COLORS.navy, width: 1.8 } });
    line(slide, `distribution-median-${groupIndex + 1}`, center - boxWidth / 2, y(summary.q2), center + boxWidth / 2, y(summary.q2), "solid", COLORS.orange, 2.8);
    group.observations.forEach((value, observationIndex) => {
      const normalizedOffset = (((observationIndex * 7 + groupIndex * 3) % 17) / 16 - .5) * Math.min(slot * .42, 58);
      const isOutlier = value < summary.lowerFence || value > summary.upperFence;
      const radius = isOutlier ? 5.5 : 4.2;
      slide.shapes.add({
        name: `distribution-point-${groupIndex + 1}-${observationIndex + 1}`,
        geometry: "ellipse",
        position: { left: center + normalizedOffset - radius, top: y(value) - radius, width: radius * 2, height: radius * 2 },
        fill: isOutlier ? COLORS.orange : COLORS.blue,
        line: { style: "solid", fill: COLORS.white, width: .8 },
      });
    });
    addTextBox(slide, { name: `distribution-group-${groupIndex + 1}`, text: group.label.text, position: { left: center - slot * .42, top: plot.top + plot.height + 8, width: slot * .84, height: 26 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center", singleLine: true });
    addTextBox(slide, { name: `distribution-n-${groupIndex + 1}`, text: `n=${group.n}`, position: { left: center - slot * .42, top: plot.top + plot.height + 34, width: slot * .84, height: 22 }, fontSize: 14, color: COLORS.muted, alignment: "center", singleLine: true });
  });
  addTextBox(slide, { name: "distribution-statistics-note", text: data.diagram.statistics_note.text, position: { left: plan.chart.left + 18, top: plan.chart.top + plan.chart.height - 36, width: 510, height: 24 }, fontSize: 12, color: COLORS.muted });
  addTextBox(slide, { name: "distribution-jitter-note", text: data.diagram.jitter_note.text, position: { left: plan.chart.left + 532, top: plan.chart.top + plan.chart.height - 36, width: plan.chart.width - 550, height: 24 }, fontSize: 12, bold: true, color: COLORS.orange, alignment: "right" });
  insights(slide, plan.rail, data.diagram.insights);
  bottom(slide, plan.bottom, data.diagram.conclusion);
}
function renderSmallMultiples(slide, data, plan) {
  const diagram = data.diagram; const panels = diagram.panels; const cols = panels.length === 4 ? 2 : 3; const rows = Math.ceil(panels.length / cols); const gap = 12; const legendH = 30; const w = (plan.grid.width - gap * (cols - 1)) / cols; const h = (plan.grid.height - legendH - gap * (rows - 1)) / rows; const min = diagram.scale.min; const max = diagram.scale.max;
  const stateColor = { invest: COLORS.blue, maintain: COLORS.navy, watch: COLORS.muted, exit: COLORS.orange };
  const benchmarkText = diagram.benchmark ? `；基准：${diagram.benchmark_label.text}` : "；无统一基准";
  addTextBox(slide, { name: "small-shared-scale", text: `${diagram.metric.text}（${diagram.unit.text}）；共享刻度 ${min}–${max}${benchmarkText}`, position: { left: plan.grid.left, top: plan.grid.top, width: plan.grid.width, height: 24 }, fontSize: 14, bold: true, color: COLORS.navy, singleLine: true });
  panels.forEach((p, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const rowCount = row === rows - 1 ? panels.length - row * cols : cols; const rowOffset = rowCount < cols ? (cols - rowCount) * (w + gap) / 2 : 0; const left = plan.grid.left + rowOffset + col * (w + gap); const top = plan.grid.top + legendH + row * (h + gap); const color = stateColor[p.classification_state];
    panel(slide, `small-${index + 1}`, { left, top, width: w, height: h }, COLORS.white, color, 1.5);
    addTextBox(slide, { name: `small-title-${index + 1}`, text: p.label.text, position: { left: left + 10, top: top + 6, width: w * .29, height: 24 }, fontSize: 16, bold: true, color: COLORS.navy, singleLine: true });
    addTextBox(slide, { name: `small-summary-${index + 1}`, text: p.summary.text, position: { left: left + w * .31, top: top + 5, width: w * .65, height: 26 }, fontSize: 14, bold: true, color, alignment: "right", singleLine: true });
    const plot = { left: left + 22, top: top + 36, width: w - 44, height: h - 96 }; const point = (value, i) => ({ x: plot.left + i / Math.max(1, p.values.length - 1) * plot.width, y: plot.top + (max - value) / (max - min) * plot.height });
    [min, max].forEach((value, tickIndex) => addTextBox(slide, { name: `small-scale-${index + 1}-${tickIndex + 1}`, text: String(value), position: { left: left + 2, top: tickIndex ? plot.top - 9 : plot.top + plot.height - 20, width: 38, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true }));
    if (diagram.benchmark) { const bench = diagram.benchmark.map(point); bench.slice(1).forEach((pt, i) => line(slide, `small-b-${index + 1}-${i + 1}`, bench[i].x, bench[i].y, pt.x, pt.y, "dashed", COLORS.line, 1.1)); }
    const series = p.values.map(point);
    if (diagram.series_type === "line") {
      series.slice(1).forEach((pt, i) => line(slide, `small-s-${index + 1}-${i + 1}`, series[i].x, series[i].y, pt.x, pt.y, "solid", color, 2.2));
      [0, series.length - 1].forEach((pointIndex) => slide.shapes.add({ name: `small-point-${index + 1}-${pointIndex + 1}`, geometry: "ellipse", position: { left: series[pointIndex].x - 3.5, top: series[pointIndex].y - 3.5, width: 7, height: 7 }, fill: color, line: { style: "solid", fill: COLORS.white, width: .8 } }));
    } else {
      const slot = plot.width / p.values.length; const baseline = point(Math.max(min, Math.min(max, 0)), 0).y;
      p.values.forEach((value, valueIndex) => { const y = point(value, valueIndex).y; slide.shapes.add({ name: `small-column-${index + 1}-${valueIndex + 1}`, geometry: "rect", position: { left: plot.left + valueIndex * slot + slot * .2, top: Math.min(y, baseline), width: slot * .6, height: Math.max(1, Math.abs(baseline - y)) }, fill: color, line: { style: "solid", fill: color, width: 0 } }); });
    }
    addTextBox(slide, { name: `small-first-period-${index + 1}`, text: diagram.periods[0].text, position: { left: plot.left, top: plot.top + plot.height + 1, width: plot.width / 2, height: 20 }, fontSize: 12, color: COLORS.muted, singleLine: true });
    addTextBox(slide, { name: `small-last-period-${index + 1}`, text: diagram.periods.at(-1).text, position: { left: plot.left + plot.width / 2, top: plot.top + plot.height + 1, width: plot.width / 2, height: 20 }, fontSize: 12, color: COLORS.muted, alignment: "right", singleLine: true });
    addTextBox(slide, { name: `small-class-${index + 1}`, text: p.classification.text, position: { left: left + 10, top: top + h - 24, width: w - 20, height: 20 }, fontSize: 14, bold: true, color, alignment: "right", singleLine: true });
  });
  insights(slide, plan.rail, diagram.insights ?? []);
  bottom(slide, plan.bottom, diagram.conclusion);
}

export async function renderR3Module(data, output) {
  const plan = planR3Module(data); const { presentation, slide } = createPresentation(output.background); header(slide, plan);
  ({ marimekko: renderMekko, "tornado-sensitivity": renderTornado, "radar-capability": renderRadar, "dumbbell-gap": renderDumbbell, "bump-ranking": renderBump, "composition-shift": renderCompositionShift, "part-to-whole": renderPartToWhole, "box-plot": renderBoxPlot, histogram: renderHistogram, "box-plot-jitter": renderBoxPlotJitter, "small-multiples": renderSmallMultiples })[data.module_id](slide, data, plan);
  await exportPresentation(presentation, output); return plan;
}
async function main() { const options = parseCliArgs(process.argv.slice(2)); const data = await loadR3ModuleInput(options.input); const plan = await renderR3Module(data, options); process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, input_kind: data.input_kind ?? "module-fixture", slide: plan.slide })}\n`); }
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`); process.exitCode = 1; });
