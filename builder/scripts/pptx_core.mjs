import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";
import {
  FONT_SIZES,
  MIN_BODY_FONT_SIZE,
  MIN_FONT_BY_ROLE,
  MIN_VISIBLE_FONT_SIZE,
  SLIDE,
  fitPageTitleFontSize,
  toArtifactFontSize,
  validateTypography,
} from "./layout_constants.mjs";
import { auditLayoutObject } from "./layout_quality.mjs";

export {
  FONT_SIZES,
  MIN_BODY_FONT_SIZE,
  MIN_FONT_BY_ROLE,
  MIN_VISIBLE_FONT_SIZE,
  SLIDE,
  fitPageTitleFontSize,
  toArtifactFontSize,
  validateTypography,
};
export const DEFAULT_SLIDE_BACKGROUND = "#FFFFFF";
const TEXT_POLICIES = new Map();
const ALIGNMENT_CONTRACTS = [];
const CONTAINMENT_CONTRACTS = [];
export const APPROVED_CONNECTOR_KINDS = Object.freeze([
  "straight",
  "elbow",
  "curved",
]);

export const COLORS = Object.freeze({
  navy: "#15375F",
  blue: "#2F6FB2",
  blueLight: "#E9F1FA",
  orange: "#E8872D",
  orangeLight: "#FFF0E2",
  text: "#172033",
  muted: "#697386",
  line: "#AEB8C6",
  border: "#D7DEE8",
  soft: "#F4F6F8",
  white: "#FFFFFF",
});

