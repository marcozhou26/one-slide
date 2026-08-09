# 编辑式信息设计六维 Rubric

六个 key 是单一事实来源，不在其他文件另建同义分类。

| key | 要回答的问题 | 材料性问题示例 | 改善证据 |
| --- | --- | --- | --- |
| `visual_subject` | 第一眼是否知道主证据是什么 | 主图和洞察卡同权；多个大色块竞争 | 主证据权重提高，辅助信息退后 |
| `title_evidence` | 标题是否由页面主证据直接证明 | 标题含结论，但证据入口不明确 | 读者能从标题直接进入对应数据 |
| `evidence_annotation` | 解释是否靠近对应证据 | 图例、洞察和数据相距过远 | 标签或解释贴近证据，往返减少 |
| `semantic_emphasis` | 色彩、字号和字重是否表达含义 | 所有序列同样抢眼；重点只靠装饰框 | 重点与非重点形成语义差异 |
| `reading_rhythm` | 阅读顺序、留白、对齐和密度是否自然 | 大片无效空白；内容挤在标题下 | 阅读链连续，留白服务分组和聚焦 |
| `information_contribution` | 每个对象是否增加信息或结构 | 重复数字、空卡片、纯装饰色带 | 重复或无贡献对象被删除 |

## 诊断格式

```json
{
  "source_sha256": "",
  "context_basis": "hash_locked_handoff|derived_from_slide",
  "page_subject": "",
  "central_message": "",
  "expression_method": "",
  "visible_defects": [
    {"id": "defect-1", "severity": "material|moderate|minor", "evidence": "", "source_ids": []}
  ],
  "primary_issue_id": "defect-1",
  "region_analysis": [
    {"id": "main-exhibit", "role": "main_exhibit|sidebar|source|conclusion|other", "evidence": "", "source_ids": []}
  ],
  "panel_integrity": {"status": "pass|protected", "evidence": ""},
  "rubric": {
    "visual_subject": {"status": "pass|issue", "evidence": ""},
    "title_evidence": {"status": "pass|issue", "evidence": ""},
    "evidence_annotation": {"status": "pass|issue", "evidence": ""},
    "semantic_emphasis": {"status": "pass|issue", "evidence": ""},
    "reading_rhythm": {"status": "pass|issue", "evidence": ""},
    "information_contribution": {"status": "pass|issue", "evidence": ""}
  },
  "primary_dimension": "visual_subject|title_evidence|evidence_annotation|semantic_emphasis|reading_rhythm|information_contribution",
  "primary_issue": "",
  "edit_hypothesis": "",
  "protected_content": [],
  "source_ids": []
}
```

`visible_defects` 必须按 `material → moderate → minor` 排序。发生材料性修改时，`primary_issue_id` 必须等于第一项缺陷；没有可见缺陷时数组为空，并选择 `NO_MATERIAL_EDIT`。

不能用机械总分替代判断。任何来源、事实、可读性或可编辑性硬失败都直接否决候选。

## 诊断先后顺序

六维 rubric 不是六个同时优化的目标。必须依次执行：

1. 只看整页 PNG，记录肉眼可见的缺陷、对象和严重度；
2. 标出主图、侧栏、结论栏、来源栏及重复板块，确认其内在秩序；
3. 从最高严重度缺陷中选择一个主问题；
4. 选择不会破坏其他区域的最小修改；
5. 再用六维 rubric 检查整页净收益。

以下情况不是改善：解释更靠近证据但原侧栏被抽空；单个卡片变大但板块秩序被破坏；存在明显文字适配问题却转而修改无关颜色或位置。
