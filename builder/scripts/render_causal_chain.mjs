import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLogicStructure } from "./validate_logic_structure.mjs";
import { planCausalLayout } from "./plan_causal_layout.mjs";
import {
  COLORS,
  addNode,
  addTextBox,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
  resolveSlideBackground,
  toArtifactFontSize,
} from "./pptx_core.mjs";

function nodeStyle(kind) {
  if (kind === "effect") {
    return { fill: COLORS.blueLight, border: COLORS.blue, borderWidth: 2.4 };
  }
  if (kind === "mechanism") {
    return { fill: COLORS.soft, border: COLORS.line, borderWidth: 1.6 };
  }
  return { fill: COLORS.white, border: COLORS.border, borderWidth: 1.6 };
}

export async function renderCausalChain(data, output) {
  validateLogicStructure(data);
  const plan = planCausalLayout(data);
  const { presentation, slide } = createPresentation(output.background);

  addTextBox(slide, {
    name: "page-title",
    text: plan.title.text,
    position: plan.title,
    fontSize: fitPageTitleFontSize(plan.title.text),
    bold: true,
  });

  const nodeShapes = new Map();
  for (const node of plan.nodes) {
    const style = nodeStyle(node.kind);
    const shape = addNode(slide, {
      name: `node-${node.id}`,
      text: "",
      position: node,
      ...style,
      fontSize: node.fontSize,
      bold: node.kind === "effect",
    });
    nodeShapes.set(node.id, shape);
  }

  for (const edge of plan.edges) {
    connectNative(slide, nodeShapes.get(edge.from), nodeShapes.get(edge.to), {
      kind: "straight",
      role: "relationship",
      fromSide: "right",
      toSide: "left",
      line: { style: "solid", fill: COLORS.muted, width: 2 },
    });
  }

  for (const node of plan.nodes) {
    const shape = nodeShapes.get(node.id);
    shape.text = node.text;
    shape.text.style = {
      fontSize: toArtifactFontSize(node.fontSize),
      bold: node.kind === "effect",
      color: COLORS.text,
      alignment: "center",
    };
    shape.text.verticalAlignment = "middle";
  }

  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(options.input, "utf8"));
  const plan = await renderCausalChain(data, options);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      module: "causal-chain",
      nodes: plan.nodes.length,
      edges: plan.edges.length,
      pptx: options.pptx,
      background: resolveSlideBackground(options.background),
    })}\n`,
  );
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
