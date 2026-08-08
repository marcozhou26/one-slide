import csv
import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "producer" / "scripts" / "validate_package.py"
SPEC = importlib.util.spec_from_file_location("validate_package", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_package(root, output_mode="PROMPT_ONLY", synthetic=True):
    (root / "brief").mkdir(parents=True)
    (root / "handoff" / "data").mkdir(parents=True)
    (root / "review").mkdir(parents=True)
    (root / "internal").mkdir(parents=True)
    (root / "brief" / "slide-brief.md").write_text("# single page Brief\n\nMake only one page.\n", encoding="utf-8")

    data = root / "handoff" / "data" / "workload.csv"
    with data.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["activity", "hours"])
        writer.writerow(["Approval", 9.2])
        writer.writerow(["Repeat meeting", 7.4])
        writer.writerow(["Team coaching", 4.1])

    disclosure = MODULE.DISCLOSURE if synthetic else "User provided data"
    (root / "handoff" / "builder-prompt.md").write_text(
        f"# single page Builder Prompt\n\nOnly one page is generated. Use `data/workload.csv`.{disclosure}\n",
        encoding="utf-8",
    )
    (root / "review" / "content-review.md").write_text(
        "# Single-page content confirmation\n\n- Model-generated completion, Pending confirmation: activity classification and sample hours.\n" if synthetic else "# Single-page content confirmation\n\n- User-provided: all content.\n",
        encoding="utf-8",
    )

    entries = [
        {"source_id": "U01", "kind": "user_supplied", "statement": "Managers are overburdened", "origin": "user prompt", "status": "locked", "affects": ["subject"]},
    ]
    source_ids = ["U01"]
    if synthetic:
        entries.extend([
            {"source_id": "G01", "kind": "synthetic_generated", "statement": "Example activities and hours", "origin": "generated records", "status": "pending_confirmation", "affects": ["display_blocks.B01"], "gap_id": "GAP01", "generation_rule": "minimum illustrative ranking data"},
            {"source_id": "C01", "kind": "calculated", "statement": "The proportion of the first two items", "origin": "formula", "status": "locked", "affects": ["content.title"], "formula": "(9.2+7.4)/(9.2+7.4+4.1)", "input_source_ids": ["G01"]},
        ])
        source_ids.extend(["G01", "C01"])

    title_ids = ["C01"] if synthetic else ["U01"]
    item_ids = ["G01"] if synthetic else ["U01"]
    generation_mode = "SYNTHETIC_AUGMENTATION" if synthetic else "SOURCE_ONLY"
    handoff = {
        "schema_version": "1.0", "product": "single-consulting-slide-producer",
        "output_mode": output_mode, "generation_mode": generation_mode, "single_slide": True,
        "subject": "Work burden of lower-level managers", "story": "Approvals and recurring meetings take up most of the non-coaching time",
        "audience_task": "Identify management activities that most need to be reduced", "source_ids": source_ids,
        "content": {
            "title": {"text": "Approval and recurring meetings take up approximately 80% of the listed time", "source_ids": title_ids},
            "subtitle": {"text": disclosure, "source_ids": item_ids},
            "insights": [], "actions": [], "footnotes": []
        },
        "structure": {"primary_question": "Where do you spend most of your time?", "primary_relationship": "activity x hours", "primary_exhibit": "ranking-chart", "visual_intent": "Horizontally sorted bar chart", "layout_intent": "full-canvas"},
        "information_budget": {"primary_exhibit_count": 1, "supporting_evidence_count": 0, "action_or_condition_count": 0, "status": "pass"},
        "display_blocks": [{"block_id": "B01", "budget_role": "primary_exhibit", "display_intent": "ranking", "source_ids": item_ids, "items": [{"item_id": "M01", "label": "Approval", "value": "9.2", "unit": "hours", "source_ids": item_ids}]}],
        "datasets": [{"dataset_id": "D01", "path": "data/workload.csv", "grain": "one row per activity", "encoding": {"category": "activity", "value": "hours"}, "source_ids": item_ids}],
        "review_marking": {"required": synthetic, "synthetic_data_disclosure": MODULE.DISCLOSURE if synthetic else None, "qualitative_marker": "Pending confirmation" if synthetic else None},
        "constraints": {"must_include": [], "must_avoid": [], "slide_count": 1},
    }
    write_json(root / "handoff" / "builder-handoff.json", handoff)
    write_json(root / "handoff" / "handoff-manifest.json", {
        "schema_version": "1.0", "product": "single-consulting-slide-producer", "output_mode": output_mode,
        "generation_mode": generation_mode, "single_slide": True, "synthetic_content": synthetic,
        "synthetic_data": synthetic, "status": "ready", "builder_target": "single-consulting-slide-builder",
        "entrypoints": {"builder_prompt": "builder-prompt.md", "builder_handoff": "builder-handoff.json", "content_review": "../review/content-review.md"},
        "files": [{"path": "data/workload.csv", "role": "display_data", "format": "csv", "sha256": file_hash(data), "row_count": 3}],
    })
    write_json(root / "internal" / "source-baseline.json", {"sources": [{"source_id": "U01", "type": "user_prompt", "status": "read"}]})
    write_json(root / "internal" / "provenance-ledger.json", {"schema_version": "1.0", "entries": entries})
    write_json(root / "internal" / "generation-ledger.json", {"generation_mode": generation_mode, "gaps": ["GAP01"] if synthetic else []})

    if output_mode == "PPT_DRAFT":
        (root / "delivery").mkdir()
        with zipfile.ZipFile(root / "delivery" / "one-slide-v1.0.0.pptx", "w") as archive:
            archive.writestr("ppt/slides/slide1.xml", "<p:sld xmlns:p='x'/>")


class PackageValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_sparse_synthetic_prompt_package_passes(self):
        make_package(self.root)
        result = MODULE.validate(self.root)
        self.assertTrue(result["ok"], result)

    def test_source_only_package_passes(self):
        make_package(self.root, synthetic=False)
        result = MODULE.validate(self.root)
        self.assertTrue(result["ok"], result)

    def test_missing_item_provenance_fails(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-handoff.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        del payload["display_blocks"][0]["items"][0]["source_ids"]
        write_json(path, payload)
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("visible object missing source_ids" in error for error in result["errors"]))

    def test_missing_disclosure_fails(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-prompt.md"
        path.write_text("# Prompt\n\nOnly one page is generated. Use `data/workload.csv`.\n", encoding="utf-8")
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("missing synthetic data disclosure" in error for error in result["errors"]))

    def test_multiple_primary_exhibits_fail(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-handoff.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["display_blocks"].append({"block_id": "B02", "budget_role": "primary_exhibit", "source_ids": ["G01"], "items": []})
        write_json(path, payload)
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("exactly one display block" in error for error in result["errors"]))

    def test_visible_pipe_fails(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-handoff.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["content"]["title"]["text"] = "Approval｜Repeat meeting"
        write_json(path, payload)
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("delimiter forbidden" in error for error in result["errors"]))

    def test_requested_module_without_payload_fails(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-handoff.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["requested_module"] = "waterfall-attribution"
        payload["structure"]["primary_exhibit"] = "waterfall-attribution"
        write_json(path, payload)
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("requires a complete module_payload" in error for error in result["errors"]))

    def test_executable_module_payload_contract_passes(self):
        make_package(self.root)
        path = self.root / "handoff" / "builder-handoff.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["requested_module"] = "waterfall-attribution"
        payload["structure"]["primary_exhibit"] = "waterfall-attribution"
        payload["module_payload"] = {
            "version": "1.0",
            "module_id": "waterfall-attribution",
            "source_anchors": [{"id": "U01", "text": "Managers are overburdened"}],
            "title": {"text": "Managers are overburdened", "origin": "source", "source_ids": ["U01"]},
            "diagram": {"type": "waterfall"},
        }
        write_json(path, payload)
        result = MODULE.validate(self.root)
        self.assertTrue(result["ok"], result)

    def test_ppt_draft_with_one_slide_passes(self):
        make_package(self.root, output_mode="PPT_DRAFT")
        result = MODULE.validate(self.root)
        self.assertTrue(result["ok"], result)

    def test_ppt_draft_ignores_powerpoint_lock_file(self):
        make_package(self.root, output_mode="PPT_DRAFT")
        (self.root / "delivery" / "~$one-slide-v1.0.0.pptx").write_bytes(b"office-lock")
        result = MODULE.validate(self.root)
        self.assertTrue(result["ok"], result)

    def test_ppt_draft_handoff_passes_before_delivery_exists(self):
        make_package(self.root, output_mode="PPT_DRAFT")
        delivery = self.root / "delivery" / "one-slide-v1.0.0.pptx"
        delivery.unlink()
        (self.root / "delivery").rmdir()
        result = MODULE.validate(self.root, stage="handoff")
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["checks"]["stage"], "handoff")

    def test_ppt_draft_with_two_slides_fails(self):
        make_package(self.root, output_mode="PPT_DRAFT")
        path = self.root / "delivery" / "one-slide-v1.0.0.pptx"
        with zipfile.ZipFile(path, "a") as archive:
            archive.writestr("ppt/slides/slide2.xml", "<p:sld xmlns:p='x'/>")
        result = MODULE.validate(self.root)
        self.assertFalse(result["ok"])
        self.assertTrue(any("exactly one slide" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
