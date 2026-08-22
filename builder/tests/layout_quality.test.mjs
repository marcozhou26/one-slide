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

test("blocks a large container left with only its heading after content removal", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "客户价值", ["客户价值"], [54, 28, 1172, 52]),
    element("EvidencePanel", "", [], [54, 120, 1172, 260]),
    element("EvidencePanelTitle", "关键发现", ["关键发现"], [74, 136, 220, 28]),
    ...Array.from({ length: 10 }, (_, index) => element(`metric-${index}`, "证据", ["证据"], [60 + index * 110, 430, 90, 40])),
    element("SourceFooter", "数据来源：案例数据", ["数据来源：案例数据"], [54, 650, 1172, 20]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "EMPTY_CONTENT_CONTAINER_FAIL"));
});

test("blocks a large uninterrupted blank band even when a low object masks max-bottom checks", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "客户价值", ["客户价值"], [54, 28, 1172, 52]),
    ...Array.from({ length: 12 }, (_, index) => element(`metric-${index}`, "证据", ["证据"], [54 + (index % 4) * 292, 120 + Math.floor(index / 4) * 55, 270, 36])),
    element("LowAction", "下一步", ["下一步"], [54, 590, 1172, 30]),
    element("SourceFooter", "数据来源：案例数据", ["数据来源：案例数据"], [54, 650, 1172, 20]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "VISUAL_BALANCE_FAIL"));
});

test("blocks visible content below the data-source footer", () => {
  const result = auditLayoutObject(layout([
    element("PageHeading-title", "客户价值", ["客户价值"], [54, 28, 1172, 52]),
    ...Array.from({ length: 12 }, (_, index) => element(`metric-${index}`, "证据", ["证据"], [54 + (index % 4) * 292, 120 + Math.floor(index / 4) * 100, 270, 70])),
    element("data-source-footer", "数据来源：案例数据", ["数据来源：案例数据"], [54, 650, 1172, 20]),
    element("StrayConclusion", "判断仍留在页底", ["判断仍留在页底"], [54, 680, 800, 20]),
  ]));
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "CONTENT_BELOW_SOURCE_FOOTER_FAIL"));
});

const peerGroupPolicy = {
  textPolicies: { title: { textRole: "pageTitle", maxLines: 1 } },
  peerGroupContracts: [{
    name: "overview_items",
    headingName: "title",
    rows: [["row-1"], ["row-2"], ["row-3"]],
    sparse: true,
    maximumSparseGap: 28,
    minimumHeadingGapRatio: 1.35,
    centerRange: [360, 430],
  }],
};

test("blocks sparse peer rows that are spread across the available height", () => {
  const result = auditLayoutObject(layout([
    element("title", "目录", ["目录"], [62, 38, 760, 58]),
    element("row-1", "第一章", ["第一章"], [218, 140, 760, 52]),
    element("row-2", "第二章", ["第二章"], [218, 300, 760, 52]),
    element("row-3", "第三章", ["第三章"], [218, 460, 760, 52]),
  ]), peerGroupPolicy);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "PEER_GROUP_COHESION_FAIL"));
  assert.ok(result.findings.some((item) => item.code === "SPARSE_GROUP_OVERDISTRIBUTED"));
});

test("blocks a compact peer group whose visual center remains too high", () => {
  const result = auditLayoutObject(layout([
    element("title", "目录", ["目录"], [62, 38, 760, 58]),
    element("row-1", "第一章", ["第一章"], [218, 140, 760, 52]),
    element("row-2", "第二章", ["第二章"], [218, 216, 760, 52]),
    element("row-3", "第三章", ["第三章"], [218, 292, 760, 52]),
  ]), peerGroupPolicy);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((item) => item.code === "CONTENT_GROUP_TOO_HIGH"));
  assert.ok(!result.findings.some((item) => item.code === "SPARSE_GROUP_OVERDISTRIBUTED"));
});

test("accepts a compact peer group centered at or slightly below canvas center", () => {
  const result = auditLayoutObject(layout([
    element("title", "目录", ["目录"], [62, 38, 760, 58]),
    element("row-1", "第一章", ["第一章"], [218, 288, 760, 52]),
    element("row-2", "第二章", ["第二章"], [218, 364, 760, 52]),
    element("row-3", "第三章", ["第三章"], [218, 440, 760, 52]),
  ]), peerGroupPolicy);
  assert.deepEqual(result, { ok: true, code: "LAYOUT_QUALITY_PASS", findings: [] });
});

test("group-aware balance replaces the generic page-bottom occupancy gate", () => {
  const result = auditLayoutObject(layout([
    element("title", "目录", ["目录"], [62, 38, 760, 58]),
    element("row-1", "第一章", ["第一章"], [218, 288, 900, 52]),
    element("row-2", "第二章", ["第二章"], [218, 364, 900, 52]),
    element("row-3", "第三章", ["第三章"], [218, 440, 900, 52]),
    ...Array.from({ length: 9 }, (_, index) => element(`decorative-peer-${index}`, "", [], [1120 + index, 440, 1, 1])),
  ]), peerGroupPolicy);
  assert.ok(!result.findings.some((item) => item.code === "CANVAS_HEIGHT_UNDERUSED"));
  assert.equal(result.ok, true);
});
