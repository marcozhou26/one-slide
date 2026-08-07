#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const files = (await fs.readdir(scriptDir))
  .filter((name) => name.startsWith("render") && name.endsWith(".mjs"))
  .map((name) => path.join(scriptDir, name));
const findings = [];

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes('roundRect')) findings.push({ file: path.basename(file), line: index + 1, code: "ROUNDED_DATA_OR_CONTAINER" });
    const normalizationOnly = line.includes('replaceAll("｜"') || line.includes("join(\"|\")");
    if (/｜|\s\|\s/.test(line) && !normalizationOnly) findings.push({ file: path.basename(file), line: index + 1, code: "VISIBLE_FIELD_DELIMITER" });
  });
}

const core = await fs.readFile(path.join(scriptDir, "pptx_core.mjs"), "utf8");
const roundedCount = [...core.matchAll(/roundRect/g)].length;
if (roundedCount !== 1 || !/function addStatusTag[\s\S]*?geometry:\s*"roundRect"/.test(core)) {
  findings.push({ file: "pptx_core.mjs", line: 0, code: "ROUNDRECT_NOT_ISOLATED_TO_STATUS_TAG", roundedCount });
}

const result = { ok: findings.length === 0, renderer_files: files.length, findings };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (findings.length) process.exitCode = 1;
