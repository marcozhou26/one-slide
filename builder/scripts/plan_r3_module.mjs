import { SLIDE } from "./layout_constants.mjs";
import { validateR3Module } from "./validate_r3_module.mjs";

export function planR3Module(data) {
  validateR3Module(data);
  const base = { slide: SLIDE, title: { ...data.title, left: 54, top: 28, width: 1172, height: 52 }, subtitle: data.subtitle ? { ...data.subtitle, left: 54, top: 82, width: 1172, height: 28 } : null };
  if (data.module_id === "marimekko") return { ...base, chart: { left: 62, top: 142, width: 850, height: 430 }, rail: { left: 944, top: 126, width: 282, height: 470 }, bottom: { left: 54, top: 620, width: 1172, height: 44 } };
  if (data.module_id === "tornado-sensitivity") return { ...base, chart: { left: 54, top: 148, width: 870, height: 430 }, rail: { left: 954, top: 132, width: 272, height: 454 }, bottom: { left: 54, top: 620, width: 1172, height: 44 } };
  if (data.module_id === "radar-capability") {
    const hasRanking = data.diagram.supporting_evidence?.type === "business-unit-ranking";
    const hasCondition = Boolean(data.diagram.condition);
    return {
      ...base,
      radar: { left: 54, top: 126, width: hasRanking ? 748 : 850, height: hasCondition ? 432 : 480 },
      labels: { left: 54, top: 126, width: hasRanking ? 748 : 850, height: hasCondition ? 432 : 480 },
      rail: { left: hasRanking ? 826 : 934, top: 126, width: hasRanking ? 400 : 292, height: hasCondition ? 432 : 480 },
      condition: hasCondition ? { left: 54, top: 574, width: 1172, height: 86 } : null,
      bottom: !hasCondition && data.diagram.conclusion ? { left: 54, top: 628, width: 1172, height: 36 } : null,
      scale: { ...data.diagram.scale },
      series_labels: { ...data.diagram.series_labels },
      supporting_evidence_type: data.diagram.supporting_evidence?.type ?? null,
    };
  }
  if (data.module_id === "dumbbell-gap") return { ...base, chart: { left: 54, top: 134, width: 872, height: 472 }, rail: { left: 954, top: 132, width: 272, height: 474 }, bottom: { left: 54, top: 630, width: 1172, height: 34 } };
  if (data.module_id === "slope-ranking") return { ...base, chart: { left: 60, top: 136, width: 888, height: 452 }, rail: { left: 976, top: 128, width: 250, height: 466 }, bottom: { left: 54, top: 624, width: 1172, height: 40 } };
  return { ...base, grid: { left: 60, top: 130, width: 892, height: 464 }, rail: { left: 982, top: 128, width: 244, height: 468 }, bottom: { left: 54, top: 626, width: 1172, height: 38 } };
}
