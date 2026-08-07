#!/usr/bin/env python3
import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


EMU_PER_POINT = 9525
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"


def emu(value):
    return round(float(value) * EMU_PER_POINT)


def normalized_geometry(rail):
    source_x, source_y = emu(rail["sourceX"]), emu(rail["sourceY"])
    target_x, target_y = emu(rail["targetX"]), emu(rail["targetY"])
    attrs = []
    if target_x < source_x:
        attrs.append('flipH="1"')
    if target_y < source_y:
        attrs.append('flipV="1"')
    attr_text = f" {' '.join(attrs)}" if attrs else ""
    xfrm = (
        f'<a:xfrm{attr_text} xmlns:a="{DRAWING_NS}">'
        f'<a:off x="{min(source_x, target_x)}" y="{min(source_y, target_y)}" />'
        f'<a:ext cx="{abs(target_x - source_x)}" cy="{abs(target_y - source_y)}" />'
        '</a:xfrm>'
    )
    geometry = (
        f'<a:prstGeom prst="bentConnector3" xmlns:a="{DRAWING_NS}">'
        '<a:avLst><a:gd name="adj1" fmla="val 50000" /></a:avLst>'
        '</a:prstGeom>'
    )
    return xfrm, geometry


def patch_slide(xml, ledger):
    patched = 0
    for relation in ledger:
        connector = relation.get("connector", {})
        rail = connector.get("lockedRail")
        if not rail:
            continue
        expected_name = f'name="{connector["id"]}"'
        match = next(
            (candidate for candidate in re.finditer(r'<p:cxnSp>.*?</p:cxnSp>', xml, re.DOTALL)
             if expected_name in candidate.group(0)),
            None,
        )
        if not match:
            raise RuntimeError(f"Connector not found in slide XML: {connector['id']}")
        block = match.group(0)
        xfrm, geometry = normalized_geometry(rail)
        block, start_connection_count = re.subn(r'<a:stCxn[^>]*/>', '', block, count=1, flags=re.DOTALL)
        block, end_connection_count = re.subn(r'<a:endCxn[^>]*/>', '', block, count=1, flags=re.DOTALL)
        block, xfrm_count = re.subn(r'<a:xfrm[^>]*>.*?</a:xfrm>', xfrm, block, count=1, flags=re.DOTALL)
        block, geom_count = re.subn(r'<a:prstGeom[^>]*>.*?</a:prstGeom>', geometry, block, count=1, flags=re.DOTALL)
        if start_connection_count > 1 or end_connection_count > 1 or xfrm_count != 1 or geom_count != 1:
            raise RuntimeError(f"Connector geometry is incomplete: {connector['id']}")
        xml = xml[:match.start()] + block + xml[match.end():]
        patched += 1
    return xml, patched


def normalize(pptx_path, ledger_path):
    pptx = Path(pptx_path)
    ledger = json.loads(Path(ledger_path).read_text(encoding="utf-8"))
    with ZipFile(pptx, "r") as source:
        slide_xml = source.read("ppt/slides/slide1.xml").decode("utf-8")
        slide_xml, patched = patch_slide(slide_xml, ledger)
        if patched == 0:
            return 0
        handle, temp_name = tempfile.mkstemp(prefix=f".{pptx.stem}-", suffix=".pptx", dir=pptx.parent)
        os.close(handle)
        try:
            with ZipFile(temp_name, "w", ZIP_DEFLATED) as target:
                for item in source.infolist():
                    data = slide_xml.encode("utf-8") if item.filename == "ppt/slides/slide1.xml" else source.read(item.filename)
                    target.writestr(item, data)
            os.replace(temp_name, pptx)
        finally:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
    return patched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pptx", required=True)
    parser.add_argument("--ledger", required=True)
    args = parser.parse_args()
    print(json.dumps({"patched": normalize(args.pptx, args.ledger)}))


if __name__ == "__main__":
    main()
