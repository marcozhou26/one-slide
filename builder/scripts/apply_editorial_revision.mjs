import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ALLOWED = new Set([
  "move", "resize", "font-size", "font-weight", "text-align", "text-color", "text-insets",
]);
const SLIDE_WIDTH = 1280;
const SIDEBAR_LEFT = SLIDE_WIDTH * 0.74;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith("--") || argv[index + 1] === undefined) throw new Error("Use --key value arguments.");
    args[argv[index].slice(2)] = argv[index + 1];
  }
  for (const key of ["workspace", "input", "qa", "plan", "output", "audit"]) if (!args[key]) throw new Error(`--${key} is required.`);
  return args;
}

async function sha256(file) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
}

function visibleText(node) {
  const own = (node?.paragraphs ?? []).flatMap((paragraph) => paragraph.runs ?? []).map((run) => String(run.text ?? "")).join("").trim();
  if (own) return own;
  for (const child of node?.children ?? []) {
    const text = visibleText(child);
    if (text) return text;
  }
  return "";
}

function bboxOf(target) {
  const p = target.position;
  return [p.left, p.top, p.width, p.height];
}

function assertBbox(actual, expected, label) {
  if (!Array.isArray(expected) || expected.length !== 4 || expected.some((value) => !Number.isFinite(value))) {
    throw new Error(`${label}: expected_bbox must contain four numbers.`);
  }
  actual.forEach((value, index) => {
    if (Math.abs(value - expected[index]) > 0.6) throw new Error(`${label}: expected_bbox does not match current source.`);
  });
}

function validColor(value) {
  return value === "none" || /^#?[0-9A-F]{6}$/iu.test(String(value));
}

