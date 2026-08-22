#!/usr/bin/env python3
"""Validate the portable OneSlide source package."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


TEXT_SUFFIXES = {".md", ".txt", ".json", ".yaml", ".yml", ".py", ".js", ".mjs", ".csv"}
FORBIDDEN_TEXT = {
    "/" + "Users" + "/": "macOS absolute user path",
    "marco" + "zhou": "local username",
    "file:" + "///": "local file URL",
}
FORBIDDEN_NAMES = {".DS_Store", "__pycache__"}
PROHIBITED_GITHUB_ATTRIBUTION = (
    "南海" + "公学",
    "nan" + "hai academy",
    "nan" + "hai.pro",
)
SUITE_VERSION = "1.9.2"
REQUIRED = [
    "SKILL.md",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "LICENSE_STATUS.md",
    "NOTICE",
    "CONTENT-LICENSE.md",
    "TRADEMARKS.md",
    "ABOUT.md",
    "agents/openai.yaml",
    "references/input-contract.md",
    "references/suite-contract.md",
    "producer/ENGINE.md",
    "producer/references/input-contract.md",
    "producer/references/provenance-contract.md",
    "producer/references/output-contract.md",
    "producer/scripts/validate_package.py",
    "builder/ENGINE.md",
    "builder/references/input-contract.md",
    "builder/references/module-registry.json",
    "builder/scripts/route_v3.mjs",
    "builder/scripts/pptx_core.mjs",
    "builder/scripts/canvas_profiles.mjs",
    "builder/scripts/render_portrait_one_point.mjs",
    "builder/references/semantic-icon-library.md",
    "builder/scripts/resolve_semantic_icon.mjs",
    "builder/scripts/build_semantic_icon_library.mjs",
    "builder/assets/icons/tabler/aliases.zh-CN.json",
    "builder/assets/icons/tabler/registry.json",
    "builder/assets/icons/tabler/LICENSE-TABLER.txt",
    "builder/tests/semantic_icon_library.test.mjs",
    "builder/tests/canvas_profiles.test.mjs",
    "builder/scripts/ensure_auto_slide_number.mjs",
    "builder/scripts/normalize_powerpoint_text_editability.mjs",
    "builder/scripts/audit_public_readability.mjs",
    "builder/tests/public_readability_mvp.test.mjs",
    "scripts/register_workspace_packages.mjs",
    "builder/tests/slide_number_contracts.test.mjs",
    "builder/tests/native_text_editability_contracts.test.mjs",
    "builder/tests/structure_page_contracts.test.mjs",
    "producer/scripts/compile_outline_handoff.mjs",
    "builder/scripts/validate_bookend_page.mjs",
    "builder/scripts/validate_navigation_page.mjs",
    "builder/scripts/validate_section_transition.mjs",
    "scripts/check_environment.py",
    "scripts/export_powerpoint_png.py",
    "scripts/validate_suite.py",
    "tests/test_suite_contract.py",
    "tests/test_producer_package.py",
    "tests/input-contract-results.md",
]


def validate(root: Path) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    if not root.is_dir():
        return {"ok": False, "errors": [f"not a directory: {root}"], "warnings": []}

    for relative in REQUIRED:
        path = root / relative
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"missing or empty required file: {relative}")

    skill_files = [path.relative_to(root).as_posix() for path in root.rglob("SKILL.md")]
    if skill_files != ["SKILL.md"]:
        errors.append(f"exactly one public SKILL.md is required; found: {skill_files}")

    skill_path = root / "SKILL.md"
    if skill_path.is_file():
        skill_text = skill_path.read_text(encoding="utf-8")
        if not re.search(r"(?m)^name:\s*one-slide\s*$", skill_text):
            errors.append("SKILL.md name must be one-slide")
        if not re.search(r"(?m)^license:\s*Apache-2\.0\s*$", skill_text):
            errors.append("SKILL.md license must be Apache-2.0")
        if not re.search(r'(?m)^\s*author:\s*["\']周俊东 Marco["\']\s*$', skill_text):
            errors.append("SKILL.md author must be 周俊东 Marco")
        if not re.search(rf'(?m)^\s*version:\s*["\']{re.escape(SUITE_VERSION)}["\']\s*$', skill_text):
            errors.append(f"SKILL.md version must be {SUITE_VERSION}")
        for term in ("PROMPT_ONLY", "PPT_DRAFT", "SYNTHETIC_AUGMENTATION", "EVIDENCE_BLOCKED"):
            if term not in skill_text:
                errors.append(f"SKILL.md missing required mode or state: {term}")
        if "一次只处理一页" not in skill_text:
            errors.append("SKILL.md must state the one-slide boundary")

    for path in root.rglob("*"):
        relative = path.relative_to(root).as_posix()
        if relative == "runs" or relative.startswith("runs/") or relative == ".codex" or relative.startswith(".codex/"):
            continue
        if path.name in FORBIDDEN_NAMES or path.suffix == ".pyc":
            errors.append(f"cache or local artifact in package: {relative}")
        if path.is_file() and path.suffix.lower() in TEXT_SUFFIXES:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                errors.append(f"text file is not UTF-8: {relative}")
                continue
            scan_text = text.replace("https://github.com/marcozhou26/", "https://github.com/PUBLIC_ACCOUNT/")
            for pattern, label in FORBIDDEN_TEXT.items():
                if pattern in scan_text:
                    errors.append(f"{label} in {relative}: {pattern}")
            scan_text_lower = scan_text.lower()
            for term in PROHIBITED_GITHUB_ATTRIBUTION:
                if term.lower() in scan_text_lower:
                    errors.append(f"prohibited GitHub attribution in {relative}: {term}")

    registry_path = root / "builder/references/module-registry.json"
    if registry_path.is_file():
        try:
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            errors.append(f"invalid builder module registry: {exc}")
        else:
            if registry.get("suite_version") != SUITE_VERSION:
                errors.append(
                    f"builder suite version mismatch: registry={registry.get('suite_version')}, skill={SUITE_VERSION}"
                )
            if not registry.get("builder_engine_version"):
                errors.append("builder module registry missing builder_engine_version")
            if "skill_version" in registry:
                errors.append("builder module registry must not use ambiguous skill_version")
            modules = registry.get("modules") or []
            declared = registry.get("productized_module_count")
            productized = [module for module in modules if module.get("status") == "productized"]
            if declared != len(productized):
                errors.append(
                    f"builder productized module count mismatch: declared={declared}, actual={len(productized)}"
                )
            seen: set[str] = set()
            for index, module in enumerate(modules):
                module_id = module.get("module_id")
                if not module_id or module_id in seen:
                    errors.append(f"invalid or duplicate module_id at registry index {index}: {module_id}")
                if module_id:
                    seen.add(module_id)
                for field in ("validator", "planner", "renderer", "reference"):
                    value = module.get(field)
                    if not isinstance(value, str) or not value:
                        errors.append(f"module {module_id} missing {field}")
                        continue
                    if not (root / "builder" / value).is_file():
                        errors.append(f"module {module_id} references missing {field}: {value}")

    license_path = root / "LICENSE_STATUS.md"
    if license_path.is_file():
        license_status = license_path.read_text(encoding="utf-8")
        if "PUBLIC_LICENSE_READY=pass" not in license_status:
            errors.append("public license status must be pass")
        if "Apache License 2.0" not in license_status or "CC BY 4.0" not in license_status:
            errors.append("license status must declare both Apache-2.0 and CC BY 4.0 scopes")

    apache_text = root / "LICENSE"
    if apache_text.is_file() and "Apache License" not in apache_text.read_text(encoding="utf-8"):
        errors.append("LICENSE must contain the Apache License 2.0 text")

    content_license = root / "CONTENT-LICENSE.md"
    if content_license.is_file() and "creativecommons.org/licenses/by/4.0" not in content_license.read_text(encoding="utf-8"):
        errors.append("CONTENT-LICENSE.md must link to CC BY 4.0")

    return {"ok": not errors, "errors": errors, "warnings": warnings}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("suite_directory", type=Path)
    args = parser.parse_args()
    result = validate(args.suite_directory.resolve())
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 10


if __name__ == "__main__":
    sys.exit(main())
