import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { validateLogicStructure } from "./validate_logic_structure.mjs";

export class LayoutError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const SLIDE = Object.freeze({ width: 1280, height: 720 });
const CONTENT = Object.freeze({
  left: 64,
  top: 150,
  width: 1152,
  height: 506,
});
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 20;
const MIN_NODE_HEIGHT = 64;
const ROW_GAP = 24;
const COLUMN_GAP = 48;

function textUnits(text) {
  let units = 0;
  for (const char of text) {
    units += /[\u2E80-\u9FFF\uF900-\uFAFF]/u.test(char) ? 1 : 0.55;
  }
  return units;
}

function estimateNodeHeight(text, width, fontSize) {
  const innerWidth = Math.max(40, width - 32);
  const unitsPerLine = Math.max(1, Math.floor(innerWidth / (fontSize * 0.92)));
  const lines = Math.max(1, Math.ceil(textUnits(text) / unitsPerLine));
  return Math.max(MIN_NODE_HEIGHT, Math.ceil(lines * fontSize * 1.35 + 28));
}

function calculateRanks(nodes, edges) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  const ranks = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    incoming.set(edge.to, incoming.get(edge.to) + 1);
    outgoing.get(edge.from).push(edge.to);
  }

  const queue = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort();

  while (queue.length > 0) {
    const id = queue.shift();
    for (const next of outgoing.get(id).sort()) {
      ranks.set(next, Math.max(ranks.get(next), ranks.get(id) + 1));
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }
  return ranks;
}

function chooseFontAndHeights(nodes, nodeWidth) {
  const availableHeight = CONTENT.height - ROW_GAP * (nodes.length - 1);
  if (availableHeight < MIN_NODE_HEIGHT * nodes.length) {
    throw new LayoutError(
      "SINGLE_SLIDE_FIT_FAIL",
      `Rank with ${nodes.length} nodes cannot fit without deleting content`,
    );
  }

  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 1) {
    const heights = nodes.map((node) =>
      estimateNodeHeight(node.text, nodeWidth, fontSize),
    );
    if (heights.reduce((sum, height) => sum + height, 0) <= availableHeight) {
      return { fontSize, heights };
    }
  }

  throw new LayoutError(
    "SINGLE_SLIDE_FIT_FAIL",
    "Node text cannot fit at the 16 pt minimum without rewriting",
  );
}

export function planCausalLayout(data) {
  validateLogicStructure(data);

  if (textUnits(data.title.text) > 46) {
    throw new LayoutError(
      "SINGLE_SLIDE_FIT_FAIL",
      "Title cannot remain on one line at 35 pt",
    );
  }

  const ranks = calculateRanks(data.diagram.nodes, data.diagram.edges);
  const rankCount = Math.max(...ranks.values()) + 1;
  const columnWidth =
    (CONTENT.width - COLUMN_GAP * (rankCount - 1)) / rankCount;
  const nodeWidth = Math.min(340, Math.floor(columnWidth - 16));
  if (nodeWidth < 180) {
    throw new LayoutError(
      "SINGLE_SLIDE_FIT_FAIL",
      "Causal depth leaves insufficient node width",
    );
  }

  const grouped = Array.from({ length: rankCount }, () => []);
  for (const node of data.diagram.nodes) {
    grouped[ranks.get(node.id)].push(node);
  }
  for (const group of grouped) {
    group.sort((a, b) => a.id.localeCompare(b.id));
  }

  const plannedNodes = [];
  for (let rank = 0; rank < grouped.length; rank += 1) {
    const group = grouped[rank];
    const { fontSize, heights } = chooseFontAndHeights(group, nodeWidth);
    const totalHeight =
      heights.reduce((sum, height) => sum + height, 0) +
      ROW_GAP * (group.length - 1);
    let top = CONTENT.top + Math.round((CONTENT.height - totalHeight) / 2);
    const left = Math.round(
      CONTENT.left +
        rank * (columnWidth + COLUMN_GAP) +
        (columnWidth - nodeWidth) / 2,
    );

    for (let index = 0; index < group.length; index += 1) {
      const node = group[index];
      const height = heights[index];
      plannedNodes.push({
        ...node,
        rank,
        left,
        top,
        width: nodeWidth,
        height,
        fontSize,
      });
      top += height + ROW_GAP;
    }
  }

  return {
    slide: SLIDE,
    content: CONTENT,
    title: {
      ...data.title,
      left: 64,
      top: 52,
      width: 1152,
      height: 52,
      fontSize: 30,
    },
    nodes: plannedNodes,
    edges: data.diagram.edges.map((edge) => ({ ...edge })),
    typography: {
      minimumBodyFontSize: MIN_FONT_SIZE,
      titleFontSize: 35,
    },
  };
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new LayoutError(
      "SOURCE_BASELINE_FAIL",
      "Usage: plan_causal_layout.mjs <logic-structure.json> <layout-plan.json>",
    );
  }
  const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const plan = planCausalLayout(data);
  await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      code: error.code ?? "SINGLE_SLIDE_FIT_FAIL",
      message: error.message,
    })}\n`);
    process.exitCode = 1;
  });
}
