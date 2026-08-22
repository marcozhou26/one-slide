import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { moduleForPageType } from "../../builder/scripts/structure_page_common.mjs";

const THEMES = new Set(["light", "navy", "inherit_template"]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function compileOutlinePage(spec, slideNumber, theme = "light") {
  if (spec?.schema_version !== "effective-page-spec-1.0") throw Object.assign(new Error("Complex-report pages require effective-page-spec-1.0 from slide-spec"), { code: "EFFECTIVE_PAGE_SPEC_REQUIRED" });
  if (spec?.mode !== "REPORT_PAGE" || !spec?.director_inheritance?.locked_fields) throw Object.assign(new Error("REPORT_PAGE requires director_inheritance.locked_fields"), { code: "EFFECTIVE_PAGE_SPEC_CONFLICT" });
  if (!Number.isInteger(slideNumber) || slideNumber < 1) throw Object.assign(new Error("slideNumber must be a positive integer"), { code: "INPUT_CONTRACT_FAIL" });
  if (!THEMES.has(theme)) throw Object.assign(new Error("theme must be light, navy, or inherit_template"), { code: "INPUT_CONTRACT_FAIL" });
  if (spec.director_inheritance.locked_fields.sequence !== slideNumber) throw Object.assign(new Error(`effective_page_spec sequence does not match slide ${slideNumber}`), { code: "EFFECTIVE_PAGE_SPEC_CONFLICT" });
  const pageContract = spec.page_contract;
  if (spec.director_inheritance.locked_fields.page_type !== pageContract?.page_type || spec.director_inheritance.locked_fields.central_message !== pageContract?.central_message) throw Object.assign(new Error("effective_page_spec overrides director-locked page type or central message"), { code: "EFFECTIVE_PAGE_SPEC_CONFLICT" });
  const moduleId = moduleForPageType(pageContract?.page_type);
  if (!moduleId) throw Object.assign(new Error(`Page type ${pageContract?.page_type} is handled by existing content routing, not a structure-page module`), { code: "MODULE_COVERAGE_GAP" });
  const payload = {
    version: "1.0",
    module_id: moduleId,
    theme,
    deck_context: clone(spec.deck_context),
    page_contract: clone(pageContract),
  };
  return {
    requested_module: moduleId,
    primary_exhibit: moduleId,
    module_payload: payload,
    page_type: pageContract.page_type,
    output_mode: "PROMPT_ONLY",
  };
}

export function renderBuilderPrompt(compiled) {
  const payload = compiled.module_payload;
  const contract = payload.page_contract;
  return [
    "# OneSlide Builder Prompt",
    "",
    `仅生成一页16:9 PowerPoint。使用已产品化模块 \`${payload.module_id}\`，页面类型为 \`${contract.page_type}\`，主题为 \`${payload.theme}\`。`,
    "",
    `本页任务：${contract.page_job}`,
    `中心结论：${contract.central_message}`,
    "",
    contract.page_type === "summary" ? "只能呈现 page_contract.visible_components 及其 paragraph_leading_icon 声明的部件。图标必须位于所属段落左侧，不得变成 Logo、标题装饰或业务强调。原生自动页码属于报告系统层，不转成普通文本框。" : "只能呈现 page_contract.visible_components 中声明的内容部件。不得增加Logo、品牌署名、解释文字或装饰部件。原生自动页码属于报告系统层，不转成普通文本框。",
    "同级元素默认完全同质；相对平移不得改成居中。浅色与深色版本只替换视觉令牌，不改变内容、层级或强调语义。",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.slide || !args.json || !args.prompt) throw new Error("Usage: compile_outline_handoff.mjs --input effective-page-spec.json --slide N --theme light|navy|inherit_template --json payload.json --prompt prompt.md");
  const spec = JSON.parse(await fs.readFile(args.input, "utf8"));
  const compiled = compileOutlinePage(spec, Number(args.slide), args.theme ?? "light");
  await fs.mkdir(path.dirname(args.json), { recursive: true });
  await fs.mkdir(path.dirname(args.prompt), { recursive: true });
  await fs.writeFile(args.json, JSON.stringify(compiled, null, 2) + "\n");
  await fs.writeFile(args.prompt, renderBuilderPrompt(compiled));
  process.stdout.write(`${JSON.stringify({ status: "EFFECTIVE_PAGE_SPEC_COMPILED", slide: Number(args.slide), module: compiled.requested_module, page_type: compiled.page_type })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) main().catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "OUTLINE_COMPILE_FAIL", message: error.message })}\n`); process.exitCode = 1; });
