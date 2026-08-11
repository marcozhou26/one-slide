import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
MODULE_PATH = ROOT / "scripts" / "validate_suite.py"
SPEC = importlib.util.spec_from_file_location("validate_suite", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SuiteContractTests(unittest.TestCase):
    def test_release_source_passes_suite_validator(self):
        with tempfile.TemporaryDirectory() as temporary:
            copy_root = Path(temporary) / "one-slide"
            shutil.copytree(ROOT, copy_root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules"))
            result = MODULE.validate(copy_root)
            self.assertTrue(result["ok"], result)

    def test_only_one_public_skill_entry_exists(self):
        skill_files = [path.relative_to(ROOT).as_posix() for path in ROOT.rglob("SKILL.md")]
        self.assertEqual(skill_files, ["SKILL.md"])

    def test_nested_skill_entry_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            copy_root = Path(temporary) / "one-slide"
            shutil.copytree(ROOT, copy_root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules"))
            nested = copy_root / "builder" / "SKILL.md"
            nested.write_text("---\nname: hidden-builder\n---\n", encoding="utf-8")
            result = MODULE.validate(copy_root)
            self.assertFalse(result["ok"])
            self.assertTrue(any("exactly one public SKILL.md" in error for error in result["errors"]))

    def test_local_absolute_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            copy_root = Path(temporary) / "one-slide"
            shutil.copytree(ROOT, copy_root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "node_modules"))
            bad_path = "/" + "Users" + "/example/private/file.pptx"
            (copy_root / "README.md").write_text(f"Use {bad_path}", encoding="utf-8")
            result = MODULE.validate(copy_root)
            self.assertFalse(result["ok"])
            self.assertTrue(any("absolute user path" in error for error in result["errors"]))

    def test_prohibited_github_attribution_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            copy_root = Path(temporary) / "one-slide"
            shutil.copytree(ROOT, copy_root, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            bad_attribution = "nan" + "hai academy"
            (copy_root / "README.md").write_text(f"Background: {bad_attribution}", encoding="utf-8")
            result = MODULE.validate(copy_root)
            self.assertFalse(result["ok"])
            self.assertTrue(any("prohibited GitHub attribution" in error for error in result["errors"]))

    def test_builder_registry_is_complete_and_portable(self):
        registry = json.loads((ROOT / "builder/references/module-registry.json").read_text(encoding="utf-8"))
        modules = registry["modules"]
        self.assertEqual(registry["suite_version"], "1.3.1")
        self.assertEqual(registry["builder_engine_version"], "3.3.5")
        self.assertNotIn("skill_version", registry)
        self.assertEqual(registry["productized_module_count"], len(modules))
        for module in modules:
            for field in ("validator", "planner", "renderer", "reference"):
                self.assertTrue((ROOT / "builder" / module[field]).is_file(), (module["module_id"], field))

    def test_input_contract_covers_sparse_conflict_file_and_runtime_cases(self):
        contract = (ROOT / "references/input-contract.md").read_text(encoding="utf-8")
        for term in (
            "稀疏自然语言",
            "权威版本",
            "异常文件",
            "真实公司无数据",
            "PPT 依赖不可用",
            "ASK_ONE_BLOCKING_QUESTION",
        ):
            self.assertIn(term, contract)

    def test_public_license_files_and_scopes_are_present(self):
        status = (ROOT / "LICENSE_STATUS.md").read_text(encoding="utf-8")
        self.assertIn("PUBLIC_LICENSE_READY=pass", status)
        self.assertIn("Apache License 2.0", status)
        self.assertIn("CC BY 4.0", status)
        for relative in ("LICENSE", "NOTICE", "CONTENT-LICENSE.md", "TRADEMARKS.md", "ABOUT.md"):
            self.assertTrue((ROOT / relative).is_file(), relative)


if __name__ == "__main__":
    unittest.main()
