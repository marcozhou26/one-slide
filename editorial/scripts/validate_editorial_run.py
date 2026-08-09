#!/usr/bin/env python3
"""Validate Editorial Editor diagnosis, patch, candidate layout, and manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path


RUBRIC_KEYS = {
    "visual_subject",
    "title_evidence",
    "evidence_annotation",
    "semantic_emphasis",
    "reading_rhythm",
    "information_contribution",
}
DECISIONS = {
    "EDITORIAL_IMPROVEMENT_PASS",
    "NO_MATERIAL_EDIT",
    "EDITORIAL_CANDIDATE_REJECTED",
    "EDITORIAL_EDIT_BLOCKED",
}
SEVERITY_ORDER = {"material": 0, "moderate": 1, "minor": 2}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_json(command: list[str]) -> tuple[dict, str | None]:
    process = subprocess.run(command, text=True, capture_output=True, check=False)
    try:
        record = json.loads(process.stdout)
    except json.JSONDecodeError:
        return {}, process.stderr.strip() or process.stdout.strip() or "command returned no JSON"
    return record, None


def finding_signatures(record: dict) -> set[str]:
    return {json.dumps(item, ensure_ascii=False, sort_keys=True) for item in record.get("findings", [])}


def baseline_relative_gate(name: str, baseline: dict, candidate: dict) -> bool:
    if candidate.get("ok"):
        return True
    if baseline.get("ok"):
        return False
    if name == "layout":
        return finding_signatures(candidate).issubset(finding_signatures(baseline))
    if name == "semantic":
        baseline_warnings = set(baseline.get("field_simulation_warnings", []))
        candidate_warnings = set(candidate.get("field_simulation_warnings", []))
        min_font = candidate.get("min_font_pt")
        return candidate_warnings.issubset(baseline_warnings) and isinstance(min_font, (int, float)) and min_font >= 12
    return False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_dir", type=Path)
    args = parser.parse_args()
    root = args.run_dir.resolve()
    errors: list[str] = []

    def load(name: str) -> dict:
        path = root / name
        if not path.is_file():
            errors.append(f"missing: {name}")
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"invalid json {name}: {error}")
            return {}

    diagnosis = load("editorial-diagnosis.json")
    manifest = load("editorial-manifest.json")
    verification = load("verification.json")
    patch = load("editorial-patch.json") if (root / "editorial-patch.json").exists() else {"operations": []}
    patch_audit = load("patch-audit.json")

    if set(diagnosis.get("rubric", {})) != RUBRIC_KEYS:
        errors.append("diagnosis must cover exactly the six rubric keys")
    for key, value in diagnosis.get("rubric", {}).items():
        if value.get("status") not in {"pass", "issue"} or not value.get("evidence"):
            errors.append(f"rubric entry incomplete: {key}")
    if not diagnosis.get("primary_issue") or not diagnosis.get("edit_hypothesis") or not diagnosis.get("protected_content"):
        errors.append("diagnosis lacks primary_issue, edit_hypothesis, or protected_content")
    if diagnosis.get("primary_dimension") not in RUBRIC_KEYS:
        errors.append("diagnosis primary_dimension must be one of the six rubric keys")
    if diagnosis.get("context_basis") not in {"hash_locked_handoff", "derived_from_slide"}:
        errors.append("diagnosis context_basis is invalid")
    if not diagnosis.get("source_ids") or not diagnosis.get("central_message"):
        errors.append("diagnosis lacks source_ids or central_message")
    visible_defects = diagnosis.get("visible_defects")
    if not isinstance(visible_defects, list):
        errors.append("diagnosis visible_defects must be a list")
        visible_defects = []
    else:
        severities = []
        for defect in visible_defects:
            if not isinstance(defect, dict) or not defect.get("id") or defect.get("severity") not in SEVERITY_ORDER or not defect.get("evidence") or not defect.get("source_ids"):
                errors.append("visible defect requires id, severity, evidence, and source_ids")
                continue
            severities.append(SEVERITY_ORDER[defect["severity"]])
        if severities != sorted(severities):
            errors.append("visible_defects must be ordered by severity")
    region_analysis = diagnosis.get("region_analysis")
    if not isinstance(region_analysis, list) or not region_analysis:
        errors.append("diagnosis requires non-empty region_analysis")
    else:
        for region in region_analysis:
            if not isinstance(region, dict) or not region.get("id") or region.get("role") not in {"main_exhibit", "sidebar", "source", "conclusion", "other"} or not region.get("evidence") or not region.get("source_ids"):
                errors.append("region_analysis entry is incomplete")
    panel_integrity = diagnosis.get("panel_integrity", {})
    if panel_integrity.get("status") not in {"pass", "protected"} or not panel_integrity.get("evidence"):
        errors.append("diagnosis requires panel_integrity status and evidence")

    decision = manifest.get("decision")
    if decision not in DECISIONS:
        errors.append("invalid manifest decision")
    if decision == "EDITORIAL_IMPROVEMENT_PASS":
        if not visible_defects:
            errors.append("improvement pass requires at least one visible defect")
        elif diagnosis.get("primary_issue_id") != visible_defects[0].get("id"):
            errors.append("primary_issue_id must select the highest-severity visible defect")
    if decision == "NO_MATERIAL_EDIT" and visible_defects:
        errors.append("no-material-edit requires an empty visible_defects list")
    source = Path(manifest.get("source_pptx", ""))
    candidate = Path(manifest.get("candidate_pptx", ""))
    if not source.is_file() or not candidate.is_file():
        errors.append("source or candidate PPTX missing")
    else:
        if manifest.get("source_sha256") != sha256(source):
            errors.append("source hash mismatch")
        if manifest.get("candidate_sha256") != sha256(candidate):
            errors.append("candidate hash mismatch")
        if source.resolve() == candidate.resolve():
            errors.append("candidate overwrites source")
        source_copy = root / "source/source.pptx"
        if not source_copy.is_file() or sha256(source_copy) != sha256(source):
            errors.append("run source/source.pptx is missing or not hash-equal to manifest source")
        if diagnosis.get("source_sha256") != sha256(source):
            errors.append("diagnosis source_sha256 mismatch")
        expected_candidate = root / "candidate/edited.pptx"
        if candidate.resolve() != expected_candidate.resolve():
            errors.append("manifest candidate must be candidate/edited.pptx")
    operations = patch.get("operations", [])
    if manifest.get("operations_count") != len(operations):
        errors.append("operations_count mismatch")
    if len(patch_audit.get("operations", [])) != len(operations):
        errors.append("patch-audit operation count mismatch")
    if source.is_file() and patch_audit.get("source_sha256") != sha256(source):
        errors.append("patch-audit source hash mismatch")
    if candidate.is_file() and patch_audit.get("output_sha256") != sha256(candidate):
        errors.append("patch-audit candidate hash mismatch")
    if decision == "EDITORIAL_IMPROVEMENT_PASS" and not operations:
        errors.append("improvement pass requires at least one operation")
    if decision == "EDITORIAL_IMPROVEMENT_PASS" and source.is_file() and candidate.is_file() and sha256(source) == sha256(candidate):
        errors.append("improvement pass requires a candidate hash different from source")
    if decision == "NO_MATERIAL_EDIT" and operations:
        errors.append("no-material-edit cannot contain operations")
    if decision in {"EDITORIAL_CANDIDATE_REJECTED", "EDITORIAL_EDIT_BLOCKED"} and operations:
        errors.append("rejected or blocked final output must be a zero-operation rollback")
    if decision in {"EDITORIAL_CANDIDATE_REJECTED", "EDITORIAL_EDIT_BLOCKED"} and source.is_file() and candidate.is_file() and sha256(source) != sha256(candidate):
        errors.append("rejected or blocked final output must be hash-equal to source")
    if not verification.get("verification_pass"):
        errors.append("decision requires verification_pass")
    improved = manifest.get("improved_dimensions", [])
    if any(value not in RUBRIC_KEYS for value in improved):
        errors.append("improved_dimensions contains a value outside the six rubric keys")
    issue_dimensions = {key for key, value in diagnosis.get("rubric", {}).items() if value.get("status") == "issue"}
    if decision == "EDITORIAL_IMPROVEMENT_PASS" and not improved:
        errors.append("improvement pass requires improved_dimensions")
    if decision == "EDITORIAL_IMPROVEMENT_PASS" and not set(improved).intersection(issue_dimensions):
        errors.append("improved_dimensions must address a diagnosed issue")
    if not manifest.get("editorial_judgment"):
        errors.append("manifest requires a rendered before-after editorial judgment")
    reviewer = manifest.get("reviewer", {})
    expected_reviewer_status = "pass" if decision in {"EDITORIAL_IMPROVEMENT_PASS", "NO_MATERIAL_EDIT"} else ("rejected" if decision == "EDITORIAL_CANDIDATE_REJECTED" else "blocked")
    if reviewer.get("status") != expected_reviewer_status or not reviewer.get("evidence"):
        errors.append(f"manifest requires independent reviewer status={expected_reviewer_status} with evidence")

    required_json = {
        "baseline/inspect-manifest.json": None,
        "baseline/layout.audit.json": None,
        "baseline/semantic-audit.json": None,
        "candidate/inspect-manifest.json": None,
        "candidate/layout.audit.json": None,
        "candidate/semantic-audit.json": None,
        "candidate/contrast-audit.json": "EDITORIAL_CONTRAST_PASS",
        "candidate/powerpoint-open.json": None,
    }
    evidence = {}
    for name, expected_code in required_json.items():
        evidence[name] = load(name)
        if decision in {"EDITORIAL_IMPROVEMENT_PASS", "NO_MATERIAL_EDIT"} and expected_code and (not evidence[name].get("ok") or evidence[name].get("code") != expected_code):
            errors.append(f"hard QA gate failed: {name}")
    if evidence.get("candidate/powerpoint-open.json", {}).get("status") != "pass":
        errors.append("actual Microsoft PowerPoint open/edit inspection is not passed")
    powerpoint = evidence.get("candidate/powerpoint-open.json", {})
    powerpoint_screenshot = Path(powerpoint.get("screenshot_path", ""))
    required_powerpoint = ("app_bundle_id", "window_title", "pptx_sha256", "selected_native_objects", "checked_at", "screenshot_sha256")
    if any(powerpoint.get(key) in (None, "") for key in required_powerpoint):
        errors.append("PowerPoint evidence lacks required fields")
    elif candidate.is_file() and powerpoint.get("pptx_sha256") != sha256(candidate):
        errors.append("PowerPoint evidence PPTX hash mismatch")
    if not powerpoint_screenshot.is_file() or (powerpoint_screenshot.is_file() and powerpoint.get("screenshot_sha256") != sha256(powerpoint_screenshot)):
        errors.append("PowerPoint screenshot missing or hash mismatch")
    for name, pptx_path in (("baseline/inspect-manifest.json", source), ("candidate/inspect-manifest.json", candidate)):
        record = evidence.get(name, {})
        if pptx_path.is_file() and record.get("source_sha256") != sha256(pptx_path):
            errors.append(f"inspect manifest PPTX binding mismatch: {name}")

    skill_root = Path(__file__).resolve().parents[2]
    if source.is_file() and candidate.is_file() and (root / "baseline/inspect-manifest.json").is_file() and (root / "candidate/inspect-manifest.json").is_file() and (root / "patch-audit.json").is_file():
        with tempfile.TemporaryDirectory(prefix="oneslide-editorial-validate-") as temporary:
            fresh_verification_path = Path(temporary) / "verification.json"
            fresh_verification, verification_error = run_json([
                "python3", "-B", str(skill_root / "editorial/scripts/verify_editorial_roundtrip.py"),
                "--workspace", str(skill_root), "--source-pptx", str(source), "--candidate-pptx", str(candidate),
                "--source-inspect-manifest", str(root / "baseline/inspect-manifest.json"),
                "--candidate-inspect-manifest", str(root / "candidate/inspect-manifest.json"),
                "--audit", str(root / "patch-audit.json"), "--output", str(fresh_verification_path),
            ])
            if verification_error or not fresh_verification.get("verification_pass"):
                errors.append(f"fresh roundtrip verification failed: {verification_error or fresh_verification.get('visual', {})}")
            for key in ("verification_pass", "inspect_binding_pass", "patch_audit_binding_pass", "native_editable_pass", "semantic_tokens_pass"):
                if verification.get(key) != fresh_verification.get(key):
                    errors.append(f"stored verification does not match fresh result: {key}")

    fresh_layout, layout_error = run_json(["node", str(skill_root / "builder/scripts/layout_quality.mjs"), str(root / "candidate/layout.json")]) if (root / "candidate/layout.json").is_file() else ({}, "candidate layout missing")
    fresh_semantic, semantic_error = run_json(["python3", "-B", str(skill_root / "builder/scripts/audit_pptx_semantics.py"), str(candidate)]) if candidate.is_file() else ({}, "candidate missing")
    fresh_baseline_layout, baseline_layout_error = run_json(["node", str(skill_root / "builder/scripts/layout_quality.mjs"), str(root / "baseline/layout.json")]) if (root / "baseline/layout.json").is_file() else ({}, "baseline layout missing")
    fresh_baseline_semantic, baseline_semantic_error = run_json(["python3", "-B", str(skill_root / "builder/scripts/audit_pptx_semantics.py"), str(source)]) if source.is_file() else ({}, "source missing")
    with tempfile.TemporaryDirectory(prefix="oneslide-editorial-contrast-") as temporary:
        fresh_contrast_path = Path(temporary) / "contrast.json"
        fresh_contrast, contrast_error = run_json([
            "python3", "-B", str(skill_root / "editorial/scripts/audit_editorial_contrast.py"),
            "--layout", str(root / "candidate/layout.json"), "--audit", str(root / "patch-audit.json"), "--output", str(fresh_contrast_path),
        ]) if (root / "candidate/layout.json").is_file() and (root / "patch-audit.json").is_file() else ({}, "contrast inputs missing")
    for name, stored, fresh, error in (
        ("layout", evidence.get("candidate/layout.audit.json", {}), fresh_layout, layout_error),
        ("semantic", evidence.get("candidate/semantic-audit.json", {}), fresh_semantic, semantic_error),
        ("contrast", evidence.get("candidate/contrast-audit.json", {}), fresh_contrast, contrast_error),
    ):
        if error or stored.get("ok") != fresh.get("ok") or stored.get("code") != fresh.get("code"):
            errors.append(f"stored {name} audit does not match fresh execution: {error or fresh.get('code')}")
        if decision in {"EDITORIAL_IMPROVEMENT_PASS", "NO_MATERIAL_EDIT"} and not fresh.get("ok"):
            if name == "layout":
                if baseline_layout_error or not baseline_relative_gate(name, fresh_baseline_layout, fresh):
                    errors.append(f"fresh hard QA gate failed or regressed: {name}")
            elif name == "semantic":
                if baseline_semantic_error or not baseline_relative_gate(name, fresh_baseline_semantic, fresh):
                    errors.append(f"fresh hard QA gate failed or regressed: {name}")
            else:
                errors.append(f"fresh hard QA gate failed: {name}")
    for name, stored, fresh, error in (
        ("baseline-layout", evidence.get("baseline/layout.audit.json", {}), fresh_baseline_layout, baseline_layout_error),
        ("baseline-semantic", evidence.get("baseline/semantic-audit.json", {}), fresh_baseline_semantic, baseline_semantic_error),
    ):
        if error or stored.get("ok") != fresh.get("ok") or stored.get("code") != fresh.get("code"):
            errors.append(f"stored {name} audit does not match fresh execution: {error or fresh.get('code')}")

    candidate_layout = root / "candidate/layout.json"
    if candidate_layout.is_file():
        layout = json.loads(candidate_layout.read_text(encoding="utf-8"))
        frame = layout.get("slide", {}).get("frame", {})
        width, height = frame.get("width"), frame.get("height")
        for element in layout.get("elements", []):
            if element.get("scope") != "slide" or not isinstance(element.get("bbox"), list):
                continue
            left, top, item_width, item_height = element["bbox"]
            if left < -1 or top < -1 or left + item_width > width + 1 or top + item_height > height + 1:
                errors.append(f"candidate element outside canvas: {element.get('name')}")

    result = {"ok": not errors, "code": "EDITORIAL_RUN_PASS" if not errors else "EDITORIAL_RUN_FAIL", "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(10)


if __name__ == "__main__":
    main()
