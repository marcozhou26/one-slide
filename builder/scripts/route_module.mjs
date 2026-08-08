import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(scriptDir, "..", "references", "module-registry.json");

export async function routeModule(profile) {
  const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
  const productized = registry.modules.filter((module) => module.status === "productized");
  if (profile.requested_module) {
    const requestedModule = profile.requested_module === "slope-ranking" ? "bump-ranking" : profile.requested_module;
    const selected = productized.find((module) => module.module_id === requestedModule);
    if (!selected) {
      const error = new Error(`Requested module is not productized: ${profile.requested_module}`);
      error.code = "MODULE_NOT_PRODUCTIZED";
      throw error;
    }
    return { decision: "selected", module: selected, reason: "user_explicit" };
  }
  const matches = productized.filter((module) =>
    module.signals.some((signal) => profile[signal] === true),
  );
  if (matches.length === 1) return { decision: "selected", module: matches[0], reason: "single_explicit_signal" };
  if (matches.length > 1) {
    return {
      decision: "needs_structure_choice",
      code: "ROUTE_AMBIGUITY_REVIEW",
      candidates: matches.slice(0, 2).map((module) => module.module_id),
    };
  }
  const error = new Error("No productized module has enough explicit evidence");
  error.code = "ROUTE_EVIDENCE_INSUFFICIENT";
  throw error;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: route_module.mjs <profile.json>");
    const profile = JSON.parse(await fs.readFile(inputPath, "utf8"));
    process.stdout.write(`${JSON.stringify(await routeModule(profile))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "ROUTE_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
