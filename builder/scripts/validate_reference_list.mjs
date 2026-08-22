import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

const fail = (condition, code, message) => requireCondition(condition, code, message);
const unsafeLocator = (value) => {
  const username = "marco" + "zhou";
  return new RegExp(`(?:file:\\/\\/\\/|\\/Users\\/|\\\\Users\\\\|${username})`, "i").test(String(value ?? ""));
};
const normalizeKey = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\/$/, "");

export function validateReferenceList(data) {
  fail(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  fail(data?.module_id === "reference-list", "LOGIC_STRUCTURE_FAIL", "Expected reference-list module_id");
  fail(data?.diagram?.type === "reference-list", "LOGIC_STRUCTURE_FAIL", "diagram.type must match module_id");
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  const mapped = new Set(data.title.source_ids ?? []);
  const visible = (item, label) => {
    validateVisibleText(item, anchors, label);
    (item.source_ids ?? []).forEach((id) => mapped.add(id));
  };
  if (data.subtitle) visible(data.subtitle, "Subtitle");
  const diagram = data.diagram;
  fail(Array.isArray(diagram.references) && diagram.references.length >= 2, "DATA_CONTRACT_FAIL", "Reference list needs at least 2 actual sources");
  fail(diagram.references.length <= 8, "SINGLE_SLIDE_SCOPE_OVERLOAD", "One reference-list page supports at most 8 sources");
  const ids = new Set();
  const keys = new Set();
  diagram.references.forEach((reference, index) => {
    fail(typeof reference.id === "string" && reference.id.trim() && !ids.has(reference.id), "DATA_CONTRACT_FAIL", `Reference ${index + 1} needs a unique id`);
    ids.add(reference.id);
    visible(reference.citation, `Reference ${index + 1} citation`);
    visible(reference.locator, `Reference ${index + 1} locator`);
    fail(reference.citation.text.length <= 180, "READABILITY_FAIL", `Reference ${index + 1} citation is too long for one list page`);
    fail(reference.locator.text.length <= 140, "READABILITY_FAIL", `Reference ${index + 1} locator is too long for one list page`);
    fail(!unsafeLocator(reference.locator.text), "PRIVACY_PATH_FAIL", `Reference ${index + 1} exposes a local path or username`);
    fail(Array.isArray(reference.source_ids) && reference.source_ids.length > 0, "SOURCE_FIDELITY_FAIL", `Reference ${index + 1} needs source_ids`);
    reference.source_ids.forEach((id) => {
      fail(anchors.has(id), "SOURCE_FIDELITY_FAIL", `Reference ${index + 1} cites unknown source ${id}`);
      mapped.add(id);
    });
    const key = normalizeKey(reference.canonical_key);
    fail(key.length >= 3, "REFERENCE_METADATA_FAIL", `Reference ${index + 1} needs a canonical_key`);
    fail(!keys.has(key), "REFERENCE_DEDUPE_FAIL", `Duplicate canonical reference remains after compilation: ${key}`);
    keys.add(key);
    if (reference.supporting_pages != null) {
      fail(Array.isArray(reference.supporting_pages) && reference.supporting_pages.length <= 8, "DATA_CONTRACT_FAIL", `Reference ${index + 1} supporting_pages must contain at most 8 labels`);
      fail(reference.supporting_pages.every((page) => typeof page === "string" && page.trim() && page.length <= 24), "DATA_CONTRACT_FAIL", `Reference ${index + 1} has an invalid page label`);
    }
  });
  visible(diagram.source_note, "Source note");
  const mapping = validateAllAnchorsMapped(data.source_anchors, mapped);
  return { ok: true, module_id: data.module_id, normalized: data, ...mapping };
}

export async function loadReferenceListInput(inputPath) {
  const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  return validateReferenceList(data).normalized;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_reference_list.mjs <input.json>");
    const result = validateReferenceList(JSON.parse(await fs.readFile(inputPath, "utf8")));
    process.stdout.write(`${JSON.stringify({ ...result, normalized: undefined })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