function validateOperation(op) {
  if (!ALLOWED.has(op.op)) throw new Error(`Unsupported operation: ${op.op}`);
  if (!op.target || !/^(sh|name|bbox)\//u.test(op.target)) throw new Error(`${op.op}: target selector is required.`);
  if (!op.reason || !Array.isArray(op.expected_bbox)) throw new Error(`${op.target}: reason and expected_bbox are required.`);
  if (op.op === "move" && (![op.dx, op.dy].every(Number.isFinite))) throw new Error(`${op.target}: move needs dx and dy.`);
  if (op.op === "resize" && (![op.dw, op.dh].every(Number.isFinite))) throw new Error(`${op.target}: resize needs dw and dh.`);
  if (op.op === "font-size" && (!Number.isFinite(op.target_pt) || op.target_pt < 10)) throw new Error(`${op.target}: target_pt must be at least 10.`);
  if (op.op === "text-insets") {
    if (!op.insets || ["left", "right", "top", "bottom"].some((key) => !Number.isFinite(op.insets[key]) || op.insets[key] < 0)) {
      throw new Error(`${op.target}: text-insets needs non-negative left, right, top, and bottom values.`);
    }
  }
  if (op.intent && !["fit-repair", "hierarchy", "proximity", "alignment"].includes(op.intent)) throw new Error(`${op.target}: invalid intent.`);
  if (op.op === "font-weight" && !["normal", "bold"].includes(op.weight)) throw new Error(`${op.target}: weight must be normal or bold.`);
  if (op.op === "text-align" && !["left", "center", "right"].includes(op.alignment)) throw new Error(`${op.target}: invalid alignment.`);
  if (op.op === "text-color" && !validColor(op.color)) throw new Error(`${op.target}: invalid color.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = path.resolve(args.input);
  const output = path.resolve(args.output);
  if (input === output) throw new Error("Output must not overwrite input.");
  try {
    await fs.access(output);
    throw new Error("Output already exists.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const qaPath = path.resolve(args.qa);
  const qa = JSON.parse(await fs.readFile(qaPath, "utf8"));
  const plan = JSON.parse(await fs.readFile(args.plan, "utf8"));
  const inputHash = await sha256(input);
  if (qa.role !== "EDITORIAL_QA" || qa.decision !== "BUILDER_LOCAL_REPAIR") throw new Error("Editorial QA did not authorize BUILDER_LOCAL_REPAIR.");
  if (qa.source_sha256 !== inputHash) throw new Error("Editorial QA source_sha256 does not match input.");
  if (plan.version !== 1 || !Array.isArray(plan.operations) || plan.operations.length === 0) throw new Error("Builder revision plan version 1 with at least one operation is required.");
  if (plan.source_sha256 !== inputHash) throw new Error("Builder plan source_sha256 does not match input.");
  if (plan.editorial_qa_sha256 !== await sha256(qaPath)) throw new Error("Builder plan is not bound to the Editorial QA brief.");
  if (!plan.execution_rationale) throw new Error("Builder plan needs execution_rationale.");
  plan.operations.forEach(validateOperation);

  const groupContracts = new Map((plan.group_contracts ?? []).map((contract) => [contract.group_id, contract]));
  const qaGroups = new Map((qa.diagnostic_basis?.visual_groups ?? []).map((group) => [group.group_id, group]));
  for (const contract of groupContracts.values()) {
    if (!contract.group_id || !Array.isArray(contract.members) || contract.members.length < 2) throw new Error("Each group contract needs a group_id and at least two members.");
    if (!['uniform-typography', 'content-driven-containers'].includes(contract.policy)) throw new Error(`${contract.group_id}: invalid group policy.`);
    const qaGroup = qaGroups.get(contract.group_id);
    if (!qaGroup || qaGroup.source_ids.length !== contract.members.length || qaGroup.source_ids.some((member) => !contract.members.includes(member))) {
      throw new Error(`${contract.group_id}: group contract must match the Editorial QA visual group.`);
    }
  }
  for (const op of plan.operations) {
    const member = op.target.startsWith("name/") ? decodeURIComponent(op.target.slice(5)) : null;
    const matchingQaGroups = member ? [...qaGroups.values()].filter((group) => group.source_ids.includes(member)) : [];
    if (matchingQaGroups.length && !op.group_id) throw new Error(`${op.target}: operation on a declared visual-group member requires group_id.`);
    if (!op.group_id) continue;
    const contract = groupContracts.get(op.group_id);
    if (!contract) throw new Error(`${op.group_id}: operation references an undeclared group contract.`);
    if (!member || !contract.members.includes(member)) throw new Error(`${op.target}: target is not a declared member of ${op.group_id}.`);
  }
  for (const contract of groupContracts.values()) {
    const groupOperations = plan.operations.filter((op) => op.group_id === contract.group_id);
    if (contract.policy === "uniform-typography") {
      for (const operationName of ["font-size", "text-insets"]) {
        const operations = groupOperations.filter((op) => op.op === operationName);
        if (!operations.length) continue;
        const members = new Set(operations.map((op) => decodeURIComponent(op.target.slice(5))));
        if (members.size !== contract.members.length || contract.members.some((member) => !members.has(member))) {
          throw new Error(`${contract.group_id}: ${operationName} must be applied to every peer member.`);
        }
        if (operationName === "font-size" && new Set(operations.map((op) => op.target_pt)).size !== 1) {
          throw new Error(`${contract.group_id}: peer members must keep one font size.`);
        }
      }
    }
    if (contract.policy === "content-driven-containers" && groupOperations.some((op) => op.op === "font-size")) {
      throw new Error(`${contract.group_id}: expand the content container before changing peer typography.`);
    }
  }

  const modulePath = path.join(path.resolve(args.workspace), "node_modules/@oai/artifact-tool/dist/artifact_tool.mjs");
  const { FileBlob, PresentationFile } = await import(pathToFileURL(modulePath).href);
  const presentation = await PresentationFile.importPptx(await FileBlob.load(input));
  if (presentation.slides.items.length !== 1) throw new Error("Input must contain exactly one slide.");
  const slide = presentation.slides.getItem(0);
  const snapshot = await presentation.inspect({ kind: "shape,textbox", include: "id,name,bbox,slide,geometry,fillColor,text", maxChars: 500000 });
  const inventory = snapshot.ndjson.split("\n").filter(Boolean).map(JSON.parse);

  function resolve(selector, expectedBbox) {
    if (selector.startsWith("sh/")) {
      const target = presentation.resolve(selector);
      assertBbox(bboxOf(target), expectedBbox, selector);
      return target;
    }
    let matches = [];
    if (selector.startsWith("name/")) {
      const wanted = decodeURIComponent(selector.slice(5));
      matches = inventory.filter((item) => item.slide === 1 && item.name === wanted);
    } else if (selector.startsWith("bbox/")) {
      const wanted = selector.slice(5).split(",").map(Number);
      matches = inventory.filter((item) => item.slide === 1 && Array.isArray(item.bbox) && item.bbox.every((value, index) => Math.abs(value - wanted[index]) <= 0.6));
    }
    if (matches.length !== 1) throw new Error(`${selector}: expected one match, found ${matches.length}.`);
    const target = presentation.resolve(matches[0].id);
    assertBbox(bboxOf(target), expectedBbox, selector);
    return target;
  }

  const audit = {
    version: 1,
    source_sha256: inputHash,
    input,
    output,
    role: "BUILDER_REVISION_EXECUTOR",
    editorial_qa_sha256: await sha256(qaPath),
    editorial_decision: qa.decision,
    primary_issue: qa.primary_issue?.problem,
    execution_rationale: plan.execution_rationale,
    operations: [],
  };

  for (const op of plan.operations) {
    const target = resolve(op.target, op.expected_bbox);
    const before = bboxOf(target);
    const targetText = visibleText(target.toProto());
    if (["move", "resize"].includes(op.op) && !targetText) {
      throw new Error(`${op.target}: DATA_ENCODING_GEOMETRY_PROTECTED`);
    }
    const inSidebar = before[0] >= SIDEBAR_LEFT;
    const groupContract = op.group_id ? groupContracts.get(op.group_id) : null;
    const sidebarContentExpansion = inSidebar && op.op === "resize" && op.intent === "fit-repair" && groupContract?.policy === "content-driven-containers" && op.dw >= 0 && op.dh >= 0;
    if (inSidebar && ["move", "resize"].includes(op.op) && !sidebarContentExpansion) {
      throw new Error(`${op.target}: SIDEBAR_GEOMETRY_PROTECTED`);
    }
    const record = { ...op, before };
    if (op.op === "move") {
      target.position = { left: before[0] + op.dx, top: before[1] + op.dy, width: before[2], height: before[3] };
      record.after = bboxOf(target);
    } else if (op.op === "resize") {
      if (before[2] + op.dw <= 1 || before[3] + op.dh <= 1) throw new Error(`${op.target}: invalid final size.`);
      target.position = { left: before[0], top: before[1], width: before[2] + op.dw, height: before[3] + op.dh };
      record.after = bboxOf(target);
    } else if (op.op === "font-size") {
      record.before_px = target.text.fontSize;
      const targetPx = op.target_pt * (96 / 72);
      if (inSidebar && (op.intent !== "fit-repair" || !Number.isFinite(record.before_px) || targetPx >= record.before_px)) {
        throw new Error(`${op.target}: SIDEBAR_FONT_SIZE_REQUIRES_REDUCTION_FIT_REPAIR`);
      }
      target.text.style = { fontSize: targetPx };
      record.after_px = target.text.fontSize;
    } else if (op.op === "font-weight") {
      record.before_bold = target.text.bold;
      target.text.bold = op.weight === "bold";
      record.after_bold = target.text.bold;
    } else if (op.op === "text-align") {
      record.before_alignment = target.text.alignment;
      target.text.alignment = op.alignment;
      record.after_alignment = target.text.alignment;
    } else if (op.op === "text-color") {
      target.text.color = op.color;
      record.after_color = op.color;
    } else if (op.op === "text-insets") {
      target.text.insets = op.insets;
      record.after_insets = op.insets;
    }
    audit.operations.push(record);
  }

  await fs.mkdir(path.dirname(output), { recursive: true });
  await (await PresentationFile.exportPptx(presentation)).save(output);
  audit.output_sha256 = await sha256(output);
  await fs.mkdir(path.dirname(path.resolve(args.audit)), { recursive: true });
  await fs.writeFile(path.resolve(args.audit), `${JSON.stringify(audit, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ status: "EDITORIAL_PATCH_FAIL", message: error.message })}\n`);
  process.exitCode = 1;
});
