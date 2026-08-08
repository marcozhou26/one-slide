# OneSlide 输入契约测试结果

测试对象：`one-slide` 1.2.2（输入契约继承已验证的 1.2.0）
输入契约等级：B  
测试日期：2026-08-07

| test_id | 场景 | 输入 | 实际行为 | 是否追问 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- | --- |
| IC01 | 完整输入 | 受众、结论、真实数据、单位齐全，只要提示词 | 使用 `SOURCE_ONLY`；不增加合成内容 | 否 | `test_source_only_package_passes` | pass |
| IC02 | 稀疏自然语言 | “说明基层管理者审批为什么慢，信息不足可以补，直接做成 PPT” | 推导审批阶段×耗时；补匿名示例；逐项来源标注；生成一页 PPTX | 否 | `qa_runs/sparse-ppt-draft-v1` | pass |
| IC03 | 缺少关键主题 | “帮我做一页咨询 PPT” | 没有主题和读者任务可推导；只问“这一页主要想让读者看懂或决定什么？” | 是，达到门槛 | 契约语义演练 | pass |
| IC04 | 模糊或冲突目标 | 同一页要求薪酬倒挂、组织层级和完整行动计划 | 返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`；推荐最强单页焦点，不生成多页 | 是，达到门槛 | 契约语义演练 | pass |
| IC05 | 非阻塞偏好缺失 | 主题和数据完整，但没有颜色、模块、坐标和模板 | 使用中性专业风格；从主要关系选择图形 | 否 | OneSlide 契约与 Builder 默认规则 | pass |
| IC06 | 异常文件 | 附件损坏，但用户文字已经说明主题 | 标记附件不可读；只使用可读文字继续，不假装提取成功 | 否 | B 级异常输入语义演练 | pass |
| IC07 | 真实公司无数据 | 要求生成某真实公司的事实离职率，但没有证据 | 不生成真实公司名下的虚构指标；返回 `EVIDENCE_BLOCKED` 或改成匿名示例 | 否 | 事实边界语义演练 | pass |
| IC08 | PPT 运行依赖缺失 | 请求 PPTX，但 `@oai/artifact-tool` 不可用 | 保留已验证提示词包；返回 `PPT_RENDERING_BLOCKED` | 否 | `check_environment.py` 降级契约 | pass |

## 状态

```text
INPUT_CONTRACT_DECLARED
INPUT_CONTRACT_TESTED
INPUT_CONTRACT_PASS
```

该状态证明本轮覆盖了完整、稀疏、关键缺失、方向冲突、非阻塞偏好、异常文件、真实公司事实边界和运行依赖场景。它不代表所有主题和全部 Builder 模块已经通过真实用户测试。
