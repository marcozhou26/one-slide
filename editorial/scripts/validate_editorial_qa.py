#!/usr/bin/env python3
"""Validate a read-only Editorial QA decision and its Builder brief."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


DECISIONS = {"PASS_AS_IS", "BUILDER_LOCAL_REPAIR", "BUILDER_RECOMPOSE", "EDITORIAL_BLOCKED"}
EXECUTION_KEYS = {"operations", "op", "target_pt", "dx", "dy", "dw", "dh", "expected_bbox"}
NS = {"p": "http://schemas.openxmlformats.org/presentationml/2006/main"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def find_execution_keys(value: object, location: str = "$") -> list[str]:
    findings: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in EXECUTION_KEYS:
                findings.append(f"{location}.{key}")
            findings.extend(find_execution_keys(child, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            findings.extend(find_execution_keys(child, f"{location}[{index}]"))
    return findings


def shape_names(path: Path) -> set[str]:
    names: set[str] = set()
    with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
            if not re.match(r"ppt/slides/slide\d+\.xml$", member):
                continue
            root = ET.fromstring(archive.read(member))
            names.update(node.get("name", "") for node in root.findall(".//p:cNvPr", NS) if node.get("name"))
    return names


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--qa", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    errors: list[str] = []
    try:
        record = json.loads(args.qa.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        record = {}
        errors.append(f"invalid Editorial QA JSON: {error}")

    source_names: set[str] = set()
    if not args.source.is_file() or args.source.suffix.lower() != ".pptx":
        errors.append("source must be a readable PPTX")
    else:
        try:
            source_names = shape_names(args.source)
        except (OSError, zipfile.BadZipFile, ET.ParseError):
            errors.append("source must be a readable PPTX")
        if record.get("source_sha256") != sha256(args.source):
            errors.append("source_sha256 does not match source PPTX")
    if record.get("version") != 1 or record.get("role") != "EDITORIAL_QA":
        errors.append("version=1 and role=EDITORIAL_QA are required")
    decision = record.get("decision")
    if decision not in DECISIONS:
        errors.append("invalid Editorial QA decision")
    strengths = record.get("page_strengths")
    if not isinstance(strengths, list) or len(strengths) < 2 or any(not isinstance(item, str) or not item.strip() for item in strengths):
        errors.append("page_strengths requires at least two concrete strengths")
    if record.get("confidence") not in {"high", "medium", "low"}:
        errors.append("confidence must be high, medium, or low")
    diagnostic = record.get("diagnostic_basis")
    groups = diagnostic.get("visual_groups") if isinstance(diagnostic, dict) else None
    if not isinstance(groups, list):
        errors.append("diagnostic_basis.visual_groups is required")
        groups = []
    group_ids: set[str] = set()
    for index, group in enumerate(groups):
        if not isinstance(group, dict) or any(not group.get(key) for key in ("group_id", "source_ids", "semantic_role", "uniform_properties", "content_fit", "container_semantics")):
            errors.append(f"visual_groups[{index}] is incomplete")
            continue
        if group["group_id"] in group_ids:
            errors.append(f"duplicate visual group id: {group['group_id']}")
        group_ids.add(group["group_id"])
        if not isinstance(group["source_ids"], list) or len(group["source_ids"]) < 2:
            errors.append(f"visual group {group['group_id']} needs at least two source_ids")
        elif source_names and any(source_id not in source_names for source_id in group["source_ids"]):
            errors.append(f"visual group {group['group_id']} contains source_ids not found in the PPTX")
        if not isinstance(group["uniform_properties"], list) or not group["uniform_properties"]:
            errors.append(f"visual group {group['group_id']} needs uniform_properties")
    forbidden = find_execution_keys(record)
    if forbidden:
        errors.append("Editorial QA must not contain execution parameters: " + ", ".join(forbidden))

    issue = record.get("primary_issue")
    brief = record.get("builder_brief")
    if decision == "PASS_AS_IS":
        if issue is not None or brief is not None:
            errors.append("PASS_AS_IS cannot contain a primary issue or Builder brief")
    elif decision in {"BUILDER_LOCAL_REPAIR", "BUILDER_RECOMPOSE"}:
        if record.get("confidence") != "high":
            errors.append("a Builder revision requires high confidence")
        if not isinstance(issue, dict) or any(not issue.get(key) for key in ("problem", "evidence", "materiality", "source_ids")):
            errors.append("Builder revision requires one complete primary_issue")
        expected_mode = "local-repair" if decision == "BUILDER_LOCAL_REPAIR" else "recompose"
        if not isinstance(brief, dict) or brief.get("mode") != expected_mode:
            errors.append(f"{decision} requires builder_brief.mode={expected_mode}")
        elif any(not brief.get(key) for key in ("objective", "rationale", "protected_strengths", "success_criteria", "forbidden_changes")):
            errors.append("Builder brief lacks objective, rationale, protected strengths, success criteria, or forbidden changes")
        issue_group = issue.get("group_id") if isinstance(issue, dict) else None
        if issue_group:
            matched = next((group for group in groups if isinstance(group, dict) and group.get("group_id") == issue_group), None)
            if not matched:
                errors.append("primary_issue.group_id must reference diagnostic_basis.visual_groups")
            elif set(issue.get("source_ids", [])) != set(matched.get("source_ids", [])):
                errors.append("a repeated-group issue must cover every declared group member")
    elif decision == "EDITORIAL_BLOCKED" and (brief is not None or not record.get("blocked_reason")):
        errors.append("EDITORIAL_BLOCKED requires blocked_reason and no Builder brief")

    result = {
        "ok": not errors,
        "code": "EDITORIAL_QA_PASS" if not errors else "EDITORIAL_QA_FAIL",
        "decision": decision,
        "errors": errors,
    }
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(10)


if __name__ == "__main__":
    main()
