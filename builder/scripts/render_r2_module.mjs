import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COLORS,
  addChartLine,
  addFieldGroup,
  addNode,
  addTextBox,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";
import { planR2Module } from "./plan_r2_module.mjs";

const PALE_ORANGE = COLORS.orangeLight;
const PALE_BLUE = COLORS.blueLight;

function addPageHeader(slide, plan) {
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true, color: COLORS.navy });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, fontSize: 18, color: COLORS.muted });
}

function addPanel(slide, name, position, fill = COLORS.white, border = COLORS.border, borderWidth = 1.2) {
  return slide.shapes.add({ name, geometry: "rect", position, fill, line: { style: "solid", fill: border, width: borderWidth } });
}

function addDivider(slide, name, x1, y1, x2, y2, style = "solid", color = COLORS.border, width = 1) {
  return addChartLine(slide, { name, from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, line: { style, fill: color, width } });
}

function renderRouteTradeoff(slide, data, plan) {
  const rows = data.diagram.routes[0].rows.length;
  const routeShapes = [];
  plan.panels.forEach((panel, routeIndex) => {
    const route = data.diagram.routes[routeIndex];
    const frame = addPanel(slide, `route-${routeIndex + 1}-frame`, panel, routeIndex === 0 ? COLORS.soft : PALE_BLUE, routeIndex === 0 ? COLORS.line : COLORS.blue, 1.6);
    routeShapes.push(frame);
    addTextBox(slide, { name: `route-${routeIndex + 1}-title`, text: route.label.text, position: { left: panel.left + 18, top: panel.top + 12, width: panel.width - 36, height: 40 }, fontSize: 18, bold: true, color: routeIndex === 0 ? COLORS.muted : COLORS.navy, alignment: "center" });
    const rowTop = panel.top + 62;
    const rowH = (panel.height - 116) / rows;
    route.rows.forEach((row, rowIndex) => {
      if (rowIndex > 0) addDivider(slide, `route-${routeIndex + 1}-divider-${rowIndex}`, panel.left + 12, rowTop + rowIndex * rowH, panel.left + panel.width - 12, rowTop + rowIndex * rowH);
      addTextBox(slide, { name: `route-${routeIndex + 1}-dim-${rowIndex + 1}`, text: row.dimension.text, position: { left: panel.left + 16, top: rowTop + rowIndex * rowH + 6, width: 104, height: rowH - 12 }, fontSize: 16, bold: true, color: COLORS.navy });
      addTextBox(slide, { name: `route-${routeIndex + 1}-judgment-${rowIndex + 1}`, text: `${row.judgment.text}\n${row.evidence.text}`, position: { left: panel.left + 122, top: rowTop + rowIndex * rowH + 5, width: 232, height: rowH - 10 }, fontSize: 16, color: COLORS.text });
      addTextBox(slide, { name: `route-${routeIndex + 1}-score-${rowIndex + 1}`, text: row.score === 3 ? "●" : row.score === 2 ? "◐" : "○", position: { left: panel.left + 362, top: rowTop + rowIndex * rowH + 7, width: 48, height: rowH - 14 }, fontSize: 24, bold: true, color: row.score === 3 ? COLORS.blue : row.score === 2 ? COLORS.orange : COLORS.line, alignment: "center" });
    });
    const total = route.rows.reduce((sum, item) => sum + item.score, 0);
    addTextBox(slide, { name: `route-${routeIndex + 1}-total`, text: `总评分 ${total}/${rows * 3}`, position: { left: panel.left + 16, top: panel.top + panel.height - 43, width: panel.width - 32, height: 30 }, fontSize: 18, bold: true, color: routeIndex === 0 ? COLORS.muted : COLORS.blue, alignment: "right" });
  });
  addPanel(slide, "conflict-band", plan.conflict, COLORS.white, COLORS.border, 1);
  addTextBox(slide, { name: "conflict-label", text: "关键权衡", position: { left: plan.conflict.left + 18, top: plan.conflict.top + 12, width: plan.conflict.width - 36, height: 30 }, fontSize: 18, bold: true, color: COLORS.orange, alignment: "center" });
  const conflicts = data.diagram.conflicts ?? [];
  conflicts.forEach((item, index) => {
    const top = plan.conflict.top + 62 + index * 102;
    addTextBox(slide, { name: `conflict-${index + 1}`, text: item.text, position: { left: plan.conflict.left + 24, top, width: plan.conflict.width - 48, height: 54 }, fontSize: 18, bold: true, color: COLORS.navy, alignment: "center", geometry: "diamond", fill: PALE_ORANGE, line: { style: "solid", fill: COLORS.orange, width: 1.3 } });
    addDivider(slide, `conflict-axis-${index + 1}`, plan.conflict.left - 22, top + 27, plan.conflict.left + plan.conflict.width + 22, top + 27, "solid", COLORS.orange, 2.4).sendToBack();
  });
  if (data.diagram.recommendation) {
    const recommendation = addNode(slide, { name: "recommendation", text: data.diagram.recommendation.text, position: plan.convergence, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 2, fontSize: 18, bold: true, color: COLORS.navy });
    routeShapes.forEach((shape, index) => connectNative(slide, shape, recommendation, { kind: "straight", fromSide: "bottom", toSide: index === 0 ? "left" : "right", line: { style: "solid", fill: COLORS.orange, width: 2.2 } }));
  }
}

