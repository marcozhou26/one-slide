import { isDirectRun, runValidatorCli, validateStructurePage } from "./structure_page_common.mjs";
export const validateBookendPage = (data) => validateStructurePage(data, "bookend-page");
if (isDirectRun(import.meta.url)) runValidatorCli("bookend-page").then((result) => process.stdout.write(`${JSON.stringify({ ...result, normalized: undefined })}\n`)).catch((error) => { process.stderr.write(`${JSON.stringify({ code: error.code ?? "DATA_CONTRACT_FAIL", message: error.message })}\n`); process.exitCode = 1; });
