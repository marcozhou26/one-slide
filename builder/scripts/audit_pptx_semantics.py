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
SLIDE_NUMBER_FONT_PT = 8.0


def slide_size(archive: zipfile.ZipFile) -> tuple[int, int]:
    root = ET.fromstring(archive.read("ppt/presentation.xml"))
    size = root.find("p:sldSz", NS)
    if size is None:
        raise ET.ParseError("presentation.xml has no p:sldSz")
    return int(size.get("cx", "0")), int(size.get("cy", "0"))


def slide_number_shapes(root: ET.Element) -> list[ET.Element]:
    result: list[ET.Element] = []
    for shape in root.findall(".//p:sp", NS):
        placeholder = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if placeholder is not None and placeholder.get("type") == "sldNum":
            result.append(shape)
    return result


def inspect_slide_number_part(root: ET.Element, part_name: str, width: int, height: int) -> list[str]:
    warnings: list[str] = []
    shapes = slide_number_shapes(root)
    if len(shapes) != 1:
        return [f"{part_name}: expected one automatic slide-number placeholder, found {len(shapes)}"]
    shape = shapes[0]
    fields = shape.findall(".//a:fld", NS)
    if len(fields) != 1 or fields[0].get("type") != "slidenum":
        warnings.append(f"{part_name}: slide-number placeholder is not backed by one slidenum field")
    sizes = {
        int(node.get("sz")) / 100
        for node in shape.findall(".//a:rPr", NS)
        + shape.findall(".//a:defRPr", NS)
        + shape.findall(".//a:endParaRPr", NS)
        if node.get("sz", "").isdigit()
    }
    if sizes != {SLIDE_NUMBER_FONT_PT}:
        warnings.append(f"{part_name}: slide-number font must be exactly 8 pt, found {sorted(sizes)}")
    transform = shape.find("./p:spPr/a:xfrm", NS)
    offset = transform.find("a:off", NS) if transform is not None else None
    extent = transform.find("a:ext", NS) if transform is not None else None
    if offset is None or extent is None:
        warnings.append(f"{part_name}: slide-number placeholder has no explicit geometry")
    else:
        x, y = int(offset.get("x", "0")), int(offset.get("y", "0"))
        w, h = int(extent.get("cx", "0")), int(extent.get("cy", "0"))
        if x < width * 0.9 or y < height * 0.9 or x + w > width or y + h > height:
            warnings.append(f"{part_name}: slide-number placeholder is not inside the bottom-right page region")
    return warnings


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
    pictures = 0
    unauthorized_pictures = 0
    slides = 0
    with zipfile.ZipFile(path) as archive:
        slide_width, slide_height = slide_size(archive)
        slide_names = sorted(name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name))
        slides = len(slide_names)
        for slide_name in slide_names:
            root = ET.fromstring(archive.read(slide_name))
            warnings.extend(inspect_slide_number_part(root, slide_name, slide_width, slide_height))
            picture_nodes = root.findall(".//p:pic", NS)
            pictures += len(picture_nodes)
            for text_node in root.findall(".//a:t", NS):
                text = text_node.text or ""
                if BAR_PATTERN.search(text):
                    warnings.append(f"{slide_name}: {text}")
            for shape in root.findall(".//p:sp", NS):
                name = shape.find("./p:nvSpPr/p:cNvPr", NS).get("name", "")
                placeholder = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
                automatic_slide_number = placeholder is not None and placeholder.get("type") == "sldNum"
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
                    if automatic_slide_number:
                        continue
                    if micro_badge and point_size < 12:
                        if props.tag == f"{{{NS['a']}}}rPr" and props.get("b") != "0":
                            warnings.append(f"{slide_name}: micro risk badge must use regular weight: {name}")
                    else:
                        regular_fonts.append(point_size)
        for part_name in sorted(
            name
            for name in archive.namelist()
            if re.fullmatch(r"ppt/(?:slideMasters/slideMaster|slideLayouts/slideLayout)\d+\.xml", name)
        ):
            root = ET.fromstring(archive.read(part_name))
            warnings.extend(inspect_slide_number_part(root, part_name, slide_width, slide_height))
        tabler_svg_icons = sum(
            1
            for name in archive.namelist()
            if re.fullmatch(r"ppt/media/image\d*\.svg", name)
            and b"icon-tabler" in archive.read(name)
        )
        unauthorized_pictures = max(0, pictures - tabler_svg_icons)
    min_font = min(fonts) if fonts else None
    font_sizes = sorted(set(fonts))
    if slides != 1:
        warnings.append(f"Expected exactly one slide, found {slides}")
    regular_font_sizes = sorted(set(regular_fonts))
    regular_min_font = min(regular_fonts) if regular_fonts else None
    if regular_min_font is not None and regular_min_font < 12:
        warnings.append(f"Visible non-badge font below 12 pt: {regular_min_font:g} pt")
    if len(regular_font_sizes) > 5:
        warnings.append(f"Too many regular font sizes: {', '.join(f'{size:g}' for size in regular_font_sizes)}")
    if unauthorized_pictures:
        warnings.append(f"Found {unauthorized_pictures} unauthorized picture objects; verify the page was not flattened")
    ok = not warnings and unauthorized_pictures == 0 and slides == 1
    code = "SEMANTIC_AUDIT_PASS" if ok else "SEMANTIC_AUDIT_FAIL"
    if pictures and not unauthorized_pictures:
        # Whitelisted semantic SVG icons remain independent picture objects;
        # the slide is still native-editable and has not been flattened.
        pass
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
