#!/usr/bin/env python3
"""Verify content invariants after a Builder revision requested by Editorial QA."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageChops, ImageStat


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
TOKEN_RE = re.compile(r"[−+\-]?\d+(?:\.\d+)?(?:pp|%|％|人|万元|百万元|月|年|天|次/月)?")


def inspect_pptx(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        slides = sorted(name for name in archive.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", name))
        texts: list[str] = []
        counts = Counter()
        for name in slides:
            xml = archive.read(name)
            counts["shape_nodes"] += xml.count(b"<p:sp>")
            counts["picture_nodes"] += xml.count(b"<p:pic>")
            counts["graphic_frames"] += xml.count(b"<p:graphicFrame>")
            counts["group_nodes"] += xml.count(b"<p:grpSp>")
            counts["connector_nodes"] += xml.count(b"<p:cxnSp>")
            root = ET.fromstring(xml)
            texts.extend("".join(node.text or "" for node in shape.findall(".//a:t", NS)).strip() for shape in root.findall(".//p:sp", NS))
        visible = [text for text in texts if text]
        tokens = TOKEN_RE.findall("\n".join(visible))
        return {"slides": len(slides), **counts, "texts": Counter(visible), "tokens": Counter(tokens)}


def compare_images(source: Path, candidate: Path) -> dict:
    before = Image.open(source).convert("RGB")
    after = Image.open(candidate).convert("RGB")
    if before.size != after.size:
        return {"complete": False, "error": "image size mismatch"}
    difference = ImageChops.difference(before, after)
    stats = ImageStat.Stat(difference)
    mean_abs = sum(stats.mean) / (len(stats.mean) * 255.0)
    thresholded = difference.convert("L").point(lambda value: 255 if value > 8 else 0)
    changed = thresholded.histogram()[255]
    total = before.size[0] * before.size[1]
    return {
        "complete": True,
        "mean_abs_diff": round(mean_abs, 6),
        "changed_pixel_ratio": round(changed / total, 6),
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_inspect_manifest(path: Path, pptx: Path) -> tuple[dict, list[str]]:
    errors: list[str] = []
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return {}, [f"inspect manifest unreadable: {error}"]
    if manifest.get("source_sha256") != sha256(pptx):
        errors.append("inspect manifest is not bound to PPTX")
    for key, hash_key in (("png", "png_sha256"), ("layout", "layout_sha256"), ("inventory", "inventory_sha256")):
        asset = Path(manifest.get(key, ""))
        if not asset.is_file():
            errors.append(f"inspect asset missing: {key}")
        elif manifest.get(hash_key) != sha256(asset):
            errors.append(f"inspect asset hash mismatch: {key}")
    return manifest, errors


def regenerate_inspection(workspace: Path, pptx: Path, output: Path) -> tuple[dict, list[str]]:
    script = workspace / "editorial/scripts/inspect_editorial_slide.mjs"
    process = subprocess.run(
        ["node", str(script), "--workspace", str(workspace), "--input", str(pptx), "--output-dir", str(output)],
        text=True, capture_output=True, check=False,
    )
    if process.returncode != 0:
        return {}, [f"fresh inspection failed: {process.stderr.strip() or process.stdout.strip()}"]
    try:
        return json.loads((output / "inspect-manifest.json").read_text(encoding="utf-8")), []
    except (OSError, json.JSONDecodeError) as error:
        return {}, [f"fresh inspection manifest unreadable: {error}"]


def expected_texts(source: Counter, audit: dict) -> tuple[Counter, bool]:
    return source.copy(), True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pptx", type=Path, required=True)
    parser.add_argument("--candidate-pptx", type=Path, required=True)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--source-inspect-manifest", type=Path, required=True)
    parser.add_argument("--candidate-inspect-manifest", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    source = inspect_pptx(args.source_pptx)
    candidate = inspect_pptx(args.candidate_pptx)
    source_manifest, source_manifest_errors = load_inspect_manifest(args.source_inspect_manifest, args.source_pptx)
    candidate_manifest, candidate_manifest_errors = load_inspect_manifest(args.candidate_inspect_manifest, args.candidate_pptx)
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    audit_binding_ok = (
        audit.get("source_sha256") == sha256(args.source_pptx)
        and audit.get("output_sha256") == sha256(args.candidate_pptx)
    )
    expected, text_proof_ok = expected_texts(source["texts"], audit)
    structure_ok = (
        source["slides"] == candidate["slides"] == 1
        and source["picture_nodes"] == candidate["picture_nodes"]
        and source["graphic_frames"] == candidate["graphic_frames"]
        and source["group_nodes"] == candidate["group_nodes"]
        and source["shape_nodes"] == candidate["shape_nodes"]
    )
    tokens_ok = source["tokens"] == candidate["tokens"]
    texts_ok = expected == candidate["texts"] and text_proof_ok
    with tempfile.TemporaryDirectory(prefix="oneslide-editorial-verify-") as temporary:
        temporary_root = Path(temporary)
        fresh_source, fresh_source_errors = regenerate_inspection(args.workspace.resolve(), args.source_pptx, temporary_root / "source")
        fresh_candidate, fresh_candidate_errors = regenerate_inspection(args.workspace.resolve(), args.candidate_pptx, temporary_root / "candidate")
        provenance_errors = fresh_source_errors + fresh_candidate_errors
        for label, supplied, fresh in (("source", source_manifest, fresh_source), ("candidate", candidate_manifest, fresh_candidate)):
            for hash_key in ("source_sha256", "png_sha256", "layout_sha256", "inventory_sha256"):
                if supplied.get(hash_key) != fresh.get(hash_key):
                    provenance_errors.append(f"{label} supplied inspection is not reproducible: {hash_key}")
        inspect_binding_ok = not source_manifest_errors and not candidate_manifest_errors and not provenance_errors
        visual = compare_images(Path(fresh_source.get("png", "")), Path(fresh_candidate.get("png", ""))) if inspect_binding_ok else {"complete": False, "errors": source_manifest_errors + candidate_manifest_errors + provenance_errors}
        operations = len(audit.get("operations", []))
        visual_change_ok = visual.get("complete") and (
            visual.get("changed_pixel_ratio", 0) > 0 if operations else visual.get("changed_pixel_ratio", 1) <= 0.00001
        )
    native_editable_ok = (
        candidate["slides"] == 1
        and candidate["shape_nodes"] + candidate["connector_nodes"] + candidate["graphic_frames"] > 0
        and not (candidate["picture_nodes"] == 1 and candidate["shape_nodes"] == 0 and candidate["graphic_frames"] == 0)
    )
    result = {
        "source_pptx": str(args.source_pptx),
        "candidate_pptx": str(args.candidate_pptx),
        "operations_count": operations,
        "structure_pass": structure_ok,
        "semantic_tokens_pass": tokens_ok,
        "reviewed_text_changes_pass": texts_ok,
        "inspect_binding_pass": inspect_binding_ok,
        "patch_audit_binding_pass": audit_binding_ok,
        "native_editable_pass": native_editable_ok,
        "visual": visual,
        "visual_change_observed": visual_change_ok,
        "verification_pass": structure_ok and tokens_ok and texts_ok and inspect_binding_ok and audit_binding_ok and native_editable_ok and visual_change_ok,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=lambda value: dict(value)) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["verification_pass"]:
        raise SystemExit(10)


if __name__ == "__main__":
    main()
