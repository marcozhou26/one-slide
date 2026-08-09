#!/usr/bin/env python3
"""Write a hash-locked Editorial Editor manifest after visual judgment."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

RUBRIC_KEYS = {"visual_subject", "title_evidence", "evidence_annotation", "semantic_emphasis", "reading_rhythm", "information_contribution"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--diagnosis", type=Path, required=True)
    parser.add_argument("--verification", type=Path, required=True)
    parser.add_argument("--patch", type=Path)
    parser.add_argument("--decision", choices=("EDITORIAL_IMPROVEMENT_PASS", "NO_MATERIAL_EDIT", "EDITORIAL_CANDIDATE_REJECTED", "EDITORIAL_EDIT_BLOCKED"), required=True)
    parser.add_argument("--improved-dimensions", default="")
    parser.add_argument("--judgment", required=True)
    parser.add_argument("--reviewer-status", choices=("pass", "rejected", "blocked"), required=True)
    parser.add_argument("--reviewer-evidence", required=True)
    parser.add_argument("--baseline-render", type=Path, required=True)
    parser.add_argument("--candidate-render", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    diagnosis = json.loads(args.diagnosis.read_text(encoding="utf-8"))
    verification = json.loads(args.verification.read_text(encoding="utf-8"))
    patch = json.loads(args.patch.read_text(encoding="utf-8")) if args.patch else {"operations": []}
    dimensions = [value.strip() for value in args.improved_dimensions.split(",") if value.strip()]
    if any(value not in RUBRIC_KEYS for value in dimensions):
        raise SystemExit("improved dimensions must use the six rubric keys")
    if args.decision == "EDITORIAL_IMPROVEMENT_PASS" and not dimensions:
        raise SystemExit("EDITORIAL_IMPROVEMENT_PASS requires at least one improved dimension")
    if args.decision == "EDITORIAL_IMPROVEMENT_PASS" and not verification.get("verification_pass"):
        raise SystemExit("EDITORIAL_IMPROVEMENT_PASS requires verification_pass")
    expected_reviewer_status = "pass" if args.decision in {"EDITORIAL_IMPROVEMENT_PASS", "NO_MATERIAL_EDIT"} else ("rejected" if args.decision == "EDITORIAL_CANDIDATE_REJECTED" else "blocked")
    if args.reviewer_status != expected_reviewer_status:
        raise SystemExit(f"{args.decision} requires reviewer status {expected_reviewer_status}")
    manifest = {
        "version": "1.0",
        "source_sha256": sha256(args.source),
        "source_pptx": str(args.source.resolve()),
        "candidate_sha256": sha256(args.candidate),
        "candidate_pptx": str(args.candidate.resolve()),
        "decision": args.decision,
        "primary_issue": diagnosis.get("primary_issue"),
        "edit_hypothesis": diagnosis.get("edit_hypothesis"),
        "operations_count": len(patch.get("operations", [])),
        "improved_dimensions": dimensions,
        "editorial_judgment": args.judgment,
        "reviewer": {"status": args.reviewer_status, "evidence": args.reviewer_evidence},
        "baseline_render": str(args.baseline_render.resolve()),
        "candidate_render": str(args.candidate_render.resolve()),
        "verification": str(args.verification.resolve()),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
