#!/usr/bin/env node
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";

const EMU_PER_PX = 9525;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function argValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function parseAttrs(xml) {
  const attrs = {};
  for (const match of xml.matchAll(/([\w:]+)="([^"]*)"/gu)) attrs[match[1]] = match[2];
  return attrs;
}

function parseRelationships(xml) {
  const rels = new Map();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/gu)) {
    const attrs = parseAttrs(match[1]);
    if (!attrs.Id || !attrs.Target) continue;
    let target = attrs.Target.replace(/^\//u, "");
    target = target.replace(/^\.\.\//u, "ppt/");
    if (target.startsWith("media/")) target = `ppt/${target}`;
    rels.set(attrs.Id, target);
  }
  return rels;
}

function parsePics(slideXml, rels) {
  const pics = [];
  for (const match of slideXml.matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/gu)) {
    const block = match[0];
    const name = parseAttrs(block.match(/<p:cNvPr\b([^>]*)\/?>/u)?.[1] ?? "").name ?? "";
    const svgRid = block.match(/asvg:svgBlip r:embed="([^"]+)"/u)?.[1] ?? null;
    const bitmapRid = block.match(/<a:blip r:embed="([^"]+)"/u)?.[1] ?? null;
    const offAttrs = parseAttrs(block.match(/<a:off\b([^>]*)\/>/u)?.[1] ?? "");
    const extAttrs = parseAttrs(block.match(/<a:ext\b([^>]*)\/>/u)?.[1] ?? "");
    pics.push({
      name,
      svg_rid: svgRid,
      bitmap_rid: bitmapRid,
      svg_media_path: svgRid ? rels.get(svgRid) ?? null : null,
      bitmap_media_path: bitmapRid ? rels.get(bitmapRid) ?? null : null,
      position: {
        left: Number(offAttrs.x ?? 0) / EMU_PER_PX,
        top: Number(offAttrs.y ?? 0) / EMU_PER_PX,
        width: Number(extAttrs.cx ?? 0) / EMU_PER_PX,
        height: Number(extAttrs.cy ?? 0) / EMU_PER_PX,
      },
    });
  }
  return pics;
}

function center(position) {
  return { x: position.left + position.width / 2, y: position.top + position.height / 2 };
}

function inside(position, bbox, pad = 2) {
  const c = center(position);
  return c.x >= bbox[0] - pad && c.x <= bbox[0] + bbox[2] + pad && c.y >= bbox[1] - pad && c.y <= bbox[1] + bbox[3] + pad;
}

function loadTargetBBoxes(layout) {
  const map = new Map();
  for (const element of layout.elements ?? []) {
    if (element.name && Array.isArray(element.bbox)) map.set(element.name, element.bbox);
  }
  return map;
}

async function readJsonWithOptionalPrefix(file) {
  const raw = await fs.readFile(file, "utf8");
  const start = raw.indexOf("{");
  if (start < 0) throw new Error(`No JSON object found in ${file}`);
  return JSON.parse(raw.slice(start));
}

async function pptxEvidence(pptxPath) {
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
  const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
  const relXml = await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string");
  const rels = parseRelationships(relXml);
  const pics = parsePics(slideXml, rels);
  for (const pic of pics) {
    if (!pic.svg_media_path) continue;
    const media = zip.file(pic.svg_media_path);
    pic.svg_sha256 = media ? sha256(await media.async("nodebuffer")) : null;
  }
  return { slideXml, pics };
}

function routeItems(routeResult) {
  return new Map((routeResult.icon_handoff?.items ?? []).map((item) => [item.index, item]));
}

