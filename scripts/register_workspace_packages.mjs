import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const moduleRoot = process.env.CODEX_NODE_MODULES || process.env.NODE_PATH;
if (!moduleRoot) throw new Error("Set CODEX_NODE_MODULES to the bundled workspace node_modules directory");

const packageEntries = new Map([
  ["@oai/artifact-tool", path.join(moduleRoot, "@oai", "artifact-tool", "dist", "artifact_tool.mjs")],
  ["jszip", path.join(moduleRoot, "jszip", "lib", "index.js")],
]);

for (const [specifier, entry] of packageEntries) {
  if (!fs.existsSync(entry)) throw new Error(`Workspace package entry is unavailable for ${specifier}: ${entry}`);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const entry = packageEntries.get(specifier);
    if (entry) return { url: pathToFileURL(entry).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
