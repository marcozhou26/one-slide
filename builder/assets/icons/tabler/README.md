# Tabler Icons semantic subset for OneSlide

This directory contains a curated SVG subset of Tabler Icons for optional semantic identification in OneSlide.

- Source: https://github.com/tabler/tabler-icons
- Source package: `@tabler/icons` 3.46.0
- License: MIT; see `LICENSE-TABLER.txt`
- Default style: outline
- SVG assets are replaceable visual resources and are not required to be editable as native PowerPoint paths.

Regenerate from an official Tabler package:

```bash
node builder/scripts/build_semantic_icon_library.mjs /path/to/tabler-icons
```

The complete upstream library is not redistributed in OneSlide. Only icons referenced by `aliases.zh-CN.json` are copied into the package.
