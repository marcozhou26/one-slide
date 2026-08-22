#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "../..");
const assetRoot = path.join(skillRoot, "builder/assets/icons/tabler");

export async function buildSemanticIconLibrary(sourceRoot, destinationRoot = assetRoot) {
  const aliases = JSON.parse(await fs.readFile(path.join(destinationRoot, "aliases.zh-CN.json"), "utf8"));
  const sourceRegistry = JSON.parse(await fs.readFile(path.join(sourceRoot, "icons.json"), "utf8"));
  const iconIds = [...new Set(Object.values(aliases.concepts).flatMap((entry) => entry.icons))].sort();
  const missing = iconIds.filter((iconId) => !sourceRegistry[iconId]);
  if (missing.length) throw new Error(`UNKNOWN_ICON_IDS: ${missing.join(", ")}`);

  const outlineDir = path.join(destinationRoot, "outline");
  const filledDir = path.join(destinationRoot, "filled");
  await fs.mkdir(outlineDir, { recursive: true });
  await fs.mkdir(filledDir, { recursive: true });

  const registry = {};
  for (const iconId of iconIds) {
    const source = sourceRegistry[iconId];
    const styles = {};
    for (const style of ["outline", "filled"]) {
      if (!source.styles?.[style]) continue;
      const inputPath = path.join(sourceRoot, "icons", style, `${iconId}.svg`);
      const outputPath = path.join(destinationRoot, style, `${iconId}.svg`);
      await fs.copyFile(inputPath, outputPath);
      styles[style] = `${style}/${iconId}.svg`;
    }
    registry[iconId] = {
      icon_id: iconId,
      category: source.category ?? null,
      tags: source.tags ?? [],
      styles,
    };
  }

  const output = {
    schema_version: "1.0",
    source: "Tabler Icons",
    source_version: JSON.parse(await fs.readFile(path.join(sourceRoot, "package.json"), "utf8")).version,
    license: "MIT",
    selection_policy: "OneSlide business semantic whitelist; SVG assets are replaceable visual resources and are not required to be path-editable.",
    icon_count: Object.keys(registry).length,
    icons: registry,
  };
  await fs.writeFile(path.join(destinationRoot, "registry.json"), `${JSON.stringify(output, null, 2)}\n`);
  await fs.copyFile(path.join(sourceRoot, "LICENSE"), path.join(destinationRoot, "LICENSE-TABLER.txt"));
  return output;
}

async function main() {
  const sourceRoot = process.argv[2];
  if (!sourceRoot) throw new Error("Usage: node builder/scripts/build_semantic_icon_library.mjs <tabler-icons-root> [destination-root]");
  const result = await buildSemanticIconLibrary(path.resolve(sourceRoot), process.argv[3] ? path.resolve(process.argv[3]) : assetRoot);
  process.stdout.write(`${JSON.stringify({ status: "pass", icon_count: result.icon_count, source_version: result.source_version })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ status: "fail", reason: error.message })}\n`);
    process.exitCode = 1;
  });
}
