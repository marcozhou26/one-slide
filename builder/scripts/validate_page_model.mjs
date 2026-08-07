import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

export class PageModelError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function need(condition, code, message) {
  if (!condition) throw new PageModelError(code, message);
}

function sourced(item, label) {
  need(item && typeof item.text === "string" && item.text.trim(), "PAGE_MODEL_FAIL", `${label}.text is required`);
  need(Array.isArray(item.source_ids) && item.source_ids.length > 0, "SOURCE_FIDELITY_FAIL", `${label}.source_ids is required`);
}

export function validatePageModel(model) {
  need(model?.version === "2.0", "PAGE_MODEL_FAIL", "version must be 2.0");
  need(model?.audience?.reader && model?.audience?.task, "TARGET_AUDIENCE_FAIL", "audience.reader and audience.task are required");
  sourced(model.subject, "subject");
  sourced(model.story, "story");
  need(typeof model.expression_method === "string" && model.expression_method.trim(), "PAGE_MODEL_FAIL", "expression_method is required");
  const skeleton = model.information_skeleton;
  need(Array.isArray(skeleton?.entities) && skeleton.entities.length > 0, "PAGE_MODEL_FAIL", "information_skeleton.entities is required");
  need(Array.isArray(skeleton?.fields) && skeleton.fields.length > 0, "PAGE_MODEL_FAIL", "information_skeleton.fields is required");
  need(Array.isArray(skeleton?.relationships), "PAGE_MODEL_FAIL", "information_skeleton.relationships is required");
  const entityIds = new Set();
  for (const entity of skeleton.entities) {
    need(entity?.id && entity?.label, "PAGE_MODEL_FAIL", "every entity needs id and label");
    need(Array.isArray(entity.source_ids) && entity.source_ids.length > 0, "SOURCE_FIDELITY_FAIL", `entity ${entity.id} needs source_ids`);
    need(!entityIds.has(entity.id), "PAGE_MODEL_FAIL", `duplicate entity id: ${entity.id}`);
    entityIds.add(entity.id);
  }
  const fieldIds = new Set();
  const axisCounts = new Map();
  for (const field of skeleton.fields) {
    need(field?.field_id && field?.label && field?.axis_id, "PAGE_MODEL_FAIL", "every field needs field_id, label and axis_id");
    need(["text", "number", "percentage", "currency", "date", "duration", "rating", "status"].includes(field.value_type), "PAGE_MODEL_FAIL", `invalid value_type for ${field.field_id}`);
    need(["left", "center", "right"].includes(field.alignment), "PAGE_MODEL_FAIL", `invalid alignment for ${field.field_id}`);
    need(Array.isArray(field.source_ids) && field.source_ids.length > 0, "SOURCE_FIDELITY_FAIL", `field ${field.field_id} needs source_ids`);
    need(!fieldIds.has(field.field_id), "PAGE_MODEL_FAIL", `duplicate field id: ${field.field_id}`);
    fieldIds.add(field.field_id);
    axisCounts.set(field.axis_id, (axisCounts.get(field.axis_id) ?? 0) + 1);
  }
  for (const relation of skeleton.relationships) {
    need(relation?.type && relation?.from && relation?.to, "PAGE_MODEL_FAIL", "every relationship needs type, from and to");
    need(Array.isArray(relation.source_ids) && relation.source_ids.length > 0, "SOURCE_FIDELITY_FAIL", "every relationship needs source_ids");
  }
  const visual = model.visual_consequence;
  need(visual?.primary_evidence, "PAGE_MODEL_FAIL", "visual_consequence.primary_evidence is required");
  need(Array.isArray(visual?.regions) && visual.regions.length > 0, "PAGE_MODEL_FAIL", "visual_consequence.regions is required");
  need(Array.isArray(visual?.alignment_axes) && visual.alignment_axes.length > 0, "PAGE_MODEL_FAIL", "visual_consequence.alignment_axes is required");
  need(Array.isArray(visual?.layers) && visual.layers.length >= 3, "PAGE_MODEL_FAIL", "visual_consequence.layers needs at least three layers");
  const unknownAxes = visual.alignment_axes.filter((axis) => !axisCounts.has(axis));
  need(unknownAxes.length === 0, "PAGE_MODEL_FAIL", `visual_consequence cites unknown axes: ${unknownAxes.join(", ")}`);
  return { ok: true, fields: fieldIds.size, entities: entityIds.size, axes: [...axisCounts.keys()] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const input = process.argv[2];
    if (!input) throw new PageModelError("INPUT_CONTRACT_FAIL", "Usage: validate_page_model.mjs <page-model.json>");
    const result = validatePageModel(JSON.parse(await fs.readFile(input, "utf8")));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "PAGE_MODEL_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
