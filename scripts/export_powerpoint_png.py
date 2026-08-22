#!/usr/bin/env python3
"""Retired: OneSlide no longer exports PowerPoint directly to PNG."""

from __future__ import annotations

import json
import sys


def main() -> int:
    print(
        json.dumps(
            {
                "ok": False,
                "error": "POWERPOINT_NATIVE_PNG_RETIRED",
                "message": (
                    "OneSlide 已退休 Microsoft PowerPoint 原生 PNG 导出能力，"
                    "因为该路线可能导致竖版页面变形。不会自动改用 PDF 或其他转换方式。"
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 20


if __name__ == "__main__":
    sys.exit(main())
