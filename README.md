# OneSlide

Turn complete or scattered source material into one clear, source-traceable, natively editable PowerPoint slide.

OneSlide is for people who want a professional single-slide presentation without writing a complex prompt. Start with one sentence or provide complete source material. When essential information is missing, OneSlide adds only the minimum needed content, preserves the supplied meaning, and clearly labels model-generated content, calculations, and externally verified sources.

[Download latest source](../../archive/refs/heads/main.zip) · [Get started](#get-started-in-three-minutes) · [中文提示词指南](https://github.com/marcozhou26/oneask/blob/main/docs/OneSlide_%E6%8F%90%E7%A4%BA%E8%AF%8D%E8%BE%93%E5%85%A5%E6%8C%87%E5%8D%97_%E5%85%AC%E5%BC%80%E7%89%88_v1.0.md) · [Report an issue](../../issues)

## Explain complex logic on one slide

The examples below show slide types supported or migrated into OneSlide. All displayed data is simulated or synthetic and contains no real customer, employee, or personal information.

<table>
  <tr>
    <td width="50%"><img src="showcase/01-column-chart.png" alt="Monthly contract value bar chart"><br><b>Bar chart:</b> Actual, target, and cumulative shortfall</td>
    <td width="50%"><img src="showcase/02-medium-capability-gap.png" alt="Capability gap analysis"><br><b>Capability analysis:</b> Gaps, difficulty, and constraints</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/03-bubble-heatmap.png" alt="Bubble matrix and heatmap"><br><b>Bubble matrix:</b> Value, difficulty, and priority</td>
    <td width="50%"><img src="showcase/04-org-chart.png" alt="Organization chart"><br><b>Organization chart:</b> Solid-line reporting and dotted-line collaboration</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/05-waterfall.png" alt="EBITDA waterfall chart"><br><b>Waterfall:</b> Budget-to-actual variance attribution</td>
    <td width="50%"><img src="showcase/06-sankey.png" alt="Candidate flow Sankey diagram"><br><b>Flow analysis:</b> Candidate sourcing, screening, hiring, and retention</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/07-project-gantt.png" alt="Project Gantt chart"><br><b>Project Gantt:</b> Progress, dependencies, and release conditions</td>
    <td width="50%"><img src="showcase/08-compensation-productivity.png" alt="Compensation and productivity analysis"><br><b>Pay effectiveness:</b> Pay per employee, output per employee, and department quadrants</td>
  </tr>
</table>

## One slide means one slide

Each run produces exactly one slide on one native PowerPoint canvas: 16:9 for presentations, 9:16 for short-video B-roll, or portrait 3:4 for knowledge graphics. It composes directly on that canvas and never crops or stretches a landscape slide. If the source material cannot fit honestly, OneSlide recommends the strongest one-page focus or asks you to choose; it does not silently create extra slides.

Two output modes are available:

- `PROMPT_ONLY`: produces a complete prompt and handoff package for another presentation tool or model.
- `PPT_DRAFT`: produces a natively editable PowerPoint slide and runs basic layout checks.

If you do not explicitly request a PowerPoint file, OneSlide defaults to `PROMPT_ONLY`.

## Get started in three minutes

1. Download and unzip the [latest source package](../../archive/refs/heads/main.zip).
2. Copy the top-level `one-slide` folder into the Skills directory of a compatible agent client.
3. Refresh the client and invoke `$one-slide`.

Prompt package only:

```text
Create one slide explaining that frontline managers spend too much time on approvals and meetings. Add reasonable illustrative data where needed, and return only the prompt package.
```

Editable PowerPoint draft:

```text
Create one professional, editable PowerPoint slide from this material. You may fill essential gaps, but clearly label anything you add.
```

## How OneSlide handles missing information

Every important content item is classified as one of the following:

- supplied by the user;
- a stable inference from the supplied material;
- calculated from supplied data;
- model-generated and pending confirmation; or
- verified from an external source.

When synthetic data is used, the slide must display: “Synthetic sample data, not real customer data.” Confirming an illustrative scenario does not turn it into a verified fact.

## Runtime requirements

- `PROMPT_ONLY`: Python 3.10 or later.
- `PPT_DRAFT`: Node.js and a Codex environment compatible with `@oai/artifact-tool`.
- Full PowerPoint verification requires Microsoft PowerPoint. If it is unavailable, the result must state `POWERPOINT_OPEN_CHECK=not_tested`.

Check the environment:

```bash
python3 scripts/check_environment.py
```

Validate the Skill package:

```bash
python3 scripts/validate_suite.py .
python3 -m unittest discover -s tests -v
```

## Repository structure

- `SKILL.md`: the single user-facing entry point.
- `producer/`: interprets source material, fills targeted gaps, and records provenance.
- `builder/`: selects the visual structure, creates native PowerPoint objects, and checks layout.
- `showcase/`: public single-slide previews using simulated or synthetic data.
- `scripts/` and `tests/`: environment checks, package validation, and regression tests.

## Current boundaries

- OneSlide creates one slide at a time; it does not design the storyline for a full presentation.
- Added content never overrides user-supplied facts, and simulated content must not be presented as real data.
- If PowerPoint-generation dependencies are unavailable, OneSlide delivers only the prompt and structured handoff package.
- Do not submit customer data, employee personal information, or other sensitive material through public issues.

## Author

- Author and maintainer: 周俊东 Marco
- WeChat public account and Channels account: 周俊东 Marco

## Licensing

- `SKILL.md`, execution engines, scripts, configuration, and test code: Apache License 2.0.
- Original instructions, tutorials, sample inputs, sample outputs, and original reference presentations: CC BY 4.0.
- The names “OneSlide” and “周俊东 Marco,” profile images, logos, and WeChat public account or Channels branding are not included in the open licenses.
- See `LICENSE_STATUS.md`, `CONTENT-LICENSE.md`, `TRADEMARKS.md`, and `NOTICE` for the exact scope.

Slides created through ordinary use of OneSlide do not need a watermark or signature. Redistribution or modification of OneSlide itself, its documentation, or its examples remains subject to the applicable license.

## Version status

The current local build is v1.9.2. It preserves the v1.8.1 slide-generation, semantic-icon, summary-page and optical-alignment behavior, formally accepts slide-spec `effective_page_spec` as the direct upstream for complex-report pages, deterministically consumes its `icon_handoff`, and gives visually unfilled text shapes a fully transparent native hit area so PowerPoint users can select the text object instead of accidentally selecting its background frame. It does not rewrite paragraph or run font properties. It retains the retired Microsoft PowerPoint direct PNG-export boundary and does not automatically enable a PDF or third-party conversion fallback. Public release status remains separate from this local build.
