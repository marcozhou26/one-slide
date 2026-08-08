# OneSlide 模块开发工作交接

更新时间：2026-08-08  
交接目标：把后续大量图表模块的开发，迁移到新的工作空间继续推进。

## 1. 项目定位

OneSlide 不是整套 PPT 自动生成器，而是“先确定一页的信息关系和版式逻辑，再让 AI 执行”的单页咨询型 PPT 工具。

每次运行只生成一页 16:9 PowerPoint，必须满足：

- 来源事实、数字、口径和结论强度可追溯；
- 图表、文字和形状为 PowerPoint 原生可编辑对象；
- 信息不足时只做定向补全，并标明合成或待确认内容；
- 不因为新增模块而扩大单页范围、改变 Producer 的来源语义或偷偷生成多页。

## 2. 当前架构与职责

```text
用户材料
  ↓
Producer
  - 锁定读者任务、页面问题、主要关系和中心结论
  - 建立来源基线和 provenance
  - 生成 builder-prompt.md 与 builder-handoff.json
  ↓
Builder 路由
  - 判断是否命中一个正式模块
  - 或进入 direct_composition
  ↓
Builder 模块
  - validator：输入契约与来源门禁
  - planner：页面空间分配
  - renderer：原生 PowerPoint 对象
  - QA：布局、渲染、可编辑性和 PowerPoint 检查
```

Producer 不绘制 PowerPoint，也不负责精确坐标。Builder 不重新决定页面目标、不重写用户事实、不增加新的业务内容。

主要入口：

- `SKILL.md`：唯一用户入口；
- `producer/ENGINE.md`：Producer 内部执行规则；
- `producer/references/output-contract.md`：Producer → Builder 交接格式；
- `builder/ENGINE.md`：Builder 执行与 QA 规则；
- `builder/references/module-registry.json`：正式模块注册表，由路由脚本读取。

## 3. 已完成的 bump-ranking 升级

`slope-ranking` 已从正式模块注册表退休，正式模块 ID 为 `bump-ranking`。旧输入仍保留兼容转换，不删除旧 fixture。

已完成：

- 支持 2–8 个有序时期；
- 支持 5–12 个对象；
- 每个对象使用与时期数一致的 `ranks`、`values`、`states` 数组；
- 支持 `active`、`new`、`exited`、`not_ranked`；
- 阻止同一时期重复排名；
- 支持两期 slope-style 和三期以上 Bump Chart；
- 更新 Producer 的模块选择和交接规则；
- 新增五期、进入/退出、重复排名和数组长度异常 fixture；
- 已生成真实的多期参考 PPTX：`builder/assets/reference-pages/bump-ranking.pptx`。

关键文件：

- `builder/references/bump-ranking-module.md`
- `builder/scripts/validate_r3_module.mjs`
- `builder/scripts/plan_r3_module.mjs`
- `builder/scripts/render_r3_module.mjs`
- `builder/scripts/route_input.mjs`
- `builder/scripts/route_module.mjs`
- `producer/ENGINE.md`
- `producer/references/output-contract.md`
- `builder/references/information-structure-compiler.md`

旧版兼容文件：

- `builder/assets/test-fixtures/slope-ranking-valid.json`
- `builder/references/slope-ranking-module.md`

## 4. Producer 与 Builder 的模块交接规则

新增模块不能只改 Builder。只要模块需要 Producer 生成可执行 payload，就必须同时完成：

1. Producer 能识别这种信息关系，而不是只识别模块名称；
2. Producer reference/ENGINE 能说明字段、期间、单位、状态和来源要求；
3. `builder-handoff.json` 中的 `requested_module`、`structure.primary_exhibit` 和 `module_payload.module_id` 完全一致；
4. `module_payload` 是完整、可通过 validator 的输入，不接受只有模块名的半成品；
5. Builder 仍然是模块字段和视觉对象的最终门禁；
6. 如果一个模块无法覆盖页面全部必含内容，三项模块字段都省略，进入 `direct_composition`，不得硬塞模块。

以排名迁移为例，新 Producer payload 应使用：

```json
{
  "module_id": "bump-ranking",
  "diagram": {
    "periods": [],
    "objects": [
      {
        "ranks": [],
        "values": [],
        "states": []
      }
    ]
  }
}
```

不要为新任务生成旧的 `left_period`、`right_period`、`left_rank`、`right_rank` 字段。

## 5. 新增模块的最小纵向切片

每个新模块必须一次完成一条真实可用链路，而不是只提交 renderer：

