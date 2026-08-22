#!/usr/bin/env python3
"""Clone editable shapes into an existing PowerPoint template slide.

The template package, slide master, layout, theme, background, and its own
decorative shapes remain intact. Only generated slide shapes are inserted.
Relationship-bearing generated content is blocked to avoid a partially broken deck.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"p": P, "a": A, "r": R}
ET.register_namespace("a", A)
ET.register_namespace("p", P)
ET.register_namespace("r", R)


class TemplateError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    try:
        return ET.fromstring(archive.read(name))
    except KeyError as error:
        raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", f"Missing package part: {name}") from error


def slide_size(archive: zipfile.ZipFile) -> tuple[int, int]:
    root = read_xml(archive, "ppt/presentation.xml")
    size = root.find("p:sldSz", NS)
    if size is None:
        raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", "Presentation has no slide size")
    return int(size.attrib["cx"]), int(size.attrib["cy"])


def slide_count(archive: zipfile.ZipFile) -> int:
    root = read_xml(archive, "ppt/presentation.xml")
    slide_ids = root.find("p:sldIdLst", NS)
    return 0 if slide_ids is None else len(list(slide_ids))


def shape_children(slide_root: ET.Element) -> list[ET.Element]:
    tree = slide_root.find("p:cSld/p:spTree", NS)
    if tree is None:
        raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", "Slide has no shape tree")
    return list(tree)[2:]


def is_slide_number_placeholder(element: ET.Element) -> bool:
    placeholder = element.find("p:nvSpPr/p:nvPr/p:ph", NS)
    return placeholder is not None and placeholder.attrib.get("type") == "sldNum"


def relationship_attributes(element: ET.Element) -> list[str]:
    return [key for node in element.iter() for key in node.attrib if key.startswith(f"{{{R}}}")]


def remap_ids(elements: list[ET.Element], next_id: int) -> tuple[dict[str, str], int]:
    mapping: dict[str, str] = {}
    for element in elements:
        for node in element.iter(f"{{{P}}}cNvPr"):
            old = node.attrib.get("id")
            if old is None:
                continue
            new = str(next_id)
            next_id += 1
            mapping[old] = new
            node.set("id", new)
    for element in elements:
        for node in element.iter():
            if node.tag in {f"{{{A}}}stCxn", f"{{{A}}}endCxn"}:
                old = node.attrib.get("id")
                if old in mapping:
                    node.set("id", mapping[old])
    return mapping, next_id


def apply_template(template: Path, generated: Path, output: Path, target_slide: int) -> dict:
    if target_slide < 1:
        raise TemplateError("INPUT_CONTRACT_FAIL", "target-slide is 1-based")
    if not template.is_file():
        raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", f"Template file does not exist: {template}")
    if not generated.is_file():
        raise TemplateError("SOURCE_BASELINE_FAIL", f"Generated PPTX does not exist: {generated}")
    try:
        template_zip = zipfile.ZipFile(template)
        generated_zip = zipfile.ZipFile(generated)
    except zipfile.BadZipFile as error:
        raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", f"Invalid PPTX package: {error}") from error
    with template_zip, generated_zip:
        template_size = slide_size(template_zip)
        generated_size = slide_size(generated_zip)
        if template_size != generated_size:
            raise TemplateError(
                "TEMPLATE_COMPATIBILITY_FAIL",
                f"Slide size differs: template={template_size}, generated={generated_size}",
            )
        count = slide_count(template_zip)
        if target_slide > count:
            raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", f"Template has only {count} slides")
        template_slide_name = f"ppt/slides/slide{target_slide}.xml"
        generated_slide_name = "ppt/slides/slide1.xml"
        template_root = read_xml(template_zip, template_slide_name)
        generated_root = read_xml(generated_zip, generated_slide_name)
        template_tree = template_root.find("p:cSld/p:spTree", NS)
        assert template_tree is not None
        generated_shapes = [
            copy.deepcopy(item)
            for item in shape_children(generated_root)
            if not is_slide_number_placeholder(item)
        ]
        if not generated_shapes:
            raise TemplateError("TEMPLATE_COMPATIBILITY_FAIL", "Generated page has no editable shapes")
        if any(relationship_attributes(item) for item in generated_shapes):
            raise TemplateError(
                "TEMPLATE_CONTENT_RELATIONSHIP_UNSUPPORTED",
                "Generated page contains images, charts, media, or hyperlinks that require relationship cloning",
            )
        template_ids = [int(node.attrib["id"]) for node in template_root.iter(f"{{{P}}}cNvPr") if node.attrib.get("id", "").isdigit()]
        remap_ids(generated_shapes, max(template_ids, default=0) + 1)
        insert_at = 2
        for element in generated_shapes:
            template_tree.insert(insert_at, element)
            insert_at += 1
        slide_xml = ET.tostring(template_root, encoding="utf-8", xml_declaration=True)

        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix=".pptx", delete=False, dir=output.parent) as temp_stream:
            temp_path = Path(temp_stream.name)
        try:
            with zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as out_zip:
                for info in template_zip.infolist():
                    data = slide_xml if info.filename == template_slide_name else template_zip.read(info.filename)
                    out_zip.writestr(info, data)
            numbering_script = Path(__file__).with_name("ensure_auto_slide_number.mjs")
            numbering = subprocess.run(
                ["node", str(numbering_script), str(temp_path)],
                check=False,
                capture_output=True,
                text=True,
            )
            if numbering.returncode != 0:
                raise TemplateError(
                    "AUTO_SLIDE_NUMBER_FAIL",
                    numbering.stderr.strip() or numbering.stdout.strip() or "Automatic slide numbering failed",
                )
            os.replace(temp_path, output)
        finally:
            if temp_path.exists():
                temp_path.unlink()

    return {
        "status": "TEMPLATE_APPLIED",
        "template_sha256": sha256(template),
        "generated_sha256": sha256(generated),
        "output_sha256": sha256(output),
        "target_slide": target_slide,
        "template_slide_count": count,
        "editable_shapes_cloned": len(generated_shapes),
        "slide_size_emu": list(template_size),
        "template_master_preserved": True,
        "template_layout_preserved": True,
        "automatic_slide_number_ready": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", required=True, type=Path)
    parser.add_argument("--generated", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--target-slide", type=int, default=1)
    parser.add_argument("--manifest", type=Path)
    args = parser.parse_args()
    try:
        result = apply_template(args.template, args.generated, args.output, args.target_slide)
        if args.manifest:
            args.manifest.parent.mkdir(parents=True, exist_ok=True)
            args.manifest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except TemplateError as error:
        print(json.dumps({"code": error.code, "message": str(error)}, ensure_ascii=False))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
