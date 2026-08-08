import { SLIDE } from "./layout_constants.mjs";
import {
  extractGanttLayerSteps,
  normalizeGanttDependencies,
  normalizeGanttTimeAxis,
  validateR4Module,
} from "./validate_r4_module.mjs";

function sankeySemantics(kind) {
  if (kind === "neutral") return { kind, tone: "neutral", ribbon_style: "solid" };
  if (kind === "on_time" || kind === "success") return { kind, tone: "positive", ribbon_style: "solid" };
  return { kind, tone: "exception", ribbon_style: "solid" };
}

function planSankey(data, base) {
  const block = (data.display_blocks ?? []).find(
    (item) => item.display_intent === "local_verification" || item.block_id === "E25_SLA",
  );
  const slaRows = (block?.items ?? []).map((item) => ({
    id: item.item_id,
    service: item.label,
    monthly_volume: item.value.monthly_volume,
    fte: item.value.fte,
    on_time_rate: item.value.on_time_rate,
    sla_status: item.value.sla_status,
    source_ids: item.source_ids,
  }));
  const hasSla = slaRows.length > 0;
  return {
    ...base,
    main: { left: 54, top: hasSla ? 146 : 132, width: hasSla ? 742 : 850, height: hasSla ? 436 : 450 },
    rail: { left: hasSla ? 826 : 934, top: 126, width: hasSla ? 400 : 292, height: 466 },
    bottom: hasSla
      ? { left: 54, top: 604, width: 1172, height: 68 }
      : { left: 54, top: 620, width: 1172, height: 44 },
    sankey: {
      flow_semantics: data.diagram.flows.map((flow, index) => ({ index, ...sankeySemantics(flow.kind) })),
      sla_rows: slaRows,
      sla_block_id: block?.block_id ?? null,
    },
  };
}

function planGantt(data, base) {
  const timeAxis = normalizeGanttTimeAxis(data.diagram);
  const layerSteps = extractGanttLayerSteps(data.diagram, timeAxis);
  const dependencies = normalizeGanttDependencies(data.diagram);
  const sideMetrics = (data.diagram.side_metrics ?? []).filter(
    (item) => !item.text?.startsWith("Stage level"),
  );
  const orderedTasks=data.diagram.lanes.flatMap(lane=>data.diagram.tasks.filter(task=>task.lane===lane.text).sort((left,right)=>left.start-right.start));
  return {
    ...base,
    main: { left: 54, top: 126, width: 882, height: 474 },
    side: { left: 966, top: 126, width: 260, height: 474 },
    bottom: { left: 54, top: 626, width: 1172, height: 38 },
    gantt: {
      time_axis: timeAxis,
      layer_steps: layerSteps,
      dependencies,
      tasks: orderedTasks,
      side_metrics: sideMetrics,
      side_title: data.diagram.tasks.some((task) => task.critical) ? "critical path" : "Verification points",
    },
  };
}

export function planR4Module(data) {
  validateR4Module(data);
  const subtitleInput=data.subtitle??(typeof data.content?.subtitle==="string"?{text:data.content.subtitle}:null);
  const base = {
    slide: SLIDE,
    title: { ...data.title, left: 54, top: 28, width: 1172, height: 52 },
    subtitle: subtitleInput ? { ...subtitleInput, left: 54, top: 82, width: 1172, height: 28 } : null,
  };
  if (data.module_id === "sankey-flow") return planSankey(data, base);
  if (["chord-dependency", "region-map-table"].includes(data.module_id)) {
    return { ...base, main: { left: 54, top: 132, width: 850, height: 450 }, rail: { left: 934, top: 126, width: 292, height: 466 }, bottom: { left: 54, top: 620, width: 1172, height: 44 } };
  }
  if (data.module_id === "market-funnel") return { ...base, main: { left: 54, top: 132, width: 548, height: 454 }, side: { left: 634, top: 132, width: 592, height: 454 }, bottom: { left: 54, top: 620, width: 1172, height: 44 } };
  if (data.module_id === "industry-value-chain") return { ...base, main: { left: 54, top: 132, width: 1172, height: 464 }, bottom: { left: 54, top: 620, width: 1172, height: 44 } };
  if (data.module_id === "spiral-maturity") return { ...base, main: { left: 54, top: 126, width: 930, height: 480 }, side: { left: 1014, top: 126, width: 212, height: 480 }, bottom: { left: 54, top: 626, width: 1172, height: 38 } };
  if (data.module_id === "gantt-dependency") return planGantt(data, base);
  throw new Error(`Unsupported R4 module: ${data.module_id}`);
}
