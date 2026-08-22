import { runValidatorCli, validateStructurePage } from "./structure_page_common.mjs";
export const validateSummaryPage = (data) => validateStructurePage(data, "summary-page");
if (process.argv[1]?.endsWith("validate_summary_page.mjs")) runValidatorCli("summary-page").then(() => process.stdout.write('{"ok":true,"module":"summary-page"}\n')).catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "VALIDATION_FAIL", message: error.message })}\n`); process.exitCode = 1; });
