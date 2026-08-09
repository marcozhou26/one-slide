#!/usr/bin/env python3
"""Create a deterministic, non-rendering Editorial Editor run plan."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


SLIDE_RE = re.compile(r"^ppt/slides/slide(\d+)\.xml$")


def stop(status: str, reason: str, code: int) -> None:
    print(json.dumps({"status": status, "reason": reason}, ensure_ascii=False, indent=2))
    raise SystemExit(code)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slide_metrics(path: Path) -> tuple[int, int, int]:
    try:
        with zipfile.ZipFile(path) as archive:
            slides = {int(match.group(1)) for name in archive.namelist() if (match := SLIDE_RE.match(name))}
            slide_xml = b"".join(archive.read(name) for name in archive.namelist() if SLIDE_RE.match(name))
    except (OSError, zipfile.BadZipFile):
        stop("SOURCE_INVALID", "PPTX is unreadable or not a valid package", 4)
    if not slides:
        stop("SOURCE_INVALID", "PPTX contains no slide XML", 4)
    return len(slides), slide_xml.count(b"<p:sp>"), slide_xml.count(b"<p:cxnSp>")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--qa", choices=("standard", "targeted"))
    parser.add_argument("--handoff", type=Path)
    args = parser.parse_args()

    source = args.input.expanduser().resolve()
    output = args.output_dir.expanduser().resolve()
    if not source.exists():
        stop("SOURCE_REQUIRED", "input file does not exist", 2)
    if source.suffix.lower() == ".ppt":
        stop("SOURCE_CONVERSION_REQUIRED", "legacy PPT must be converted before editing", 6)
    if source.suffix.lower() != ".pptx":
        stop("SOURCE_INVALID", "input must be PPTX", 4)
    count, shape_count, connector_count = slide_metrics(source)
    if count != 1:
        stop("SINGLE_SLIDE_REQUIRED", f"Editorial Editor requires exactly one slide; found {count}", 3)
    if output == source.parent or output in source.parents:
        stop("OUTPUT_CONFLICT", "output directory must not be the source file directory itself", 7)
    if output.exists() and any(output.iterdir()):
        stop("OUTPUT_EXISTS", "output directory already contains work", 8)
    if args.handoff and not args.handoff.is_file():
        stop("SOURCE_VERSION_CONFLICT", "declared handoff does not exist", 9)
    handoff = None
    if args.handoff:
        try:
            handoff = json.loads(args.handoff.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            stop("SOURCE_VERSION_CONFLICT", "editorial handoff is unreadable or invalid JSON", 9)
        required = ("source_pptx_sha256", "central_message", "primary_relationship", "protected_content", "source_ids")
        missing = [key for key in required if not handoff.get(key)]
        if missing:
            stop("SOURCE_VERSION_CONFLICT", f"editorial handoff missing required fields: {', '.join(missing)}", 9)
        if handoff["source_pptx_sha256"] != sha256(source):
            stop("SOURCE_VERSION_CONFLICT", "editorial handoff source_pptx_sha256 does not match input", 9)

    mode = args.qa or ("targeted" if shape_count >= 60 or connector_count >= 10 else "standard")
    budgets = {
        "standard": {"max_candidates": 1, "max_render_rounds": 2},
        "targeted": {"max_candidates": 2, "max_render_rounds": 3},
    }
    print(json.dumps({
        "status": "EDITORIAL_READY",
        "input": str(source),
        "source_sha256": sha256(source),
        "slide_count": count,
        "qa_mode": mode,
        "qa_mode_basis": "explicit" if args.qa else ("complexity_derived" if mode == "targeted" else "default_standard"),
        "shape_count": shape_count,
        "connector_count": connector_count,
        **budgets[mode],
        "handoff": str(args.handoff.resolve()) if args.handoff else None,
        "handoff_basis": "hash_locked" if args.handoff else "derive_from_slide_if_unambiguous_and_record_in_diagnosis",
        "output_dir": str(output),
        "source_overwrite_allowed": False,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
