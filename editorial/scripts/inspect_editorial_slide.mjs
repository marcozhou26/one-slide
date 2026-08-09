import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Use --key value arguments.");
    args[argv[index].slice(2)] = argv[index + 1];
  }
  for (const key of ["workspace", "input", "output-dir"]) if (!args[key]) throw new Error(`--${key} is required.`);
  return args;
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

async function writeBlob(file, blob) {
  await fs.writeFile(file, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args.input);
  const outputDir = path.resolve(args["output-dir"]);
  await fs.mkdir(outputDir, { recursive: true });
  const modulePath = path.join(path.resolve(args.workspace), "node_modules/@oai/artifact-tool/dist/artifact_tool.mjs");
  const { FileBlob, PresentationFile } = await import(pathToFileURL(modulePath).href);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
  if (presentation.slides.items.length !== 1) throw new Error(`Expected exactly one slide; found ${presentation.slides.items.length}.`);
  const slide = presentation.slides.getItem(0);
  const png = path.join(outputDir, "slide.png");
  const layout = path.join(outputDir, "layout.json");
  const inventory = path.join(outputDir, "inventory.ndjson");
  await writeBlob(png, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(layout, await (await slide.export({ format: "layout" })).text());
  const snapshot = await presentation.inspect({
    kind: "shape,textbox",
    include: "id,name,bbox,slide,geometry,fillColor,lineColor,lineWidth,text",
    maxChars: 500000,
  });
  await fs.writeFile(inventory, `${snapshot.ndjson.trim()}\n`);
  const result = {
    status: "EDITORIAL_BASELINE_READY",
    source: input,
    source_sha256: await sha256(input),
    slide_count: 1,
    png,
    png_sha256: await sha256(png),
    layout,
    layout_sha256: await sha256(layout),
    inventory,
    inventory_sha256: await sha256(inventory),
  };
  await fs.writeFile(path.join(outputDir, "inspect-manifest.json"), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "EDITORIAL_INSPECT_FAIL", message: error.message })}\n`);
  process.exitCode = 1;
});
