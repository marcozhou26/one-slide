import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildAnchorMap,
  requireCondition,
  validateAllAnchorsMapped,
  validateTitle,
  validateVisibleText,
} from "./source_fidelity.mjs";

export function validateIssueTree(data) {
  requireCondition(data?.version === "1.0", "LOGIC_STRUCTURE_FAIL", "Unsupported version");
  requireCondition(data?.module_id === "issue-tree", "LOGIC_STRUCTURE_FAIL", "Expected issue-tree module");
  requireCondition(["analysis", "decision"].includes(data.audience_mode), "LOGIC_STRUCTURE_FAIL", "Unsupported audience mode");
  requireCondition(data?.diagram?.type === "issue-tree", "LOGIC_STRUCTURE_FAIL", "Expected issue-tree diagram");
  const anchors = buildAnchorMap(data.source_anchors);
  validateTitle(data.title, anchors);
  validateVisibleText(data.diagram.root, anchors, "Root issue");
  requireCondition(
    Array.isArray(data.diagram.branches) && data.diagram.branches.length >= 2 && data.diagram.branches.length <= 3,
    "LOGIC_STRUCTURE_FAIL",
    "Issue tree requires two or three top-level branches",
  );

  const ids = new Set([data.diagram.root.id]);
  const mapped = new Set([...(data.title.source_ids ?? []), ...(data.diagram.root.source_ids ?? [])]);
  for (const branch of data.diagram.branches) {
    requireCondition(typeof branch.id === "string" && !ids.has(branch.id), "LOGIC_STRUCTURE_FAIL", "Branch ids must be unique");
    ids.add(branch.id);
    validateVisibleText(branch, anchors, `Branch ${branch.id}`);
    (branch.source_ids ?? []).forEach((id) => mapped.add(id));
    requireCondition(
      Array.isArray(branch.children) && branch.children.length >= 1 && branch.children.length <= 3,
      "LOGIC_STRUCTURE_FAIL",
      `Branch ${branch.id} requires one to three child issues`,
    );
    for (const child of branch.children) {
      requireCondition(typeof child.id === "string" && !ids.has(child.id), "LOGIC_STRUCTURE_FAIL", "Child ids must be unique");
      ids.add(child.id);
      validateVisibleText(child, anchors, `Child ${child.id}`);
      (child.source_ids ?? []).forEach((id) => mapped.add(id));
      if (child.verification) {
        validateVisibleText(child.verification, anchors, `Verification ${child.id}`);
        (child.verification.source_ids ?? []).forEach((id) => mapped.add(id));
      }
      if (child.status && child.status !== "neutral") {
        requireCondition(
          Array.isArray(child.status_source_ids) && child.status_source_ids.length > 0,
          "SOURCE_FIDELITY_FAIL",
          `Status for ${child.id} requires source evidence`,
        );
        child.status_source_ids.forEach((id) => mapped.add(id));
      }
    }
  }
  for (const insight of data.diagram.so_what ?? []) {
    validateVisibleText(insight, anchors, "So what insight");
    (insight.source_ids ?? []).forEach((id) => mapped.add(id));
  }
  if (data.diagram.mece === true) {
    requireCondition(
      Array.isArray(data.diagram.mece_source_ids) && data.diagram.mece_source_ids.length > 0,
      "SOURCE_FIDELITY_FAIL",
      "MECE may only be claimed with explicit source evidence",
    );
    data.diagram.mece_source_ids.forEach((id) => mapped.add(id));
  }
  return { ok: true, ...validateAllAnchorsMapped(data.source_anchors, mapped) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  try {
    if (!inputPath) throw new Error("Usage: validate_issue_tree.mjs <input.json>");
    const data = JSON.parse(await fs.readFile(inputPath, "utf8"));
    process.stdout.write(`${JSON.stringify(validateIssueTree(data))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "LOGIC_STRUCTURE_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  }
}
