import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addChartLine,
  addFieldGroup,
  addNode,
  addTextBox,
  COLORS,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";
import { planR5Module } from "./plan_r5_module.mjs";
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
function rail(slide, pos, items, title = "管理洞察") {
  panel(slide, `${title}-rail`, pos, COLORS.soft);
  addTextBox(slide, {
    name: `${title}-title`,
    text: title,
    position: {
      left: pos.left + 16,
      top: pos.top + 14,
      width: pos.width - 32,
      height: 28,
    },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  items.slice(0, 3).forEach((x, i) =>
    addNode(slide, {
      name: `${title}-${i + 1}`,
      text: `${i + 1}  ${x.text}`,
      position: {
        left: pos.left + 14,
        top: pos.top + 58 + i * 124,
        width: pos.width - 28,
        height: 100,
      },
      fill: COLORS.white,
      border: i === 0 ? COLORS.orange : COLORS.border,
      borderWidth: i === 0 ? 1.5 : 1,
      fontSize: 16,
      bold: i === 0,
      color: COLORS.text,
      alignment: "left",
    })
  );
}
function bottom(slide, pos, item) {
  if (item) {
    addNode(slide, {
      name: "bottom",
      text: item.text,
      position: pos,
      fill: PALE_ORANGE,
      border: COLORS.orange,
      borderWidth: 1.2,
      fontSize: 18,
      bold: true,
      color: COLORS.navy,
    });
  }
}
function metricHeader(slide, pos, metrics) {
  const gap = 12, w = (pos.width - gap * 2) / 3;
  metrics.forEach((m, i) =>
    addTextBox(slide, {
      name: `metric-${i + 1}`,
      text: `${m.label.text}\n${m.value.text}\n${m.target.text}`,
      position: {
        left: pos.left + i * (w + gap),
        top: pos.top,
        width: w,
        height: 84,
      },
      fontSize: i === 0 ? 18 : 16,
      bold: true,
      color: i === 0 ? COLORS.orange : COLORS.navy,
      alignment: "center",
      fill: i === 0 ? PALE_ORANGE : COLORS.soft,
      line: {
        style: "solid",
        fill: i === 0 ? COLORS.orange : COLORS.border,
        width: 1,
      },
    })
  );
}

function renderAge(slide, data, p) {
  panel(slide, "age-frame", p.main);
  const bands = data.diagram.bands,
    center = p.main.left + 330,
    max = Math.max(
      ...bands.flatMap(
        (x) => [x.male, x.female, x.healthy_male, x.healthy_female],
      ),
    ),
    scale = 200 / max,
    rowH = 54,
    top = p.main.top + 46,
    metricLeft = p.main.left + 590,
    metricColW = (p.main.width - 606) / 4;
  addTextBox(slide, {
    name: "male-head",
    text: `男性  总计 ${bands.reduce((s, x) => s + x.male, 0)} 人`,
    position: {
      left: p.main.left + 80,
      top: p.main.top + 10,
      width: 190,
      height: 28,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.navy,
    alignment: "center",
  });
  addTextBox(slide, {
    name: "age-head",
    text: "年龄段",
    position: {
      left: center - 42,
      top: p.main.top + 10,
      width: 84,
      height: 28,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.muted,
    alignment: "center",
  });
  addTextBox(slide, {
    name: "female-head",
    text: `女性  总计 ${bands.reduce((s, x) => s + x.female, 0)} 人`,
    position: {
      left: center + 80,
      top: p.main.top + 10,
      width: 190,
      height: 28,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.orange,
    alignment: "center",
  });
  ["司龄", "薪酬", "离职", "管理"].forEach((t, i) =>
    addTextBox(slide, {
      name: `age-metric-head-${i + 1}`,
      text: t,
      position: {
        left: metricLeft + i * metricColW,
        top: p.main.top + 10,
        width: metricColW - 2,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.muted,
      alignment: "center",
    })
  );
  bands.forEach((x, i) => {
    const y = top + i * rowH,
      highlight = i === 2 || i === 3
        ? PALE_BLUE
        : i >= 5
        ? PALE_ORANGE
        : COLORS.white;
    addTextBox(slide, {
      name: `age-band-bg-${i + 1}`,
      text: "",
      position: {
        left: p.main.left + 10,
        top: y,
        width: p.main.width - 20,
        height: rowH - 2,
      },
      fontSize: 16,
      fill: highlight,
      line: { style: "solid", fill: highlight, width: 0 },
    });
    const mw = x.male * scale,
      fw = x.female * scale,
      bmw = x.healthy_male * scale,
      bfw = x.healthy_female * scale;
    addTextBox(slide, {
      name: `male-benchmark-${i + 1}`,
      text: "",
      position: { left: center - 50 - bmw, top: y + 8, width: bmw, height: 34 },
      fontSize: 16,
      fill: "none",
      line: { style: "dashed", fill: COLORS.muted, width: 1 },
    });
    addTextBox(slide, {
      name: `female-benchmark-${i + 1}`,
      text: "",
      position: { left: center + 50, top: y + 8, width: bfw, height: 34 },
      fontSize: 16,
      fill: "none",
      line: { style: "dashed", fill: COLORS.muted, width: 1 },
    });
    addTextBox(slide, {
      name: `male-${i + 1}`,
      text: mw >= 52 ? String(x.male) : "",
      position: { left: center - 50 - mw, top: y + 10, width: mw, height: 30 },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: COLORS.navy,
      line: { style: "solid", fill: COLORS.navy, width: 1 },
    });
    if (mw < 52) addTextBox(slide, {
      name: `male-external-${i + 1}`,
      text: String(x.male),
      position: { left: center - 114 - mw, top: y + 10, width: 58, height: 30 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "right",
    });
    addTextBox(slide, {
      name: `female-${i + 1}`,
      text: fw >= 52 ? String(x.female) : "",
      position: { left: center + 50, top: y + 10, width: fw, height: 30 },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: COLORS.orange,
      line: { style: "solid", fill: COLORS.orange, width: 1 },
    });
    if (fw < 52) addTextBox(slide, {
      name: `female-external-${i + 1}`,
      text: String(x.female),
      position: { left: center + 56 + fw, top: y + 10, width: 58, height: 30 },
      fontSize: 16,
      bold: true,
      color: COLORS.orange,
    });
    addTextBox(slide, {
      name: `age-label-${i + 1}`,
      text: x.label.text,
      position: { left: center - 45, top: y + 8, width: 90, height: 34 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
    [x.tenure, x.salary, x.turnover, x.manager_share].forEach((m, j) =>
      addTextBox(slide, {
        name: `age-metric-${i + 1}-${j + 1}`,
        text: m.text,
        position: {
          left: metricLeft + j * metricColW,
          top: y + 8,
          width: metricColW - 2,
          height: 34,
        },
        fontSize: 16,
        color: COLORS.text,
        alignment: "center",
      })
    );
  });
  rail(slide, p.rail, data.diagram.insights);
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderWorkforce(slide, data, p) {
  panel(slide, "workforce-frame", p.main);
  const months = data.diagram.months,
    left = p.main.left + 28,
    plotW = p.main.width - 56,
    step = plotW / 11,
    top = p.main.top + 24,
    h = 104;
  const hasAttrition = months.every((month) => Number.isFinite(month.attrition_rate));
  const hasRecruitment = months.every((month) => Number.isFinite(month.recruitment_rate));
  const hasBudget = months.every((month) => Number.isFinite(month.budget));
  if (hasAttrition || hasRecruitment) [0, 50, 100].forEach((v) =>
    line(
      slide,
      `rate-grid-${v}`,
      left,
      top + h - v / 100 * h,
      left + plotW,
      top + h - v / 100 * h,
      "dashed",
      COLORS.border,
      .6,
    )
  );
  const attr = [], recruit = [];
  months.forEach((m, i) => {
    const x = left + i * step;
    if (hasAttrition) attr.push({ x, y: top + h - m.attrition_rate / 20 * h });
    if (hasRecruitment) recruit.push({ x, y: top + h - m.recruitment_rate / 100 * h });
    if (m.annotation) {
      addTextBox(slide, {
        name: `workforce-note-${i + 1}`,
        text: `⚠ ${m.annotation.text}`,
        position: { left: x - 34, top: top - 4, width: 68, height: 24 },
        fontSize: 16,
        bold: true,
        color: COLORS.orange,
        alignment: "center",
      });
    }
  });
  for (let i = 1; i < months.length; i++) {
    if (hasAttrition) line(
      slide,
      `attrition-line-${i}`,
      attr[i - 1].x,
      attr[i - 1].y,
      attr[i].x,
      attr[i].y,
      "solid",
      COLORS.orange,
      2,
    );
    if (hasRecruitment) line(
      slide,
      `recruit-line-${i}`,
      recruit[i - 1].x,
      recruit[i - 1].y,
      recruit[i].x,
      recruit[i].y,
      "solid",
      COLORS.blue,
      2,
    );
  }
  addTextBox(slide, {
    name: "rate-legend",
    text: hasAttrition || hasRecruitment
      ? `${hasAttrition ? "橙：离职率" : "离职率待补充"}；${hasRecruitment ? "蓝：招聘完成率" : "招聘完成率待补充"}`
      : "离职率／招聘完成率：待客户补充",
    position: { left: left, top: top + h + 4, width: 430, height: 24 },
    fontSize: 16,
    bold: true,
    color: COLORS.navy,
  });
  addTextBox(slide, {
    name: "workforce-row-legend",
    text: "对账顺序：期初 / 入 / 离 / 调 / 期末 / 净增",
    position: { left, top: top + h + 24, width: 500, height: 20 },
    fontSize: 16,
    color: COLORS.muted,
  });
  const cellTop = p.main.top + 176, cellW = (p.main.width - 28) / 12;
  months.forEach((m, i) => {
    const x = p.main.left + 14 + i * cellW,
      boxLeft = x + 1,
      boxWidth = cellW - 3,
      hire = m.campus_hires + m.social_hires + m.referral_hires,
      exit = m.voluntary_exit + m.involuntary_exit,
      net = m.closing - m.opening;
    addTextBox(slide, {
      name: `month-${i + 1}`,
      text: m.label.text,
      position: { left: x, top: cellTop, width: cellW - 2, height: 24 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
    addTextBox(slide, {
      name: `opening-${i + 1}`,
      text: String(m.opening),
      position: {
        left: boxLeft,
        top: cellTop + 28,
        width: boxWidth,
        height: 30,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: COLORS.navy,
      line: { style: "solid", fill: COLORS.navy, width: 1 },
    });
    addTextBox(slide, {
      name: `hire-${i + 1}`,
      text: `+${hire}`,
      position: {
        left: boxLeft,
        top: cellTop + 62,
        width: boxWidth,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: COLORS.blue,
      line: { style: "solid", fill: COLORS.blue, width: 1 },
    });
    addTextBox(slide, {
      name: `exit-${i + 1}`,
      text: `−${exit}`,
      position: {
        left: boxLeft,
        top: cellTop + 94,
        width: boxWidth,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: COLORS.orange,
      line: { style: "solid", fill: COLORS.orange, width: 1 },
    });
    addTextBox(slide, {
      name: `transfer-${i + 1}`,
      text: `${m.transfer_in - m.transfer_out >= 0 ? "+" : "−"}${Math.abs(m.transfer_in - m.transfer_out)}`,
      position: {
        left: boxLeft,
        top: cellTop + 126,
        width: boxWidth,
        height: 26,
      },
      fontSize: 16,
      color: COLORS.text,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: 1 },
    });
    addTextBox(slide, {
      name: `closing-${i + 1}`,
      text: String(m.closing),
      position: {
        left: boxLeft,
        top: cellTop + 156,
        width: boxWidth,
        height: 30,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: net >= 4 ? PALE_BLUE : COLORS.white,
      line: { style: "solid", fill: COLORS.border, width: 1 },
    });
    addTextBox(slide, {
      name: `net-${i + 1}`,
      text: `${net >= 0 ? "+" : ""}${net}`,
      position: { left: boxLeft, top: cellTop + 188, width: boxWidth, height: 24 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
    if (hasBudget) addTextBox(slide, {
      name: `budget-${i + 1}`,
      text: `编差 ${m.closing - m.budget}`,
      position: {
        left: boxLeft,
        top: cellTop + 220,
        width: boxWidth,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: m.closing < m.budget ? COLORS.orange : COLORS.blue,
      alignment: "center",
    });
    if (i < 11) {
      line(
        slide,
        `workforce-link-${i + 1}`,
        x + cellW - 6,
        cellTop + 171,
        x + cellW + 4,
        cellTop + 42,
        "dashed",
        COLORS.line,
        .8,
      );
    }
  });
  if (!hasBudget) addTextBox(slide, {
    name: "budget-missing-note",
    text: "编制预算偏差：待客户补充",
    position: { left, top: cellTop + 228, width: 300, height: 28 },
    fontSize: 16,
    bold: true,
    color: COLORS.muted,
  });
  rail(slide, p.rail, data.diagram.insights);
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function chartPoint(plot, index, count, value, min = 0, max = 100) {
  return {
    x: plot.left + index / (count - 1) * plot.width,
    y: plot.top + plot.height - (value - min) / (max - min) * plot.height,
  };
}
function renderSurvival(slide, data, p) {
  panel(slide, "survival-frame", p.main);
  const plot = {
    left: p.main.left + 56,
    top: p.main.top + 38,
    width: p.main.width - 90,
    height: 255,
  };
  [0, 25, 50, 75, 100].forEach((v) => {
    const y = chartPoint(plot, 0, 25, v).y;
    line(
      slide,
      `survival-grid-${v}`,
      plot.left,
      y,
      plot.left + plot.width,
      y,
      "dashed",
      COLORS.border,
      .6,
    );
    addTextBox(slide, {
      name: `survival-axis-${v}`,
      text: `${v}%`,
      position: { left: plot.left - 76, top: y - 12, width: 70, height: 24 },
      fontSize: 16,
      color: COLORS.muted,
      alignment: "right",
    });
  });
  [3, 13].forEach((m, i) =>
    addTextBox(slide, {
      name: `risk-band-${i + 1}`,
      text: "",
      position: {
        left: chartPoint(plot, m, 25, 0).x - 8,
        top: plot.top,
        width: 16,
        height: plot.height,
      },
      fontSize: 16,
      fill: PALE_ORANGE,
      line: { style: "solid", fill: PALE_ORANGE, width: 0 },
    })
  );
  const series = [...data.diagram.cohorts, {
      ...data.diagram.benchmark,
      isBenchmark: true,
    }],
    colors = [COLORS.navy, COLORS.orange, COLORS.blue, "#7397BD", COLORS.muted];
  series.forEach((s, si) => {
    for (let i = 1; i < s.values.length; i++) {
      const a = chartPoint(plot, i - 1, 25, s.values[i - 1]),
        b = chartPoint(plot, i, 25, s.values[i - 1]),
        c = chartPoint(plot, i, 25, s.values[i]);
      line(
        slide,
        `survival-h-${si}-${i}`,
        a.x,
        a.y,
        b.x,
        b.y,
        s.isBenchmark ? "dashed" : "solid",
        colors[si],
        s.isBenchmark ? 1.2 : 1.8,
      );
      line(
        slide,
        `survival-v-${si}-${i}`,
        b.x,
        b.y,
        c.x,
        c.y,
        s.isBenchmark ? "dashed" : "solid",
        colors[si],
        s.isBenchmark ? 1.2 : 1.8,
      );
    }
  });
  data.diagram.cohorts.forEach((s, i) =>
    addTextBox(slide, {
      name: `cohort-legend-${i + 1}`,
      text: `● ${s.label.text}\n12月 ${Math.round(s.values[12])}%  24月 ${
        Math.round(s.values[24])
      }%`,
      position: {
        left: plot.left + i * (plot.width / 4),
        top: plot.top + plot.height + 5,
        width: plot.width / 4 - 4,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: colors[i],
      alignment: "center",
    })
  );
  addTextBox(slide, {
    name: "benchmark-legend",
    text: "灰虚线：行业基准",
    position: { left: plot.left, top: plot.top - 28, width: 160, height: 24 },
    fontSize: 16,
    bold: true,
    color: COLORS.muted,
  });
  addTextBox(slide, {
    name: "survival-notes",
    text: "3 个月：融入与岗位匹配问题        13 个月：晋升与调薪预期落空",
    position: {
      left: plot.left + 170,
      top: plot.top - 28,
      width: 600,
      height: 24,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.orange,
    alignment: "center",
  });
  const riskTop = p.main.top + 338,
    labelW = 170,
    colW = (p.main.width - labelW - 28) / 5;
  data.diagram.risk_rows.forEach((r, ri) => {
    addTextBox(slide, {
      name: `risk-label-${ri + 1}`,
      text: r.label.text,
      position: {
        left: p.main.left + 14,
        top: riskTop + ri * 30,
        width: labelW,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    r.scores.forEach((v, ci) =>
      addTextBox(slide, {
        name: `risk-${ri + 1}-${ci + 1}`,
        text: ["低", "中", "高"][v - 1],
        position: {
          left: p.main.left + 14 + labelW + ci * colW,
          top: riskTop + ri * 30,
          width: colW - 2,
          height: 28,
        },
        fontSize: 16,
        bold: v === 3,
        color: v === 3 ? COLORS.white : COLORS.text,
        alignment: "center",
        fill: v === 3 ? COLORS.orange : v === 2 ? PALE_ORANGE : COLORS.soft,
        line: { style: "solid", fill: COLORS.white, width: .5 },
      })
    );
  });
  rail(slide, p.rail, data.diagram.insights);
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderSupply(slide, data, p) {
  panel(slide, "supply-frame", p.main);
  const rows = data.diagram.periods,
    plot = {
      left: p.main.left + 54,
      top: p.main.top + 30,
      width: p.main.width - 90,
      height: 245,
    },
    min = 250,
    max = 500;
  [300, 350, 400, 450].forEach((v) => {
    const y = chartPoint(plot, 0, 6, v, min, max).y;
    line(
      slide,
      `supply-grid-${v}`,
      plot.left,
      y,
      plot.left + plot.width,
      y,
      "dashed",
      COLORS.border,
      .6,
    );
    addTextBox(slide, {
      name: `supply-axis-${v}`,
      text: String(v),
      position: { left: plot.left - 76, top: y - 12, width: 70, height: 24 },
      fontSize: 16,
      color: COLORS.muted,
      alignment: "right",
    });
  });
  rows.forEach((r, i) => {
    const x = chartPoint(plot, i, 6, r.demand, min, max).x,
      yLow = chartPoint(plot, i, 6, r.demand_low, min, max).y,
      yHigh = chartPoint(plot, i, 6, r.demand_high, min, max).y,
      yD = chartPoint(plot, i, 6, r.demand, min, max).y,
      yS = chartPoint(plot, i, 6, r.supply, min, max).y;
    addTextBox(slide, {
      name: `demand-band-${i + 1}`,
      text: "",
      position: { left: x - 18, top: yHigh, width: 36, height: yLow - yHigh },
      fontSize: 16,
      fill: PALE_BLUE,
      line: { style: "solid", fill: PALE_BLUE, width: 0 },
    });
    addTextBox(slide, {
      name: `gap-${i + 1}`,
      text: String(r.gap),
      position: {
        left: x - 30,
        top: yD,
        width: 60,
        height: Math.max(22, yS - yD),
      },
      fontSize: 16,
      bold: true,
      color: COLORS.orange,
      alignment: "center",
      fill: PALE_ORANGE,
      line: { style: "solid", fill: COLORS.orange, width: 1 },
    });
    if (i) {
      const pd = chartPoint(plot, i - 1, 6, rows[i - 1].demand, min, max),
        ps = chartPoint(plot, i - 1, 6, rows[i - 1].supply, min, max);
      line(slide, `demand-${i}`, pd.x, pd.y, x, yD, "solid", COLORS.navy, 2.5);
      line(slide, `supply-${i}`, ps.x, ps.y, x, yS, "dashed", COLORS.blue, 2);
    }
    addTextBox(slide, {
      name: `period-${i + 1}`,
      text: r.label.text,
      position: {
        left: x - 28,
        top: plot.top + plot.height + 4,
        width: 56,
        height: 24,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
  });
  const tableTop = p.main.top + 326,
    rowNames = ["期初", "流失", "退休", "晋升", "转岗", "内部供给", "需外补"],
    keys = [
      "opening",
      "attrition",
      "retirement",
      "promotion",
      "transfer",
      "supply",
      "external",
    ],
    labelW = 120,
    colW = (p.main.width - labelW - 24) / 6;
  rowNames.forEach((name, ri) => {
    addTextBox(slide, {
      name: `supply-row-label-${ri + 1}`,
      text: name,
      position: {
        left: p.main.left + 12,
        top: tableTop + ri * 22,
        width: labelW,
        height: 22,
      },
      fontSize: 16,
      bold: ri >= 5,
      color: ri === 6 ? COLORS.orange : COLORS.navy,
    });
    rows.forEach((r, ci) =>
      addTextBox(slide, {
        name: `supply-cell-${ri + 1}-${ci + 1}`,
        text: String(r[keys[ri]]),
        position: {
          left: p.main.left + 12 + labelW + ci * colW,
          top: tableTop + ri * 22,
          width: colW - 2,
          height: 22,
        },
        fontSize: 16,
        bold: ri >= 5,
        color: ri === 6 ? COLORS.orange : COLORS.text,
        alignment: "center",
        fill: ri === 6 ? PALE_ORANGE : ri === 5 ? PALE_BLUE : COLORS.white,
        line: { style: "solid", fill: COLORS.border, width: .5 },
      })
    );
  });
  panel(slide, "strategy-rail", p.rail, COLORS.soft);
  addTextBox(slide, {
    name: "strategy-title",
    text: "补充策略",
    position: {
      left: p.rail.left + 16,
      top: p.rail.top + 14,
      width: p.rail.width - 32,
      height: 28,
    },
    fontSize: 18,
    bold: true,
    color: COLORS.navy,
  });
  data.diagram.strategies.forEach((s, i) =>
    addNode(slide, {
      name: `strategy-${i + 1}`,
      text:
        `${s.label.text}\n${s.count} 人\n周期：${s.cycle.text}\n成本：${s.cost.text}\n风险：${s.risk.text}`,
      position: {
        left: p.rail.left + 14,
        top: p.rail.top + 58 + i * 124,
        width: p.rail.width - 28,
        height: 100,
      },
      fill: COLORS.white,
      border: i === 0 ? COLORS.orange : COLORS.border,
      borderWidth: i === 0 ? 1.5 : 1,
      fontSize: 16,
      bold: i === 0,
      color: COLORS.text,
      alignment: "left",
    })
  );
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderLevel(slide, data, p) {
  panel(slide, "level-frame", p.main);
  const levels = data.diagram.levels,
    functions = data.diagram.functions,
    left = p.main.left + 210,
    top = p.main.top + 42,
    rowH = 50,
    colW = (p.main.width - 230) / 5,
    max = Math.max(...levels.flatMap((x) => x.cells.map((c) => c.count))),
    maxTotal = Math.max(
      ...levels.map((x) => x.cells.reduce((s, c) => s + c.count, 0)),
    );
  functions.forEach((f, i) =>
    addTextBox(slide, {
      name: `function-${i + 1}`,
      text: f.text,
      position: {
        left: left + i * colW,
        top: p.main.top + 8,
        width: colW - 2,
        height: 30,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    })
  );
  levels.forEach((l, ri) => {
    const total = l.cells.reduce((s, c) => s + c.count, 0),
      barW = 170 * total / maxTotal;
    const barLeft = p.main.left + 190 - barW;
    addTextBox(slide, {
      name: `level-bar-${ri + 1}`,
      text: barW >= 90 ? `${l.label.text}  ${total}` : "",
      position: {
        left: barLeft,
        top: top + ri * rowH + 6,
        width: barW,
        height: 34,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: ri < 4 ? COLORS.blue : COLORS.navy,
      line: { style: "solid", fill: COLORS.white, width: .7 },
    });
    if (barW < 90) addTextBox(slide, {
      name: `level-bar-label-${ri + 1}`,
      text: `${l.label.text}  ${total}`,
      position: { left: p.main.left + 8, top: top + ri * rowH + 6, width: Math.max(54, barLeft - p.main.left - 14), height: 34 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "right",
    });
    l.cells.forEach((c, ci) => {
      const ratio = c.count / max,
        fill = c.count === 0
          ? COLORS.white
          : ratio > .65
          ? COLORS.blue
          : ratio > .3
          ? PALE_BLUE
          : COLORS.soft;
      addTextBox(slide, {
        name: `level-cell-${ri + 1}-${ci + 1}`,
        text: c.count ? `${c.count}人\n${c.salary}万\n${c.tenure}年司龄` : "断层",
        position: {
          left: left + ci * colW,
          top: top + ri * rowH,
          width: colW - 2,
          height: rowH - 2,
        },
        fontSize: 16,
        bold: c.count === 0 || ci === 0 && l.management_span < 4,
        color: c.count === 0 || ci === 0 && l.management_span < 4
          ? COLORS.orange
          : COLORS.text,
        alignment: "center",
        fill,
        line: {
          style: c.count === 0 ? "dashed" : "solid",
          fill: c.count === 0 || ci === 0 && l.management_span < 4
            ? COLORS.orange
            : COLORS.border,
          width: c.count === 0 ? 1.2 : .6,
        },
      });
    });
  });
  rail(slide, p.rail, data.diagram.insights);
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderMobility(slide, data, p) {
  panel(slide, "mobility-matrix", p.matrix);
  panel(slide, "mobility-network", p.network, COLORS.soft);
  const deps = data.diagram.departments,
    n = 6,
    labelW = 86,
    cellW = (p.matrix.width - labelW - 20) / n,
    rowH = 54,
    top = p.matrix.top + 50;
  deps.forEach((d, i) => {
    addTextBox(slide, {
      name: `mob-col-${i + 1}`,
      text: d.text,
      position: {
        left: p.matrix.left + labelW + i * cellW,
        top: p.matrix.top + 10,
        width: cellW - 2,
        height: 34,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
    });
    addTextBox(slide, {
      name: `mob-row-${i + 1}`,
      text: d.text,
      position: {
        left: p.matrix.left + 8,
        top: top + i * rowH,
        width: labelW - 12,
        height: rowH - 2,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
  });
  const maxOff = Math.max(
    ...data.diagram.matrix.flatMap((r, i) => r.filter((_, j) => i !== j)),
  );
  data.diagram.matrix.forEach((r, i) =>
    r.forEach((v, j) => {
      const q = data.diagram.quality[i][j],
        fill = i === j
          ? COLORS.soft
          : v === 0
          ? COLORS.white
          : v / maxOff > .5
          ? PALE_ORANGE
          : PALE_BLUE;
      addTextBox(slide, {
        name: `mobility-${i + 1}-${j + 1}`,
        text: i === j ? String(v) : v ? `${v}/${q.retention}/${q.performance}` : "○",
        position: {
          left: p.matrix.left + labelW + j * cellW,
          top: top + i * rowH,
          width: cellW - 2,
          height: rowH - 2,
        },
        fontSize: 16,
        bold: v === maxOff,
        color: v === maxOff ? COLORS.orange : COLORS.text,
        alignment: "center",
        fill,
        line: {
          style: v === 0 ? "dashed" : "solid",
          fill: v === maxOff ? COLORS.orange : COLORS.border,
          width: v === maxOff ? 1.2 : .6,
        },
      });
    })
  );
  const totalTop = top + n * rowH + 2;
  addTextBox(slide, {
    name: "mob-total-label",
    text: "流入合计",
    position: {
      left: p.matrix.left + 8,
      top: totalTop,
      width: labelW - 12,
      height: 40,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.navy,
  });
  for (let j = 0; j < n; j++) {
    const total = data.diagram.matrix.reduce((s, r) => s + r[j], 0);
    addTextBox(slide, {
      name: `mob-total-${j + 1}`,
      text: String(total),
      position: {
        left: p.matrix.left + labelW + j * cellW,
        top: totalTop,
        width: cellW - 2,
        height: 40,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: PALE_BLUE,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    });
  }
  addTextBox(slide, {
    name: "mobility-cell-legend",
    text: "格内顺序：人数 / 12 月留存率 / 绩效提升比例（%）；对角线为留任人数",
    position: { left: p.matrix.left + labelW, top: totalTop + 42, width: 420, height: 24 },
    fontSize: 16,
    color: COLORS.muted,
  });
  const cx = p.network.left + p.network.width / 2,
    cy = p.network.top + 172,
    r = 118,
    shapes = [];
  deps.forEach((d, i) => {
    const a = (-90 + i * 60) * Math.PI / 180,
      x = cx + Math.cos(a) * r,
      y = cy + Math.sin(a) * r;
    shapes.push(addTextBox(slide, {
      name: `mob-node-${i + 1}`,
      text: d.text,
      position: { left: x - 38, top: y - 22, width: 76, height: 44 },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      geometry: "ellipse",
      fill: i < 2 ? COLORS.orange : COLORS.navy,
      line: { style: "solid", fill: COLORS.white, width: 1 },
    }));
  });
  const flows = [];
  data.diagram.matrix.forEach((row, i) =>
    row.forEach((v, j) => {
      if (i !== j && v > 0) flows.push({ i, j, v });
    })
  );
  flows.sort((a, b) => b.v - a.v).slice(0, 3).reverse().forEach((f, i) =>
    connectNative(slide, shapes[f.i], shapes[f.j], {
      kind: "curved",
      placement: "front",
      line: {
        style: "solid",
        fill: i === 2 ? COLORS.orange : COLORS.blue,
        width: 2 + f.v / 8,
      },
    })
  );
  data.diagram.insights.forEach((x, i) =>
    addTextBox(slide, {
      name: `mob-insight-${i + 1}`,
      text: `${i + 1}  ${x.text}`,
      position: {
        left: p.network.left + 16,
        top: p.network.top + 314 + i * 44,
        width: p.network.width - 32,
        height: 40,
      },
      fontSize: 16,
      bold: i === 0,
      color: i === 0 ? COLORS.orange : COLORS.text,
      fill: COLORS.white,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    })
  );
  bottom(slide, p.bottom, data.diagram.conclusion);
}

function renderEligibility(slide, data, p) {
  metricHeader(slide, {
    left: p.main.left,
    top: p.main.top,
    width: p.main.width,
  }, data.diagram.metrics);
  panel(slide, "eligibility-table", {
    left: p.main.left,
    top: p.main.top + 102,
    width: p.main.width,
    height: p.main.height - 102,
  });
  const policies = data.diagram.policies,
    segments = data.diagram.segments,
    labelW = 136,
    colW = (p.main.width - labelW - 18) / policies.length,
    top = p.main.top + 148,
    rowH = 54;
  policies.forEach((x, i) =>
    addTextBox(slide, {
      name: `policy-${i + 1}`,
      text: x.text,
      position: {
        left: p.main.left + labelW + i * colW,
        top: p.main.top + 108,
        width: colW - 2,
        height: 34,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    })
  );
  segments.forEach((s, ri) => {
    addTextBox(slide, {
      name: `segment-${ri + 1}`,
      text: s.label.text,
      position: {
        left: p.main.left + 10,
        top: top + ri * rowH,
        width: labelW - 12,
        height: rowH - 2,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    s.scores.forEach((v, ci) =>
      addTextBox(slide, {
        name: `eligible-${ri + 1}-${ci + 1}`,
        text: ["需人工", "条件覆盖", "自动判断"][v - 1],
        position: {
          left: p.main.left + labelW + ci * colW,
          top: top + ri * rowH,
          width: colW - 2,
          height: rowH - 2,
        },
        fontSize: 16,
        bold: v === 1,
        color: v === 1 ? COLORS.orange : COLORS.text,
        alignment: "center",
        fill: v === 1 ? PALE_ORANGE : v === 3 ? PALE_BLUE : COLORS.soft,
        line: { style: "solid", fill: COLORS.border, width: .6 },
      })
    );
  });
  rail(slide, p.rail, data.diagram.insights, "发现与动作");
  bottom(slide, p.bottom, data.diagram.conclusion);
}
function renderService(slide, data, p) {
  metricHeader(slide, {
    left: p.main.left,
    top: p.main.top,
    width: p.main.width,
  }, data.diagram.metrics);
  panel(slide, "service-table", {
    left: p.main.left,
    top: p.main.top + 102,
    width: p.main.width,
    height: p.main.height - 102,
  });
  const max = Math.max(...data.diagram.services.map((x) => x.volume)),
    top = p.main.top + 126,
    rowH = 64;
  addFieldGroup(slide, { name: "service-head", fields: ["服务目录", "需求量", "办理成功率", "自动化覆盖", "责任组"].map((value) => ({ value, bold: true, alignment: "center" })), position: { left: p.main.left + 16, top, width: p.main.width - 32, height: 28 }, gap: 4, fontSize: 16, color: COLORS.navy });
  data.diagram.services.forEach((s, i) => {
    const y = top + 36 + i * rowH;
    const volumeWidth = 250 * s.volume / max;
    addTextBox(slide, {
      name: `service-name-${i + 1}`,
      text: s.label.text,
      position: { left: p.main.left + 16, top: y, width: 120, height: 44 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    addTextBox(slide, {
      name: `service-volume-${i + 1}`,
      text: volumeWidth >= 72 ? String(s.volume) : "",
      position: {
        left: p.main.left + 140,
        top: y + 8,
        width: volumeWidth,
        height: 28,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.white,
      alignment: "center",
      fill: s.success < 80 ? COLORS.orange : COLORS.blue,
      line: { style: "solid", fill: COLORS.white, width: .5 },
    });
    if (volumeWidth < 72) addTextBox(slide, {
      name: `service-volume-external-${i + 1}`,
      text: String(s.volume),
      position: { left: p.main.left + 146 + volumeWidth, top: y + 8, width: 68, height: 28 },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    addTextBox(slide, {
      name: `service-success-${i + 1}`,
      text: `${s.success}%`,
      position: { left: p.main.left + 410, top: y, width: 90, height: 44 },
      fontSize: 18,
      bold: true,
      color: s.success < 80 ? COLORS.orange : COLORS.navy,
      alignment: "center",
    });
    addTextBox(slide, {
      name: `service-auto-${i + 1}`,
      text: `${s.automation}%`,
      position: { left: p.main.left + 510, top: y, width: 90, height: 44 },
      fontSize: 18,
      bold: true,
      color: s.automation < 50 ? COLORS.orange : COLORS.blue,
      alignment: "center",
    });
    addTextBox(slide, {
      name: `service-owner-${i + 1}`,
      text: s.owner.text,
      position: { left: p.main.left + 620, top: y, width: 180, height: 44 },
      fontSize: 16,
      color: COLORS.text,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    });
  });
  rail(slide, p.rail, data.diagram.insights, "发现／根因／动作");
  bottom(slide, p.bottom, data.diagram.conclusion);
}
function renderIntake(slide, data, p) {
  metricHeader(slide, {
    left: p.main.left,
    top: p.main.top,
    width: p.main.width,
  }, data.diagram.metrics);
  panel(slide, "intake-table", {
    left: p.main.left,
    top: p.main.top + 102,
    width: p.main.width,
    height: p.main.height - 102,
  });
  const labelW = 120,
    colW = (p.main.width - labelW - 20) / 4,
    top = p.main.top + 154,
    rowH = 58;
  data.diagram.intents.forEach((x, i) =>
    addTextBox(slide, {
      name: `intent-${i + 1}`,
      text: x.text,
      position: {
        left: p.main.left + labelW + i * colW,
        top: p.main.top + 112,
        width: colW - 2,
        height: 34,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
      alignment: "center",
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: .7 },
    })
  );
  const max = Math.max(...data.diagram.matrix.flat().map((x) => x.volume));
  data.diagram.services.forEach((s, ri) => {
    addTextBox(slide, {
      name: `intake-service-${ri + 1}`,
      text: s.text,
      position: {
        left: p.main.left + 10,
        top: top + ri * rowH,
        width: labelW - 12,
        height: rowH - 2,
      },
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    data.diagram.matrix[ri].forEach((v, ci) =>
      addTextBox(slide, {
        name: `intake-${ri + 1}-${ci + 1}`,
        text: `${v.volume}\n命中 ${Math.round(v.one_touch)}%`,
        position: {
          left: p.main.left + labelW + ci * colW,
          top: top + ri * rowH,
          width: colW - 2,
          height: rowH - 2,
        },
        fontSize: 16,
        bold: v.volume / max > .7,
        color: ci === 2 && v.volume / max > .5 ? COLORS.orange : COLORS.text,
        alignment: "center",
        fill: v.volume / max > .7
          ? PALE_BLUE
          : v.volume / max > .4
          ? COLORS.soft
          : COLORS.white,
        line: { style: "solid", fill: COLORS.border, width: .6 },
      })
    );
  });
  rail(slide, p.rail, data.diagram.insights, "发现／根因／动作");
  bottom(slide, p.bottom, data.diagram.conclusion);
}
function renderClassification(slide, data, p) {
  metricHeader(slide, {
    left: p.main.left,
    top: p.main.top,
    width: p.main.width,
  }, data.diagram.metrics);
  panel(slide, "classification-flow", {
    left: p.main.left,
    top: p.main.top + 102,
    width: p.main.width,
    height: p.main.height - 102,
  });
  const top = p.main.top + 132, rowH = 54;
  addTextBox(slide, {
    name: "class-head",
    text: "模型输入                      AI 初分                     最终分类",
    position: {
      left: p.main.left + 60,
      top: p.main.top + 108,
      width: p.main.width - 120,
      height: 28,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.navy,
    alignment: "center",
  });
  data.diagram.categories.forEach((c, i) => {
    const y = top + i * rowH;
    const a = addNode(slide, {
      name: `class-input-${i + 1}`,
      text: `${c.label.text}\n${c.input}`,
      position: { left: p.main.left + 24, top: y, width: 170, height: 48 },
      fill: COLORS.white,
      border: COLORS.border,
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    const b = addNode(slide, {
      name: `class-predict-${i + 1}`,
      text: `${c.predicted}\n改判 ${c.reclassified}`,
      position: { left: p.main.left + 340, top: y, width: 170, height: 48 },
      fill: i === 4 ? PALE_ORANGE : PALE_BLUE,
      border: i === 4 ? COLORS.orange : COLORS.blue,
      fontSize: 16,
      bold: true,
      color: i === 4 ? COLORS.orange : COLORS.navy,
    });
    const d = addNode(slide, {
      name: `class-final-${i + 1}`,
      text: `${c.label.text}\n${c.final}`,
      position: { left: p.main.left + 650, top: y, width: 170, height: 48 },
      fill: COLORS.white,
      border: COLORS.border,
      fontSize: 16,
      bold: true,
      color: COLORS.navy,
    });
    connectNative(slide, a, b, {
      kind: "straight",
      placement: "front",
      line: { style: "solid", fill: COLORS.line, width: 1.2 },
    });
    connectNative(slide, b, d, {
      kind: "straight",
      placement: "front",
      line: {
        style: "solid",
        fill: i === 4 ? COLORS.orange : COLORS.blue,
        width: 1.5,
      },
    });
  });
  addTextBox(slide, {
    name: "other-label",
    text: data.diagram.other_label.text,
    position: {
      left: p.main.left + 330,
      top: p.main.top + 412,
      width: 190,
      height: 44,
    },
    fontSize: 16,
    bold: true,
    color: COLORS.orange,
    alignment: "center",
    fill: PALE_ORANGE,
    line: { style: "dashed", fill: COLORS.orange, width: 1 },
  });
  rail(slide, p.rail, data.diagram.insights, "发现／根因／动作");
  bottom(slide, p.bottom, data.diagram.conclusion);
}

export async function renderR5Module(data, output) {
  const p = planR5Module(data),
    { presentation, slide } = createPresentation(output.background);
  header(slide, p);
  ({
    "hr-age-gender-pyramid": renderAge,
    "hr-workforce-reconciliation": renderWorkforce,
    "hr-new-hire-survival": renderSurvival,
    "hr-supply-demand-gap": renderSupply,
    "hr-level-function-matrix": renderLevel,
    "hr-from-to-mobility": renderMobility,
    "hr-eligibility-matrix": renderEligibility,
    "hr-service-catalog": renderService,
    "hr-ticket-intake": renderIntake,
    "hr-ticket-classification": renderClassification,
  })[data.module_id](slide, data, p);
  await exportPresentation(presentation, output);
  return p;
}
async function main() {
  const o = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(o.input, "utf8"));
  await renderR5Module(data, o);
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
