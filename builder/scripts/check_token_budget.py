#!/usr/bin/env python3
import json
from pathlib import Path

skill = Path(__file__).resolve().parent.parent
entry = skill / "ENGINE.md"
if not entry.is_file():
    entry = skill / "SKILL.md"
core = [entry]
direct = core + [skill / "references" / "visual-grammar.md", skill / "references" / "direct-composition.md"]
raw_fallback = core + [skill / "references" / "input-contract.md", skill / "references" / "information-structure-compiler.md"]

def size(paths):
    return sum(path.stat().st_size for path in paths)

result = {
    "core_chars": size(core),
    "direct_route_chars": size(direct),
    "raw_fallback_chars": size(raw_fallback),
    "limits": {"core_chars": 12000, "direct_route_chars": 21000, "raw_fallback_chars": 24000},
}
result["ok"] = all(result[key] <= limit for key, limit in result["limits"].items())
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["ok"] else 1)
