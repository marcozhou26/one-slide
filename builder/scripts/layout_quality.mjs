#!/usr/bin/env node
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";

const FOOTER_NAME = /(?:footer|source|page-tag|method-note|footnote|disclosure)/iu;
const HEADING_EXEMPT_NAME = /(?:background|brand|logo|heading-rule|title-accent|titleindex|index-badge)/iu;
const MIN_HEADING_CONTENT_GAP = 16;
const BOTTOM_SPACE_SIGNAL = 56;
const LARGE_CONTAINER_AREA = 36000;
const MAX_BODY_GAP = 150;
const CONTAINER_NAME = /(?:panel|frame|container|section|card)/iu;
const TITLE_NAME = /(?:title|heading|header|label)$/iu;
const SUPPORTED_CANVASES = new Map([
  ["1280x720", "presentation_16_9"],
  ["720x1280", "short_video_broll_9_16"],
  ["720x960", "knowledge_graphic_3_4"],
]);

function chars(value) {
  return Array.from(String(value ?? "").trim());
}

function textLines(element) {
  return Array.isArray(element?.textLayout?.lines)
    ? element.textLayout.lines.map((line) => String(line?.text ?? ""))
    : [];
}

function median(values) {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function auditLayoutObject(layout, { textPolicies = {}, alignmentContracts = [], peerGroupContracts = [] } = {}) {
  const findings = [];
  const frame = layout?.slide?.frame;
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const canvasProfile = SUPPORTED_CANVASES.get(`${width}x${height}`);
  if (layout?.unit !== "px" || !canvasProfile) {
    findings.push({ code: "CANVAS_CONTRACT_FAIL", detail: `Expected 1280x720, 720x1280, or 720x960 px, received ${width || "?"}x${height || "?"} ${layout?.unit || "?"}` });
  }

  const elements = (layout?.elements ?? []).filter((element) => element?.scope === "slide" && Array.isArray(element?.bbox));
  const sourceFooters = elements.filter((element) => /(?:data-source-footer|sourcefootnote|footermeta|footertext|^footer(?:-\d+)?$|^text 97$)/iu.test(String(element.name ?? "")) && /^数据来源[：:]/u.test(String(element.text ?? "").trim()));
  if (sourceFooters.length > 0) {
    const footerTop = Math.min(...sourceFooters.map((element) => element.bbox[1]));
    const belowFooter = elements.filter((element) => {
      if (sourceFooters.includes(element) || /Slide Number Placeholder/iu.test(String(element.name ?? ""))) return false;
      return element.bbox[1] >= footerTop && (String(element.text ?? "").trim() || element.bbox[2] * element.bbox[3] >= 6000);
    });
    if (belowFooter.length > 0) findings.push({ code: "CONTENT_BELOW_SOURCE_FOOTER_FAIL", footer_top: footerTop, names: belowFooter.map((element) => element.name) });
  }
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

  const bodyTop = headingElements.length > 0
    ? Math.max(...headingElements.map((element) => element.bbox[1] + element.bbox[3])) + MIN_HEADING_CONTENT_GAP
    : 96;
  const footerElements = elements.filter((element) => FOOTER_NAME.test(String(element.name ?? "")));
  const bodyBottom = footerElements.length > 0
    ? Math.min(...footerElements.map((element) => element.bbox[1])) - 12
    : height - 60;
  const bodyElements = elements.filter((element) => {
    const name = String(element.name ?? "");
    if (headingElements.includes(element) || FOOTER_NAME.test(name) || HEADING_EXEMPT_NAME.test(name)) return false;
    const [, top, elementWidth, elementHeight] = element.bbox;
    return elementWidth > 0 && elementHeight > 0 && top + elementHeight > bodyTop && top < bodyBottom;
  });

  for (const container of bodyElements.filter((element) => {
    const [, , elementWidth, elementHeight] = element.bbox;
    return !String(element.text ?? "").trim() && CONTAINER_NAME.test(String(element.name ?? "")) && elementWidth * elementHeight >= LARGE_CONTAINER_AREA;
  })) {
    const [left, top, containerWidth, containerHeight] = container.bbox;
    const right = left + containerWidth;
    const bottom = top + containerHeight;
    const meaningful = bodyElements.filter((element) => {
      if (element === container) return false;
      const [childLeft, childTop, childWidth, childHeight] = element.bbox;
      const childCenterX = childLeft + childWidth / 2;
      const childCenterY = childTop + childHeight / 2;
      return childCenterX >= left && childCenterX <= right && childCenterY >= top && childCenterY <= bottom
        && (String(element.text ?? "").trim() || !CONTAINER_NAME.test(String(element.name ?? "")));
    });
    const textBearing = meaningful.filter((element) => String(element.text ?? "").trim());
    if (meaningful.length === 0 || (textBearing.length === 1 && TITLE_NAME.test(String(textBearing[0].name ?? "")) && meaningful.length <= 2)) {
      findings.push({ code: "EMPTY_CONTENT_CONTAINER_FAIL", name: container.name, bbox: container.bbox, contained_names: meaningful.map((element) => element.name) });
    }
  }

  const meaningfulBody = bodyElements.filter((element) => {
    const [,, elementWidth, elementHeight] = element.bbox;
    return String(element.text ?? "").trim()
      || !CONTAINER_NAME.test(String(element.name ?? ""))
      || elementWidth * elementHeight < LARGE_CONTAINER_AREA;
  });
  if (peerGroupContracts.length === 0 && meaningfulBody.length >= 12 && bodyBottom > bodyTop) {
    const intervals = meaningfulBody
      .map((element) => [Math.max(bodyTop, element.bbox[1]), Math.min(bodyBottom, element.bbox[1] + element.bbox[3])])
      .filter(([top, bottom]) => bottom > top)
      .sort((left, right) => left[0] - right[0]);
    const merged = [];
    for (const interval of intervals) {
      const last = merged.at(-1);
      if (!last || interval[0] > last[1] + 2) merged.push([...interval]);
      else last[1] = Math.max(last[1], interval[1]);
    }
    const gaps = [];
    let cursor = bodyTop;
    for (const [top, bottom] of merged) {
      if (top > cursor) gaps.push({ top: cursor, bottom: top, size: top - cursor });
      cursor = Math.max(cursor, bottom);
    }
    if (bodyBottom > cursor) gaps.push({ top: cursor, bottom: bodyBottom, size: bodyBottom - cursor });
    const largestGap = gaps.sort((left, right) => right.size - left.size)[0];
    if (largestGap?.size > MAX_BODY_GAP) findings.push({ code: "VISUAL_BALANCE_FAIL", largest_gap: largestGap, maximum_gap: MAX_BODY_GAP, body_range: [bodyTop, bodyBottom] });
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
    if (peerGroupContracts.length === 0 && maxBottom < 540) findings.push({ code: "CANVAS_HEIGHT_UNDERUSED", max_bottom: maxBottom, minimum: 540 });
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

  for (const contract of peerGroupContracts) {
    const heading = byName.get(contract.headingName);
    const memberNames = contract.rows.flat();
    const missing = [contract.headingName, ...memberNames].filter((name) => !byName.has(name));
    if (missing.length > 0) {
      findings.push({ code: "PEER_GROUP_MEMBER_MISSING", name: contract.name, missing });
      continue;
    }
    const rowBoxes = contract.rows.map((row) => {
      const members = row.map((name) => byName.get(name));
      const top = Math.min(...members.map((element) => element.bbox[1]));
      const bottom = Math.max(...members.map((element) => element.bbox[1] + element.bbox[3]));
      return { top, bottom };
    }).sort((left, right) => left.top - right.top);
    const groupTop = rowBoxes[0].top;
    const groupBottom = rowBoxes.at(-1).bottom;
    const groupCenter = (groupTop + groupBottom) / 2;
    const peerGaps = rowBoxes.slice(1).map((row, index) => row.top - rowBoxes[index].bottom);
    const typicalPeerGap = median(peerGaps);
    const headingBottom = heading.bbox[1] + heading.bbox[3];
    const headingGap = groupTop - headingBottom;
    if (headingGap < typicalPeerGap * (contract.minimumHeadingGapRatio ?? 1.35)) {
      findings.push({ code: "PEER_GROUP_COHESION_FAIL", name: contract.name, heading_gap: headingGap, peer_gap: typicalPeerGap, minimum_ratio: contract.minimumHeadingGapRatio ?? 1.35 });
    }
    if (contract.sparse && typicalPeerGap > (contract.maximumSparseGap ?? 28)) {
      findings.push({ code: "SPARSE_GROUP_OVERDISTRIBUTED", name: contract.name, peer_gap: typicalPeerGap, maximum: contract.maximumSparseGap ?? 28 });
    }
    const [minimumCenter, maximumCenter] = contract.centerRange ?? [height * 0.5, height * 0.6];
    if (groupCenter < minimumCenter) {
      findings.push({ code: "CONTENT_GROUP_TOO_HIGH", name: contract.name, group_center: groupCenter, minimum: minimumCenter });
    } else if (groupCenter > maximumCenter) {
      findings.push({ code: "CONTENT_GROUP_TOO_LOW", name: contract.name, group_center: groupCenter, maximum: maximumCenter });
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
