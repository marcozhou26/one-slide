import subprocess
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = SKILL_ROOT / "scripts" / "export_powerpoint_png.py"


class NativePngExportRetiredTest(unittest.TestCase):
    def test_script_returns_retired_without_creating_images_or_pdf(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp)
            result = subprocess.run(
                ["python3", str(SCRIPT), "unused.pptx", "--output-dir", str(target)],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 20)
            self.assertIn("POWERPOINT_NATIVE_PNG_RETIRED", result.stdout)
            self.assertEqual(list(target.glob("*.png")), [])
            self.assertEqual(list(target.glob("*.jpg")), [])
            self.assertEqual(list(target.glob("*.pdf")), [])

    def test_script_contains_no_powerpoint_or_conversion_invocation(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("osascript", source)
        self.assertNotIn("save as PNG", source)
        self.assertNotIn("subprocess", source)


if __name__ == "__main__":
    unittest.main()
