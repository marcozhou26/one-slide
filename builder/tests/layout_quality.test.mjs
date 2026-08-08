import test from "node:test";
import assert from "node:assert/strict";
import { auditLayoutObject } from "../scripts/layout_quality.mjs";

function layout(elements) {
  return {
    unit: "px",
    slide: { frame: { left: 0, top: 0, width: 1280, height: 720 } },
    elements,
  };
}

function element(name, text, lines, bbox) {
  return {
    scope: "slide",
    name,
    text,
    bbox,
    textLayout: { lineCount: lines.length, lines: lines.map((value, index) => ({ index: index + 1, text: value })) },
  };
}

test("blocks short labels, orphan lines and split provenance tokens", () => {
  const result = auditLayoutObject(layout([
    element("number", "01", ["0", "1"], [60, 120, 20, 28]),
    element("action", "Model suggestion, pending confirmation", ["Model suggestion, pending confirmation", "recognize"], [80, 590, 160, 24]),
    element("provenance", "SYNTHETIC_GENERATED", ["SYNTHETIC_G", "ENERATED"], [900, 590, 150, 28]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "SHORT_LABEL_WRAP"));
  assert.ok(result.findings.some((item) => item.code === "ORPHAN_LINE"));
  assert.ok(result.findings.some((item) => item.code === "UNBREAKABLE_TOKEN_WRAP"));
});

test("blocks punctuation or number-unit pairs stranded across lines", () => {
  const result = auditLayoutObject(layout([
    element("insight", "The biggest driver, contribution 18", ["maximum drive", ", contribution 18"], [900, 180, 220, 60]),
    element("title", "Invest 700 million", ["Invest 700", "million"], [54, 28, 1172, 70]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "BAD_LINE_START_PUNCTUATION"));
  assert.ok(result.findings.some((item) => item.code === "NUMBER_UNIT_SPLIT"));
});

test("blocks a subtitle stacked below a rendered two-line page title", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "This is a long title that already takes up two lines", ["This is an already occupied", "Two-line long title"], [54, 24, 1172, 84]),
    element("PageHeading-subtitle", "Continuing stacked subtitles are not allowed", ["Continuing stacked subtitles are not allowed"], [54, 110, 1172, 28]),
  ]), {
    textPolicies: {
      "PageHeading-title": { textRole: "pageTitle", maxLines: 2 },
      "PageHeading-subtitle": { textRole: "pageSubtitle", maxLines: 1 },
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "TWO_LINE_TITLE_WITH_SUBTITLE"));
});

test("blocks declared major sections whose right edges do not align", () => {
  const result = auditLayoutObject(layout([
    element("TableRight", "", [], [715, 126, 451, 320]),
    element("ConclusionBand", "", [], [54, 466, 1173, 64]),
  ]), {
    alignmentContracts: [{
      name: "main-right-edge",
      edge: "right",
      members: ["TableRight", "ConclusionBand"],
      tolerance: 2,
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "EDGE_ALIGNMENT_MISMATCH"));
});

test("blocks gantt annotations that crowd the heading while bottom space remains", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "T+9 The pilot path has been clarified", ["T+9 The pilot path has been clarified"], [48, 26, 1184, 52]),
    element("MilestoneLabel-0", "T+1 blueprint approved", ["T+1 blueprint approved"], [452, 72, 120, 18]),
    element("DependencyLegend", "solid line Necessary dependencies", ["solid line Necessary dependencies"], [48, 76, 354, 20]),
    element("MainExhibitBoundary", "", [], [48, 104, 1184, 400]),
    element("RiskControlBoundary", "", [], [48, 526, 1184, 68]),
    element("SourceFooter", "Source: provided by user", ["Source: provided by user"], [48, 612, 1184, 20]),
  ]));
  assert.equal(result.ok, false);
  const finding = result.findings.find((item) => item.code === "CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE");
  assert.ok(finding);
  assert.ok(finding.intrusion_names.includes("MilestoneLabel-0"));
  assert.ok(finding.intrusion_names.includes("DependencyLegend"));
});

test("accepts content that starts after the heading safe zone", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "Project path", ["Project path"], [48, 26, 1184, 52]),
    element("DependencyLegend", "solid line Necessary dependencies", ["solid line Necessary dependencies"], [48, 98, 354, 20]),
    element("MainExhibitBoundary", "", [], [48, 122, 1184, 410]),
    element("RiskControlBoundary", "", [], [48, 548, 1184, 68]),
    element("SourceFooter", "Source: provided by user", ["Source: provided by user"], [48, 640, 1184, 20]),
  ]));
  assert.equal(result.ok, true);
});

test("blocks a 960-style layout stranded on a 1280 canvas", () => {
  const elements = Array.from({ length: 12 }, (_, index) => element(`item-${index}`, "content", ["content"], [40 + index * 60, 100 + index * 25, 120, 30]));
  const result = auditLayoutObject(layout(elements));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "CANVAS_WIDTH_UNDERUSED"));
  assert.ok(result.findings.some((item) => item.code === "CANVAS_HEIGHT_UNDERUSED"));
});

test("accepts a full-canvas layout with clean line breaks", () => {
  const elements = Array.from({ length: 12 }, (_, index) => element(`item-${index}`, "full content", ["full content"], [54 + (index % 4) * 292, 120 + Math.floor(index / 4) * 220, 270, 80]));
  const result = auditLayoutObject(layout(elements));
  assert.deepEqual(result, { ok: true, code: "LAYOUT_QUALITY_PASS", findings: [] });
});
