#!/usr/bin/env python3
"""Audit contrast for text affected by a Builder editorial revision."""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path


HEX = re.compile(r"^#?([0-9a-f]{6})$", re.I)


def rgb(value: str | None) -> tuple[int, int, int] | None:
    match = HEX.match(str(value or ""))
    return tuple(int(match.group(1)[i:i + 2], 16) for i in (0, 2, 4)) if match else None


def luminance(color: tuple[int, int, int]) -> float:
    channels = [component / 255 for component in color]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(foreground: tuple[int, int, int], background: tuple[int, int, int]) -> float:
    first, second = sorted((luminance(foreground), luminance(background)), reverse=True)
    return (first + 0.05) / (second + 0.05)


def contains(outer: list[float], inner: list[float], tolerance: float = 2) -> bool:
    left, top, width, height = outer
    x, y, w, h = inner
    return x >= left - tolerance and y >= top - tolerance and x + w <= left + width + tolerance and y + h <= top + height + tolerance


def target_name(selector: str) -> str | None:
    from urllib.parse import unquote
    return unquote(selector[5:]) if selector.startswith("name/") else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--layout", type=Path, required=True)
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    layout = json.loads(args.layout.read_text(encoding="utf-8"))
    audit = json.loads(args.audit.read_text(encoding="utf-8"))
    elements = [item for item in layout.get("elements", []) if item.get("scope") == "slide" and isinstance(item.get("bbox"), list)]
    by_name = {item.get("name"): item for item in elements if item.get("name")}
    affected: dict[str, str] = {}
    errors: list[str] = []
    for operation in audit.get("operations", []):
        name = target_name(str(operation.get("target", "")))
        if not name or name not in by_name:
            errors.append(f"changed target unresolved in candidate layout: {operation.get('target')}")
            continue
        target = by_name[name]
        if operation.get("op") in {"text-color", "font-size", "font-weight", "text-insets", "move", "resize"} and str(target.get("text", "")).strip():
            affected[name] = operation["op"]
        if operation.get("op") == "shape-fill":
            for item in elements:
                if str(item.get("text", "")).strip() and contains(target["bbox"], item["bbox"]):
                    affected[item["name"]] = f"contained by changed fill {name}"

    findings = []
    for name, reason in affected.items():
        item = by_name[name]
        background = rgb(item.get("fillColor"))
        if background is None:
            candidates = [container for container in elements if container.get("order", 0) < item.get("order", math.inf) and rgb(container.get("fillColor")) and contains(container["bbox"], item["bbox"])]
            if candidates:
                container = min(candidates, key=lambda value: value["bbox"][2] * value["bbox"][3])
                background = rgb(container.get("fillColor"))
        background = background or (255, 255, 255)
        text_runs = []
        for paragraph_index, paragraph in enumerate(item.get("paragraphs", []), start=1):
            paragraph_style = paragraph.get("resolvedTextStyle", {})
            runs = [run for run in paragraph.get("runs", []) if str(run.get("text", "")).strip()]
            if not runs and str(paragraph.get("text", "")).strip():
                runs = [{"text": paragraph.get("text")}]
            for run_index, run in enumerate(runs, start=1):
                foreground = rgb(run.get("color")) or rgb(paragraph_style.get("color")) or rgb(item.get("resolvedTextStyle", {}).get("color"))
                font_size = float(run.get("fontSize") or paragraph_style.get("fontSize") or item.get("resolvedFontSize") or 0)
                bold = bool(run.get("bold", paragraph_style.get("bold", False)))
                text_runs.append((paragraph_index, run_index, str(run.get("text", "")), foreground, font_size, bold))
        if not text_runs:
            text_runs = [(1, 1, str(item.get("text", "")), rgb(item.get("resolvedTextStyle", {}).get("color")), float(item.get("resolvedFontSize") or 0), False)]
        for paragraph_index, run_index, text, foreground, font_size, bold in text_runs:
            if foreground is None:
                findings.append({"name": name, "paragraph": paragraph_index, "run": run_index, "text": text, "reason": reason, "pass": False, "error": "foreground color unresolved"})
                continue
            contrast = ratio(foreground, background)
            threshold = 3.0 if font_size >= 18 or (bold and font_size >= 14) else 4.5
            findings.append({"name": name, "paragraph": paragraph_index, "run": run_index, "text": text, "reason": reason, "contrast_ratio": round(contrast, 2), "threshold": threshold, "pass": contrast >= threshold})

    ok = not errors and all(item.get("pass") for item in findings)
    result = {"ok": ok, "code": "EDITORIAL_CONTRAST_PASS" if ok else "EDITORIAL_CONTRAST_FAIL", "affected_text_count": len(affected), "findings": findings, "errors": errors}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not ok:
        raise SystemExit(10)


if __name__ == "__main__":
    main()
