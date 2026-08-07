import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "normalize_org_connectors.py"
SPEC = importlib.util.spec_from_file_location("normalize_org_connectors", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class NormalizeOrgConnectorsTest(unittest.TestCase):
    def test_only_patches_the_named_vertical_rail_connector(self):
        untouched = (
            '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="1" name="other" />'
            '<p:cNvCxnSpPr><a:stCxn id="1" idx="1"/><a:endCxn id="2" idx="1"/>'
            '</p:cNvCxnSpPr></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/>'
            '<a:ext cx="3" cy="4"/></a:xfrm><a:prstGeom prst="bentConnector3">'
            '<a:avLst/></a:prstGeom></p:spPr></p:cxnSp>'
        )
        target = untouched.replace('id="1" name="other"', 'id="3" name="sales-east"')
        xml = untouched + target
        ledger = [{
            "connector": {
                "id": "sales-east",
                "lockedRail": {
                    "sourceX": 40,
                    "sourceY": 207,
                    "targetX": 50,
                    "targetY": 274,
                },
            },
        }]

        patched, count = MODULE.patch_slide(xml, ledger)

        self.assertEqual(count, 1)
        self.assertIn(untouched, patched)
        target_block = patched[patched.index('name="sales-east"') - 43:]
        self.assertNotIn("<a:stCxn", target_block)
        self.assertIn('<a:off x="381000" y="1971675" />', target_block)
        self.assertIn('<a:ext cx="95250" cy="638175" />', target_block)
        self.assertIn('prst="bentConnector3"', target_block)
        self.assertIn('name="adj1" fmla="val 50000"', target_block)

    def test_patches_an_already_detached_connector(self):
        xml = (
            '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="3" name="sales-east" />'
            '<p:cNvCxnSpPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="1" y="2"/>'
            '<a:ext cx="3" cy="4"/></a:xfrm><a:prstGeom prst="bentConnector3">'
            '<a:avLst/></a:prstGeom></p:spPr></p:cxnSp>'
        )
        ledger = [{
            "connector": {
                "id": "sales-east",
                "lockedRail": {"sourceX": 40, "sourceY": 207, "targetX": 50, "targetY": 274},
            },
        }]

        patched, count = MODULE.patch_slide(xml, ledger)

        self.assertEqual(count, 1)
        self.assertIn('<a:off x="381000" y="1971675" />', patched)
        self.assertIn('prst="bentConnector3"', patched)


if __name__ == "__main__":
    unittest.main()
