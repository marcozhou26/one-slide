#!/usr/bin/env python3
"""Report prompt-only and PPT-draft runtime readiness without changing the machine."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def artifact_tool_location() -> str | None:
    candidates: list[Path] = []
    for variable in ("CODEX_NODE_MODULES", "NODE_PATH"):
        value = os.environ.get(variable, "")
        for entry in value.split(os.pathsep):
            if entry:
                candidates.append(Path(entry))
    for base in candidates:
        package = base / "@oai" / "artifact-tool" / "package.json"
        if package.is_file():
            return str(package.parent)

    node = shutil.which("node")
    if not node:
        return None
    command = [node, "-e", "try{console.log(require.resolve('@oai/artifact-tool/package.json'))}catch(e){process.exit(2)}"]
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode == 0 and completed.stdout.strip():
        return str(Path(completed.stdout.strip()).parent)
    return None


def main() -> int:
    python_ready = sys.version_info >= (3, 10)
    node_path = shutil.which("node")
    artifact_path = artifact_tool_location()
    report = {
        "python": {"ready": python_ready, "version": sys.version.split()[0]},
        "node": {"ready": bool(node_path), "path": node_path},
        "artifact_tool": {"ready": bool(artifact_path), "path": artifact_path},
        "PROMPT_ONLY_READY": python_ready,
        "PPT_DRAFT_READY": python_ready and bool(node_path) and bool(artifact_path),
        "note": "Microsoft PowerPoint open-check is evaluated per run and is not inferred here.",
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["PROMPT_ONLY_READY"] else 10


if __name__ == "__main__":
    raise SystemExit(main())
