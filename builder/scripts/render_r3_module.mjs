import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, addChartLine, addNode, addTextBox, createPresentation, exportPresentation, fitPageTitleFontSize, parseCliArgs } from "./pptx_core.mjs";
import { planR3Module } from "./plan_r3_module.mjs";
import { loadR3ModuleInput } from "./validate_r3_module.mjs";

const STACK = [COLORS.orange, COLORS.navy, COLORS.blue, COLORS.line, COLORS.soft];
const PALE_ORANGE = COLORS.orangeLight;
const PALE_BLUE = COLORS.blueLight;

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
  items.slice(0, 3).forEach((item, index) => addNode(slide, { name: `${title}-item-${index + 1}`, text: item.text, position: { left: position.left + 16, top: position.top + 60 + index * 122, width: position.width - 32, height: 96 }, fill: COLORS.white, border: index === 0 ? COLORS.orange : COLORS.border, borderWidth: index === 0 ? 1.7 : 1, fontSize: 16, bold: index === 0, color: COLORS.text, alignment: "left" }));
}
function bottom(slide, position, item) { if (item) addNode(slide, { name: "bottom-conclusion", text: item.text, position, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.3, fontSize: 18, bold: true, color: COLORS.navy }); }

function renderMekko(slide, data, plan) {
  panel(slide, "mekko-frame", plan.chart);
  const plot = { left: plan.chart.left + 54, top: plan.chart.top + 66, width: plan.chart.width - 78, height: plan.chart.height - 120 };
  for (let tick = 0; tick <= 4; tick += 1) {
    const y = plot.top + (tick / 4) * plot.height;
    line(slide, `mekko-grid-${tick}`, plot.left, y, plot.left + plot.width, y, "solid", COLORS.border, .7);
    addTextBox(slide, { name: `mekko-tick-${tick}`, text: `${100 - tick * 25}%`, position: { left: plan.chart.left + 4, top: y - 12, width: 44, height: 24 }, fontSize: 16, color: COLORS.muted, alignment: "right" });
  }
  let cursor = plot.left;
  data.diagram.segments.forEach((segment, segmentIndex) => {
    const width = plot.width * segment.size_share / 100;
    let y = plot.top + plot.height;
    segment.stacks.forEach((stack, stackIndex) => {
      const height = plot.height * stack.share / 100;
      y -= height;
      slide.shapes.add({ name: `mekko-${segmentIndex + 1}-${stackIndex + 1}`, geometry: "rect", position: { left: cursor, top: y, width, height }, fill: STACK[stackIndex], line: { style: "solid", fill: COLORS.white, width: 1.2 } });
      if (height >= 36 && width >= 70) addTextBox(slide, { name: `mekko-label-${segmentIndex + 1}-${stackIndex + 1}`, text: `${stack.label.text} ${stack.share}%`, position: { left: cursor + 4, top: y + height / 2 - 14, width: width - 8, height: 28 }, fontSize: 16, bold: stackIndex === 0, color: stackIndex < 3 ? COLORS.white : COLORS.text, alignment: "center" });
    });
    addTextBox(slide, { name: `mekko-top-${segmentIndex + 1}`, text: `${segment.absolute_size.text}\n${segment.growth.text}`, position: { left: cursor, top: plan.chart.top + 10, width, height: 48 }, fontSize: 16, bold: true, color: segment.priority ? COLORS.orange : COLORS.navy, alignment: "center" });
    addTextBox(slide, { name: `mekko-bottom-${segmentIndex + 1}`, text: `${segment.label.text}\n${segment.size_share}%`, position: { left: cursor, top: plot.top + plot.height + 8, width, height: 40 }, fontSize: 16, bold: segment.priority, color: segment.priority ? COLORS.orange : COLORS.text, alignment: "center" });
    if (segment.priority) slide.shapes.add({ name: `mekko-priority-${segmentIndex + 1}`, geometry: "rect", position: { left: cursor - 3, top: plot.top - 3, width: width + 6, height: plot.height + 6 }, fill: "none", line: { style: "solid", fill: COLORS.orange, width: 3 } });
    cursor += width;
  });
  insights(slide, plan.rail, data.diagram.insights ?? []);
  bottom(slide, plan.bottom, data.diagram.conclusion);
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
    addTextBox(slide, { name: `radar-label-${index + 1}`, text: labelText, position: { left, top, width: boxWidth, height: boxHeight }, fontSize: d.priority ? 14 : 14, bold: d.priority, color: d.priority ? COLORS.orange : COLORS.text, alignment: "center", fill: d.priority ? PALE_ORANGE : "none", line: { style: "solid", fill: d.priority ? COLORS.orange : "none", width: d.priority ? 1.1 : 0 } });
  });
  if (data.diagram.supporting_evidence) renderRankingEvidence(slide, data.diagram.supporting_evidence, plan, scale);
  else {
    panel(slide, "radar-rail", plan.rail, COLORS.soft);
    (data.diagram.group_cards ?? []).forEach((card, index) => addNode(slide, { name: `group-card-${index + 1}`, text: `${card.group.text}\n均分 ${card.average}\n${card.problem.text}\n${card.action.text}`, position: { left: plan.rail.left + 16, top: plan.rail.top + 18 + index * 150, width: plan.rail.width - 32, height: 128 }, fill: COLORS.white, border: index === 0 ? COLORS.orange : COLORS.border, borderWidth: index === 0 ? 1.7 : 1, fontSize: 16, bold: index === 0, color: COLORS.text, alignment: "left" }));
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

function renderSmallMultiples(slide, data, plan) {
  const panels = data.diagram.panels; const cols = panels.length === 4 ? 2 : 3; const rows = Math.ceil(panels.length / cols); const gap = 12; const w = (plan.grid.width - gap * (cols - 1)) / cols; const h = (plan.grid.height - gap * (rows - 1)) / rows; const all = panels.flatMap((p) => p.values).concat(data.diagram.benchmark); const min = Math.min(...all); const max = Math.max(...all);
  const classColor = (text) => /加大|增长|领先/.test(text) ? COLORS.blue : /退出|落后|收缩/.test(text) ? COLORS.orange : COLORS.muted;
  panels.forEach((p, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const left = plan.grid.left + col * (w + gap); const top = plan.grid.top + row * (h + gap); const color = classColor(p.classification.text);
    panel(slide, `small-${index + 1}`, { left, top, width: w, height: h }, COLORS.white, color, 1.5);
    addTextBox(slide, { name: `small-title-${index + 1}`, text: p.label.text, position: { left: left + 10, top: top + 8, width: w * .46, height: 42 }, fontSize: 16, bold: true, color: COLORS.navy });
    addTextBox(slide, { name: `small-summary-${index + 1}`, text: p.summary.text, position: { left: left + w * .46, top: top + 6, width: w * .49, height: 44 }, fontSize: 16, bold: true, color, alignment: "right" });
    const plot = { left: left + 18, top: top + 58, width: w - 36, height: h - 86 }; const point = (value, i) => ({ x: plot.left + i / Math.max(1, p.values.length - 1) * plot.width, y: plot.top + (max - value) / Math.max(1e-6, max - min) * plot.height });
    const bench = data.diagram.benchmark.map(point); const series = p.values.map(point);
    bench.slice(1).forEach((pt, i) => line(slide, `small-b-${index + 1}-${i + 1}`, bench[i].x, bench[i].y, pt.x, pt.y, "solid", COLORS.line, 1.1));
    series.slice(1).forEach((pt, i) => line(slide, `small-s-${index + 1}-${i + 1}`, series[i].x, series[i].y, pt.x, pt.y, "solid", color, 2.2));
    addTextBox(slide, { name: `small-class-${index + 1}`, text: p.classification.text, position: { left: left + 10, top: top + h - 26, width: w - 20, height: 20 }, fontSize: 16, bold: true, color, alignment: "right" });
  });
  insights(slide, plan.rail, data.diagram.insights ?? []);
  bottom(slide, plan.bottom, data.diagram.conclusion);
}

export async function renderR3Module(data, output) {
  const plan = planR3Module(data); const { presentation, slide } = createPresentation(output.background); header(slide, plan);
  ({ marimekko: renderMekko, "tornado-sensitivity": renderTornado, "radar-capability": renderRadar, "dumbbell-gap": renderDumbbell, "bump-ranking": renderBump, "small-multiples": renderSmallMultiples })[data.module_id](slide, data, plan);
  await exportPresentation(presentation, output); return plan;
}
async function main() { const options = parseCliArgs(process.argv.slice(2)); const data = await loadR3ModuleInput(options.input); const plan = await renderR3Module(data, options); process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, input_kind: data.input_kind ?? "module-fixture", slide: plan.slide })}\n`); }
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`); process.exitCode = 1; });
