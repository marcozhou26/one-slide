#!/usr/bin/env node
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const FOOTER_NAME = /(?:footer|source|page-tag|method-note|footnote|disclosure)/iu;
const HEADING_EXEMPT_NAME = /(?:background|brand|logo)/iu;
const EYEBROW_NAME = /(?:eyebrow|kicker|overline|super[-_ ]?title)/iu;
const TITLE_DECORATION_NAME = /(?:heading[-_ ]?rule|title[-_ ]?accent)/iu;
const GENERIC_DECORATION_NAME = /(?:decorative|decoration|ornament|flourish|filler|spacer)/iu;
const BAND_NAME = /(?:top|header|brand|bottom|footer)[-_ ]?(?:band|strip|rule)/iu;
const MIN_HEADING_CONTENT_GAP = 16;
const BOTTOM_SPACE_SIGNAL = 56;

function chars(value) {
  return Array.from(String(value ?? "").trim());
}

function textLines(element) {
  return Array.isArray(element?.textLayout?.lines)
    ? element.textLayout.lines.map((line) => String(line?.text ?? ""))
    : [];
}

function hasText(element) {
  return String(element?.text ?? "").trim().length > 0;
}

function contains(container, child, tolerance = 2) {
  const [left, top, width, height] = container.bbox;
  const [childLeft, childTop, childWidth, childHeight] = child.bbox;
  return childLeft >= left - tolerance
    && childTop >= top - tolerance
    && childLeft + childWidth <= left + width + tolerance
    && childTop + childHeight <= top + height + tolerance;
}

function informationContributionFindings(elements, width) {
  const findings = [];
  for (const element of elements) {
    const name = String(element.name ?? "");
    const [left, top, elementWidth, elementHeight] = element.bbox;
    const informativeChildren = elements.filter((candidate) => candidate !== element && hasText(candidate) && contains(element, candidate));

    if (EYEBROW_NAME.test(name)) {
      findings.push({ code: "EYEBROW_BLOCKED", name, detail: "Title eyebrows, kickers, overlines, and supertitles are not allowed." });
      continue;
    }
    if (TITLE_DECORATION_NAME.test(name)) {
      findings.push({ code: "DECORATIVE_ELEMENT_BLOCKED", name, detail: "Heading rules and title accents do not carry slide information." });
      continue;
    }
    if (GENERIC_DECORATION_NAME.test(name)) {
      findings.push({ code: "DECORATIVE_ELEMENT_BLOCKED", name, detail: "Aesthetic-only visible elements are not allowed." });
      continue;
    }

    const isWideTopBand = !hasText(element)
      && top <= 48
      && left <= width * 0.1
      && elementWidth >= width * 0.8
      && elementHeight <= 96;
    if (isWideTopBand && informativeChildren.length === 0) {
      findings.push({ code: "DECORATIVE_TOP_BAND_BLOCKED", name, bbox: element.bbox });
      continue;
    }

    if (BAND_NAME.test(name) && !hasText(element) && informativeChildren.length === 0) {
      findings.push({ code: "DECORATIVE_ELEMENT_BLOCKED", name, detail: "An empty band, strip, or rule has no information contribution." });
    }
  }
  return findings;
}

