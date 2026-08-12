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
import { validateCohortRetention } from "../scripts/validate_cohort_retention.mjs";
import { validateCorrelationMatrix } from "../scripts/validate_correlation_matrix.mjs";
import { validateScatterRegression } from "../scripts/validate_scatter_regression.mjs";
import { validateConfidenceBand } from "../scripts/validate_confidence_band.mjs";
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
  const validatorPath = registry.modules.find((item) => item.module_id === moduleId)?.validator;
  if (validatorPath === "scripts/validate_r2_module.mjs") return validateR2Module;
  if (validatorPath === "scripts/validate_r3_module.mjs") return validateR3Module;
  if (validatorPath === "scripts/validate_r4_module.mjs") return validateR4Module;
  if (validatorPath === "scripts/validate_r5_module.mjs") return validateR5Module;
  if (validatorPath === "scripts/validate_cohort_retention.mjs") return validateCohortRetention;
  if (validatorPath === "scripts/validate_correlation_matrix.mjs") return validateCorrelationMatrix;
  if (validatorPath === "scripts/validate_scatter_regression.mjs") return validateScatterRegression;
  if (validatorPath === "scripts/validate_confidence_band.mjs") return validateConfidenceBand;
  throw new Error(`No validator test adapter for ${moduleId}`);
};

test("the V3 registry preserves 32 productized modules with resolvable runtime files", async () => {
  assert.equal(registry.suite_version, "1.5.2");
  assert.equal(registry.builder_engine_version, "3.4.1");
  assert.equal(registry.productized_module_count, 32);
  assert.equal(registry.modules.length, 32);
  assert.equal(new Set(registry.modules.map((item) => item.module_id)).size, 32);
  for (const module of registry.modules) {
    assert.equal(module.status, "productized");
    for (const field of ["validator", "planner", "renderer", "reference"]) {
      assert.ok((await fs.stat(path.join(skillRoot, module[field]))).isFile(), `${module.module_id}:${field}`);
    }
    assert.ok((await fs.stat(path.join(skillRoot, "assets/reference-pages", `${module.module_id}.pptx`))).size > 1000, module.module_id);
  }
});

test("all 32 complete fixtures validate without style input and missing core content is blocked", async () => {
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
