# OneSlide 输入契约测试结果

测试对象：`one-slide` 1.6.1（继承既有输入契约，并新增原生竖版画布和 PowerPoint 原生 PNG 导出场景）
输入契约等级：B  
测试日期：2026-08-10

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
| IC09 | 结构化 handoff 缺模块载荷 | handoff 指定已产品化模块，但没有 `module_payload` | 返回 `MODULE_PAYLOAD_INCOMPLETE`；不进入渲染 | 否 | `v3_route_and_budget.test.mjs` | pass |
| IC10 | 原始输入直接指定图形 | 自然语言明确要求瀑布图并给出起止数据 | 允许路由到对应模块；后续仍运行模块 validator | 否 | `v3_route_and_budget.test.mjs` | pass |
| IC11 | 未提供页码偏好 | 用户只要求生成一页 PPTX，未说页码样式 | 自动添加 8pt、右下角的 PowerPoint 原生动态页码；不追问内部字段 | 否 | `slide_number_contracts.test.mjs` | pass |
| IC12 | 短视频/B-roll 稀疏输入 | “把这一观点做成短视频 B-roll PowerPoint” | 稳定推导原生 `9:16`；纵向重构，不追问比例，不裁切横版页 | 否 | `canvas_profiles.test.mjs`、代表性 PPTX | pass |
| IC13 | 4:3 竖版歧义 | “高4宽3，做知识图文” | 规范化为原生竖版 `3:4`（7.5×10 英寸），不生成横版 4:3 | 否 | `canvas_profiles.test.mjs` | pass |
| IC14 | 竖版宽图超载 | B-roll 同时要求宽幅长流程、多列密表与完整框架 | 不压缩、不裁切、不暗中多页；返回 `SINGLE_SLIDE_SCOPE_OVERLOAD` | 否 | `canvas_profiles.test.mjs`、契约语义检查 | pass |

## 状态

```text
INPUT_CONTRACT_DECLARED
INPUT_CONTRACT_TESTED
INPUT_CONTRACT_PASS
```

该状态证明本轮覆盖了完整、稀疏、关键缺失、方向冲突、非阻塞偏好、异常文件、真实公司事实边界和运行依赖场景。它不代表所有主题和全部 Builder 模块已经通过真实用户测试。

## 2026-08-09 histogram 模块追加验证

| test_id | 场景 | 实际行为 | 是否追问 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| HIC01 | 完整输入 | 复算 8 个区间、48 个有效观测和 2 个缺失值，生成一页计划 | 否 | `histogram_contracts.test.mjs` | pass |
| HIC02 | 稀疏自然语言 | 从连续观测与“集中、偏斜、长尾”关系自动路由，不要求模块名或图表名 | 否 | 同上 | pass |
| HIC03 | 缺少关键观测 | 停止正式分布页，不编造样本 | 否 | 同上 | pass |
| HIC04 | 单位冲突 | 阻断来源不一致的正式载荷 | 否 | 同上 | pass |
| HIC05 | 非阻塞样式与预计算分箱缺失 | 使用默认样式，从原始观测复算后继续 | 否 | 同上 | pass |
| HIC06 | 异常格式 | 带单位的数字字符串、坏边界、样本不对平和声明频数不一致分别阻断 | 否 | 同上 | pass |

`INPUT_CONTRACT_PASS` 仅覆盖本模块声明与已执行场景，不等于真实用户验收。

## 2026-08-10 reference-list 模块追加验证

| test_id | 场景 | 实际行为 | 是否追问 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| RLIC01 | 完整来源记录 | 从五项实际来源生成单列编号清单、定位信息和支持范围 | 否 | `reference_list_contracts.test.mjs`、代表性 PPTX | pass |
| RLIC02 | 跨页重复来源 | 按 DOI、URL 或稳定作品标识去重，合并来源 ID 与正文页回链 | 否 | `reference_list_contracts.test.mjs` | pass |
| RLIC03 | 稀疏自然语言 | 从“实际用过、去重、编号、作者或机构、标题、日期、链接、正文页”自动路由，不要求模块名或视觉名 | 否 | 同上 | pass |
| RLIC04 | 缺少来源记录 | 返回 `SOURCE_BASELINE_FAIL`，不要求用户重新抄写一份清单 | 否 | 同上 | pass |
| RLIC05 | 缺少标题或定位信息 | 返回 `REFERENCE_METADATA_FAIL`，不补写不存在的作者、标题、日期或链接 | 否 | 同上 | pass |
| RLIC06 | 超过八项 | 返回 `SINGLE_SLIDE_SCOPE_OVERLOAD`，不缩小字号或自动生成第二页 | 否 | 同上 | pass |
| RLIC07 | 非阻塞样式缺失 | 使用统一单列列表继续，不追问颜色、坐标或装饰偏好 | 否 | 同上 | pass |
| RLIC08 | 语义图标完整输入 | `跨部门协同 + object_identifier` 稳定返回 `users-group`，并保留候选与匹配依据 | 否 | `builder/tests/semantic_icon_library.test.mjs` | pass |
| RLIC09 | 语义图标稀疏输入 | 只给“数据导入”与流程节点角色，自动使用默认 outline 并返回 `file-import` | 否 | 同上 | pass |
| RLIC10 | 图标用于装饰 | `decoration` 返回 `ICON_ROLE_NOT_ALLOWED / NO_ICON`，继续无图标构图 | 否 | 同上 | pass |
| RLIC11 | 未知图标语义 | 无白名单匹配时返回 `NO_SEMANTIC_MATCH / NO_ICON`，不要求用户填写文件名 | 否 | 同上 | pass |
| RLIC08 | 异常格式 | 损坏 JSON 在读取阶段阻断，不伪装为成功提取 | 否 | 同上 | pass |

`INPUT_CONTRACT_PASS` 证明本模块声明与已执行场景一致；PowerPoint 原生打开、产品价值和用户验收仍分别报告。

## 2026-08-09 scatter-regression 模块追加验证

| test_id | 场景 | 实际行为 | 是否追问 | 证据 | 结果 |
| --- | --- | --- | --- | --- | --- |
| SRIC01 | 完整输入 | 从逐条 x/y 复算斜率、截距、R²、有效/缺失/重复样本和绝对残差异常点 | 否 | `scatter_regression_contracts.test.mjs` | pass |
| SRIC02 | 稀疏自然语言 | 从两个连续指标、方向/强度/偏离趋势任务和成对观测自动路由，不要求模块名或图表名 | 否 | 同上 | pass |
| SRIC03 | 缺少关键观测 | 停止正式拟合，不编造数据 | 否 | 同上 | pass |
| SRIC04 | 单位冲突 | 阻断不同单位的成对记录，不暗自换算或合并 | 否 | 同上 | pass |
| SRIC05 | 非阻塞样式缺失 | 使用默认布局继续，不追问颜色和版式 | 否 | 同上 | pass |
| SRIC06 | 异常格式与统计冲突 | 损坏 JSON、零方差、样本不足、统计不对平和异常点排序不一致分别阻断 | 否 | 同上 | pass |

`INPUT_CONTRACT_PASS` 仅覆盖本模块声明与已执行场景，不等于真实用户验收。
