import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addChartLine,
  addContainer,
  addFieldGroup,
  addNode,
  addTableCell,
  addTextBox,
  COLORS,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";
import { planR4Module } from "./plan_r4_module.mjs";
import { buildSankeyRibbonPath, computeSankeyGeometry } from "./sankey_geometry.mjs";
const PALE_ORANGE = COLORS.orangeLight, PALE_BLUE = COLORS.blueLight;
function header(slide, p) {
  addTextBox(slide, {
    name: "page-title",
    text: p.title.text,
    position: p.title,
    fontSize: fitPageTitleFontSize(p.title.text),
    bold: true,
    color: COLORS.navy,
  });
  if (p.subtitle) {
    addTextBox(slide, {
      name: "page-subtitle",
      text: p.subtitle.text,
      position: p.subtitle,
      fontSize: 16,
      color: COLORS.muted,
    });
  }
}
function panel(
  slide,
  name,
  position,
  fill = COLORS.white,
  border = COLORS.border,
  width = 1.1,
) {
  return slide.shapes.add({
    name,
    geometry: "rect",
    position,
    fill,
    line: { style: "solid", fill: border, width },
  });
}
function line(
  slide,
  name,
  x1,
  y1,
  x2,
  y2,
  style = "solid",
  color = COLORS.line,
  width = 1,
) {
  return addChartLine(slide, {
    name,
    from: { x: x1, y: y1 },
    to: { x: x2, y: y2 },
    line: { style, fill: color, width },
  });
}
function rail(slide, pos, items, title = "关键洞察") {
  panel(slide, `${title}-rail`, pos, COLORS.soft);
  addTextBox(slide, {
    name: `${title}-title`,
    text: title,
    position: {
      left: pos.left + 18,
      top: pos.top + 14,
      width: pos.width - 36,
      height: 30,
    },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  const cards = [];
  items.slice(0, 3).forEach((x, i) =>
    cards.push(addNode(slide, {
      name: `${title}-${i + 1}`,
      text: x.text,
      position: {
        left: pos.left + 16,
        top: pos.top + 60 + i * 122,
        width: pos.width - 32,
        height: 96,
      },
      fill: COLORS.white,
      border: COLORS.border,
      borderWidth: 1,
      fontSize: 16,
      bold: false,
      color: COLORS.text,
      alignment: "left",
    }))
  );
  return cards;
}
function bottom(slide, pos, item) {
  if (item) {
    addNode(slide, {
      name: "bottom",
      text: item.text,
      position: pos,
      fill: PALE_ORANGE,
      border: COLORS.orange,
      borderWidth: 1.3,
      fontSize: 18,
      bold: true,
      color: COLORS.navy,
    });
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function keepNumberUnitTogether(text) {
  return String(text ?? "").replace(/(\d)\s+(?=(?:个月|人|个|年|月|周|天|小时|分钟|%))/gu, "$1");
}

function sankeyEvidenceRail(slide, p, rows, insights) {
  panel(slide, "sankey-evidence-rail", p.rail, COLORS.soft);
  addTextBox(slide, {
    name: "sla-verification-title",
    text: "SLA 核验",
    position: { left: p.rail.left + 14, top: p.rail.top + 10, width: p.rail.width - 28, height: 26 },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  const table = { left: p.rail.left + 10, top: p.rail.top + 42, width: p.rail.width - 20 };
  const weights=[.22,.18,.13,.17,.30],headers=["服务","服务量","FTE","准时率","SLA 状态"];
  const addRow=(name,values,top,height,fill,bold=false)=>{
    let left=table.left;
    values.forEach((value,index)=>{
      const width=table.width*weights[index];
      addTableCell(slide,{name:`${name}-${index+1}`,text:String(value),position:{left,top,width,height},fill,border:COLORS.border,fontSize:12,bold,color:bold?COLORS.navy:COLORS.text,alignment:"center"});
      left+=width;
    });
  };
  addRow("sla-header",headers,table.top,30,PALE_BLUE,true);
  rows.forEach((row, index) => {
    addRow(
      `sla-row-${index+1}`,
      [
        row.service,
        formatNumber(row.monthly_volume),
        row.fte,
        `${Math.round(row.on_time_rate * 100)}%`,
        row.sla_status,
      ],
      table.top+30+index*34,
      34,
      index%2?COLORS.soft:COLORS.white,
      false,
    );
  });
  const insightTop = table.top + 30 + rows.length * 34 + 14;
  (insights ?? []).slice(0, 3).forEach((item, index) => addTextBox(slide, {
    name: `sankey-insight-${index + 1}`,
    text: item.text,
    position: { left: p.rail.left + 14, top: insightTop + index * 62, width: p.rail.width - 28, height: 54 },
    fontSize: 14,
    bold: false,
    color: COLORS.text,
    fill: COLORS.white,
    line: { style: "solid", fill: COLORS.border, width: .7 },
  }));
}

function renderSankey(slide, data, p) {
  panel(slide, "sankey-frame", p.main);
  const layers = data.diagram.layers;
  const flows = data.diagram.flows.map((flow, index) => ({ ...flow, __index: index }));
  const plot = {
    left: p.main.left + 112,
    top: p.main.top + 62,
    width: p.main.width - 224,
    height: p.main.height - 86,
  };
  const maxNodes = Math.max(...layers.map((layer) => layer.nodes.length));
  const nodeGap = maxNodes >= 7 ? 6 : maxNodes >= 5 ? 10 : 14;
  const geometry = computeSankeyGeometry(layers, flows, plot, { nodeWidth: 20, gap: nodeGap });
  const shapes = new Map();
  const semanticFor = (flow) => p.sankey.flow_semantics[flow.__index];
  const toneColor = (semantic) => semantic.tone === "exception"
    ? "#D96F16"
    : semantic.tone === "neutral"
    ? "#52677F"
    : "#1F66AD";
  const incidentFlows = (nodeId) => flows.filter((flow) => flow.from === nodeId || flow.to === nodeId);
  const nodeColor = (nodeId) => {
    const totals = new Map();
    for (const flow of incidentFlows(nodeId)) {
      const color = toneColor(semanticFor(flow));
      totals.set(color, (totals.get(color) ?? 0) + flow.value);
    }
    return [...totals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? COLORS.navy;
  };

  geometry.flows
    .slice()
    .sort((left, right) => right.thickness - left.thickness || left.index - right.index)
    .forEach((flow) => {
      const pathGeometry = buildSankeyRibbonPath(flow);
      const color = toneColor(semanticFor(flow));
      slide.shapes.add({
        name: `sankey-ribbon-${flow.index + 1}-${flow.from}-${flow.to}`,
        geometry: "custom",
        position: pathGeometry.position,
        customPaths: pathGeometry.customPaths,
        fill: {
          type: "gradient",
          gradientKind: "linear",
          angleDeg: 0,
          stops: [
            { offset: 0, color: `${color}/78` },
            { offset: 100000, color: `${color}/62` },
          ],
        },
        line: { style: "solid", fill: "none", width: 0 },
      });
    });

  layers.forEach((layer, layerIndex) => {
    const titleLeft = layerIndex === 0
      ? p.main.left + 10
      : geometry.nodes[layer.nodes[0].id].left - geometry.columnGap / 2 + 10;
    const titleWidth = layerIndex === 0 || layerIndex === layers.length - 1
      ? geometry.columnGap / 2 + 92
      : geometry.columnGap;
    addTextBox(slide, {
      name: `layer-${layerIndex + 1}`,
      text: layer.label?.text ?? `第 ${layerIndex + 1} 层`,
      position: {
        left: titleLeft,
        top: p.main.top + 8,
        width: titleWidth,
        height: 46,
      },
      fontSize: 12,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });

    layer.nodes.forEach((node) => {
      const nodePosition = geometry.nodes[node.id];
      const fill = nodeColor(node.id);
      const shape = slide.shapes.add({
        name: `node-${node.id}`,
        geometry: "rect",
        position: {
          left: nodePosition.left,
          top: nodePosition.top,
          width: nodePosition.width,
          height: nodePosition.height,
        },
        fill,
        line: { style: "solid", fill: "none", width: 0 },
      });
      shapes.set(node.id, shape);

      const firstLayer = layerIndex === 0;
      const labelWidth = firstLayer
        ? 90
        : Math.max(72, Math.min(108, geometry.columnGap - nodePosition.width - 14));
      const labelLeft = firstLayer
        ? nodePosition.left - labelWidth - 10
        : nodePosition.left + nodePosition.width + 10;
      const compact = layer.nodes.length >= 5;
      addTextBox(slide, {
        name: `node-label-${node.id}`,
        text: node.label.text.replaceAll("；", "\n"),
        position: {
          left: labelLeft,
          top: nodePosition.top + nodePosition.height / 2 - (compact ? 18 : 22),
          width: labelWidth,
          height: compact ? 22 : 26,
        },
        fontSize: 12,
        bold: true,
        color: COLORS.text,
        alignment: firstLayer ? "right" : "left",
      });
      addTextBox(slide, {
        name: `node-value-${node.id}`,
        text: formatNumber(node.value),
        position: {
          left: labelLeft,
          top: nodePosition.top + nodePosition.height / 2 + (compact ? 2 : 5),
          width: labelWidth,
          height: 18,
        },
        fontSize: 12,
        color: COLORS.muted,
        alignment: firstLayer ? "right" : "left",
        singleLine: true,
      });
    });
  });
  if (p.sankey.sla_rows.length) sankeyEvidenceRail(slide, p, p.sankey.sla_rows, data.diagram.insights ?? []);
  else {
    const cards = rail(slide, p.rail, (data.diagram.insights ?? []).map((item) => ({
      ...item,
      text: keepNumberUnitTogether(item.text),
    })));
    ["turnover", "not_hired", "screened_out"].forEach((id, i) => {
      if (shapes.get(id) && cards[i]) connectNative(slide, shapes.get(id), cards[i], { kind: "elbow", role: "leader", fromSide: "right", toSide: "left", line: { style: "solid", fill: COLORS.line, width: .8 } });
    });
  }
  bottom(slide, p.bottom, data.diagram.conclusion
    ? { ...data.diagram.conclusion, text: keepNumberUnitTogether(data.diagram.conclusion.text) }
    : null);
}

function renderChord(slide, data, p) {
  panel(slide, "chord-frame", p.main);
  addTextBox(slide, {
    name: "chord-node-legend",
    text: "节点外显示总量和净流；正值为净流入，负值为净流出",
    position: { left: p.main.left + 16, top: p.main.top + 10, width: 330, height: 24 },
    fontSize: 16,
    color: COLORS.muted,
  });
  const nodes = data.diagram.nodes,
    flows = [...data.diagram.flows].sort((a, b) => b.value - a.value);
  const cx = p.main.left + p.main.width / 2,
    cy = p.main.top + p.main.height / 2 + 8,
    r = 166;
  const shapes = new Map();
  nodes.forEach((n, i) => {
    const a = (-90 + i * 360 / nodes.length) * Math.PI / 180,
      x = cx + Math.cos(a) * r,
      y = cy + Math.sin(a) * r;
    const s = addTextBox(slide, {
      name: `chord-node-${n.id}`,
      text: n.label.text,
      position: { left: x - 42, top: y - 25, width: 84, height: 50 },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      geometry: "ellipse",
      fill: i % 3 === 0
        ? COLORS.orange
        : i % 3 === 1
        ? COLORS.blue
        : COLORS.navy,
      line: { style: "solid", fill: COLORS.white, width: 1.2 },
    });
    shapes.set(n.id, s);
    const incoming = flows.filter((f) => f.to === n.id).reduce((sum, f) => sum + f.value, 0);
    const outgoing = flows.filter((f) => f.from === n.id).reduce((sum, f) => sum + f.value, 0);
    const net = incoming - outgoing;
    const cos = Math.cos(a), sin = Math.sin(a);
    const labelPos = cos > .35
      ? { left: x + 48, top: y - 12, width: 140, height: 24 }
      : cos < -.35
      ? { left: x - 188, top: y - 12, width: 140, height: 24 }
      : sin < 0
      ? { left: x - 70, top: y - 56, width: 140, height: 24 }
      : { left: x - 70, top: y + 28, width: 140, height: 24 };
    addTextBox(slide, {
      name: `chord-node-metric-${n.id}`,
      text: `总量 ${n.total ?? "—"}\n净流 ${net >= 0 ? "+" : "−"}${Math.abs(net)}`,
      position: labelPos,
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
  });
  const max = Math.max(...flows.map((f) => f.value));
  flows.slice().reverse().forEach((f, i) =>
    connectNative(slide, shapes.get(f.from), shapes.get(f.to), {
      kind: "curved",
      arrow: true,
      placement: "front",
      line: {
        style: "solid",
        fill: i >= flows.length - 3 ? COLORS.orange : COLORS.line,
        width: Math.max(1, 8 * f.value / max),
      },
    })
  );
  const cards = rail(slide, p.rail, data.diagram.insights ?? []);
  ["n1", "n3", "n6"].forEach((id, i) => {
    if (shapes.get(id) && cards[i]) {
      connectNative(slide, shapes.get(id), cards[i], {
        kind: "elbow",
        role: "leader",
        fromSide: "right",
        toSide: "left",
        line: { style: "solid", fill: COLORS.line, width: .8 },
      });
    }
  });
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderFunnel(slide, data, p) {
  panel(slide, "funnel-frame", p.main);
  panel(slide, "calc-frame", p.side, COLORS.soft);
  const layers = data.diagram.layers,
    max = layers[0].value,
    center = p.main.left + p.main.width / 2;
  layers.forEach((x, i) => {
    const w = 180 + 300 * x.value / max,
      h = 82,
      top = p.main.top + 24 + i * 103;
    addNode(slide, {
      name: `funnel-${i + 1}`,
      text: `${x.label.text}  ${x.value}\n占上一层 ${
        i === 0 ? "100" : Math.round(x.value / layers[i - 1].value * 100)
      }%\n原因：${x.reason.text}`,
      position: { left: center - w / 2, top, width: w, height: h },
      fill: i === 3 ? COLORS.orange : [COLORS.navy, COLORS.blue, "#7397BD"][i],
      border: COLORS.white,
      borderWidth: 1,
      fontSize: 16,
      bold: true,
      color: COLORS.white,
    });
    if (i < 3) {
      line(
        slide,
        `funnel-arrow-${i + 1}`,
        center,
        top + h,
        center,
        top + 103,
        "solid",
        COLORS.orange,
        2,
      );
    }
  });
  addTextBox(slide, {
    name: "calc-title",
    text: "测算逻辑",
    position: {
      left: p.side.left + 22,
      top: p.side.top + 18,
      width: p.side.width - 44,
      height: 30,
    },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  const factorW = (p.side.width - 60) / data.diagram.factors.length;
  const factorShapes = [];
  data.diagram.factors.forEach((x, i) => {
    factorShapes.push(addNode(slide, {
      name: `factor-${i + 1}`,
      text:
        `${x.label.text}\n${x.value.text}\n${x.sensitivity.text}\n来源：${x.source.text}`,
      position: {
        left: p.side.left + 20 + i * factorW,
        top: p.side.top + 76,
        width: factorW - 10,
        height: 142,
      },
      fill: i === 1 ? PALE_ORANGE : COLORS.white,
      border: COLORS.border,
      borderWidth: 1,
      fontSize: 16,
      bold: i === 1,
      color: COLORS.text,
    }));
    if (i) {
      line(
        slide,
        `factor-mul-${i}`,
        p.side.left + 20 + i * factorW - 7,
        p.side.top + 145,
        p.side.left + 20 + i * factorW + 2,
        p.side.top + 145,
        "solid",
        COLORS.orange,
        2,
      );
    }
  });
  if (data.diagram.milestone) {
    addNode(slide, {
      name: "milestone",
      text: data.diagram.milestone.text,
      position: {
        left: p.side.left + 36,
        top: p.side.top + 252,
        width: p.side.width - 72,
        height: 80,
      },
      fill: PALE_BLUE,
      border: COLORS.blue,
      borderWidth: 1.5,
      fontSize: 18,
      bold: true,
      color: COLORS.navy,
    });
  }
  (data.diagram.assumptions ?? []).forEach((x, i) =>
    addTextBox(slide, {
      name: `assumption-${i + 1}`,
      text: `• ${x.text}`,
      position: {
        left: p.side.left + 36,
        top: p.side.top + 350 + i * 30,
        width: p.side.width - 72,
        height: 26,
      },
      fontSize: 16,
      color: COLORS.text,
    })
  );
  bottom(slide, p.bottom, data.diagram.conclusion ?? data.diagram.milestone);
}

function renderValueChain(slide, data, p) {
  panel(slide, "value-frame", p.main);
  const stages = data.diagram.stages,
    gap = 8,
    stageStart = p.main.left + 150,
    w = (p.main.width - 170 - gap * (stages.length - 1)) / stages.length,
    top = p.main.top + 92;
  const values = stages.map((x) => x.value_index),
    minValue = Math.min(...values),
    maxValue = Math.max(...values),
    valuePoints = stages.map((x, i) => ({
      x: stageStart + i * (w + gap) + w / 2,
      y: p.main.top + 76 -
        (x.value_index - minValue) / Math.max(1, maxValue - minValue) * 20,
    }));
  valuePoints.slice(1).forEach((point, i) =>
    line(
      slide,
      `value-curve-${i + 1}`,
      valuePoints[i].x,
      valuePoints[i].y,
      point.x,
      point.y,
      "solid",
      COLORS.orange,
      2,
    )
  );
  valuePoints.forEach((point, i) =>
    addTextBox(slide, {
      name: `value-point-${i + 1}`,
      text: "",
      position: { left: point.x - 5, top: point.y - 5, width: 10, height: 10 },
      fontSize: 16,
      geometry: "ellipse",
      fill: COLORS.orange,
      line: { style: "solid", fill: COLORS.white, width: 1 },
    })
  );
  stages.forEach((x, i) => {
    const left = stageStart + i * (w + gap);
    addNode(slide, {
      name: `stage-${x.id}`,
      text:
        `${x.label.text}\n利润率 ${x.margin}%\n规模 ${x.market_size} 亿\nCR5 ${x.concentration}%`,
      position: { left, top, width: w, height: 96 },
      fill: i === stages.length - 1
        ? COLORS.orange
        : i < 2
        ? COLORS.blue
        : COLORS.navy,
      border: COLORS.white,
      fontSize: 16,
      bold: true,
      color: COLORS.white,
    });
    addTextBox(slide, {
      name: `barrier-${i + 1}`,
      text: x.barrier.text,
      position: { left, top: p.main.top + 10, width: w, height: 36 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: 1 },
    });
    if (i < stages.length - 1) {
      line(
        slide,
        `chain-${i + 1}`,
        left + w,
        top + 48,
        left + w + gap,
        top + 48,
        "solid",
        COLORS.orange,
        2,
      );
    }
  });
  const rowTop = top + 112, rowH = 44;
  data.diagram.players.forEach((player, ri) => {
    addTextBox(slide, {
      name: `player-${ri + 1}`,
      text: player.label.text,
      position: {
        left: p.main.left + 20,
        top: rowTop + ri * rowH,
        width: 130,
        height: rowH,
      },
      fontSize: 16,
      bold: player.ours,
      color: player.ours ? COLORS.orange : COLORS.navy,
    });
    stages.forEach((s, si) => {
      const covered = player.coverage.includes(s.id),
        planned = (player.planned ?? []).includes(s.id);
      addTextBox(slide, {
        name: `coverage-${ri + 1}-${si + 1}`,
        text: planned ? "拟进入" : covered ? "●" : "",
        position: {
          left: stageStart + si * (w + gap),
          top: rowTop + ri * rowH,
          width: w - 2,
          height: rowH - 4,
        },
        fontSize: 16,
        bold: player.ours,
        color: player.ours ? COLORS.orange : COLORS.blue,
        alignment: "center",
        fill: covered ? (player.ours ? PALE_ORANGE : PALE_BLUE) : COLORS.white,
        line: {
          style: planned ? "dashed" : "solid",
          fill: planned ? COLORS.orange : COLORS.border,
          width: 1,
        },
      });
    });
  });
  bottom(slide, p.bottom, data.diagram.positioning);
}

function renderGantt(slide, data, p) {
  panel(slide, "gantt-frame", p.main);
  panel(slide, "gantt-side", p.side, COLORS.soft);
  const timeAxis = p.gantt.time_axis,
    layerSteps = p.gantt.layer_steps,
    dependencyPlan = p.gantt.dependencies,
    tasks = p.gantt.tasks,
    layerAreaH = layerSteps.length ? 78 : 0;
  const laneW = 260,
    plotL = p.main.left + laneW,
    plotW = p.main.width - laneW - 18,
    monthW = plotW / timeAxis.length,
    rowH = (p.main.height - 54 - layerAreaH) / tasks.length,
    taskGridBottom = p.main.top + 42 + tasks.length * rowH;
  const laneGroups = data.diagram.lanes.map((l) => ({
    name: l.text,
    indexes: tasks.map((t, i) => t.lane === l.text ? i : -1)
      .filter((i) => i >= 0),
  })).filter((g) => g.indexes.length);
  laneGroups.forEach((g, gi) => {
    const first = Math.min(...g.indexes),
      last = Math.max(...g.indexes),
      top = p.main.top + 42 + first * rowH,
      height = (last - first + 1) * rowH;
    addTextBox(slide, {
      name: `lane-bg-${gi + 1}`,
      text: "",
      position: { left: p.main.left + 4, top, width: p.main.width - 8, height },
      fontSize: 16,
      fill: gi % 2 === 0 ? "#F8FAFC" : COLORS.white,
      line: { style: "solid", fill: COLORS.border, width: .5 },
    });
    addTextBox(slide, {
      name: `lane-${gi + 1}`,
      text: g.name,
      position: { left: p.main.left + 8, top, width: 46, height },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: gi % 2 === 0 ? PALE_BLUE : COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    });
  });
  for (let m = 0; m <= timeAxis.length; m++) {
    const x = plotL + m * monthW;
    line(
      slide,
      `month-${m}`,
      x,
      p.main.top + 34,
      x,
      taskGridBottom,
      m === 0 || m === timeAxis.length || m % 3 === 0 ? "solid" : "dashed",
      m === 0 || m === timeAxis.length || m % 3 === 0 ? COLORS.line : COLORS.border,
      m === 0 || m === timeAxis.length || m % 3 === 0 ? 1 : .5,
    );
    if (m < timeAxis.length) {
      addTextBox(slide, {
        name: `month-label-${m + 1}`,
        text: timeAxis[m].label,
        position: { left: x - 4, top: p.main.top + 8, width: monthW + 8, height: 22 },
        fontSize: 16,
        color: COLORS.muted,
        alignment: "center",
      });
    }
  }
  const taskShapes = new Map();
  tasks.forEach((t, i) => {
    const top = p.main.top + 42 + i * rowH;
    addTextBox(slide, {
      name: `task-label-${t.id}`,
      text: `${t.label.text}\n${t.owner.text}`,
      position: {
        left: p.main.left + 60,
        top,
        width: laneW - 66,
        height: rowH - 2,
      },
      fontSize: 14,
      bold: t.critical,
      color: t.critical ? COLORS.orange : COLORS.text,
    });
    const left = plotL + (t.start - 1) * monthW,
      width = (t.end - t.start + 1) * monthW;
    const frame = addTextBox(slide, {
      name: `task-${t.id}`,
      text: `${t.progress}%`,
      position: { left, top: top + 3, width, height: rowH - 8 },
      fontSize: 14,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: t.critical ? COLORS.orange : COLORS.blue,
      line: {
        style: "solid",
        fill: t.critical ? COLORS.orange : COLORS.blue,
        width: t.critical ? 2 : 1,
      },
    });
    taskShapes.set(t.id, frame);
  });
  dependencyPlan.forEach((d) => {
    const isTimeOrder = d.relationship_class === "time_order_only";
    connectNative(slide, taskShapes.get(d.from), taskShapes.get(d.to), {
      kind: isTimeOrder ? "straight" : "elbow",
      fromSide: "right",
      toSide: "left",
      arrow: !isTimeOrder,
      placement: "front",
      line: isTimeOrder
        ? { style: "dashed", fill: "#56616F", width: 3 }
        : { style: "solid", fill: COLORS.blue, width: 1.6 },
    });
  });
  taskShapes.forEach(shape=>shape.bringToFront());
  (data.diagram.milestones ?? []).forEach((m, i) =>
    addTextBox(slide, {
      name: `milestone-${i + 1}`,
      text: "◆",
      position: {
        left: plotL + (m.month - .5) * monthW - 12,
        top: p.main.top + 14,
        width: 24,
        height: 24,
      },
      fontSize: 18,
      bold: true,
      color: COLORS.orange,
      alignment: "center",
    })
  );
  if (layerSteps.length) {
    const areaTop = taskGridBottom + 10,
      areaBottom = p.main.top + p.main.height - 10,
      minLayer = Math.min(...layerSteps.map((step) => step.layer_count)),
      maxLayer = Math.max(...layerSteps.map((step) => step.layer_count)),
      layerY = (value) => areaBottom - 15 - (value - minLayer) / Math.max(1, maxLayer - minLayer) * (areaBottom - areaTop - 30),
      layerX = (slot) => plotL + (slot - .5) * monthW;
    addTextBox(slide, {
      name: "layer-step-label",
      text: "阶段层级",
      position: { left: p.main.left + 60, top: areaTop, width: laneW - 66, height: areaBottom - areaTop },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    layerSteps.slice(1).forEach((step, index) => {
      const previous = layerSteps[index], x1 = layerX(previous.slot), x2 = layerX(step.slot), y1 = layerY(previous.layer_count), y2 = layerY(step.layer_count);
      line(slide, `layer-step-horizontal-${index + 1}`, x1, y1, x2, y1, "solid", COLORS.orange, 2.2);
      line(slide, `layer-step-vertical-${index + 1}`, x2, y1, x2, y2, "solid", COLORS.orange, 2.2);
    });
    const last = layerSteps.at(-1);
    line(slide, "layer-step-horizontal-final", layerX(last.slot), layerY(last.layer_count), plotL + plotW, layerY(last.layer_count), "solid", COLORS.orange, 2.2);
    layerSteps.forEach((step, index) => addTextBox(slide, {
      name: `layer-step-node-${index + 1}`,
      text: `${step.layer_count}层`,
      position: { left: layerX(step.slot) - 31, top: layerY(step.layer_count) - 14, width: 62, height: 28 },
      fontSize: 14,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      geometry: "rect",
      fill: COLORS.orange,
      line: { style: "solid", fill: COLORS.white, width: 1 },
    }));
  }
  addTextBox(slide, {
    name: "gantt-side-title",
    text: p.gantt.side_title,
    position: {
      left: p.side.left + 16,
      top: p.side.top + 18,
      width: p.side.width - 32,
      height: 30,
    },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  addTextBox(slide, {
    name: "gantt-relationship-legend",
    text: "虚线：仅时间顺序\n实线箭头：必要依赖",
    position: { left: p.side.left + 16, top: p.side.top + 46, width: p.side.width - 32, height: 38 },
    fontSize: 12,
    color: COLORS.muted,
  });
  p.gantt.side_metrics.forEach((x, i) =>
    addNode(slide, {
      name: `gantt-metric-${i + 1}`,
      text: x.text,
      position: {
        left: p.side.left + 14,
        top: p.side.top + 90 + i * 154,
        width: p.side.width - 28,
        height: 128,
      },
      fill: COLORS.white,
      border: COLORS.border,
      borderWidth: 1,
      fontSize: 16,
      bold: false,
      color: COLORS.text,
      alignment: "left",
    })
  );
  bottom(slide, p.bottom, data.diagram.conclusion);
}

export async function renderR4Module(data, output) {
  const p = planR4Module(data),
    { presentation, slide } = createPresentation(output.background);
  header(slide, p);
  ({
    "sankey-flow": renderSankey,
    "chord-dependency": renderChord,
    "market-funnel": renderFunnel,
    "industry-value-chain": renderValueChain,
    "gantt-dependency": renderGantt,
  })[data.module_id](slide, data, p);
  await exportPresentation(presentation, output);
  return p;
}
async function main() {
  const o = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(o.input, "utf8"));
  await renderR4Module(data, o);
  process.stdout.write(
    `${JSON.stringify({ ok: true, module: data.module_id })}\n`,
  );
}
if (
  process.argv[1] &&
  path.basename(process.argv[1]) ===
    path.basename(fileURLToPath(import.meta.url))
) {
  main().catch((e) => {
    process.stderr.write(
      `${
        JSON.stringify({ code: e.code ?? "RENDER_FAIL", message: e.message })
      }\n`,
    );
    process.exitCode = 1;
  });
}
