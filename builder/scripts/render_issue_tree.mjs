import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planIssueTree } from "./plan_issue_tree.mjs";
import {
  COLORS,
  addNode,
  addTextBox,
  connectNative,
  createPresentation,
  exportPresentation,
  fitPageTitleFontSize,
  parseCliArgs,
  toArtifactFontSize,
} from "./pptx_core.mjs";

function childColors(status) {
  if (status === "core") return { fill: COLORS.orangeLight, border: COLORS.orange, borderWidth: 2.2 };
  if (status === "excluded") return { fill: COLORS.soft, border: COLORS.line, borderWidth: 1.2, borderStyle: "dashed" };
  return { fill: COLORS.white, border: COLORS.border, borderWidth: 1.4 };
}

export async function renderIssueTree(data, output) {
  const plan = planIssueTree(data);
  const { presentation, slide } = createPresentation(output.background);
  addTextBox(slide, { name: "page-title", text: plan.title.text, position: plan.title, fontSize: fitPageTitleFontSize(plan.title.text), bold: true });

  const root = addNode(slide, {
    name: `root-${plan.root.id}`,
    text: "",
    position: plan.root,
    fill: COLORS.navy,
    border: COLORS.navy,
    color: COLORS.white,
    bold: true,
    fontSize: 18,
  });
  const branchShapes = new Map();
  for (const branch of plan.branches) {
    branchShapes.set(
      branch.id,
      addNode(slide, {
        name: `branch-${branch.id}`,
        text: "",
        position: branch,
        fill: COLORS.blueLight,
        border: COLORS.blue,
        bold: true,
        fontSize: 18,
      }),
    );
  }
  const childShapes = new Map();
  for (const child of plan.children) {
    childShapes.set(
      child.id,
      addNode(slide, {
        name: `child-${child.id}`,
        text: "",
        position: child,
        ...childColors(child.status),
        fontSize: 16,
      }),
    );
  }
  for (const branch of plan.branches) {
    connectNative(slide, root, branchShapes.get(branch.id), {
      kind: "elbow",
      fromSide: "right",
      toSide: "left",
      arrow: false,
      line: { style: "solid", fill: COLORS.line, width: 1.8 },
    });
  }
  for (const child of plan.children) {
    connectNative(slide, branchShapes.get(child.branch_id), childShapes.get(child.id), {
      kind: "elbow",
      fromSide: "right",
      toSide: "left",
      arrow: false,
      line: { style: "solid", fill: COLORS.line, width: 1.5 },
    });
  }

  root.text = plan.root.text;
  root.text.style = { fontSize: toArtifactFontSize(18), bold: true, color: COLORS.white, alignment: "center" };
  root.text.verticalAlignment = "middle";
  for (const branch of plan.branches) {
    const shape = branchShapes.get(branch.id);
    shape.text = branch.text;
    shape.text.style = { fontSize: toArtifactFontSize(18), bold: true, color: COLORS.text, alignment: "center" };
    shape.text.verticalAlignment = "middle";
  }
  for (const child of plan.children) {
    const shape = childShapes.get(child.id);
    const suffix = child.verification ? `\n${child.verification.text}` : "";
    shape.text = `${child.text}${suffix}`;
    shape.text.style = { fontSize: toArtifactFontSize(16), bold: child.status === "core", color: child.status === "excluded" ? COLORS.muted : COLORS.text, alignment: "left" };
    shape.text.verticalAlignment = "middle";
  }
  if (plan.insightRail) {
    slide.shapes.add({
      name: "so-what-rail",
      geometry: "rect",
      position: plan.insightRail,
      fill: COLORS.soft,
      line: { style: "solid", fill: COLORS.border, width: 1 },
    });
    addTextBox(slide, {
      name: "so-what-title",
      text: "So What",
      position: { left: plan.insightRail.left + 22, top: plan.insightRail.top + 14, width: plan.insightRail.width - 44, height: 28 },
      fontSize: 16,
      bold: true,
      color: COLORS.blue,
    });
    plan.insights.forEach((insight, index) => {
      addTextBox(slide, {
        name: `insight-${index + 1}`,
        text: insight.text,
        position: insight,
        fontSize: 16,
        bold: false,
      });
    });
  }
  await exportPresentation(presentation, output);
  return plan;
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const data = JSON.parse(await fs.readFile(options.input, "utf8"));
  const plan = await renderIssueTree(data, options);
  process.stdout.write(`${JSON.stringify({ ok: true, module: "issue-tree", branches: plan.branches.length, children: plan.children.length })}\n`);
}

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ code: error.code ?? "RENDER_FAIL", message: error.message })}\n`);
    process.exitCode = 1;
  });
}