export class SlideContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function estimateTextWidth(text, fontSize, bold = false) {
  const fontPixels = toArtifactFontSize(fontSize);
  return Array.from(String(text ?? "")).reduce((sum, character) => {
    if (/\s/u.test(character)) return sum + fontPixels * 0.34;
    if (/[A-Z0-9_]/u.test(character)) return sum + fontPixels * 0.66;
    if (/[a-z]/u.test(character)) return sum + fontPixels * 0.56;
    if (/[.,:;!?'"()–—-]/u.test(character)) return sum + fontPixels * 0.42;
    return sum + fontPixels * 0.88;
  }, 0) * (bold ? 1.04 : 1);
}

export function resolveSlideBackground(requestedBackground) {
  if (
    typeof requestedBackground !== "string" ||
    requestedBackground.trim() === ""
  ) {
    return DEFAULT_SLIDE_BACKGROUND;
  }
  return requestedBackground.trim();
}

export function validateLineContract({
  kind,
  segmentCount = 1,
  role = "relationship",
}) {
  if (!APPROVED_CONNECTOR_KINDS.includes(kind)) {
    throw new SlideContractError(
      "NONSTANDARD_CONNECTOR_BLOCKED",
      `Connector kind is not approved: ${kind}`,
    );
  }
  if (segmentCount !== 1) {
    throw new SlideContractError(
      "MULTI_SEGMENT_LINE_BLOCKED",
      "A route must use one native connector instead of joined line segments",
    );
  }
  if (role !== "relationship" && role !== "leader") {
    throw new SlideContractError(
      "LINE_ROLE_BLOCKED",
      `Unsupported line role: ${role}`,
    );
  }
  return { kind, segmentCount, role };
}

export function connectNative(
  slide,
  fromShape,
  toShape,
  {
    kind = "straight",
    role = "relationship",
    segmentCount = 1,
    fromSide,
    toSide,
    line = { style: "solid", fill: COLORS.muted, width: 2 },
    arrow = role === "relationship",
    placement = role === "leader" ? "front" : "back",
  } = {},
) {
  validateLineContract({ kind, segmentCount, role });
  const connector = slide.shapes.connect(fromShape, toShape, {
    kind,
    fromSide,
    toSide,
    line,
    ...(arrow ? { tail: { type: "triangle", width: "med", length: "med" } } : {}),
  });
  if (placement === "front") connector.bringToFront();
  else if (placement === "back") connector.sendToBack();
  else if (placement !== "natural") {
    throw new SlideContractError("LINE_LAYER_FAIL", `Unsupported connector placement: ${placement}`);
  }
  return connector;
}

export function addChartLine(
  slide,
  {
    name,
    from,
    to,
    line = { style: "solid", fill: COLORS.line, width: 1 },
  },
) {
  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  const verticalFlip = (to.x - from.x) * (to.y - from.y) < 0;
  return slide.shapes.add({
    name,
    geometry: "line",
    position: { left, top, width, height, ...(verticalFlip ? { verticalFlip: true } : {}) },
    fill: "none",
    line,
  });
}

export function normalizePresentationZOrder(presentation) {
  const proto = presentation.toProto();
  for (const slide of proto.slides ?? []) {
    slide.elements = [...(slide.elements ?? [])].sort(
      (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0),
    );
  }
  return Presentation.load(proto);
}

export function addTextBox(
  slide,
  {
    name,
    text,
    position,
    textRole = "body",
    fontSize = FONT_SIZES[textRole],
    bold = false,
    color = COLORS.text,
    alignment = "left",
    verticalAlignment = "middle",
    fill = "none",
    line = { style: "solid", fill: "none", width: 0 },
    geometry = "textbox",
    insets = { left: 4, right: 4, top: 2, bottom: 2 },
    singleLine = false,
    maxLines,
    minLastLineChars = 2,
  },
) {
  validateTypography(textRole, fontSize);
  const visibleText = String(text ?? "").replace(/\s*｜\s*|\s+\|\s+/g, "\n");
  if (singleLine && visibleText.includes("\n")) {
    throw new SlideContractError("SINGLE_LINE_TEXT_FAIL", `${name} contains an explicit line break`);
  }
  if (singleLine) {
    const estimatedWidth = estimateTextWidth(visibleText, fontSize, bold);
    const availableWidth = position.width - (insets.left ?? 0) - (insets.right ?? 0);
    if (estimatedWidth > availableWidth) {
      throw new SlideContractError("SINGLE_LINE_FIT_FAIL", `${name} needs about ${Math.ceil(estimatedWidth)} px but only ${Math.floor(availableWidth)} px is available`);
    }
  }
  const shape = slide.shapes.add({ name, geometry, position, fill, line });
  shape.text = visibleText;
  shape.text.style = { fontSize: toArtifactFontSize(fontSize), bold, color, alignment };
  shape.text.verticalAlignment = verticalAlignment;
  shape.text.insets = insets;
  shape.text.wrap = singleLine ? "none" : "square";
  shape.text.autoFit = "none";
  TEXT_POLICIES.set(name, { singleLine, maxLines, minLastLineChars, textRole });
  return shape;
}

export function addPageHeading(
  slide,
  {
    name = "PageHeading",
    title,
    subtitle,
    position,
    titleFontSize = fitPageTitleFontSize(title),
    titleColor = COLORS.text,
    subtitleColor = COLORS.muted,
  },
) {
  if (!title || !position?.width) {
    throw new SlideContractError("PAGE_HEADING_INPUT_FAIL", "addPageHeading requires title and position.width");
  }
  if (String(title).includes("\n")) {
    throw new SlideContractError("PAGE_TITLE_MANUAL_BREAK", "Page titles must not contain manual line breaks");
  }
  const availableWidth = position.width - 8;
  const titleMayWrap = estimateTextWidth(title, titleFontSize, true) > availableWidth;
  const titleHeight = 52;
  const titleShape = addTextBox(slide, {
    name: name + "-title",
    text: title,
    textRole: "pageTitle",
    position: { left: position.left, top: position.top, width: position.width, height: titleHeight },
    fontSize: titleFontSize,
    bold: true,
    color: titleColor,
    alignment: "left",
    maxLines: 2,
    minLastLineChars: 6,
  });
  let subtitleShape = null;
  if (subtitle) {
    subtitleShape = addTextBox(slide, {
      name: name + "-subtitle",
      text: subtitle,
      textRole: "pageSubtitle",
      position: { left: position.left, top: position.top + titleHeight + 2, width: position.width, height: 28 },
      fontSize: FONT_SIZES.pageSubtitle,
      color: subtitleColor,
      alignment: "left",
      maxLines: 1,
    });
  }
  return { titleShape, subtitleShape, titleMayWrap };
}

export function registerEdgeAlignment({ name, edge, members, tolerance = 2 }) {
  if (!name || !["left", "right"].includes(edge) || !Array.isArray(members) || members.length < 2) {
    throw new SlideContractError("ALIGNMENT_CONTRACT_INPUT_FAIL", "Edge alignment requires a name, left/right edge, and at least two member names");
  }
  ALIGNMENT_CONTRACTS.push({ name, edge, members: [...members], tolerance });
}

export function registerContainment({ name, parent, members, tolerance = 2 }) {
  if (!name || !parent || !Array.isArray(members) || members.length < 1) {
    throw new SlideContractError("CONTAINMENT_CONTRACT_INPUT_FAIL", "Containment requires a name, parent, and at least one member name");
  }
  CONTAINMENT_CONTRACTS.push({ name, parent, members: [...members], tolerance });
}

export function addNode(
  slide,
  {
    name,
    text,
    position,
    fill = COLORS.white,
    border = COLORS.border,
    borderWidth = 1.5,
    borderStyle = "solid",
    fontSize = 18,
    bold = false,
    color = COLORS.text,
    alignment = "center",
    geometry = "rect",
  },
) {
  return addTextBox(slide, {
    name,
    text,
    position,
    fontSize,
    bold,
    color,
    alignment,
    fill,
    line: { style: borderStyle, fill: border, width: borderWidth },
    geometry,
  });
}

export function addContainer(
  slide,
  {
    name,
    position,
    fill = COLORS.white,
    border = COLORS.border,
    borderWidth = 1,
  },
) {
  return slide.shapes.add({
    name,
    geometry: "rect",
    position,
    fill,
    line: { style: "solid", fill: border, width: borderWidth },
  });
}

export function addDataBar(slide, { name, position, fill = COLORS.blue, border = fill }) {
  return slide.shapes.add({
    name,
    geometry: "rect",
    position,
    fill,
    line: { style: "solid", fill: border, width: 0 },
  });
}

export function addChartColumn(slide, options) {
  return addDataBar(slide, options);
}

export function addTableCell(
  slide,
  {
    name,
    text,
    position,
    fill = COLORS.white,
    border = COLORS.border,
    fontSize = FONT_SIZES.body,
    bold = false,
    color = COLORS.text,
    alignment = "left",
  },
) {
  return addTextBox(slide, {
    name,
    text,
    position,
    fontSize,
    bold,
    color,
    alignment,
    fill,
    line: { style: "solid", fill: border, width: 0.8 },
    geometry: "rect",
  });
}

export function addStatusTag(
  slide,
  {
    name,
    text,
    position,
    fill = COLORS.soft,
    border = COLORS.border,
    fontSize = FONT_SIZES.body,
    bold = true,
    color = COLORS.text,
  },
) {
  return addTextBox(slide, {
    name,
    text,
    position,
    fontSize,
    bold,
    color,
    alignment: "center",
    fill,
    line: { style: "solid", fill: border, width: 0.8 },
    geometry: "roundRect",
    singleLine: true,
  });
}

export function addIndexBadge(
  slide,
  {
    name,
    text,
    position,
    fill = "none",
    border = "none",
    fontSize = FONT_SIZES.body,
    color = COLORS.blue,
  },
) {
  return addTextBox(slide, {
    name,
    text,
    position,
    fontSize,
    bold: true,
    color,
    alignment: "center",
    fill,
    line: { style: "solid", fill: border, width: 0 },
    singleLine: true,
    insets: { left: 1, right: 1, top: 1, bottom: 1 },
  });
}

export function addActionBand(
  slide,
  {
    name,
    position,
    label,
    copy,
    labelWidth = 190,
    fill = COLORS.blueLight,
    border = COLORS.border,
    labelColor = COLORS.blue,
    copyColor = COLORS.navy,
    labelFontSize = FONT_SIZES.body,
    copyFontSize = FONT_SIZES.body,
  },
) {
  if (labelWidth < 120 || labelWidth > position.width * 0.35) {
    throw new SlideContractError("ACTION_BAND_GEOMETRY_FAIL", "Action label width must be 120 px to 35% of the band width");
  }
  const frame = addContainer(slide, { name: `${name}-frame`, position, fill, border });
  const padding = 14;
  const labelShape = addTextBox(slide, {
    name: `${name}-label`,
    text: label,
    position: { left: position.left + padding, top: position.top + 6, width: labelWidth - padding, height: position.height - 12 },
    fontSize: labelFontSize,
    bold: true,
    color: labelColor,
    singleLine: true,
  });
  const copyShape = addTextBox(slide, {
    name: `${name}-copy`,
    text: copy,
    position: { left: position.left + labelWidth, top: position.top + 6, width: position.width - labelWidth - padding, height: position.height - 12 },
    fontSize: copyFontSize,
    bold: true,
    color: copyColor,
    maxLines: 2,
    minLastLineChars: 4,
  });
  return { frame, labelShape, copyShape };
}

export function addFieldGroup(
  slide,
  {
    name,
    fields,
    position,
    gap = 8,
    fill = "none",
    border = "none",
    fontSize = FONT_SIZES.body,
    color = COLORS.text,
    labelColor = COLORS.muted,
  },
) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new SlideContractError("FIELD_GROUP_FAIL", "addFieldGroup requires at least one field");
  }
  const width = (position.width - gap * (fields.length - 1)) / fields.length;
  return fields.map((field, index) => {
    const left = position.left + index * (width + gap);
    const labelHeight = field.label ? Math.min(22, position.height * 0.35) : 0;
    const shapes = [];
    if (field.label) {
      shapes.push(addTextBox(slide, {
        name: `${name}-${index + 1}-label`,
        text: field.label,
        position: { left, top: position.top, width, height: labelHeight },
        fontSize,
        bold: false,
        color: labelColor,
        alignment: field.alignment ?? "left",
        fill,
        line: { style: "solid", fill: border, width: 0 },
      }));
    }
    shapes.push(addTextBox(slide, {
      name: `${name}-${index + 1}-value`,
      text: String(field.value ?? ""),
      position: { left, top: position.top + labelHeight, width, height: position.height - labelHeight },
      fontSize: field.fontSize ?? fontSize,
      bold: field.bold ?? true,
      color: field.color ?? color,
      alignment: field.alignment ?? "left",
      fill,
      line: { style: "solid", fill: border, width: 0 },
    }));
    return shapes;
  });
}

