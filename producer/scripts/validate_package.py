#!/usr/bin/env python3
"""Validate one Single Consulting Slide Producer run directory.

Exit codes: 0 for pass, 2 for invalid CLI arguments, and 10 for a
package-contract or validation failure.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


ValidationResult = dict[str, Any]


DISCLOSURE = "合成示例数据，非真实客户数据"
VALID_KINDS = {
    "user_supplied": "U",
    "derived_from_source": "D",
    "calculated": "C",
    "synthetic_generated": "G",
    "externally_verified": "E",
}
CANVAS_PROFILES = {
    "presentation_16_9": ("16:9", "landscape", 13.333333, 7.5),
    "short_video_broll_9_16": ("9:16", "portrait", 7.5, 13.333333),
    "knowledge_graphic_3_4": ("3:4", "portrait", 7.5, 10.0),
}


class ValidationError(Exception):
    pass


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError(f"invalid JSON: {path}: {exc}") from exc


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_relative(value: str) -> bool:
    path = PurePosixPath(value)
    return (
        bool(value)
        and not path.is_absolute()
        and ".." not in path.parts
        and not value.startswith(("file:", "~"))
    )


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def iter_text(value: Any, path: str = ""):
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_text(item, f"{path}[{index}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from iter_text(item, f"{path}.{key}" if path else key)


def visible_objects(handoff: dict[str, Any]):
    content = handoff.get("content") or {}
    for key in ("title", "subtitle"):
        item = content.get(key)
        if item:
            yield f"content.{key}", item
    for key in ("insights", "actions", "footnotes"):
        for index, item in enumerate(content.get(key) or []):
            yield f"content.{key}[{index}]", item
    for block_index, block in enumerate(handoff.get("display_blocks") or []):
        yield f"display_blocks[{block_index}]", block
        for item_index, item in enumerate(block.get("items") or []):
            yield f"display_blocks[{block_index}].items[{item_index}]", item
    for index, dataset in enumerate(handoff.get("datasets") or []):
        yield f"datasets[{index}]", dataset


def slide_count(path: Path) -> int:
    try:
        with zipfile.ZipFile(path) as archive:
            return len(
                [
                    name
                    for name in archive.namelist()
                    if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
                ]
            )
    except (OSError, zipfile.BadZipFile) as exc:
        raise ValidationError(f"invalid PPTX: {path}: {exc}") from exc


def validate(run_directory: Path, stage: str = "final") -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    required = [
        run_directory / "brief" / "slide-brief.md",
        run_directory / "handoff" / "builder-prompt.md",
        run_directory / "handoff" / "builder-handoff.json",
        run_directory / "handoff" / "handoff-manifest.json",
        run_directory / "review" / "content-review.md",
        run_directory / "internal" / "source-baseline.json",
        run_directory / "internal" / "provenance-ledger.json",
        run_directory / "internal" / "generation-ledger.json",
    ]
    for path in required:
        require(path.is_file() and path.stat().st_size > 0, f"missing or empty required file: {path}", errors)
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings, "checks": {}}

    try:
        manifest = load_json(run_directory / "handoff" / "handoff-manifest.json")
        handoff = load_json(run_directory / "handoff" / "builder-handoff.json")
        baseline = load_json(run_directory / "internal" / "source-baseline.json")
        provenance_payload = load_json(run_directory / "internal" / "provenance-ledger.json")
        load_json(run_directory / "internal" / "generation-ledger.json")
    except ValidationError as exc:
        return {"ok": False, "errors": [str(exc)], "warnings": warnings, "checks": {}}

    prompt = (run_directory / "handoff" / "builder-prompt.md").read_text(encoding="utf-8")
    review = (run_directory / "review" / "content-review.md").read_text(encoding="utf-8")

    require(manifest.get("schema_version") == "1.0", "manifest schema_version must be 1.0", errors)
    require(manifest.get("product") == "single-consulting-slide-producer", "manifest product mismatch", errors)
    require(manifest.get("single_slide") is True, "manifest single_slide must be true", errors)
    require(manifest.get("status") == "ready", "manifest status must be ready", errors)
    require(manifest.get("output_mode") in {"PROMPT_ONLY", "PPT_DRAFT"}, "invalid output_mode", errors)
    require(
        manifest.get("generation_mode") in {"SOURCE_ONLY", "SYNTHETIC_AUGMENTATION", "EVIDENCE_BLOCKED"},
        "invalid generation_mode",
        errors,
    )
    require(manifest.get("builder_target") == "single-consulting-slide-builder", "builder_target mismatch", errors)

    require(handoff.get("schema_version") == "1.0", "builder-handoff schema_version must be 1.0", errors)
    require(handoff.get("product") == "single-consulting-slide-producer", "builder-handoff product mismatch", errors)
    require(handoff.get("single_slide") is True, "builder-handoff single_slide must be true", errors)
    require(handoff.get("output_mode") == manifest.get("output_mode"), "output_mode mismatch", errors)
    require(handoff.get("generation_mode") == manifest.get("generation_mode"), "generation_mode mismatch", errors)
    canvas = handoff.get("canvas") or {}
    canvas_profile = canvas.get("profile")
    require(canvas_profile in CANVAS_PROFILES, "invalid or missing canvas.profile", errors)
    require(manifest.get("canvas_profile") == canvas_profile, "canvas_profile mismatch", errors)
    if canvas_profile in CANVAS_PROFILES:
        ratio, orientation, width_in, height_in = CANVAS_PROFILES[canvas_profile]
        require(canvas.get("aspect_ratio") == ratio, "canvas aspect_ratio mismatch", errors)
        require(canvas.get("orientation") == orientation, "canvas orientation mismatch", errors)
        require(abs(float(canvas.get("powerpoint_width_in", 0)) - width_in) < 0.001, "canvas PowerPoint width mismatch", errors)
        require(abs(float(canvas.get("powerpoint_height_in", 0)) - height_in) < 0.001, "canvas PowerPoint height mismatch", errors)
        require(canvas.get("composition_policy") == "native_recompose", "canvas must use native_recompose", errors)
    for field in ("subject", "story", "audience_task"):
        require(isinstance(handoff.get(field), str) and bool(handoff[field].strip()), f"missing {field}", errors)

    structure = handoff.get("structure") or {}
    for field in ("primary_question", "primary_relationship", "primary_exhibit", "visual_intent", "layout_intent"):
        require(isinstance(structure.get(field), str) and bool(structure[field].strip()), f"structure missing {field}", errors)

    budget = handoff.get("information_budget") or {}
    require(budget.get("primary_exhibit_count") == 1, "primary_exhibit_count must be exactly 1", errors)
    require(isinstance(budget.get("supporting_evidence_count"), int) and 0 <= budget["supporting_evidence_count"] <= 3, "supporting_evidence_count must be 0-3", errors)
    require(isinstance(budget.get("action_or_condition_count"), int) and 0 <= budget["action_or_condition_count"] <= 1, "action_or_condition_count must be 0-1", errors)
    require(budget.get("status") == "pass", "information budget status must be pass", errors)

    blocks = handoff.get("display_blocks") or []
    require(sum(1 for block in blocks if block.get("budget_role") == "primary_exhibit") == 1, "exactly one display block must be primary_exhibit", errors)
    require(sum(1 for block in blocks if block.get("budget_role") == "supporting_evidence") == budget.get("supporting_evidence_count"), "supporting evidence block count mismatch", errors)
    require(sum(1 for block in blocks if block.get("budget_role") == "action_or_condition") == budget.get("action_or_condition_count"), "action or condition block count mismatch", errors)
    require((handoff.get("constraints") or {}).get("slide_count") == 1, "constraints.slide_count must be 1", errors)

    module_payload = handoff.get("module_payload")
    requested_module = handoff.get("requested_module")
    if canvas_profile in {"short_video_broll_9_16", "knowledge_graphic_3_4"}:
        require(requested_module is None and module_payload is None, "portrait canvas cannot reuse fixed 16:9 module payload", errors)
    if module_payload is not None:
        require(isinstance(module_payload, dict), "module_payload must be an object", errors)
        if isinstance(module_payload, dict):
            payload_module = module_payload.get("module_id")
            require(module_payload.get("version") == "1.0", "module_payload version must be 1.0", errors)
            require(isinstance(payload_module, str) and bool(payload_module), "module_payload missing module_id", errors)
            require(requested_module == payload_module, "requested_module must match module_payload.module_id", errors)
            require(structure.get("primary_exhibit") == payload_module, "structure.primary_exhibit must match module_payload.module_id", errors)
            require(isinstance(module_payload.get("source_anchors"), list) and bool(module_payload.get("source_anchors")), "module_payload source_anchors are required", errors)
            require(isinstance(module_payload.get("title"), dict) and bool(module_payload.get("title", {}).get("text")), "module_payload title is required", errors)
            require(isinstance(module_payload.get("diagram"), dict) and bool(module_payload.get("diagram")), "module_payload diagram is required", errors)
    elif requested_module is not None:
        require(False, "requested_module requires a complete module_payload", errors)

    entries = provenance_payload.get("entries") if isinstance(provenance_payload, dict) else None
    require(isinstance(entries, list) and bool(entries), "provenance ledger entries must be a non-empty list", errors)
    source_map: dict[str, dict[str, Any]] = {}
    if isinstance(entries, list):
        for index, entry in enumerate(entries):
            prefix = f"provenance entries[{index}]"
            source_id = entry.get("source_id")
            kind = entry.get("kind")
            require(isinstance(source_id, str) and re.fullmatch(r"[UDCGE]\d+", source_id or "") is not None, f"{prefix} invalid source_id", errors)
            require(kind in VALID_KINDS, f"{prefix} invalid kind", errors)
            if isinstance(source_id, str):
                require(source_id not in source_map, f"duplicate source_id: {source_id}", errors)
                if kind in VALID_KINDS:
                    require(source_id.startswith(VALID_KINDS[kind]), f"{prefix} prefix does not match kind", errors)
                source_map[source_id] = entry
            for field in ("statement", "origin", "status", "affects"):
                require(bool(entry.get(field)), f"{prefix} missing {field}", errors)
            if kind == "calculated":
                require(bool(entry.get("formula")), f"{prefix} calculated entry missing formula", errors)
                require(bool(entry.get("input_source_ids")), f"{prefix} calculated entry missing input_source_ids", errors)
            elif kind == "synthetic_generated":
                require(bool(entry.get("gap_id")), f"{prefix} synthetic entry missing gap_id", errors)
                require(bool(entry.get("generation_rule")), f"{prefix} synthetic entry missing generation_rule", errors)
                require(entry.get("status") in {"pending_confirmation", "confirmed_scenario"}, f"{prefix} invalid synthetic status", errors)
            elif kind == "externally_verified":
                require(isinstance(entry.get("citation"), dict) and bool(entry["citation"].get("url")), f"{prefix} externally verified entry missing citation", errors)

    visible_source_ids: set[str] = set()
    for object_path, item in visible_objects(handoff):
        ids = item.get("source_ids") if isinstance(item, dict) else None
        require(isinstance(ids, list) and bool(ids), f"visible object missing source_ids: {object_path}", errors)
        if isinstance(ids, list):
            for source_id in ids:
                visible_source_ids.add(source_id)
                require(source_id in source_map, f"unknown source_id {source_id} at {object_path}", errors)

    declared_ids = set(handoff.get("source_ids") or [])
    require(visible_source_ids.issubset(declared_ids), "handoff source_ids does not cover all visible source IDs", errors)
    baseline_ids = {item.get("source_id") for item in (baseline.get("sources") or []) if isinstance(item, dict)}
    for source_id, entry in source_map.items():
        if entry.get("kind") == "user_supplied":
            require(source_id in baseline_ids, f"user-supplied provenance missing from source baseline: {source_id}", errors)

    synthetic_ids = {source_id for source_id, entry in source_map.items() if entry.get("kind") == "synthetic_generated"}
    synthetic_visible = bool(synthetic_ids & visible_source_ids)
    synthetic_data = manifest.get("synthetic_data") is True
    require(manifest.get("synthetic_content") is synthetic_visible, "manifest synthetic_content does not match visible provenance", errors)
    if synthetic_visible:
        require(manifest.get("generation_mode") == "SYNTHETIC_AUGMENTATION", "visible synthetic content requires SYNTHETIC_AUGMENTATION", errors)
        require("模型补全" in review and "待确认" in review, "content-review must identify synthetic content as pending confirmation", errors)
        marking = handoff.get("review_marking") or {}
        require(marking.get("required") is True, "synthetic content requires review_marking", errors)
        require(marking.get("qualitative_marker") == "待确认", "qualitative marker must be 待确认", errors)
    if synthetic_data:
        all_visible_text = "\n".join(text for _, text in iter_text(handoff.get("content") or {}))
        require(DISCLOSURE in prompt, "builder prompt missing synthetic data disclosure", errors)
        require(DISCLOSURE in all_visible_text, "visible slide content missing synthetic data disclosure", errors)
        require((handoff.get("review_marking") or {}).get("synthetic_data_disclosure") == DISCLOSURE, "review marking disclosure mismatch", errors)

    for text_path, value in iter_text({"content": handoff.get("content"), "display_blocks": blocks}):
        if "text" in text_path or text_path.endswith(("label", "value", "unit", "content")):
            require("|" not in value and "｜" not in value, f"visible field delimiter forbidden at {text_path}", errors)

    listed_paths: set[str] = set()
    handoff_root = run_directory / "handoff"
    for index, item in enumerate(manifest.get("files") or []):
        prefix = f"manifest files[{index}]"
        rel = item.get("path")
        require(isinstance(rel, str) and safe_relative(rel), f"{prefix} path must be safe and relative", errors)
        if not isinstance(rel, str) or not safe_relative(rel):
            continue
        require(rel not in listed_paths, f"duplicate manifest path: {rel}", errors)
        listed_paths.add(rel)
        target = handoff_root / rel
        require(target.is_file() and target.stat().st_size > 0, f"listed file missing or empty: {rel}", errors)
        if not target.is_file():
            continue
        require(item.get("sha256") == sha256(target), f"sha256 mismatch: {rel}", errors)
        if item.get("format") == "csv":
            try:
                with target.open("r", encoding="utf-8-sig", newline="") as handle:
                    rows = [row for row in csv.reader(handle) if any(str(cell).strip() for cell in row)]
                require(bool(rows and rows[0]), f"CSV has no header: {rel}", errors)
                require(item.get("row_count") == max(0, len(rows) - 1), f"CSV row_count mismatch: {rel}", errors)
            except (OSError, UnicodeDecodeError, csv.Error) as exc:
                errors.append(f"invalid CSV {rel}: {exc}")
        if item.get("role") in {"display_data", "relationship_data", "geography", "reference_asset"}:
            require(rel in prompt, f"builder prompt does not reference required file: {rel}", errors)

    for index, dataset in enumerate(handoff.get("datasets") or []):
        rel = dataset.get("path")
        require(rel in listed_paths, f"dataset path not listed in manifest: {rel}", errors)
        require(isinstance(dataset.get("encoding"), dict) and bool(dataset["encoding"]), f"dataset encoding missing: {rel}", errors)

    output_mode = manifest.get("output_mode")
    if output_mode == "PPT_DRAFT" and stage == "final":
        delivery = run_directory / "delivery"
        pptx_files = sorted(path for path in delivery.glob("*.pptx") if not path.name.startswith("~$")) if delivery.is_dir() else []
        require(len(pptx_files) == 1, "PPT_DRAFT requires exactly one delivery PPTX", errors)
        if len(pptx_files) == 1:
            try:
                require(slide_count(pptx_files[0]) == 1, "delivery PPTX must contain exactly one slide", errors)
            except ValidationError as exc:
                errors.append(str(exc))
    elif output_mode == "PPT_DRAFT" and stage == "handoff":
        warnings.append("PPT_DRAFT handoff validated; delivery PPTX is intentionally pending")

    local_file_scheme = "file:" + "/" * 3
    mac_user_root = "/" + "Users" + "/"
    absolute_path_pattern = re.compile(
        rf"(?:{re.escape(local_file_scheme)}|{re.escape(mac_user_root)}|[A-Za-z]:\\\\)"
    )
    for path in required:
        if path.suffix.lower() in {".md", ".json"}:
            text = path.read_text(encoding="utf-8")
            require(absolute_path_pattern.search(text) is None, f"local absolute path leaked: {path.relative_to(run_directory)}", errors)

    checks = {
        "stage": stage,
        "single_slide": not any("slide" in error and ("exactly" in error or "slide_count" in error) for error in errors),
        "provenance_coverage": not any("source_id" in error or "provenance" in error for error in errors),
        "synthetic_disclosure": not any("synthetic" in error or "模型补全" in error or "待确认" in error for error in errors),
        "package_integrity": not any("missing" in error or "sha256" in error or "path" in error for error in errors),
    }
    return {"ok": not errors, "errors": errors, "warnings": warnings, "checks": checks}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run_directory", type=Path)
    parser.add_argument("--write-report", action="store_true")
    parser.add_argument("--stage", choices=("handoff", "final"), default="final")
    args = parser.parse_args()
    run_directory = args.run_directory.resolve()
    result = validate(run_directory, stage=args.stage)
    if args.write_report:
        report = run_directory / "internal" / "validation-report.json"
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result["ok"] else 10)


if __name__ == "__main__":
    main()
