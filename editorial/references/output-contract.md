# Editorial Editor 输出契约

## 目录

```text
editorial-run/
├── source/
│   └── source.pptx
├── baseline/
│   ├── slide.png
│   ├── layout.json
│   ├── inventory.ndjson
│   └── inspect-manifest.json
├── editorial-diagnosis.json
├── editorial-patch.json
├── candidate/
│   ├── edited.pptx
│   ├── slide.png
│   ├── layout.json
│   ├── inventory.ndjson
│   ├── inspect-manifest.json
│   ├── layout.audit.json
│   ├── semantic-audit.json
│   ├── contrast-audit.json
│   └── powerpoint-open.json
├── patch-audit.json
├── verification.json
└── editorial-manifest.json
```

健康页面使用 `NO_MATERIAL_EDIT`，candidate PPTX 是源文件的版本化副本；仍需保存诊断、manifest 和基础 QA 证据。

## manifest 必含

```text
version
source_sha256
source_pptx
candidate_sha256
candidate_pptx
decision
primary_issue
edit_hypothesis
operations_count
baseline_render
candidate_render
verification
improved_dimensions
editorial_judgment
reviewer
```

`decision` 只能是 `EDITORIAL_IMPROVEMENT_PASS`、`NO_MATERIAL_EDIT`、`EDITORIAL_CANDIDATE_REJECTED` 或 `EDITORIAL_EDIT_BLOCKED`。

`EDITORIAL_IMPROVEMENT_PASS` 必须列出至少一个来自六维 rubric 的 `improved_dimensions`，并写明基于前后整页渲染的 `editorial_judgment`。像素发生变化不能自动证明改善。

所有 decision 都必须完成绑定到 PPTX 哈希的前后渲染核验、原生可编辑结构核验、布局审计、语义审计、受影响文字对比度审计和 Microsoft PowerPoint 实际打开/编辑检查。`EDITORIAL_IMPROVEMENT_PASS` 与 `NO_MATERIAL_EDIT` 要求这些硬门禁全部通过，`reviewer.status=pass`。

`EDITORIAL_CANDIDATE_REJECTED` 或 `EDITORIAL_EDIT_BLOCKED` 允许记录基线已有的门禁失败，但最终 `candidate/edited.pptx` 必须是与源文件哈希完全相同的零操作回退副本，`reviewer.status` 分别为 `rejected` 或 `blocked`。不得把失败候选作为最终文件，也不得用“未改善但没变差”冒充通过。

## 对外交付

只交付最终版本化 PPTX。诊断、patch、前后图和 QA 是内部协作信息，不进入 PPTX、备注、文件名或对外交付目录。
