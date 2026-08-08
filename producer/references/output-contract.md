# Output contract

Create a new versioned run directory. Never overwrite an existing run.

## Required package

```text
<run-directory>/
├── brief/
│   └── slide-brief.md
├── handoff/
│   ├── builder-prompt.md
│   ├── builder-handoff.json
│   ├── handoff-manifest.json
│   ├── data/                  optional
│   └── assets/                optional
├── review/
│   └── content-review.md
├── delivery/                  PPT_DRAFT only after successful render
│   └── <clean-version-name>.pptx
└── internal/
    ├── source-baseline.json
    ├── provenance-ledger.json
    ├── generation-ledger.json
    ├── validation-report.json
    └── verify/                optional QA evidence
```

Do not create empty optional directories. Client delivery contains only the versioned PPTX. Review and internal material remain outside `delivery/`.

## handoff-manifest.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "synthetic_content": true,
  "synthetic_data": true,
  "status": "ready",
  "builder_target": "single-consulting-slide-builder",
  "entrypoints": {
    "builder_prompt": "builder-prompt.md",
    "builder_handoff": "builder-handoff.json",
    "content_review": "../review/content-review.md"
  },
  "files": []
}
```

Paths in `files` are relative to `handoff/`. Each requires `path`, `role`, `format`, and `sha256`; CSV also requires `row_count`. Absolute paths, `..`, local URLs, secrets, temporary paths, and missing dependencies are forbidden.

## builder-handoff.json

Minimum structure:

```json
{
  "schema_version": "1.0",
  "product": "single-consulting-slide-producer",
  "output_mode": "PROMPT_ONLY",
  "generation_mode": "SYNTHETIC_AUGMENTATION",
  "single_slide": true,
  "subject": "页面对象",
  "story": "证据支持的一句话中心思想",
  "audience_task": "读者看完要理解或决定什么",
  "source_ids": ["U01", "G01", "C01"],
  "content": {
    "title": {"text": "结论式标题", "source_ids": ["C01"]},
    "subtitle": {"text": "合成示例数据，非真实客户数据", "source_ids": ["G01"]},
    "insights": [],
    "actions": [],
    "footnotes": []
  },
  "structure": {
    "primary_question": "页面要回答的问题",
    "primary_relationship": "category x value",
    "primary_exhibit": "ranking-chart",
    "visual_intent": "横向排序条形图",
    "layout_intent": "full-canvas"
  },
  "information_budget": {
    "primary_exhibit_count": 1,
    "supporting_evidence_count": 0,
    "action_or_condition_count": 0,
    "status": "pass"
  },
  "display_blocks": [],
  "datasets": [],
  "review_marking": {
    "required": true,
    "synthetic_data_disclosure": "合成示例数据，非真实客户数据",
    "qualitative_marker": "待确认"
  },
  "constraints": {
    "must_include": [],
    "must_avoid": [],
    "slide_count": 1
  }
}
```

Every visible text object uses `{text, source_ids}`. Structured display items use their own `source_ids`. Dataset records stay in CSV or JSON when more than a few values are required.

### 可执行模块载荷

当且仅当一个已产品化 Builder 模块可以覆盖全部必含内容，且 Producer 已能按该模块 reference 填满真实输入契约时，`builder-handoff.json` 增加：

```json
{
  "requested_module": "waterfall-attribution",
  "module_payload": {
    "version": "1.0",
    "module_id": "waterfall-attribution",
    "source_anchors": [],
    "title": {},
    "diagram": {}
  }
}
```

`requested_module`、`structure.primary_exhibit` 和 `module_payload.module_id` 必须一致。`module_payload` 必须包含该模块 validator 所需的全部字段和全部可见内容；不得只放模块名或半成品骨架。混合页面或模块无法容纳全部必含内容时，三项都省略，由 Builder 进入 `direct_composition`，不得硬塞模块。

排名迁移页使用正式模块 ID `bump-ranking`。Producer 交接时应使用 `diagram.periods` 和每个对象的 `ranks`、`values`、`states` 数组；数组长度必须与时期数一致，时期保持原始顺序。两期数据可以由 Builder 呈现为 slope-style 视觉，三期及以上数据呈现为 Bump Chart。新进入、退出或暂未上榜必须显式写入 `states`，不能靠颜色或文案猜测。旧版 `slope-ranking` 的左右字段只用于兼容已有运行包，不作为新提示词的生成目标。

## builder-prompt.md

Include, when applicable:

1. explicit instruction to produce exactly one slide;
2. audience task and page question;
3. central message and title;
4. primary relationship and exhibit;
5. data files and field-to-visual encoding;
6. supporting evidence and action area;
7. visible review marking and disclosure;
8. reading order and layout intent;
9. must include and must avoid;
10. unit, period, denominator, definition, and source notes.

Do not expose prompt history or internal ledgers. Do not paste large datasets into the prompt.

## Delivery status

For `PROMPT_ONLY`, `status=ready` means the handoff is ready for a compatible Builder.

For `PPT_DRAFT`, do not place a file in `delivery/` until the Builder produces exactly one slide and the required render checks pass. If rendering is blocked, keep `delivery/` absent and record `PPT_RENDERING_BLOCKED` in the validation report.

Validate in two stages:

```bash
python3 scripts/validate_package.py <run-directory> --stage handoff --write-report
python3 scripts/validate_package.py <run-directory> --stage final --write-report
```

The handoff stage validates the content package before rendering and permits `delivery/` to be absent. The final stage requires exactly one delivery PPTX with exactly one slide.
