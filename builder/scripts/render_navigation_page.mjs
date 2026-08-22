import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./pptx_core.mjs";
import { renderStructurePage } from "./render_structure_page.mjs";
import { loadStructureInput } from "./structure_page_common.mjs";
export const renderNavigationPage = (data, output) => renderStructurePage(data, output, "navigation-page");
async function main() { const options = parseCliArgs(process.argv.slice(2)); const data = await loadStructureInput(options.input, "navigation-page"); await renderNavigationPage(data, options); process.stdout.write(`${JSON.stringify({ ok: true, module: data.module_id })}\n`); }
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`); process.exitCode = 1; });