export function auditLayoutObject(layout, { textPolicies = {}, alignmentContracts = [], containmentContracts = [] } = {}) {
  const findings = [];
  const frame = layout?.slide?.frame;
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  if (layout?.unit !== "px" || width !== 1280 || height !== 720) {
    findings.push({ code: "CANVAS_CONTRACT_FAIL", detail: `Expected 1280x720 px, received ${width || "?"}x${height || "?"} ${layout?.unit || "?"}` });
  }

  const elements = (layout?.elements ?? []).filter((element) => element?.scope === "slide" && Array.isArray(element?.bbox));
  findings.push(...informationContributionFindings(elements, width));
  const pageTitles = elements.filter((element) => textPolicies[element.name]?.textRole === "pageTitle" || /(?:pageheading|page|decision)[-_]?title$/iu.test(String(element.name ?? "")));
  const pageSubtitles = elements.filter((element) => String(element.text ?? "").trim() && (textPolicies[element.name]?.textRole === "pageSubtitle" || /(?:pageheading|page|decision)[-_]?subtitle$/iu.test(String(element.name ?? ""))));
  for (const title of pageTitles) {
    if (textLines(title).length >= 2 && pageSubtitles.length > 0) {
      findings.push({ code: "TWO_LINE_TITLE_WITH_SUBTITLE", name: title.name, subtitle_names: pageSubtitles.map((element) => element.name) });
    }
  }

  const headingElements = [...pageTitles, ...pageSubtitles];
  if (headingElements.length > 0) {
    const headingNames = new Set(headingElements.map((element) => element.name));
    const headingBottom = Math.max(...headingElements.map((element) => element.bbox[1] + element.bbox[3]));
    const safeContentTop = headingBottom + MIN_HEADING_CONTENT_GAP;
    const contentElements = elements.filter((element) => (
      !headingNames.has(element.name)
      && !FOOTER_NAME.test(String(element.name ?? ""))
      && !HEADING_EXEMPT_NAME.test(String(element.name ?? ""))
      && element.bbox[2] > 0
      && element.bbox[3] > 0
    ));
    const intrusions = contentElements.filter((element) => element.bbox[1] < safeContentTop);
    if (intrusions.length > 0) {
      const usedBottom = Math.max(...elements.map((element) => element.bbox[1] + element.bbox[3]));
      const bottomSpace = height - usedBottom;
      findings.push({
        code: bottomSpace >= BOTTOM_SPACE_SIGNAL
          ? "CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE"
          : "HEADING_SAFE_ZONE_INTRUSION",
        heading_bottom: headingBottom,
        minimum_content_top: safeContentTop,
        bottom_space: bottomSpace,
        intrusion_names: intrusions.slice(0, 12).map((element) => element.name),
      });
    }
  }
  for (const element of elements) {
    const lines = textLines(element);
    const text = String(element?.text ?? "");
    if (!text || lines.length <= 1 || text.includes("\n")) continue;
    const name = element.name || `element-${element.id || "unknown"}`;
    const policy = textPolicies[name] ?? {};
    const compactLength = chars(text.replace(/\s+/gu, "")).length;
    const lastLineLength = chars(lines.at(-1)?.replace(/\s+/gu, "")).length;
    if (policy.singleLine || compactLength <= 8) {
      findings.push({ code: "SHORT_LABEL_WRAP", name, text, lines });
    }
    if (lastLineLength > 0 && lastLineLength < (policy.minLastLineChars ?? 2)) {
      findings.push({ code: "ORPHAN_LINE", name, text, lines });
    }
    if (/^[A-Z0-9_:+\-/.]+$/u.test(text.trim())) {
      findings.push({ code: "UNBREAKABLE_TOKEN_WRAP", name, text, lines });
    }
    for (let index = 1; index < lines.length; index += 1) {
      const previous = lines[index - 1].trim();
      const current = lines[index].trim();
      if (/^[，。；：、,.!?！？）)】》]/u.test(current)) {
        findings.push({ code: "BAD_LINE_START_PUNCTUATION", name, text, lines, line: index + 1 });
      }
      if (/\d$/u.test(previous) && /^(?:%|％|个|个月|年|月|日|人|万|亿|元|分|项|小时|天)/u.test(current)) {
        findings.push({ code: "NUMBER_UNIT_SPLIT", name, text, lines, line: index + 1 });
      }
    }
    if (Number.isFinite(policy.maxLines) && lines.length > policy.maxLines) {
      findings.push({ code: "MAX_LINES_EXCEEDED", name, text, line_count: lines.length, max_lines: policy.maxLines });
    }
  }

  const main = elements.filter((element) => !FOOTER_NAME.test(String(element.name ?? "")));
  if (main.length >= 12 && width === 1280 && height === 720) {
    const maxRight = Math.max(...main.map((element) => element.bbox[0] + element.bbox[2]));
    const maxBottom = Math.max(...main.map((element) => element.bbox[1] + element.bbox[3]));
    if (maxRight < 1120) findings.push({ code: "CANVAS_WIDTH_UNDERUSED", max_right: maxRight, minimum: 1120 });
    if (maxBottom < 540) findings.push({ code: "CANVAS_HEIGHT_UNDERUSED", max_bottom: maxBottom, minimum: 540 });
  }

  for (const element of elements) {
    const [left, top, elementWidth, elementHeight] = element.bbox;
    if (left < -1 || top < -1 || left + elementWidth > width + 1 || top + elementHeight > height + 1) {
      findings.push({ code: "ELEMENT_OUTSIDE_CANVAS", name: element.name, bbox: element.bbox });
    }
  }

  const byName = new Map(elements.map((element) => [element.name, element]));
  for (const contract of alignmentContracts) {
    const missing = contract.members.filter((name) => !byName.has(name));
    if (missing.length > 0) {
      findings.push({ code: "ALIGNMENT_MEMBER_MISSING", name: contract.name, missing });
      continue;
    }
    const values = contract.members.map((name) => {
      const [left, , elementWidth] = byName.get(name).bbox;
      return contract.edge === "right" ? left + elementWidth : left;
    });
    const spread = Math.max(...values) - Math.min(...values);
    if (spread > (contract.tolerance ?? 2)) {
      findings.push({ code: "EDGE_ALIGNMENT_MISMATCH", name: contract.name, edge: contract.edge, members: contract.members, values, spread, tolerance: contract.tolerance ?? 2 });
    }
  }

  for (const contract of containmentContracts) {
    const parent = byName.get(contract.parent);
    const missing = [contract.parent, ...contract.members].filter((name) => !byName.has(name));
    if (missing.length > 0) {
      findings.push({ code: "CONTAINMENT_MEMBER_MISSING", name: contract.name, missing });
      continue;
    }
    for (const memberName of contract.members) {
      const member = byName.get(memberName);
      if (!contains(parent, member, contract.tolerance ?? 2)) {
        findings.push({
          code: "CONTAINER_OVERFLOW",
          name: contract.name,
          parent: contract.parent,
          member: memberName,
          parent_bbox: parent.bbox,
          member_bbox: member.bbox,
        });
      }
    }
  }

  return { ok: findings.length === 0, code: findings.length ? "LAYOUT_QUALITY_FAIL" : "LAYOUT_QUALITY_PASS", findings };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error("Usage: node scripts/layout_quality.mjs <layout.json>");
  const result = auditLayoutObject(JSON.parse(await fs.readFile(inputPath, "utf8")));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 10;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, code: "LAYOUT_READ_FAIL", findings: [{ detail: error.message }] })}\n`);
    process.exitCode = 10;
  });
}