function renderScqaRoadmap(slide, data, plan) {
  const sequence = [data.diagram.scqa.s, data.diagram.scqa.c, data.diagram.scqa.q, data.diagram.scqa.a];
  const labels = ["S 情境", "C 冲突", "Q 问题", "A 答案"];
  const gap = 22;
  const w = (plan.scqa.width - gap * 3) / 4;
  const shapes = sequence.map((item, index) => addNode(slide, { name: `scqa-${index + 1}`, text: `${labels[index]}\n${item.text}`, position: { left: plan.scqa.left + index * (w + gap), top: plan.scqa.top, width: w, height: plan.scqa.height }, fill: index === 3 ? COLORS.navy : index === 1 ? PALE_ORANGE : COLORS.soft, border: index === 1 ? COLORS.orange : COLORS.border, borderWidth: index === 3 ? 0 : 1.3, fontSize: 18, bold: true, color: index === 3 ? COLORS.white : COLORS.text }));
  for (let index = 0; index < shapes.length - 1; index += 1) connectNative(slide, shapes[index], shapes[index + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: COLORS.blue, width: 1.8 } });
  const stages = data.diagram.stages;
  const laneCount = stages[0].lanes.length;
  const labelW = 150;
  const stageW = (plan.roadmap.width - labelW) / stages.length;
  const headerH = 54;
  const laneH = (plan.roadmap.height - headerH) / laneCount;
  stages.forEach((stage, stageIndex) => {
    const left = plan.roadmap.left + labelW + stageIndex * stageW;
    addTextBox(slide, { name: `stage-${stageIndex + 1}-header`, text: `${stage.label.text}\n◆ ${stage.gate.text}`, position: { left, top: plan.roadmap.top, width: stageW, height: headerH }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center", fill: stageIndex % 2 ? COLORS.soft : PALE_BLUE, line: { style: "solid", fill: COLORS.border, width: 1 } });
    stage.lanes.forEach((lane, laneIndex) => {
      if (stageIndex === 0) addTextBox(slide, { name: `lane-label-${laneIndex + 1}`, text: lane.label.text, position: { left: plan.roadmap.left, top: plan.roadmap.top + headerH + laneIndex * laneH, width: labelW, height: laneH }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center", fill: COLORS.soft, line: { style: "solid", fill: COLORS.border, width: 1 } });
      addTextBox(slide, { name: `stage-${stageIndex + 1}-lane-${laneIndex + 1}`, text: lane.action.text, position: { left, top: plan.roadmap.top + headerH + laneIndex * laneH, width: stageW, height: laneH }, fontSize: 16, color: COLORS.text, alignment: "center", fill: COLORS.white, line: { style: "solid", fill: COLORS.border, width: 1 } });
    });
  });
  const firstStage = slide.shapes.items.find((shape) => shape.name === "stage-1-header");
  connectNative(slide, shapes[3], firstStage, { kind: "elbow", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: COLORS.blue, width: 1.5 } });
}

function renderBubbleHeatmap(slide, data, plan) {
  addPanel(slide, "matrix-frame", plan.matrix, COLORS.white, COLORS.border, 1.2);
  const mx = plan.matrix.left + 58;
  const my = plan.matrix.top + 36;
  const mw = plan.matrix.width - 86;
  const mh = plan.matrix.height - 74;
  slide.shapes.add({ name: "matrix-q1", geometry: "rect", position: { left: mx, top: my, width: mw / 2, height: mh / 2 }, fill: PALE_BLUE, line: { style: "solid", fill: "none", width: 0 } });
  slide.shapes.add({ name: "matrix-q2", geometry: "rect", position: { left: mx + mw / 2, top: my, width: mw / 2, height: mh / 2 }, fill: COLORS.soft, line: { style: "solid", fill: "none", width: 0 } });
  slide.shapes.add({ name: "matrix-q3", geometry: "rect", position: { left: mx, top: my + mh / 2, width: mw / 2, height: mh / 2 }, fill: COLORS.white, line: { style: "solid", fill: "none", width: 0 } });
  slide.shapes.add({ name: "matrix-q4", geometry: "rect", position: { left: mx + mw / 2, top: my + mh / 2, width: mw / 2, height: mh / 2 }, fill: PALE_ORANGE, line: { style: "solid", fill: "none", width: 0 } });
  addDivider(slide, "matrix-mid-x", mx + mw / 2, my, mx + mw / 2, my + mh, "dashed", COLORS.line, 1.4);
  addDivider(slide, "matrix-mid-y", mx, my + mh / 2, mx + mw, my + mh / 2, "dashed", COLORS.line, 1.4);
  addTextBox(slide, { name: "matrix-x-label", text: data.diagram.axis_labels[0].text, position: { left: mx + 100, top: my + mh + 10, width: mw - 200, height: 24 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
  addTextBox(slide, { name: "matrix-y-label", text: data.diagram.axis_labels[1].text, position: { left: plan.matrix.left + 4, top: my + 95, width: 46, height: 170, rotation: 270 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
  const funcColors = [COLORS.blue, COLORS.orange, COLORS.muted];
  const funcs = [...new Set(data.diagram.items.map((item) => item.function.text))];
  const bubbleShapes = new Map();
  data.diagram.items.forEach((item) => {
    const size = Math.max(25, Math.min(54, 20 + Math.sqrt(item.size) * 5));
    const left = mx + (item.x / 5) * mw - size / 2;
    const top = my + mh - (item.y / 5) * mh - size / 2;
    const bubble = addTextBox(slide, { name: `bubble-${item.id}`, text: item.id, position: { left, top, width: size, height: size }, fontSize: 16, bold: true, color: COLORS.white, alignment: "center", geometry: "ellipse", fill: funcColors[funcs.indexOf(item.function.text) % funcColors.length], line: { style: item.hold ? "dashed" : "solid", fill: item.hold ? COLORS.line : COLORS.white, width: 1.5 } });
    bubbleShapes.set(item.id, bubble);
    addTextBox(slide, { name: `bubble-label-${item.id}`, text: item.label.text, position: { left: left - 18, top: top + size + 1, width: size + 36, height: 22 }, fontSize: 16, color: COLORS.text, alignment: "center" });
  });
  addPanel(slide, "heatmap-frame", plan.table, COLORS.white, COLORS.border, 1.2);
  const sorted = [...data.diagram.items].sort((a, b) => a.rank - b.rank);
  const rowH = (plan.table.height - 52) / sorted.length;
  const firstW = 98;
  const scoreW = 55;
  addTextBox(slide, { name: "heatmap-header", text: "举措        价值  难度  风险  依赖  速度   排名", position: { left: plan.table.left + 10, top: plan.table.top + 8, width: plan.table.width - 20, height: 34 }, fontSize: 16, bold: true, color: COLORS.navy });
  sorted.forEach((item, rowIndex) => {
    const top = plan.table.top + 46 + rowIndex * rowH;
    const rowFill = item.rank <= 4 ? PALE_ORANGE : item.hold ? COLORS.soft : COLORS.white;
    slide.shapes.add({ name: `heat-row-${item.id}`, geometry: "rect", position: { left: plan.table.left + 8, top, width: plan.table.width - 16, height: rowH }, fill: rowFill, line: { style: "solid", fill: COLORS.border, width: 0.6 } });
    addTextBox(slide, { name: `heat-label-${item.id}`, text: `${item.id} ${item.label.text}`, position: { left: plan.table.left + 12, top, width: firstW, height: rowH }, fontSize: 16, bold: item.rank <= 4, color: COLORS.text });
    item.scores.forEach((score, scoreIndex) => addTextBox(slide, { name: `heat-${item.id}-${scoreIndex + 1}`, text: String(score), position: { left: plan.table.left + firstW + 10 + scoreIndex * scoreW, top: top + 3, width: 42, height: rowH - 6 }, fontSize: 16, bold: true, color: score >= 4 ? COLORS.white : COLORS.text, alignment: "center", fill: score >= 4 ? COLORS.blue : score === 3 ? COLORS.blueLight : COLORS.soft, line: { style: "solid", fill: "none", width: 0 } }));
    addTextBox(slide, { name: `rank-${item.id}`, text: item.hold ? "暂缓" : `#${item.rank}`, position: { left: plan.table.left + 392, top, width: 72, height: rowH }, fontSize: 16, bold: true, color: item.hold ? COLORS.muted : COLORS.orange, alignment: "center" });
  });
  if (data.diagram.bottom_conclusion) addNode(slide, { name: "bottom-conclusion", text: data.diagram.bottom_conclusion.text, position: plan.bottom, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.5, fontSize: 18, bold: true, color: COLORS.navy });
}

function renderChartInsight(slide, data, plan) {
  addPanel(slide, "chart-frame", plan.chart, COLORS.white, COLORS.border, 1.2);
  const categories = data.diagram.categories;
  const values = data.diagram.series.flatMap((item) => item.values);
  const max = Math.max(...values) * 1.15;
  const plot = { left: plan.chart.left + 58, top: plan.chart.top + 40, width: plan.chart.width - 86, height: plan.chart.height - 82 };
  for (let grid = 0; grid <= 4; grid += 1) {
    const y = plot.top + (grid / 4) * plot.height;
    addDivider(slide, `grid-${grid}`, plot.left, y, plot.left + plot.width, y, "solid", COLORS.border, 0.7);
  }
  const groupW = plot.width / categories.length;
  const anchors = new Map();
  categories.forEach((category, index) => {
    const center = plot.left + groupW * (index + 0.5);
    data.diagram.series.forEach((series, seriesIndex) => {
      const value = series.values[index];
      const h = (value / max) * plot.height;
      const x = center - 23 + seriesIndex * 28;
      const bar = slide.shapes.add({ name: `bar-${seriesIndex + 1}-${index + 1}`, geometry: "rect", position: { left: x, top: plot.top + plot.height - h, width: 22, height: h }, fill: seriesIndex === 0 ? COLORS.navy : COLORS.soft, line: { style: "solid", fill: seriesIndex === 0 ? COLORS.navy : COLORS.line, width: 1.2 } });
      anchors.set(`${series.id}:${category.id}`, bar);
      addTextBox(slide, { name: `bar-label-${seriesIndex + 1}-${index + 1}`, text: String(value), position: { left: x - 19, top: plot.top + plot.height - h - 25, width: 60, height: 22 }, fontSize: 16, bold: true, color: seriesIndex === 0 ? COLORS.navy : COLORS.muted, alignment: "center" });
    });
    addTextBox(slide, { name: `category-${index + 1}`, text: category.text, position: { left: center - groupW / 2, top: plot.top + plot.height + 8, width: groupW, height: 24 }, fontSize: 16, color: COLORS.muted, alignment: "center" });
  });
  const ratio = data.diagram.ratio.values;
  const rMin = data.diagram.ratio.axis_min;
  const rMax = data.diagram.ratio.axis_max;
  const ratioPoints = ratio.map((value, index) => ({ x: plot.left + groupW * (index + 0.5), y: plot.top + 30 + ((rMax - value) / Math.max(1e-6, rMax - rMin)) * (plot.height - 70) }));
  for (let index = 0; index < ratioPoints.length - 1; index += 1) addDivider(slide, `ratio-line-${index + 1}`, ratioPoints[index].x, ratioPoints[index].y, ratioPoints[index + 1].x, ratioPoints[index + 1].y, "dashed", COLORS.orange, 2.2);
  const ratioShapes = ratioPoints.map((point, index) => {
    const shape = addTextBox(slide, { name: `ratio-point-${index + 1}`, text: "", position: { left: point.x - 5, top: point.y - 5, width: 10, height: 10 }, fontSize: 16, geometry: "ellipse", fill: COLORS.orange, line: { style: "solid", fill: COLORS.orange, width: 0 } });
    anchors.set(`${data.diagram.ratio.id}:${categories[index].id}`, shape);
    addTextBox(slide, { name: `ratio-label-${index + 1}`, text: `${ratio[index]}${data.diagram.ratio.unit}`, position: { left: point.x - 34, top: point.y - 27, width: 68, height: 22 }, fontSize: 14, bold: true, color: COLORS.orange, alignment: "center" });
    return shape;
  });
  addTextBox(slide, { name: "legend", text: `${data.diagram.series[0].label.text}  ■   ${data.diagram.series[1].label.text}  □   ${data.diagram.ratio.label.text}  ┄`, position: { left: plan.chart.left + 18, top: plan.chart.top + 6, width: plan.chart.width - 36, height: 28 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "right" });
  addPanel(slide, "insight-rail", plan.insight, COLORS.soft, COLORS.border, 1.2);
  addTextBox(slide, { name: "insight-title", text: "关键洞察", position: { left: plan.insight.left + 20, top: plan.insight.top + 16, width: plan.insight.width - 40, height: 34 }, fontSize: 18, bold: true, color: COLORS.navy });
  data.diagram.insights.forEach((insight, index) => {
    const box = addNode(slide, { name: `insight-${index + 1}`, text: insight.text, position: { left: plan.insight.left + 20, top: plan.insight.top + 66 + index * 117, width: plan.insight.width - 40, height: 92 }, fill: COLORS.white, border: COLORS.border, borderWidth: 1, fontSize: 18, bold: false, color: COLORS.text, alignment: "left" });
    const target = anchors.get(`${insight.anchor.series_id}:${insight.anchor.category_id}`);
    connectNative(slide, box, target, { kind: "straight", role: "leader", fromSide: "left", toSide: "right", arrow: false, line: { style: "solid", fill: COLORS.line, width: 1 } });
  });
  if (data.diagram.conclusion) addNode(slide, { name: "conclusion", text: data.diagram.conclusion.text, position: plan.bottom, fill: PALE_ORANGE, border: COLORS.orange, borderWidth: 1.4, fontSize: 18, bold: true, color: COLORS.navy });
}

function renderScenarioPlanning(slide, data, plan) {
  const scenarios = data.diagram.scenarios;
  const gap = 22;
  const w = (plan.scenarios.width - gap * 2) / 3;
  const scenarioShapes = [];
  scenarios.forEach((scenario, index) => {
    const left = plan.scenarios.left + index * (w + gap);
    const frame = addPanel(slide, `scenario-${index + 1}`, { left, top: plan.scenarios.top, width: w, height: plan.scenarios.height }, index === 1 ? PALE_BLUE : index === 2 ? PALE_ORANGE : COLORS.soft, index === 1 ? COLORS.blue : index === 2 ? COLORS.orange : COLORS.line, 1.5);
    scenarioShapes.push(frame);
    addFieldGroup(slide, { name: `scenario-title-${index + 1}`, fields: [{ value: scenario.label.text, bold: true }, { value: `${scenario.probability}%`, bold: true, alignment: "right" }], position: { left: left + 16, top: plan.scenarios.top + 12, width: w - 32, height: 36 }, fontSize: 18, color: index === 2 ? COLORS.orange : COLORS.navy });
    const metrics = scenario.metrics.map((item) => `${item.label.text} ${item.value.text}`).join("   ");
    const sections = [
      ["关键假设", scenario.assumptions.text],
      ["核心指标", metrics],
      ["业务影响", scenario.impact.text],
      ["领先指标", scenario.indicator.text],
      ["应对策略", scenario.response.text],
    ];
    sections.forEach(([label, value], sectionIndex) => {
      const top = plan.scenarios.top + 58 + sectionIndex * 68;
      addTextBox(slide, { name: `scenario-${index + 1}-section-${sectionIndex + 1}`, text: `${label}\n${value}`, position: { left: left + 18, top, width: w - 36, height: 62 }, fontSize: 16, bold: sectionIndex === 1, color: COLORS.text, fill: sectionIndex === 1 ? COLORS.white : "none", line: { style: "solid", fill: sectionIndex === 1 ? COLORS.border : "none", width: sectionIndex === 1 ? 0.8 : 0 } });
    });
  });
  const noRegret = addNode(slide, { name: "no-regret", text: data.diagram.no_regret.text, position: plan.bottom, fill: COLORS.navy, border: COLORS.navy, fontSize: 18, bold: true, color: COLORS.white });
  scenarioShapes.forEach((shape) => connectNative(slide, shape, noRegret, { kind: "straight", fromSide: "bottom", toSide: "top", line: { style: "solid", fill: COLORS.blue, width: 1.6 } }));
  if (data.diagram.contingent) {
    const contingent = addNode(slide, { name: "contingent", text: data.diagram.contingent.text, position: plan.contingent, fill: COLORS.white, border: COLORS.orange, borderWidth: 1.4, borderStyle: "dashed", fontSize: 16, bold: true, color: COLORS.orange });
    connectNative(slide, scenarioShapes[0], contingent, { kind: "elbow", fromSide: "bottom", toSide: "top", arrow: false, line: { style: "dashed", fill: COLORS.orange, width: 1.2 } });
    connectNative(slide, scenarioShapes[2], contingent, { kind: "elbow", fromSide: "bottom", toSide: "top", arrow: false, line: { style: "dashed", fill: COLORS.orange, width: 1.2 } });
  }
}

export async function renderR2Module(data, output) {
  const plan = planR2Module(data);
  const { presentation, slide } = createPresentation(output.background);
  addPageHeader(slide, plan);
  const handlers = {
    "route-tradeoff": renderRouteTradeoff,
    "scqa-roadmap": renderScqaRoadmap,
    "bubble-heatmap": renderBubbleHeatmap,
    "chart-insight": renderChartInsight,
    "scenario-planning": renderScenarioPlanning,
  };
  handlers[data.module_id](slide, data, plan);
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(options.input, "utf8"));
  const plan = await renderR2Module(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, slide: plan.slide })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
