# PowerPoint export contract

## Page

- The canvas is fixed to 16:9, default `1280×720`.
- When there is no template, the background is pure white `#FFFFFF`; Only explicit background or brand template inputs are overridden.
- The title uses the full width of the container it belongs to. It defaults to a single line and no line breaks are inserted artificially.
- Regular text takes precedence 14/16 pt; 12 pt Sources, legends, coordinate labels, and dense locales only. Return when the content cannot be placed `SINGLE_SLIDE_FIT_FAIL`.
- Numbers, short column names, status labels, and data labels must not be wrapped; page titles can be naturally wrapped to two lines at most, and line breaks must not be inserted manually. Subtitles must not be displayed when the title is actually two lines.
- The output must contain `.json` layout, and pass `layout_quality.mjs`;Line break orphan word, English tracking key Splitting words, two-line titles overlaid with subtitles, number unit splits, misaligned edges across blocks, underutilization of the canvas and objects out of bounds all block delivery.

## Connecting line

- Relationship lines and leaders only use a native `straight`, `elbow` or `curved` connector.
- The relationship line is rendered before the node and is located after the node; the label leader is placed on top according to reading needs.
- Check arrows after exporting FROM/TO, object order and PowerPoint The actual show is that you can’t just trust `sendToBack()`.
- Ordinary `geometry: "line"` The bottom left to top right direction must be written in the position object `verticalFlip`;Invalid temporary properties must not be set.
- Radar axis and other radial lines check the common center of the circle; chord diagrams, insights and chart leads check the objects at both ends one by one.

## Editability and Partitioning

- Titles, text, nodes, connectors, legends, and data markers are all native objects.
- The customer directory only contains versions PPTX; source text, mapping, structure, preview and QA Put the internal directory.
- eventually PPTX Must pass compression structure, rendering, overflow, real PowerPoint Open and export preview inspections.
