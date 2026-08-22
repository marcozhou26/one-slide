import fs from "node:fs/promises";

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write("Usage: node audit_ungrounded_emphasis.mjs <renderer.mjs> [...]\n");
  process.exit(2);
}

const positional = String.raw`(?:index|rowIndex|columnIndex|routeIndex|stageIndex|sectionIndex|stackIndex|ri|ci|i)\s*(?:===|!==|<|>|<=|>=)`;
const styleField = String.raw`(?:bold|color|fill|border|borderWidth|fontSize)`;
const patterns = [
  new RegExp(String.raw`${styleField}\s*:\s*[^,\n]*${positional}`, "u"),
  new RegExp(String.raw`${positional}[^\n]*(?:\?|&&)[^\n]*${styleField}`, "u"),
];
const findings = [];

for (const file of files) {
  const lines = (await fs.readFile(file, "utf8")).split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (line.includes("STRUCTURAL_STYLE_OK") || line.includes("READABILITY_PATTERN_OK") || line.includes("ZEBRA_BANDING_OK") || line.includes("BUSINESS_EMPHASIS_OK")) return;
    if (patterns.some((pattern) => pattern.test(line))) {
      findings.push({ file, line: index + 1, code: "POSITIONAL_EMPHASIS_FORBIDDEN", text: line.trim() });
    }
  });
}

const result = {
  ok: findings.length === 0,
  code: findings.length === 0 ? "UNGROUNDED_EMPHASIS_AUDIT_PASS" : "UNGROUNDED_EMPHASIS_AUDIT_FAIL",
  findings,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) process.exitCode = 10;
