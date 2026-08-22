import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COLORS,
  addChartLine,
  addIndexBadge,
  addTextBox,
  createPresentation,
  exportPresentation,
  parseCliArgs,
} from "./pptx_core.mjs";
import { planReferenceList } from "./plan_reference_list.mjs";
import { loadReferenceListInput } from "./validate_reference_list.mjs";

export async function renderReferenceList(data, output) {
  const plan = planReferenceList(data);
  const { presentation, slide } = createPresentation(output.background);
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, textRole: "pageTitle", fontSize: 35, bold: true, color: COLORS.navy, maxLines: 1 });
  if (plan.subtitle) addTextBox(slide, { name: "page-subtitle", text: plan.subtitle.text, position: plan.subtitle, textRole: "pageSubtitle", fontSize: 14, color: COLORS.muted, maxLines: 1 });
  addChartLine(slide, { name: "header-rule", from: { x: 54, y: plan.list.top - 10 }, to: { x: 1226, y: plan.list.top - 10 }, line: { style: "solid", fill: COLORS.navy, width: 1.5 } });

  plan.normalized.diagram.references.forEach((reference, index) => {
    const top = plan.list.top + index * plan.list.entryHeight;
    const citationHeight = Math.max(32, plan.list.entryHeight - 30);
    addIndexBadge(slide, { name: `reference-number-${index + 1}`, text: String(index + 1).padStart(2, "0"), position: { left: plan.list.left, top: top + 8, width: 48, height: 30 }, fontSize: 16, color: COLORS.blue });
    addTextBox(slide, { name: `reference-citation-${index + 1}`, text: reference.citation.text, position: { left: plan.list.left + 66, top: top + 4, width: plan.list.width - 66, height: citationHeight }, fontSize: 16, bold: false, color: COLORS.text, verticalAlignment: "top", maxLines: 2, minLastLineChars: 6 });
    const support = reference.supporting_pages?.length ? `支持正文：${reference.supporting_pages.join("、")}` : null;
    addTextBox(slide, { name: `reference-locator-${index + 1}`, text: [reference.locator.text, support].filter(Boolean).join("  ·  "), position: { left: plan.list.left + 66, top: top + citationHeight, width: plan.list.width - 66, height: 24 }, textRole: "source", fontSize: 14, color: COLORS.muted, verticalAlignment: "top", maxLines: 1 });
    if (index < plan.normalized.diagram.references.length - 1) {
      const y = top + plan.list.entryHeight - 4;
      addChartLine(slide, { name: `reference-rule-${index + 1}`, from: { x: plan.list.left + 66, y }, to: { x: plan.list.left + plan.list.width, y }, line: { style: "solid", fill: COLORS.border, width: 0.7 } });
    }
  });
  addTextBox(slide, { name: "source-note", text: plan.normalized.diagram.source_note.text, position: plan.footer, textRole: "source", fontSize: 12, color: COLORS.muted, maxLines: 1 });
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = await loadReferenceListInput(options.input);
  const plan = await renderReferenceList(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id, slide: plan.slide })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
