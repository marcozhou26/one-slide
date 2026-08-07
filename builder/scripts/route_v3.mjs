#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { routeInput } from "./route_input.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.dirname(scriptDir);
const registryPath = path.join(skillDir, "references", "module-registry.json");
const GENERIC_REQUESTS = new Set(["chart", "comparison", "process", "matrix", "composite"]);

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function structured(input) {
  return Boolean(
    text(input.subject) &&
      text(input.story) &&
      Array.isArray(input.source_ids) &&
      input.source_ids.length > 0 &&
      (Array.isArray(input.display_blocks) || input.structure || input.dataset || Array.isArray(input.datasets) || input.requested_module),
  );
}

function compactModule(module, sourceMode, reason) {
  return {
    status: "ready",
    route: "deterministic_module",
    source_mode: sourceMode,
    module_id: module.module_id,
    reason,
    load_only: [module.reference],
    validator: module.validator,
    planner: module.planner,
    renderer: module.renderer,
    token_policy: "Execute scripts by path. Do not read their source unless execution fails with an implementation error.",
  };
}

function direct(sourceMode, reason, input) {
  const intents = [...new Set((input.display_blocks ?? []).map((block) => block.display_intent).filter(Boolean))];
  return {
    status: "ready",
    route: "direct_composition",
    source_mode: sourceMode,
    reason,
    family: input.structure?.family ?? input.structure?.primary_exhibit ?? input.requested_module ?? "composite",
    preferred_module: input.structure?.primary_exhibit ?? null,
    display_intents: intents.slice(0, 8),
    load_only: ["references/visual-grammar.md", "references/direct-composition.md"],
    primitives: "scripts/pptx_core.mjs",
    token_policy: "Do not generate a second page model and do not read the module registry.",
  };
}

export async function routeV3(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { status: "blocked", route: "SOURCE_BASELINE_FAIL", reason: "Input must be a JSON object." };
  }
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const modules = registry.modules.filter((module) => module.status === "productized");
  const byId = new Map(modules.map((module) => [module.module_id, module]));
  const sourceMode = structured(input) ? "structured_handoff" : "raw_source";
  const requested = text(input.requested_module);
  const modulePayload = input.module_payload;
  const hasSource = Boolean(
    text(input.text) ||
      text(input.title) ||
      text(input.page_claim) ||
      text(input.subject) ||
      text(input.story) ||
      input.data != null ||
      input.dataset != null ||
      (Array.isArray(input.datasets) && input.datasets.length > 0) ||
      (Array.isArray(input.display_blocks) && input.display_blocks.length > 0),
  );
  if (!hasSource) {
    return { status: "blocked", route: "SOURCE_BASELINE_FAIL", reason: "No source content or data was provided." };
  }

  if (modulePayload != null) {
    if (!modulePayload || typeof modulePayload !== "object" || Array.isArray(modulePayload)) {
      return { status: "blocked", route: "MODULE_HANDOFF_FAIL", reason: "module_payload must be an object" };
    }
    const payloadModule = text(modulePayload.module_id);
    if (!payloadModule || !byId.has(payloadModule)) {
      return { status: "blocked", route: "MODULE_HANDOFF_FAIL", reason: `module_payload names an unknown module: ${payloadModule ?? "missing"}` };
    }
    if (requested && requested !== payloadModule) {
      return { status: "blocked", route: "ROUTE_CONFLICT", reason: "requested_module and module_payload.module_id disagree" };
    }
    const primaryExhibit = text(input.structure?.primary_exhibit);
    if (primaryExhibit && primaryExhibit !== payloadModule) {
      return { status: "blocked", route: "ROUTE_CONFLICT", reason: "structure.primary_exhibit and module_payload.module_id disagree" };
    }
    return { ...compactModule(byId.get(payloadModule), sourceMode, "validated executable module payload"), module_input: "module_payload" };
  }

  if (requested && byId.has(requested)) {
    return compactModule(byId.get(requested), sourceMode, "explicit productized module");
  }
  if (sourceMode === "structured_handoff") {
    if (requested && GENERIC_REQUESTS.has(requested)) {
      return direct(sourceMode, "generic or composite visual request requires one source-specific composition", input);
    }
    const signals = new Set(input.structure?.signals ?? []);
    const matches = modules.filter((module) => module.signals.length > 0 && module.signals.every((signal) => signals.has(signal)));
    const intents = new Set((input.display_blocks ?? []).map((block) => block.display_intent).filter(Boolean));
    const composite = (input.display_blocks?.length ?? 0) > 2 || intents.size > 1 || matches.length > 1;
    if (matches.length === 1 && !composite) {
      return compactModule(matches[0], sourceMode, `single structural signal set matched ${matches[0].module_id}`);
    }
    return direct(sourceMode, composite ? "multiple evidence relationships form a composite page" : "no single deterministic module covers the structured handoff", input);
  }

  const rawText = [input.text, input.title, input.page_claim].filter((value) => typeof value === "string").join(" ");
  const compositeCueCount = ["金字塔", "链路", "并排比较", "洞察卡", "证据带", "结论带", "主视觉"].filter((cue) => rawText.includes(cue)).length;
  if (rawText.trim().length >= 80 && compositeCueCount >= 2) {
    return {
      status: "blocked",
      route: "BRIEF_REQUIRED",
      source_mode: sourceMode,
      reason: "raw source contains multiple coordinated evidence regions and requires an approved single-page brief",
      next_skill: "consulting-slide-prompt-architect",
    };
  }

  try {
    const result = await routeInput(input);
    if (result.decision === "selected") {
      return compactModule(result.module, sourceMode, result.evidence?.join(", ") || result.reason || "raw source route");
    }
    if (result.decision === "needs_structure_choice") {
      return {
        status: "review",
        route: "BRIEF_REQUIRED",
        candidates: result.candidates,
        reason: "two structures have equal source support and require a brief decision",
        next_skill: "consulting-slide-prompt-architect",
      };
    }
    return direct(sourceMode, "raw source requires source-specific composition", input);
  } catch (error) {
    const sourceLength = [input.text, input.title, input.page_claim].filter((value) => typeof value === "string").join(" ").trim().length;
    if (error.code === "ROUTE_EVIDENCE_INSUFFICIENT" && (text(input.page_claim) || text(input.story)) && (sourceLength >= 80 || input.data != null)) {
      return direct(sourceMode, "source is sufficiently detailed but no single deterministic module covers it", input);
    }
    if (error.code === "ROUTE_EVIDENCE_INSUFFICIENT" && sourceLength >= 80) {
      return {
        status: "blocked",
        route: "BRIEF_REQUIRED",
        source_mode: sourceMode,
        reason: "detailed raw material lacks one confirmed primary relationship",
        next_skill: "consulting-slide-prompt-architect",
      };
    }
    return {
      status: "blocked",
      route: error.code ?? "ROUTE_CONFLICT",
      reason: error.message,
    };
  }
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: node scripts/route_v3.mjs input.json");
  const input = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const result = await routeV3(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "blocked") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "blocked", route: "INPUT_CONTRACT_FAIL", reason: error.message })}\n`);
    process.exitCode = 1;
  });
}
