import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLogicStructure } from "../scripts/validate_logic_structure.mjs";
import { validateIssueTree } from "../scripts/validate_issue_tree.mjs";
import { validateStageProcess } from "../scripts/validate_stage_process.mjs";
import { validateWaterfall } from "../scripts/validate_waterfall.mjs";
import { validateR2Module } from "../scripts/validate_r2_module.mjs";
import { validateR3Module } from "../scripts/validate_r3_module.mjs";
import { validateR4Module } from "../scripts/validate_r4_module.mjs";
import { validateR5Module } from "../scripts/validate_r5_module.mjs";
import { validateOrgModel } from "../scripts/validate_org_model.mjs";

const skillRoot = fileURLToPath(new URL("../", import.meta.url));
const registry = JSON.parse(await fs.readFile(path.join(skillRoot, "references/module-registry.json"), "utf8"));
const fixtureName = (moduleId) => moduleId === "waterfall-attribution" ? "waterfall-valid.json" : `${moduleId}-valid.json`;
const validator = (moduleId) => {
  if (moduleId === "complex-org-chart") return validateOrgModel;
  if (moduleId === "causal-chain") return validateLogicStructure;
  if (moduleId === "issue-tree") return validateIssueTree;
  if (moduleId === "stage-process") return validateStageProcess;
  if (moduleId === "waterfall-attribution") return validateWaterfall;
  const index = registry.modules.filter((item) => item.module_id !== "complex-org-chart").findIndex((item) => item.module_id === moduleId);
  if (index < 9) return validateR2Module;
  if (index < 15) return validateR3Module;
  if (index < 22) return validateR4Module;
  return validateR5Module;
};

test("the V3 registry preserves 33 productized modules with resolvable runtime files", async () => {
  assert.equal(registry.skill_version, "3.3.3");
  assert.equal(registry.productized_module_count, 33);
  assert.equal(registry.modules.length, 33);
  assert.equal(new Set(registry.modules.map((item) => item.module_id)).size, 33);
  for (const module of registry.modules) {
    assert.equal(module.status, "productized");
    for (const field of ["validator", "planner", "renderer", "reference"]) {
      assert.ok((await fs.stat(path.join(skillRoot, module[field]))).isFile(), `${module.module_id}:${field}`);
    }
    assert.ok((await fs.stat(path.join(skillRoot, "assets/reference-pages", `${module.module_id}.pptx`))).size > 1000, module.module_id);
  }
});

test("all 33 complete fixtures validate without style input and missing core content is blocked", async () => {
  for (const module of registry.modules) {
    const fixturePath = path.join(skillRoot, "assets/test-fixtures", fixtureName(module.module_id));
    const data = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    delete data.style;
    assert.doesNotThrow(() => validator(module.module_id)(data), module.module_id);
    const missing = structuredClone(data);
    if (module.module_id === "complex-org-chart") delete missing.nodes;
    else delete missing.diagram;
    assert.throws(() => validator(module.module_id)(missing), undefined, module.module_id);
  }
});
