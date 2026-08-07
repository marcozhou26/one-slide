import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

function mapVisible(item, anchors, mapped, label) {
  if (!item) return;
  validateVisibleText(item, anchors, label);
  (item.source_ids ?? []).forEach((id) => mapped.add(id));
}

export function validateStageProcess(data) {
  requireCondition(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(data?.module_id === "stage-process", "LOGIC_STRUCTURE_FAIL", "Expected stage-process module");
  requireCondition(data?.diagram?.type === "stage-process", "LOGIC_STRUCTURE_FAIL", "Expected stage-process diagram");
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  requireCondition(
    Array.isArray(data.diagram.steps) && data.diagram.steps.length >= 3 && data.diagram.steps.length <= 6,
    "LOGIC_STRUCTURE_FAIL",
    "Stage process requires three to six steps",
  );
  const ids = new Set();
  data.diagram.steps.forEach((step, index) => {
    requireCondition(typeof step.id === "string" && !ids.has(step.id), "LOGIC_STRUCTURE_FAIL", "Step ids must be unique");
    ids.add(step.id);
    mapVisible(step, anchors, mapped, `Step ${index + 1}`);
    mapVisible(step.action, anchors, mapped, `Action ${index + 1}`);
    for (const activity of step.activities ?? []) mapVisible(activity, anchors, mapped, `Activity ${index + 1}`);
    mapVisible(step.deliverable, anchors, mapped, `Deliverable ${index + 1}`);
    mapVisible(step.owner_period, anchors, mapped, `Owner and period ${index + 1}`);
    mapVisible(step.gate, anchors, mapped, `Gate ${index + 1}`);
  });
  requireCondition(
    Array.isArray(data.diagram.transitions) && data.diagram.transitions.length === data.diagram.steps.length - 1,
    "LOGIC_STRUCTURE_FAIL",
    "Every adjacent step requires one explicit transition",
  );
  data.diagram.transitions.forEach((transition, index) => {
    requireCondition(
      transition.from === data.diagram.steps[index].id && transition.to === data.diagram.steps[index + 1].id,
      "LOGIC_STRUCTURE_FAIL",
      "Transitions must follow the declared step order",
    );
    requireCondition(
      Array.isArray(transition.source_ids) && transition.source_ids.length > 0,
      "LOGIC_AMBIGUITY_BLOCKED",
      "Step order requires source evidence",
    );
    transition.source_ids.forEach((id) => mapped.add(id));
  });
  for (const item of data.diagram.bottom_strip ?? []) mapVisible(item, anchors, mapped, "Bottom strip");
  if (data.diagram.loopback) {
    mapVisible(data.diagram.loopback, anchors, mapped, "Loopback");
  }
  return { ok: true, ...validateAllAnchorsMapped(data.source_anchors, mapped) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_stage_process.mjs <input.json>");
    const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
    process.stdout.write(`${JSON.stringify(validateStageProcess(data))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "LOGIC_STRUCTURE_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
