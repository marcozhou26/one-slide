import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveSemanticIcon } from "../scripts/resolve_semantic_icon.mjs";
import { routeV3 } from "../scripts/route_v3.mjs";

const builderRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const assetRoot = path.join(builderRoot, "assets/icons/tabler");

test("business-module request resolves a stable collaboration icon", async () => {
  const result = await resolveSemanticIcon({ concept: "跨部门协同", role: "object_identifier" });
  assert.equal(result.status, "ready");
  assert.equal(result.selected.icon_id, "users-group");
});

test("process-node request resolves input semantics", async () => {
  const result = await resolveSemanticIcon({ concept: "数据导入", role: "process_node" });
  assert.equal(result.status, "ready");
  assert.equal(result.selected.icon_id, "file-import");
});

test("risk status resolves a stable warning icon", async () => {
  const result = await resolveSemanticIcon({ concept: "风险预警", role: "status_marker" });
  assert.equal(result.status, "ready");
  assert.equal(result.selected.icon_id, "alert-triangle");
});

test("decorative use is blocked instead of returning an asset", async () => {
  const result = await resolveSemanticIcon({ concept: "漂亮一点", role: "decoration" });
  assert.equal(result.status, "NO_ICON");
  assert.equal(result.reason, "ICON_ROLE_NOT_ALLOWED");
});

test("unknown semantics degrade to NO_ICON without asking the user", async () => {
  const result = await resolveSemanticIcon({ concept: "量子泡泡糖", role: "object_identifier" });
  assert.equal(result.status, "NO_ICON");
  assert.equal(result.reason, "NO_SEMANTIC_MATCH");
});

test("every registered SVG asset exists", async () => {
  const registry = JSON.parse(await fs.readFile(path.join(assetRoot, "registry.json"), "utf8"));
  assert.ok(registry.icon_count >= 150);
  for (const icon of Object.values(registry.icons)) {
    for (const relativePath of Object.values(icon.styles)) {
      const stat = await fs.stat(path.join(assetRoot, relativePath));
      assert.ok(stat.size > 100, `${relativePath} should contain an SVG asset`);
    }
  }
});

test("structured handoff activates the semantic icon reference and resolver", async () => {
  const result = await routeV3({
    subject: "协同机制",
    story: "跨部门协同需要统一入口",
    source_ids: ["U01"],
    structure: { primary_exhibit: "process" },
    display_blocks: [{ display_intent: "process" }],
    semantic_icon: { enabled: true, concept: "跨部门协同", role: "object_identifier" },
  });
  assert.equal(result.status, "ready");
  assert.ok(result.load_only.includes("references/semantic-icon-library.md"));
  assert.equal(result.semantic_icon.resolver, "scripts/resolve_semantic_icon.mjs");
});

test("explicit icon must remain inside the semantic candidate set", async () => {
  const valid = await resolveSemanticIcon({ concept: "风险预警", role: "status_marker", icon_id: "alert-triangle" });
  assert.equal(valid.status, "ready");
  const mismatch = await resolveSemanticIcon({ concept: "风险预警", role: "status_marker", icon_id: "user" });
  assert.equal(mismatch.status, "NO_ICON");
  assert.equal(mismatch.reason, "ICON_SEMANTIC_MISMATCH");
});