async function ensureParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeBlob(filePath, blob) {
  await ensureParent(filePath);
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

export async function exportPresentation(presentation, output) {
  if (!output?.pptx?.endsWith(".pptx") || !output?.preview?.endsWith(".png") || !output?.layout?.endsWith(".json")) {
    throw new SlideContractError("OUTPUT_CONTRACT_FAIL", "pptx, preview, and layout outputs must end in .pptx, .png, and .json");
  }
  const orderedPresentation = normalizePresentationZOrder(presentation);
  const slide = orderedPresentation.slides.items[0];
  if (!slide) {
    throw new SlideContractError("BASIC_OUTPUT_FAIL", "Presentation has no slide");
  }
  if (output.preview) {
    await writeBlob(
      output.preview,
      await orderedPresentation.export({ slide, format: "png", scale: 1 }),
    );
  }
  const layoutText = await (await slide.export({ format: "layout" })).text();
  await ensureParent(output.layout);
  await fs.writeFile(output.layout, layoutText);
  const layoutAudit = auditLayoutObject(JSON.parse(layoutText), {
    textPolicies: Object.fromEntries(TEXT_POLICIES),
    alignmentContracts: ALIGNMENT_CONTRACTS,
    containmentContracts: CONTAINMENT_CONTRACTS,
  });
  const auditPath = output.layoutAudit ?? `${output.layout}.audit.json`;
  await ensureParent(auditPath);
  await fs.writeFile(auditPath, `${JSON.stringify(layoutAudit, null, 2)}\n`);
  TEXT_POLICIES.clear();
  ALIGNMENT_CONTRACTS.length = 0;
  CONTAINMENT_CONTRACTS.length = 0;
  if (!layoutAudit.ok) {
    throw new SlideContractError("LAYOUT_QUALITY_FAIL", layoutAudit.findings.map((item) => `${item.code}:${item.name ?? "canvas"}`).join(", "));
  }
  await ensureParent(output.pptx);
  const pptx = await PresentationFile.exportPptx(orderedPresentation);
  await pptx.save(output.pptx);
  const generatedInspect = `${output.pptx}.inspect.ndjson`;
  try {
    await fs.access(generatedInspect);
    const inspectPath =
      output.inspect ??
      path.join(
        path.dirname(output.layout ?? output.preview ?? output.pptx),
        `${path.basename(output.pptx)}.inspect.ndjson`,
      );
    await ensureParent(inspectPath);
    if (path.resolve(inspectPath) !== path.resolve(generatedInspect)) {
      await fs.rename(generatedInspect, inspectPath);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return orderedPresentation;
}

export function createPresentation(background) {
  const presentation = Presentation.create({ slideSize: SLIDE });
  const slide = presentation.slides.add();
  slide.background.fill = resolveSlideBackground(background);
  return { presentation, slide };
}

export function parseCliArgs(argv, required = ["input", "pptx", "preview", "layout"]) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new SlideContractError("INPUT_CONTRACT_FAIL", "Expected --key value arguments");
    }
    options[key.slice(2)] = value;
  }
  for (const key of required) {
    if (!options[key]) {
      throw new SlideContractError("INPUT_CONTRACT_FAIL", `Missing required argument --${key}`);
    }
  }
  return options;
}
