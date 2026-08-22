#!/usr/bin/env node
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  COLORS,
  addContainer,
  addDataSourceFooter,
  addNode,
  addTextBox,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
} from "./pptx_core.mjs";
import { resolveIconHandoff } from "./icon_handoff_core.mjs";

function visible(value) {
  return typeof value === "string" ? value.trim() : value?.text?.trim() ?? "";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function itemByTarget(resolved) {
  return new Map(resolved.items.filter((item) => item.target_id).map((item) => [item.target_id, item]));
}

function itemByIndex(resolved) {
  return new Map(resolved.items.map((item) => [item.index, item]));
}

function textOnlyFallback(slide, item, position, targetObjectId, evidence) {
  const fallbackPosition = {
    left: Math.max(58, position.left + position.width / 2 - 62),
    top: position.top + Math.max(0, position.height / 2 - 13),
    width: 124,
    height: 26,
  };
  const label = addTextBox(slide, {
    name: `icon-fallback-${item.index + 1}-${targetObjectId}`,
    text: item.concept,
    position: fallbackPosition,
    fontSize: 12,
    bold: true,
    alignment: "center",
    color: COLORS.muted,
    fill: COLORS.soft,
    line: { style: "solid", fill: COLORS.border, width: 0.8 },
  });
  evidence.push({
    item_index: item.index,
    concept: item.concept,
    source_ids: item.source_ids,
    route_status: item.status,
    route_icon_id: null,
    route_asset_file: null,
    route_asset_sha256: null,
    target_object_id: targetObjectId,
    pptx_object_name: `icon-fallback-${item.index + 1}-${targetObjectId}`,
    actual_kind: "text_fallback",
    position: fallbackPosition,
    pptx_shape_id: label?.id ?? null,
  });
}

async function addResolvedIcon(slide, item, position, targetObjectId, evidence) {
  if (item.status !== "ready") {
    if (item.required && item.status === "fallback_text_only") {
      textOnlyFallback(slide, item, position, targetObjectId, evidence);
    }
    return null;
  }
  const svg = await fs.readFile(item.asset_file, "utf8");
  const objectName = `icon-handoff-${item.index + 1}-${targetObjectId}-${item.icon_id}`;
  const inserted = slide.images.add({
    name: objectName,
    blob: new TextEncoder().encode(svg),
    contentType: "image/svg+xml",
    alt: item.selection_reason,
    fit: "contain",
    position,
  });
  evidence.push({
    item_index: item.index,
    concept: item.concept,
    source_ids: item.source_ids,
    route_status: item.status,
    route_icon_id: item.icon_id,
    route_asset_file: item.asset_file,
    route_asset_sha256: sha256(svg),
    route_selection_reason: item.selection_reason,
    target_object_id: targetObjectId,
    pptx_object_name: objectName,
    actual_kind: "svg_icon",
    position,
    pptx_shape_id: inserted?.id ?? null,
  });
  return inserted;
}

async function renderClaim(slide, sample, resolved, evidence) {
  addTextBox(slide, { name: "page-title", text: sample.title, position: { left: 58, top: 34, width: 1166, height: 72 }, fontSize: fitPageTitleFontSize(sample.title), bold: true });
  addTextBox(slide, { name: "claim", text: sample.claim, position: { left: 150, top: 245, width: 980, height: 92 }, fontSize: 28, bold: true, alignment: "center", color: COLORS.navy });
  const displayItems = resolved.items.filter((item) => item.status === "ready" || (item.required && item.status === "fallback_text_only"));
  const width = 230;
  const start = 640 - (displayItems.length * width + (displayItems.length - 1) * 34) / 2;
  for (const [index, item] of displayItems.entries()) {
    const left = start + index * (width + 34);
    const targetObjectId = item.target_id ?? `claim-marker-${index + 1}`;
    await addResolvedIcon(slide, item, { left: left + 94, top: 384, width: 42, height: 42 }, targetObjectId, evidence);
    addTextBox(slide, { name: `marker-label-${index + 1}`, text: item.concept, position: { left, top: 438, width, height: 34 }, fontSize: 16, bold: true, color: COLORS.navy, alignment: "center" });
  }
}

async function renderIssue(slide, sample, resolved, evidence) {
  addTextBox(slide, { name: "page-title", text: sample.title, position: { left: 58, top: 34, width: 1166, height: 72 }, fontSize: fitPageTitleFontSize(sample.title), bold: true });
  const center = addNode(slide, { name: "issue-center", text: "商业路径分歧地图", position: { left: 500, top: 292, width: 280, height: 86 }, fill: COLORS.blueLight, border: COLORS.border, fontSize: 16, bold: true });
  const positions = [
    { left: 470, top: 145, width: 260, height: 66 },
    { left: 790, top: 205, width: 270, height: 66 },
    { left: 910, top: 315, width: 270, height: 66 },
    { left: 770, top: 438, width: 270, height: 66 },
    { left: 300, top: 438, width: 270, height: 66 },
  ];
  const ready = new Map(resolved.items.filter((item) => item.status === "ready").map((item) => [item.concept, item]));
  const nodes = [];
  const byTarget = itemByTarget(resolved);
  for (const [index, question] of sample.questions.entries()) {
    const p = positions[index];
    const targetObjectId = `question-${index + 1}`;
    const item = byTarget.get(targetObjectId);
    const node = addContainer(slide, { name: targetObjectId, position: p, fill: COLORS.white, border: COLORS.border });
    nodes.push(node);
    if (item) {
      await addResolvedIcon(slide, item, { left: p.left + 14, top: p.top + 18, width: 28, height: 28 }, targetObjectId, evidence);
    }
    addTextBox(slide, {
      name: `${targetObjectId}-text`,
      text: question,
      position: { left: p.left + (item ? 56 : 16), top: p.top + 10, width: p.width - (item ? 70 : 32), height: p.height - 20 },
      fontSize: 12,
      bold: false,
      alignment: "center",
      color: COLORS.text,
    });
    connectNative(slide, center, node, { kind: "straight", role: "leader", arrow: false, line: { style: "solid", fill: COLORS.line, width: 1 } });
  }
  const cross = addTextBox(slide, { name: "cross-cutting", text: sample.cross_cutting, position: { left: 460, top: 572, width: 360, height: 46 }, fontSize: 14, bold: true, alignment: "center", color: COLORS.navy, fill: COLORS.soft, line: { style: "solid", fill: COLORS.border, width: 0.8 } });
  for (const node of nodes) connectNative(slide, cross, node, { kind: "straight", role: "leader", arrow: false, fromSide: "top", toSide: "bottom", line: { style: "dashed", fill: COLORS.orange, width: 0.8 }, placement: "back" });
}

async function renderAligned(slide, sample, resolved, evidence) {
  addTextBox(slide, { name: "page-title", text: sample.title, position: { left: 58, top: 34, width: 1166, height: 72 }, fontSize: fitPageTitleFontSize(sample.title), bold: true });
  const cols = [215, 535, 855];
  const stages = ["AI的角色", "价值生产方式", "客户购买的结果"];
  stages.forEach((stage, index) => addTextBox(slide, { name: `stage-${index + 1}`, text: stage, position: { left: cols[index], top: 132, width: 270, height: 32 }, fontSize: 16, bold: true, alignment: "center", color: COLORS.muted }));
  const rows = [
    ["原业务", "AI作为被售卖的知识", "通用AI教育/AI课程", "客户购买AI知识"],
    ["新业务", "AI作为生产工具", "薪酬专业判断处理经营问题", "客户购买被AI放大的专业判断"],
  ];
  const nodeRows = [];
  rows.forEach((row, r) => {
    addTextBox(slide, { name: `track-label-${r + 1}`, text: row[0], position: { left: 78, top: 180 + r * 94, width: 105, height: 60 }, fontSize: 16, bold: true, color: r === 1 ? COLORS.navy : COLORS.muted, alignment: "right" });
    const shapes = row.slice(1).map((text, c) => addNode(slide, { name: `track-${r + 1}-${c + 1}`, text, position: { left: cols[c], top: 174 + r * 94, width: 270, height: 68 }, fill: r === 1 ? COLORS.blueLight : COLORS.soft, border: COLORS.border, fontSize: 14, bold: r === 1 }));
    shapes.slice(0, -1).forEach((shape, index) => connectNative(slide, shape, shapes[index + 1], { kind: "straight", fromSide: "right", toSide: "left", line: { style: "solid", fill: COLORS.line, width: 1.1 } }));
    nodeRows.push(shapes);
  });
  const supportTop = 452;
  const supportTexts = ["专业切口", "AI仍是生产工具", "高层语境入口"];
  const byIndex = itemByIndex(resolved);
  for (const [index, support] of supportTexts.entries()) {
    const left = 170 + index * 310;
    const targetObjectId = `support-frame-${index + 1}`;
    const frame = addContainer(slide, { name: targetObjectId, position: { left, top: supportTop, width: 260, height: 100 }, fill: COLORS.white, border: COLORS.border });
    const item = byIndex.get(index);
    if (item) await addResolvedIcon(slide, item, { left: left + 18, top: supportTop + 28, width: 34, height: 34 }, targetObjectId, evidence);
    addTextBox(slide, { name: `support-${index + 1}`, text: support, position: { left: left + 62, top: supportTop + 25, width: 175, height: 42 }, fontSize: 14, bold: true, color: COLORS.navy });
    connectNative(slide, frame, nodeRows[1][1], { kind: "straight", fromSide: "top", toSide: "bottom", line: { style: "dashed", fill: COLORS.orange, width: 1 } });
  }
}

export async function renderIconHandoffSample(sample, output) {
  const resolved = await resolveIconHandoff(sample.icon_handoff);
  const { presentation, slide } = createPresentation(null, "presentation_16_9");
  const evidence = [];
  if (sample.layout === "claim") await renderClaim(slide, sample, resolved, evidence);
  else if (sample.layout === "issue") await renderIssue(slide, sample, resolved, evidence);
  else if (sample.layout === "aligned") await renderAligned(slide, sample, resolved, evidence);
  else throw new Error(`Unsupported icon handoff sample layout: ${sample.layout}`);
  addDataSourceFooter(slide, { source: visible(sample.source) || "用户提供材料；slide-spec icon_handoff", position: { left: 58, top: 682, width: 1166, height: 28 } });
  await exportPresentation(presentation, output);
  return { ...resolved, render_evidence: evidence };
}

async function main() {
  const output = parseCliArgs(process.argv.slice(2));
  const sample = JSON.parse(await fs.readFile(output.input, "utf8"));
  const resolved = await renderIconHandoffSample(sample, output);
  process.stdout.write(`${JSON.stringify({ ok: true, icon_handoff: resolved }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, code: error.code ?? "ICON_HANDOFF_RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
