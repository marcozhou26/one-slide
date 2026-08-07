import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

export class LogicStructureError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function requireCondition(condition, code, message) {
  if (!condition) throw new LogicStructureError(code, message);
}

function isExactSourceSubstring(text, sourceIds, anchors) {
  if (text === "待客户补充") return true;
  return sourceIds.some((id) => anchors.get(id)?.includes(text));
}

function assertDag(nodes, edges) {
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    requireCondition(
      incoming.has(edge.from) && incoming.has(edge.to),
      "LOGIC_STRUCTURE_FAIL",
      "Edge references an unknown node",
    );
    outgoing.get(edge.from).push(edge.to);
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }

  const queue = [...incoming.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id);
  let visited = 0;

  while (queue.length > 0) {
    const id = queue.shift();
    visited += 1;
    for (const next of outgoing.get(id)) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }

  requireCondition(
    visited === nodes.length,
    "LOGIC_STRUCTURE_FAIL",
    "Causal graph must be acyclic",
  );
}

export function validateLogicStructure(data) {
  requireCondition(data && typeof data === "object", "LOGIC_STRUCTURE_FAIL", "Input must be an object");
  requireCondition(data.version === "0.1", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(
    data.audience_mode === "analysis" || data.audience_mode === "decision",
    "LOGIC_STRUCTURE_FAIL",
    "Unsupported audience mode",
  );
  requireCondition(
    data.diagram?.type === "causal-chain",
    "LOGIC_STRUCTURE_FAIL",
    "Expected causal-chain diagram",
  );
  requireCondition(
    Array.isArray(data.source_anchors) && data.source_anchors.length > 0,
    "SOURCE_BASELINE_FAIL",
    "Source anchors are required",
  );
  requireCondition(
    Array.isArray(data.diagram.nodes) && data.diagram.nodes.length > 1,
    "LOGIC_STRUCTURE_FAIL",
    "At least two nodes are required",
  );
  requireCondition(
    Array.isArray(data.diagram.edges) && data.diagram.edges.length > 0,
    "LOGIC_STRUCTURE_FAIL",
    "At least one edge is required",
  );

  const anchors = new Map();
  for (const anchor of data.source_anchors) {
    requireCondition(
      typeof anchor.id === "string" && typeof anchor.text === "string" && anchor.text.length > 0,
      "SOURCE_BASELINE_FAIL",
      "Every source anchor needs an id and text",
    );
    requireCondition(!anchors.has(anchor.id), "SOURCE_BASELINE_FAIL", `Duplicate source anchor: ${anchor.id}`);
    anchors.set(anchor.id, anchor.text);
  }

  requireCondition(
    data.title?.origin === "source" || data.title?.origin === "placeholder",
    "LOGIC_STRUCTURE_FAIL",
    "Title origin must be source or placeholder",
  );
  if (data.title.origin === "placeholder") {
    requireCondition(
      data.title.text === "待客户补充",
      "SOURCE_FIDELITY_FAIL",
      "Placeholder title must use the approved text",
    );
  } else {
    requireCondition(
      isExactSourceSubstring(data.title.text, data.title.source_ids ?? [], anchors),
      "SOURCE_FIDELITY_FAIL",
      "Title is not an exact source substring",
    );
  }

  const nodeIds = new Set();
  for (const node of data.diagram.nodes) {
    requireCondition(typeof node.id === "string" && node.id.length > 0, "LOGIC_STRUCTURE_FAIL", "Node id is required");
    requireCondition(!nodeIds.has(node.id), "LOGIC_STRUCTURE_FAIL", `Duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    requireCondition(
      isExactSourceSubstring(node.text, node.source_ids ?? [], anchors),
      "SOURCE_FIDELITY_FAIL",
      `Node ${node.id} is not an exact source substring`,
    );
  }

  for (const edge of data.diagram.edges) {
    requireCondition(
      edge.relation === "causes",
      "LOGIC_AMBIGUITY_BLOCKED",
      "Only explicit causal edges are accepted",
    );
    requireCondition(
      (edge.source_ids ?? []).length > 0,
      "LOGIC_AMBIGUITY_BLOCKED",
      "Causal edge lacks source evidence",
    );
    requireCondition(
      edge.source_ids.every((id) => anchors.has(id)),
      "LOGIC_AMBIGUITY_BLOCKED",
      "Causal evidence source is unknown",
    );
  }

  assertDag(data.diagram.nodes, data.diagram.edges);

  const mapped = new Set(
    data.diagram.nodes.flatMap((node) => node.source_ids ?? []),
  );
  const unmappedSourceIds = [...anchors.keys()].filter((id) => !mapped.has(id));
  requireCondition(
    unmappedSourceIds.length === 0,
    "CONTENT_MAPPING_FAIL",
    `Unmapped source anchors: ${unmappedSourceIds.join(", ")}`,
  );

  return {
    ok: true,
    mappedSourceIds: [...mapped].sort(),
    unmappedSourceIds,
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new LogicStructureError("SOURCE_BASELINE_FAIL", "Usage: validate_logic_structure.mjs <logic-structure.json>");
  }
  const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
  process.stdout.write(`${JSON.stringify(validateLogicStructure(data))}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      code: error.code ?? "LOGIC_STRUCTURE_FAIL",
      message: error.message,
    })}\n`);
    process.exitCode = 1;
  });
}
