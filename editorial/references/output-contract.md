# Editorial QA 输出契约

```text
editorial-run/
├── source/source.pptx
├── baseline/slide.png
├── baseline/layout.json
├── editorial-qa.json
├── editorial-qa.validation.json
├── builder/
│   ├── builder-revision-plan.json
│   ├── revision-audit.json
│   └── candidate/edited.pptx
└── editorial-recheck.json
```

`PASS_AS_IS` 不创建 `builder/` 目录。最终 PPTX 直接使用 Builder 初稿的版本化副本。

## editorial-qa.json

必含：`version`、`role=EDITORIAL_QA`、`source_sha256`、`decision`、`page_strengths`、`diagnostic_basis`、`confidence`。`diagnostic_basis.visual_groups` 记录已检查的重复组；每组包含 `group_id`、`source_ids`、`semantic_role`、`uniform_properties`、`content_fit` 和 `container_semantics`。要求修改时另含一个 `primary_issue` 和一个 `builder_brief`。

`builder_brief` 只包含：`mode`、`objective`、`rationale`、`protected_strengths`、`success_criteria`、`forbidden_changes`。不得包含执行参数。

若问题命中重复组，`primary_issue.source_ids` 必须覆盖该组的全部受影响成员，`protected_strengths` 必须明确组级统一属性。不得只点名单个成员后让 Builder 临场猜测其同级关系。

## 对外隔离

Editorial QA、Builder revision plan、前后图和审校记录均为内部协作信息，不进入 PPTX、备注、文件名或对外交付包。
