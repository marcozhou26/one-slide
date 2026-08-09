#!/usr/bin/env python3
"""Audit a generated PPTX for V3 single-slide structural warning signals."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {"a": "http://schemas.openxmlformats.org/drawingml/2006/main", "p": "http://schemas.openxmlformats.org/presentationml/2006/main"}
BAR_PATTERN = re.compile(r"(?:｜|\s\|\s)")
DATA_LABEL_PATTERN = re.compile(r"^(?:task-t\d+|data-label-.+)$")


@dataclass
class Result:
    ok: bool
    code: str
    slides: int
    pictures: int
    min_font_pt: float | None
    font_sizes_pt: list[float]
    field_simulation_warnings: list[str]


def audit(path: Path) -> Result:
    if not path.is_file() or path.suffix.lower() != ".pptx":
        return Result(False, "INPUT_CONTRACT_FAIL", 0, 0, None, [], ["Expected a readable .pptx file"])
    warnings: list[str] = []
    fonts: list[float] = []
    regular_fonts: list[float] = []
    data_label_fonts: list[float] = []
    pictures = 0
    slides = 0
    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
        slides = len(slide_names)
        for slide_name in slide_names:
            root = ET.fromstring(archive.read(slide_name))
            pictures += len(root.findall(".//p:pic", NS))
            for text_node in root.findall(".//a:t", NS):
                text = text_node.text or ""
                if BAR_PATTERN.search(text):
                    warnings.append(f"{slide_name}: {text}")
            for shape in root.findall(".//p:sp", NS):
                name = shape.find("./p:nvSpPr/p:cNvPr", NS).get("name", "")
                text = "".join(node.text or "" for node in shape.findall(".//a:t", NS)).strip()
                extent = shape.find("./p:spPr/a:xfrm/a:ext", NS)
                width_pt = int(extent.get("cx", "0")) / 12700 if extent is not None else 0
                height_pt = int(extent.get("cy", "0")) / 12700 if extent is not None else 0
                micro_badge = (
                    name.startswith("org-risk-badge-")
                    and len(text) == 1
                    and width_pt <= 22
                    and height_pt <= 20
                )
                controlled_data_label = bool(DATA_LABEL_PATTERN.fullmatch(name))
                props_list = (
                    shape.findall(".//a:rPr", NS)
                    + shape.findall(".//a:defRPr", NS)
                    + shape.findall(".//a:endParaRPr", NS)
                )
                for props in props_list:
                    size = props.get("sz")
                    if not size or not size.isdigit():
                        continue
                    point_size = int(size) / 100
                    fonts.append(point_size)
                    if controlled_data_label:
                        data_label_fonts.append(point_size)
                    elif micro_badge and point_size < 12:
                        if props.tag == f"{{{NS['a']}}}rPr" and props.get("b") != "0":
                            warnings.append(f"{slide_name}: micro risk badge must use regular weight: {name}")
                    else:
                        regular_fonts.append(point_size)
    min_font = min(fonts) if fonts else None
    font_sizes = sorted(set(fonts))
    if slides != 1:
        warnings.append(f"Expected exactly one slide, found {slides}")
    regular_font_sizes = sorted(set(regular_fonts))
    regular_min_font = min(regular_fonts) if regular_fonts else None
    if regular_min_font is not None and regular_min_font < 12:
        warnings.append(f"Visible non-badge font below 12 pt: {regular_min_font:g} pt")
    data_label_min_font = min(data_label_fonts) if data_label_fonts else None
    if data_label_min_font is not None and data_label_min_font < 10:
        warnings.append(f"Controlled data-label font below 10 pt: {data_label_min_font:g} pt")
    if len(regular_font_sizes) > 5:
        warnings.append(f"Too many regular font sizes: {', '.join(f'{size:g}' for size in regular_font_sizes)}")
    ok = not warnings and pictures == 0 and slides == 1
    code = "SEMANTIC_AUDIT_PASS" if ok else "SEMANTIC_AUDIT_FAIL"
    if pictures:
        warnings.append(f"Found {pictures} picture objects; verify the page was not flattened")
    return Result(ok, code, slides, pictures, min_font, font_sizes, warnings)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", type=Path)
    args = parser.parse_args()
    try:
        result = audit(args.pptx)
    except (OSError, zipfile.BadZipFile, ET.ParseError) as error:
        result = Result(False, "PPTX_READ_FAIL", 0, 0, None, [], [str(error)])
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    return 0 if result.ok else 10


if __name__ == "__main__":
    sys.exit(main())
