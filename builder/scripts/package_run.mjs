import fs from "node:fs/promises";
import path from "node:path";
import { validateLogicStructure } from "./validate_logic_structure.mjs";

const CONTAMINATION_PATTERN =
  /(?:^|[_\-\s])(qa|mapping|internal|test|prompt|review|待审)(?:[_\-\s.]|$)/iu;

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function mappingTargets(data, sourceId) {
  const targets = [];
  if (data.title.source_ids.includes(sourceId)) {
    targets.push(`title:${data.title.text}`);
  }
  for (const node of data.diagram.nodes) {
    if (node.source_ids.includes(sourceId)) {
      targets.push(`node:${node.id}:${node.text}`);
    }
  }
  for (const edge of data.diagram.edges) {
    if (edge.source_ids.includes(sourceId)) {
      targets.push(`edge:${edge.from}->${edge.to}:${edge.relation}`);
    }
  }
  return targets;
}

function sourceBaseline(data) {
  const lines = ["# Source baseline", ""];
  for (const anchor of data.source_anchors) {
    lines.push(`## ${anchor.id}`, "", anchor.text, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function contentMapping(data, customerFileName) {
  const header = [
    "原文锚点",
    "原文内容",
    "目标文件",
    "目标页/字段",
    "正文或备注",
    "处理动作",
    "差异理由",
    "审核结果",
  ];
  const rows = [header.map(csvCell).join(",")];
  for (const anchor of data.source_anchors) {
    for (const target of mappingTargets(data, anchor.id)) {
      rows.push(
        [
          anchor.id,
          anchor.text,
          customerFileName,
          `第1页/${target}`,
          "正文",
          "拆分保留",
          "仅拆分为标题、节点或关系，未改写原文",
          "待视觉与人工复核",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return `${rows.join("\n")}\n`;
}

function qaReport() {
  return `# QA report

BASIC_OUTPUT_PASS: not_tested
SOURCE_BASELINE_PASS: not_tested
CONTENT_MAPPING_PASS: not_tested
BODY_NOTES_ALLOCATION_PASS: not_tested
RENDERED_READABILITY_PASS: not_tested
REQUIREMENT_COVERAGE_PASS: not_tested
PRODUCT_VALUE_PASS: not_tested
USER_REQUIREMENT_PASS: not_tested
`;
}

export async function packageRun(options) {
  const required = [
    "structurePath",
    "pptxPath",
    "previewPath",
    "layoutPath",
    "runRoot",
    "customerFileName",
  ];
  for (const key of required) {
    if (!options[key]) {
      throw new Error(`PACKAGE_INPUT_FAIL: missing ${key}`);
    }
  }
  if (
    path.basename(options.customerFileName) !== options.customerFileName ||
    path.extname(options.customerFileName).toLowerCase() !== ".pptx" ||
    CONTAMINATION_PATTERN.test(options.customerFileName)
  ) {
    throw new Error(
      "CUSTOMER_PACKAGE_CONTAMINATION: customer filename contains an internal label or invalid path",
    );
  }

  const data = JSON.parse(await fs.readFile(options.structurePath, "utf8"));
  validateLogicStructure(data);
  await Promise.all([
    fs.access(options.pptxPath),
    fs.access(options.previewPath),
    fs.readFile(options.layoutPath, "utf8"),
  ]);

  const customerDir = path.join(options.runRoot, "customer");
  const internalDir = path.join(options.runRoot, "internal");
  const customerPath = path.join(customerDir, options.customerFileName);
  await fs.mkdir(customerDir, { recursive: true });
  await fs.mkdir(internalDir, { recursive: true });

  try {
    await fs.copyFile(options.pptxPath, customerPath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`CUSTOMER_OUTPUT_EXISTS: ${customerPath}`);
    }
    throw error;
  }

  await Promise.all([
    fs.writeFile(
      path.join(internalDir, "source-baseline.md"),
      sourceBaseline(data),
      { flag: "wx" },
    ),
    fs.writeFile(
      path.join(internalDir, "content-mapping.csv"),
      contentMapping(data, options.customerFileName),
      { flag: "wx" },
    ),
    fs.copyFile(
      options.structurePath,
      path.join(internalDir, "logic-structure.json"),
      fs.constants.COPYFILE_EXCL,
    ),
    fs.copyFile(
      options.previewPath,
      path.join(internalDir, "render-preview.png"),
      fs.constants.COPYFILE_EXCL,
    ),
    fs.writeFile(path.join(internalDir, "qa-report.md"), qaReport(), {
      flag: "wx",
    }),
  ]);

  return { customerDir, internalDir, customerPath };
}
