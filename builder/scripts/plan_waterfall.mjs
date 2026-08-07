import { SLIDE } from "./layout_constants.mjs";
import { validateWaterfall } from "./validate_waterfall.mjs";

export function planWaterfall(data) {
  validateWaterfall(data);
  const items = [
    { ...data.diagram.start, kind: "total", start_value: 0, end_value: data.diagram.start.value },
  ];
  let running = data.diagram.start.value;
  for (const contribution of data.diagram.contributions) {
    const next = running + contribution.value;
    items.push({ ...contribution, kind: contribution.value > 0 ? "increase" : "decrease", start_value: running, end_value: next });
    running = next;
  }
  items.push({ ...data.diagram.end, kind: "total", start_value: 0, end_value: data.diagram.end.value });
  const values = items.flatMap((item) => [item.start_value, item.end_value, 0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const chart = { left: 64, top: 164, width: 872, height: 350 };
  const baseline = chart.top + chart.height - ((0 - min) / span) * chart.height;
  const slot = chart.width / items.length;
  const barWidth = Math.min(68, slot * 0.56);
  const bars = items.map((item, index) => {
    const y1 = chart.top + chart.height - ((item.start_value - min) / span) * chart.height;
    const y2 = chart.top + chart.height - ((item.end_value - min) / span) * chart.height;
    return {
      ...item,
      left: chart.left + index * slot + (slot - barWidth) / 2,
      top: Math.min(y1, y2),
      width: barWidth,
      height: Math.max(3, Math.abs(y2 - y1)),
      connector_y: y2,
      index,
    };
  });
  return {
    slide: SLIDE,
    title: { ...data.title, left: 56, top: 38, width: 1168, height: 58, fontSize: 30 },
    chart,
    baseline,
    bars,
    unit: data.diagram.unit ?? "",
    insights: (data.diagram.insights ?? []).slice(0, 3),
    insightRail: { left: 950, top: 150, width: 274, height: 364 },
    bottom: data.diagram.bottom_conclusion
      ? { ...data.diagram.bottom_conclusion, left: 64, top: 560, width: 1160, height: 74 }
      : null,
    footnotes: (data.diagram.footnotes ?? []).map((item, index) => ({ ...item, left: 64, top: 680 - index * 22, width: 1160, height: 20 })),
  };
}
