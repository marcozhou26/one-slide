# OneSlide 编排契约

## 对外只有一个入口

顶层 `SKILL.md` 是唯一可发现入口。`producer/ENGINE.md`、`builder/ENGINE.md` 与 `editorial/ENGINE.md` 是内部执行说明，不得作为需要用户分别安装或调用的 Skill。

## 职责边界

### 顶层 OneSlide

- 判断是否为单页任务；
- 推导输出模式；
- 控制低负担互动；
- 编排内容引擎和绘制引擎；
- 汇总分层状态。

### Producer 引擎

- 建立来源基线；
- 锁定页面问题、关系、结论和信息预算；
- 定向补全并进行逐项来源标注；
- 生成 Brief、Builder Prompt、结构化 handoff 和内容确认清单。

Producer 不绘制 PowerPoint。

### Builder 引擎

- 消费已验证 handoff；
- 选择一个确定性模块或直接构图路径；
- 创建原生可编辑 PowerPoint 对象；
- 完成语义、渲染、可读性和真实 PowerPoint 检查。

Builder 不重新决定页面目标，不重写用户事实，不增加新的合成业务内容。

### Editorial QA 引擎

- 只消费 Builder 已完成的一页原生 PPTX、真实整页渲染、layout 和来源边界；
- 先识别并保护页面已经成立的设计；
- 判断 `PASS_AS_IS`、`BUILDER_LOCAL_REPAIR`、`BUILDER_RECOMPOSE` 或 `EDITORIAL_BLOCKED`；
- 最多给 Builder 一条高价值任务，不输出坐标、字号、颜色值或操作序列；
- Builder 修改后重新看整页并决定通过或回退；
- 没有明确净收益时保留初稿。

Editorial QA 不修改 PPTX，不重新生成内容，不改变事实、数字、来源、主关系或结论强度。

## 模式路由

```text
PROMPT_ONLY
  → Producer
  → validate_package.py
  → 交付 Prompt + handoff + content review

PPT_DRAFT
  → Producer
  → validate_package.py
  → Builder 路由
  → 命中模块或 direct composition
  → 生成一页 Builder 初稿
  → Editorial QA 只读判断
  → Builder 按需局部修复或重排
  → Editorial QA 复审
  → 来源保真 + 语义审计 + 整页渲染 + PowerPoint 检查
  → 交付一页 PPTX
```

## 降级规则

以下情况保留 Producer 结果，并返回 `PPT_RENDERING_BLOCKED`：

- Builder 文件缺失；
- Node.js 或 `@oai/artifact-tool` 等运行依赖不可用；
- Builder 无法表达所需主要关系；
- 路由冲突或模块验证失败；
- 无法生成原生可编辑对象；
- 当前环境不能完成要求的 PPT 检查。
- Editorial QA 无法读取、渲染或判断一页原生可编辑结果。

降级后不得在 `delivery/` 中放伪 PPTX，也不得把提示词包称为 PPT 成品。

## 对外与内部文件隔离

- 最终读者只看到一页 PPT 的业务内容及必要来源/合成披露。
- 内容确认清单面向任务委托人，不进入客户 PPTX。
- 路由、提示词、来源台账、模型决策、预览和 QA 面向制作与审校人员，留在内部目录。
- `delivery/` 只放版本化 PPTX；发布 ZIP 不带真实客户材料、运行产物或本机路径。

## 兼容性原则

- 套件内两个引擎使用相对路径通信。
- 不依赖外部安装的同名 Producer 或 Builder。
- 不在运行时读取包外的个人目录或历史测试夹具。
- 新增 Builder 模块不得改变 Producer 的来源语义和单页预算。
- 新增 provenance 类型时必须同时更新 Producer 契约、验证器和测试。
