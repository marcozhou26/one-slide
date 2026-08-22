import assert from "node:assert/strict";
import test from "node:test";
import { resolveBusinessEmphasisStyle } from "../scripts/pptx_core.mjs";

test("business emphasis changes only weight and fill", () => {
  const normal = resolveBusinessEmphasisStyle({ emphasized: false });
  const highlighted = resolveBusinessEmphasisStyle({ emphasized: true });
  assert.equal(normal.bold, false);
  assert.equal(highlighted.bold, true);
  assert.notEqual(normal.fill, highlighted.fill);
  assert.equal(normal.color, highlighted.color);
  assert.equal(normal.border, highlighted.border);
  assert.equal(normal.borderWidth, highlighted.borderWidth);
});

test("custom shared edge remains identical in both states", () => {
  const options = { border: "CCD6E0", borderWidth: 0.6 };
  const normal = resolveBusinessEmphasisStyle({ ...options, emphasized: false });
  const highlighted = resolveBusinessEmphasisStyle({ ...options, emphasized: true });
  assert.equal(normal.border, "CCD6E0");
  assert.equal(highlighted.border, "CCD6E0");
  assert.equal(normal.borderWidth, 0.6);
  assert.equal(highlighted.borderWidth, 0.6);
});
