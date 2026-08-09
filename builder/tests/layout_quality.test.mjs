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

function element(name, text, lines, bbox, properties = {}) {
  return {
    scope: "slide",
    name,
    text,
    bbox,
    textLayout: { lineCount: lines.length, lines: lines.map((value, index) => ({ index: index + 1, text: value })) },
    ...properties,
  };
}

test("blocks an empty dark band across the top of the slide", () => {
  const result = auditLayoutObject(layout([
    element("top-band", "", [], [0, 0, 1280, 24], { geometry: "rect", fillColor: "172B4D" }),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "DECORATIVE_TOP_BAND_BLOCKED"));
});

test("blocks eyebrow copy and title accents even when they contain text", () => {
  const result = auditLayoutObject(layout([
    element("title-eyebrow", "STRATEGY", ["STRATEGY"], [54, 10, 180, 18]),
    element("heading-rule", "", [], [54, 90, 120, 3]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "EYEBROW_BLOCKED"));
  assert.ok(result.findings.some((item) => item.code === "DECORATIVE_ELEMENT_BLOCKED" && item.name === "heading-rule"));
});

test("accepts a structural band when it contains reader-facing information", () => {
  const result = auditLayoutObject(layout([
    element("bottom-strip", "", [], [54, 580, 1172, 64]),
    element("bottom-strip-label", "下一步：验证三个关键假设", ["下一步：验证三个关键假设"], [72, 596, 420, 24]),
  ]));
  assert.equal(result.ok, true);
});

test("blocks short labels, orphan lines and split provenance tokens", () => {
  const result = auditLayoutObject(layout([
    element("number", "01", ["0", "1"], [60, 120, 20, 28]),
    element("action", "模型建议，待确认", ["模型建议，待确", "认"], [80, 590, 160, 24]),
    element("provenance", "SYNTHETIC_GENERATED", ["SYNTHETIC_G", "ENERATED"], [900, 590, 150, 28]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "SHORT_LABEL_WRAP"));
  assert.ok(result.findings.some((item) => item.code === "ORPHAN_LINE"));
  assert.ok(result.findings.some((item) => item.code === "UNBREAKABLE_TOKEN_WRAP"));
});

test("blocks punctuation or number-unit pairs stranded across lines", () => {
  const result = auditLayoutObject(layout([
    element("insight", "最大驱动，贡献 18", ["最大驱动", "，贡献 18"], [900, 180, 220, 60]),
    element("title", "投入 700 万元", ["投入 700", "万元"], [54, 28, 1172, 70]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "BAD_LINE_START_PUNCTUATION"));
  assert.ok(result.findings.some((item) => item.code === "NUMBER_UNIT_SPLIT"));
});

test("blocks a subtitle stacked below a rendered two-line page title", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "这是一个已经占据两行的长标题", ["这是一个已经占据", "两行的长标题"], [54, 24, 1172, 84]),
    element("PageHeading-subtitle", "不允许继续堆叠的副标题", ["不允许继续堆叠的副标题"], [54, 110, 1172, 28]),
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
    element("PageHeading-title", "T+9 试点路径已明确", ["T+9 试点路径已明确"], [48, 26, 1184, 52]),
    element("MilestoneLabel-0", "T+1 蓝图批准", ["T+1 蓝图批准"], [452, 72, 120, 18]),
    element("DependencyLegend", "实线 必要依赖", ["实线 必要依赖"], [48, 76, 354, 20]),
    element("MainExhibitBoundary", "", [], [48, 104, 1184, 400]),
    element("RiskControlBoundary", "", [], [48, 526, 1184, 68]),
    element("SourceFooter", "来源：用户提供", ["来源：用户提供"], [48, 612, 1184, 20]),
  ]));
  assert.equal(result.ok, false);
  const finding = result.findings.find((item) => item.code === "CONTENT_CROWDS_HEADING_WITH_BOTTOM_SPACE");
  assert.ok(finding);
  assert.ok(finding.intrusion_names.includes("MilestoneLabel-0"));
  assert.ok(finding.intrusion_names.includes("DependencyLegend"));
});

test("accepts content that starts after the heading safe zone", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "项目路径", ["项目路径"], [48, 26, 1184, 52]),
    element("DependencyLegend", "实线 必要依赖", ["实线 必要依赖"], [48, 98, 354, 20]),
    element("MainExhibitBoundary", "", [], [48, 122, 1184, 410]),
    element("RiskControlBoundary", "", [], [48, 548, 1184, 68]),
    element("SourceFooter", "来源：用户提供", ["来源：用户提供"], [48, 640, 1184, 20]),
  ]));
  assert.equal(result.ok, true);
});

test("blocks a 960-style layout stranded on a 1280 canvas", () => {
  const elements = Array.from({ length: 12 }, (_, index) => element(`item-${index}`, "内容", ["内容"], [40 + index * 60, 100 + index * 25, 120, 30]));
  const result = auditLayoutObject(layout(elements));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "CANVAS_WIDTH_UNDERUSED"));
  assert.ok(result.findings.some((item) => item.code === "CANVAS_HEIGHT_UNDERUSED"));
});

test("accepts a full-canvas layout with clean line breaks", () => {
  const elements = Array.from({ length: 12 }, (_, index) => element(`item-${index}`, "完整内容", ["完整内容"], [54 + (index % 4) * 292, 120 + Math.floor(index / 4) * 220, 270, 80]));
  const result = auditLayoutObject(layout(elements));
  assert.deepEqual(result, { ok: true, code: "LAYOUT_QUALITY_PASS", findings: [] });
});
