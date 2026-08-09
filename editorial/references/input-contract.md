# Editorial QA 输入契约

风险等级：B 级文件生产模块。内部契约不转嫁为用户字段表。

| input_id | 内容 | 必需程度 | 缺失与冲突处理 | 流程去向 |
| --- | --- | --- | --- | --- |
| `source_pptx` | 恰好一页、可读取的 `.pptx` | required | 先读上下文和运行目录；仍缺失则 `EDITORIAL_EDIT_BLOCKED` | 基线锁定 |
| `source_handoff` | 受众任务、中心结论、主关系、来源边界 | derived / conditional | 优先读取 OneSlide handoff；没有 handoff 时从页面稳定推导，存在两个竞争解释且影响修改时停止 | 诊断与保真 |
| `baseline_render` | 与源 PPTX 同版本的整页 PNG | derived | 缺失时由 inspector 生成，不向用户索取 | 编辑诊断 |
| `baseline_layout` | 同一版本 layout JSON | derived | 缺失时由 inspector 生成 | 对象定位与 QA |
| `qa_mode` | `standard` 或 `targeted` | optional | OneSlide 自动后置默认 `standard`；高密度、复杂关系页默认 `targeted` | 候选与渲染预算 |
| `editorial_preference` | 用户明确要求的审校方向 | optional | 缺失不阻塞，按整页审校序列判断 | 审校优先级 |
| `output_dir` | 新的版本化目录 | derived | 从运行目录生成；已存在则递增版本，不覆盖 | 输出 |

## 文件与版本

- 只接受 `.pptx`；旧 `.ppt` 返回 `SOURCE_CONVERSION_REQUIRED`；
- 输入必须恰好一页。多页来源只能接收 OneSlide 已抽取的一页工作副本；
- 源 PPTX、PNG、layout 和 handoff 的哈希或运行目录必须一致；版本冲突返回 `SOURCE_VERSION_CONFLICT`；
- 损坏、加密、缺少 slide XML 或不可导入的文件返回 `SOURCE_INVALID`；
- 源文件永不覆盖；输出目录已有内容时返回 `OUTPUT_EXISTS`，由 OneSlide 编排层选择新的版本号后重试。

## Editorial QA handoff

提供 handoff 时必须包含 `source_pptx_sha256`、`central_message`、`primary_relationship`、`protected_content` 和 `source_ids`，并与源 PPTX 哈希一致。没有独立 handoff 时，诊断文件必须记录 `source_sha256`、`context_basis=derived_from_slide`、推导的中心结论、主关系、受保护内容与可见来源；存在竞争解释时不得继续。

## 缺失判断顺序

```text
READ_CONTEXT → DERIVE_IF_STABLE → USE_DECLARED_DEFAULT
→ PROCEED_WITH_REVERSIBLE_ASSUMPTION → DEGRADE_SCOPE
→ EDITORIAL_EDIT_BLOCKED
```

缺少颜色偏好、风格、修改数量或具体坐标不得追问。QA 永远不向用户索取坐标或实现参数。缺少 handoff 但页面目标唯一时直接继续；只有竞争解释会导致相反审校决策时才阻断。
