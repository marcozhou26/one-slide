#!/usr/bin/env node
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  COLORS,
  addContainer,
  addDataSourceFooter,
  addPageHeading,
  addTextBox,
  createPresentation,
  exportPresentation,
  parseCliArgs,
  setSpeakerNotes,
} from "./pptx_core.mjs";
import { resolveCanvasProfile } from "./canvas_profiles.mjs";

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`${label} is required`);
    error.code = "INPUT_CONTRACT_FAIL";
    throw error;
  }
  return value.trim();
}

export function validatePortraitOnePoint(input) {
  const canvas = resolveCanvasProfile(input?.canvas_profile ?? "short_video_broll_9_16");
  if (canvas.orientation !== "portrait") {
    const error = new Error("Portrait one-point renderer requires a portrait canvas");
    error.code = "CANVAS_PROFILE_FAIL";
    throw error;
  }
  const supporting = Array.isArray(input.supporting_points) ? input.supporting_points : [];
  if (supporting.length > 3 || supporting.some((item) => typeof item !== "string" || !item.trim())) {
    const error = new Error("supporting_points must contain 0-3 non-empty strings");
    error.code = "SINGLE_SLIDE_SCOPE_OVERLOAD";
    throw error;
  }
  return {
    canvas,
    title: requiredText(input.title, "title"),
    corePoint: requiredText(input.core_point, "core_point"),
    supporting: supporting.map((item) => item.trim()),
    source: requiredText(input.data_source, "data_source"),
    notes: Array.isArray(input.speaker_notes) ? input.speaker_notes : [],
    background: input.background,
  };
}

export async function renderPortraitOnePoint(input, output) {
  const model = validatePortraitOnePoint(input);
  const { presentation, slide, canvas } = createPresentation(model.background, model.canvas.id);
  const margin = 54;
  addPageHeading(slide, {
    title: model.title,
    position: { left: margin, top: 62, width: canvas.width - margin * 2, height: 100 },
    titleFontSize: 30,
  });

  const heroTop = 238;
  const heroHeight = model.supporting.length ? 310 : 430;
  addContainer(slide, {
    name: "core-point-frame",
    position: { left: margin, top: heroTop, width: canvas.width - margin * 2, height: heroHeight },
    fill: COLORS.blueLight,
    border: COLORS.blue,
    borderWidth: 2,
  });
  addTextBox(slide, {
    name: "core-point",
    text: model.corePoint,
    position: { left: margin + 34, top: heroTop + 34, width: canvas.width - margin * 2 - 68, height: heroHeight - 68 },
    textRole: "hero",
    fontSize: 26,
    bold: true,
    color: COLORS.navy,
    alignment: "center",
    maxLines: 5,
  });

  if (model.supporting.length) {
    const supportTop = heroTop + heroHeight + 54;
    const gap = 18;
    const itemHeight = Math.min(112, (canvas.height - supportTop - 126 - gap * (model.supporting.length - 1)) / model.supporting.length);
    model.supporting.forEach((item, index) => {
      const top = supportTop + index * (itemHeight + gap);
      addTextBox(slide, {
        name: `support-${index + 1}`,
        text: item,
        position: { left: margin + 8, top, width: canvas.width - margin * 2 - 16, height: itemHeight },
        textRole: "body",
        fontSize: 18,
        color: COLORS.text,
        alignment: "center",
        fill: COLORS.soft,
        line: { style: "solid", fill: COLORS.border, width: 1 },
        maxLines: 3,
      });
    });
  }

  addDataSourceFooter(slide, {
    source: model.source,
    position: { left: margin, top: canvas.height - 72, width: canvas.width - margin * 2 - 44, height: 24 },
  });
  setSpeakerNotes(slide, model.notes);
  return exportPresentation(presentation, output);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const input = JSON.parse(await fs.readFile(options.input, "utf8"));
  await renderPortraitOnePoint(input, {
    pptx: options.pptx,
    preview: options.preview,
    layout: options.layout,
    layoutAudit: options["layout-audit"],
    inspect: options.inspect,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "PORTRAIT_RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 10;
  });
}