async function auditCase(root, caseId) {
  const samples = path.join(root, "samples");
  const outputs = path.join(root, "outputs");
  const logs = path.join(root, "logs");
  const sample = await readJsonWithOptionalPrefix(path.join(samples, `${caseId}.json`));
  const route = await readJsonWithOptionalPrefix(path.join(logs, `${caseId}.route-result.json`));
  const render = await readJsonWithOptionalPrefix(path.join(logs, `${caseId}.render.json`));
  const layout = await readJsonWithOptionalPrefix(path.join(outputs, `${caseId}.layout.json`));
  const pptx = await pptxEvidence(path.join(outputs, `${caseId}.pptx`));
  const routeByIndex = routeItems(route);
  const renderByIndex = new Map((render.icon_handoff?.render_evidence ?? []).map((item) => [item.item_index, item]));
  const bboxes = loadTargetBBoxes(layout);
  const items = [];
  const findings = [];

  for (const [index, spec] of (sample.icon_handoff?.items ?? []).entries()) {
    const routeItem = routeByIndex.get(index);
    const renderItem = renderByIndex.get(index);
    const record = {
      item_index: index,
      spec_concept: spec.concept,
      spec_source_ids: spec.source_ids ?? [],
      spec_required: spec.required,
      spec_role: spec.role,
      target_object_id: spec.target_id ?? routeItem?.target_id ?? renderItem?.target_object_id ?? null,
      route_status: routeItem?.status ?? null,
      route_icon_id: routeItem?.icon_id ?? null,
      route_fallback: routeItem?.fallback ?? null,
      route_asset_file: routeItem?.asset_file ?? null,
      route_reason: routeItem?.reason ?? routeItem?.selection_reason ?? null,
      render_evidence: renderItem ?? null,
      actual_pptx_object: null,
      binding_status: "unchecked",
    };

    if (spec.concept !== routeItem?.concept) findings.push(`${caseId}[${index}] route concept changed: ${spec.concept} -> ${routeItem?.concept}`);
    if (JSON.stringify(spec.source_ids ?? []) !== JSON.stringify(routeItem?.source_ids ?? [])) findings.push(`${caseId}[${index}] source_ids not preserved`);
    if (!renderItem && spec.required) findings.push(`${caseId}[${index}] required item has no render evidence`);

    if (routeItem?.status === "ready") {
      const expectedHash = renderItem?.route_asset_sha256;
      const actual = pptx.pics.find((pic) => pic.svg_sha256 === expectedHash && inside(pic.position, [
        renderItem.position.left - 1,
        renderItem.position.top - 1,
        renderItem.position.width + 2,
        renderItem.position.height + 2,
      ], 2));
      record.actual_pptx_object = actual ? {
        name: actual.name,
        svg_rid: actual.svg_rid,
        svg_media_path: actual.svg_media_path,
        svg_sha256: actual.svg_sha256,
        position: actual.position,
      } : null;
      if (!actual) findings.push(`${caseId}[${index}] PPTX does not contain expected SVG for route icon ${routeItem.icon_id}`);
      const targetBox = record.target_object_id ? bboxes.get(record.target_object_id) : null;
      if (targetBox) {
        record.binding_status = actual && inside(actual.position, targetBox, 2) ? "bound_to_target_object" : "not_bound_to_target_object";
        if (record.binding_status !== "bound_to_target_object") findings.push(`${caseId}[${index}] icon is not bound to target ${record.target_object_id}`);
      } else {
        record.binding_status = actual ? "rendered_without_layout_target_bbox" : "missing";
      }
    } else if (routeItem?.status === "fallback_text_only") {
      const fallbackName = renderItem?.pptx_object_name ?? "";
      const fallbackVisible = fallbackName && pptx.slideXml.includes(`name="${fallbackName}"`) && pptx.slideXml.includes(`>${spec.concept}<`);
      record.actual_pptx_object = fallbackVisible ? { name: fallbackName, text: spec.concept } : null;
      record.binding_status = fallbackVisible ? "explicit_text_fallback" : "missing_fallback";
      if (!fallbackVisible) findings.push(`${caseId}[${index}] required fallback text is missing`);
    } else if (spec.required) {
      findings.push(`${caseId}[${index}] required item is neither ready nor explicit fallback/unsupported`);
    }
    items.push(record);
  }
  return { case_id: caseId, ok: findings.length === 0, findings, items };
}

async function main() {
  const args = process.argv.slice(2);
  const defaultRoot = path.resolve(process.cwd(), "../icon-handoff-alignment");
  const root = argValue(args, "--root", defaultRoot);
  const caseArg = argValue(args, "--cases", "claim-p07-icon-handoff,issue-p09-icon-handoff,aligned-p06-icon-handoff");
  const cases = caseArg.split(",").map((item) => item.trim()).filter(Boolean);
  const results = [];
  const findings = [];
  for (const caseId of cases) {
    const result = await auditCase(root, caseId);
    results.push(result);
    findings.push(...result.findings);
  }
  const report = { ok: findings.length === 0, case_count: results.length, findings, results };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, message: error.message })}\n`);
    process.exitCode = 1;
  });
}