```text
真实/代表性输入
  → Producer 交接规则
  → route_input / route_v3
  → module reference
  → validator
  → planner
  → renderer
  → reference PPTX
  → 完整 fixture 与异常 fixture
  → 渲染、溢出、原生对象和可编辑性检查
```

至少新增：

- 一个 `builder/references/<module>-module.md`；
- 一个正式注册表条目；
- validator、planner、renderer；
- 一个完整 fixture；
- 一个或多个异常 fixture；
- 路由回归测试；
- 参考 PPTX；
- Producer 交接规则或明确说明为什么只走 `direct_composition`。

不要先批量堆底层组件，再等待最后统一接入。第一个模块就必须能从代表性输入运行到用户可见的一页 PPT。

## 6. 模块契约应回答的问题

开发前先写清楚：

- 这张图回答哪一个读者问题？
- 主关系是什么：比较、趋势、迁移、构成、流量、因果、流程还是空间分布？
- 最少需要哪些字段？字段的单位、期间、分母和口径是什么？
- 哪些字段必须来源可追溯？哪些可以计算？哪些只能作为合成示例？
- 数据缺失时是阻塞、定向补全，还是进入 direct composition？
- 哪些状态必须显式表达，不能靠颜色或位置猜？
- 一页内哪些内容是主图，哪些是 0–3 个支持证据，哪些是 0–1 个行动/条件区？
- 用户真正需要编辑什么：文字、数字、线条、节点、表格还是数据关系？

## 7. 验收门禁

必须分别报告，不得合并：

```text
BASIC_OUTPUT_PASS
INPUT_CONTRACT_PASS
SOURCE_BASELINE_PASS
CONTENT_MAPPING_PASS
REQUIREMENT_COVERAGE_PASS
RENDERED_READABILITY_PASS
POWERPOINT_OPEN_CHECK
PRODUCT_VALUE_PASS
USER_REQUIREMENT_PASS
```

建议使用的验证顺序：

```bash
# OneSlide / Producer 契约
python3 -m unittest discover -s tests -v

# Builder 模块回归
node --test builder/tests/bump_ranking_contracts.test.mjs
node --test builder/tests/*.test.mjs

# 生成某个模块的 PPTX 后
python3 <presentations-skill>/container_tools/slides_test.py <file.pptx>
```

文件存在、脚本跑通、ZIP 完整或 layout JSON 通过，都不能单独证明用户要求已经满足。最终仍要检查实际渲染和 PowerPoint 原生编辑性。

## 8. 当前已知状态

- Producer 契约测试：18/18 通过；
- bump-ranking 相关测试：22/22 通过；
- Builder 全量测试：在默认 Node 环境中 70/71 通过，唯一失败是既有 Sankey 渲染测试缺少 `@oai/artifact-tool`；
- bump-ranking 已使用 bundled `@oai/artifact-tool` 成功生成 PPTX；
- bump-ranking 的布局审计和溢出检查通过；
- PPTX 内部确认使用原生文本框、椭圆、线条和矩形，没有整页图片；
- Microsoft PowerPoint 应用内复核曾因当前 PowerPoint 进程无法激活而未完成，状态保持 `not_tested`，不得误报为通过。

## 9. 建议的新工作空间启动顺序

1. 将本交接文件和整个 `one-slide-github-public` 工作树作为初始上下文；
2. 先运行 Producer 契约测试和 Builder registry/fixture 测试；
3. 先挑一个高价值、字段明确、能在一页内完成的模块做纵向切片；
4. 为该模块同时写 Producer 交接规则和 Builder 模块契约；
5. 用真实或匿名合成 fixture 生成一页 PPTX；
6. 检查渲染、溢出、可编辑性和 PowerPoint 打开结果；
7. 只有该模块通过后，再抽取至少两个模块都需要的共享底座；
8. 每完成一个模块，回写模块注册表、CHANGELOG 和本交接文件的状态。

## 10. 不要做的事

- 不要把 ECharts 示例直接复制进 OneSlide 作为静态图；它只能作为图形研究参考；
- 不要只新增 Builder renderer 而不更新 Producer 交接规则；
- 不要把所有图表都塞进一个万能模块；
- 不要为了填满页面增加装饰性卡片；
- 不要把合成数据写成真实客户事实；
- 不要把旧模块删除到无法兼容已有运行包；
- 不要把技术链路通过冒充用户验收通过。

## 11. 迁移时的工作树提醒

当前工作树中另有一个 `builder/scripts/plan_r4_module.mjs` 的未提交修改，不属于本次 bump-ranking 交接内容。迁移到新空间时请单独确认它的来源和是否保留，不要把它误并入新模块基线。
