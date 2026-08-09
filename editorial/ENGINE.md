# Editorial Editor Engine

只在 Builder 已生成一页 PPTX 后运行。完整读取：

- `references/input-contract.md`
- `references/editorial-contract.md`
- `references/review-rubric.md`
- `references/output-contract.md`
- `../builder/references/information-contribution-gate.md`

首次实现或需要校准诊断颗粒度时读取 `references/walkthrough.md`。

## 执行

1. 运行 `scripts/plan_editorial_run.py`，锁定源文件、目标页、QA 预算和输出目录；
2. 运行 `scripts/inspect_editorial_slide.mjs`，生成真实基线 PNG、layout 和对象清单；
3. 先看整页渲染并记录 `visible_defects`，再按六维 rubric 写 `editorial-diagnosis.json`；识别页面区域和重复板块，只选择最高严重度的一个主问题；
4. 没有材料性问题时复制为版本化输出，记录 `NO_MATERIAL_EDIT`；
5. 有明确假设时写 `editorial-patch.json`，再运行 `scripts/apply_editorial_patch.mjs`；侧栏对象不得移动或缩放，侧栏字号只允许以 `intent: fit-repair` 缩小来修复已诊断的文字适配缺陷；
6. 重新 inspect 候选，用前后 `inspect-manifest.json` 运行 `scripts/verify_editorial_roundtrip.py`，禁止使用未与 PPTX 哈希绑定的图片；
7. 对基线与候选分别执行 OneSlide layout、信息贡献、语义、溢出，对候选执行 `scripts/audit_editorial_contrast.py` 和 Microsoft PowerPoint 实际打开/编辑检查；候选新增或恶化任何发现即回退，基线已存在且未恶化的发现单独记录；
8. 并排查看前后整页渲染，由独立审阅者写清改善维度、判断和证据，再用 `scripts/write_editorial_manifest.py` 写 hash-locked manifest；不得由像素变化或自填字符串自动推导改善；
9. 运行 `scripts/validate_editorial_run.py`。候选没有明显改善或出现硬回归时回退；只有另一个不同结构假设成立时才允许第二候选。

## 停止条件

- 需要改变事实、主关系、业务结论或数据口径；
- 无法保持原生可编辑；
- 无法读取或渲染源文件；
- 候选产生内容损失、裁切、碰撞、弱对比或新装饰；
- 下一轮只是继续微调，没有新的可验证假设。
- 修改会抽空原区域、破坏独立板块内在秩序，或只是为了制造前后差异。

## 状态

```text
EDITORIAL_READY
NO_MATERIAL_EDIT
EDITORIAL_CANDIDATE_REJECTED
EDITORIAL_EDIT_BLOCKED
EDITORIAL_IMPROVEMENT_PASS
EDITORIAL_REGRESSION_FAIL
```
