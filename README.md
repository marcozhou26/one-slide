# OneSlide

把完整或零散材料做成一页逻辑清楚、来源可追溯、原生可编辑的 PowerPoint。

OneSlide 面向不会写复杂提示词、又希望获得专业单页 PPT 的普通用户。你可以只给一句需求，也可以提供完整材料；信息不足时，它会在不改写原意的前提下定向补全，并明确标出模型补全、计算结果和外部来源。

[下载 OneSlide v1.2.1](../../releases/latest/download/one-slide-v1.2.1.zip) · [查看使用方法](#3-分钟上手) · [提交问题](../../issues)

## 一页，也能把复杂逻辑讲清楚

下面是 OneSlide 已覆盖或可迁移的单页表达类型。展示数据均为模拟或合成数据，不包含真实客户、员工或个人信息。

<table>
  <tr>
    <td width="50%"><img src="showcase/01-column-chart.png" alt="月度合同额柱状图"><br><b>柱状图：</b>实际、目标与累计缺口</td>
    <td width="50%"><img src="showcase/02-medium-capability-gap.png" alt="能力差距分析"><br><b>中等复杂度：</b>能力差距、难度与制约因素</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/03-bubble-heatmap.png" alt="气泡矩阵与热力表"><br><b>气泡矩阵：</b>价值、难度与优先级</td>
    <td width="50%"><img src="showcase/04-org-chart.png" alt="组织架构图"><br><b>组织架构：</b>实线汇报与虚线协作关系</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/05-waterfall.png" alt="EBITDA 瀑布图"><br><b>瀑布图：</b>预算与实际差异归因</td>
    <td width="50%"><img src="showcase/06-sankey.png" alt="服务工单桑基图"><br><b>流向分析：</b>工单入口、处理路径与结果</td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/07-project-gantt.png" alt="项目甘特图"><br><b>项目甘特图：</b>进度、依赖与放行条件</td>
    <td width="50%"><img src="showcase/08-compensation-productivity.png" alt="人均薪酬与产出效能"><br><b>薪酬效能：</b>人均薪酬、人均产出与部门象限</td>
  </tr>
</table>

## 它只做一页

每次运行只处理一页 16:9 PPT。材料超过一页时，OneSlide 会推荐最强的单页焦点或请你选择，不会自动生成一整套报告。

它提供两种输出：

- `PROMPT_ONLY`：生成可交给 PPT 工具或其他模型使用的完整提示词包。
- `PPT_DRAFT`：直接生成原生可编辑的 PowerPoint，并执行基础排版检查。

没有明确说“生成 PPT”时，默认先交付提示词包。

## 3 分钟上手

1. 下载并解压 [one-slide-v1.2.1.zip](../../releases/latest/download/one-slide-v1.2.1.zip)。
2. 把顶层 `one-slide` 文件夹复制到支持 Agent Skills 的 Skills 目录。
3. 刷新客户端，调用 `$one-slide`。

只生成提示词：

```text
帮我做一页，说明基层管理者每天被审批和会议占用。数据你合理补全，我只要提示词。
```

直接生成 PPT：

```text
根据这份材料直接做成一页专业 PPT。信息不足可以补，但要标明，PPT 必须可以编辑。
```

## OneSlide 如何处理信息不足

每个重要内容项都会区分：

- 用户提供；
- 根据材料稳定推导；
- 根据数据计算；
- 模型补全，待确认；
- 外部来源核验。

使用合成数据时，页面必须显示“合成示例数据，非真实客户数据”。确认采用某个假设不会把它变成真实事实。

## 运行要求

- `PROMPT_ONLY`：Python 3.10 或更高版本。
- `PPT_DRAFT`：还需要 Node.js，以及能提供 `@oai/artifact-tool` 的兼容 Codex 运行环境。
- 完整 PowerPoint 验证需要 Microsoft PowerPoint；不可用时会明确标记 `POWERPOINT_OPEN_CHECK=not_tested`。

检查运行环境：

```bash
python3 scripts/check_environment.py
```

验证 Skill 包：

```bash
python3 scripts/validate_suite.py .
python3 -m unittest discover -s tests -v
```

## 仓库结构

- `SKILL.md`：唯一用户入口。
- `producer/`：理解用户材料、定向补全和来源标注。
- `builder/`：选择图形、生成原生 PPT 和检查页面布局。
- `showcase/`：公开展示用单页效果图，全部采用模拟或合成数据。
- `scripts/`、`tests/`：环境检查、包验证和回归测试。

## 当前边界

- 每次只生成一页，不负责整套演示文稿的故事线。
- 自动补全不会改写用户事实，也不会把模拟内容冒充为真实数据。
- PPT 运行依赖不可用时，只交付提示词和结构化交接包。
- 请勿把客户数据、员工个人信息或其他敏感资料提交到公开 Issue。

## 作者

- 作者与维护者：周俊东 Marco
- 视频号和公众号：周俊东Marco
- 微信：`zhou139223`（添加时请备注“OneSlide”）
- 背景：来自南海公学（Nanhai Academy）
- 网址：[https://nanhai.pro](https://nanhai.pro)

## 授权

- `SKILL.md`、执行引擎、脚本、配置和测试代码：Apache License 2.0。
- 原创使用说明、教程、示例输入、示例输出及自有参考 PPT：CC BY 4.0。
- “OneSlide”“周俊东 Marco”的姓名、头像、Logo、公众号及视频号标识不包含在开放授权中；合理说明作品来源不受影响。
- 详细范围见 `LICENSE_STATUS.md`、`CONTENT-LICENSE.md`、`TRADEMARKS.md` 和 `NOTICE`。

使用 OneSlide 生成普通 PPT 时，不要求在 PPT 中给作者加水印或署名。重新发布、修改或分发 OneSlide 本身及其文档、示例时，须遵守相应许可证。

## 版本状态

当前版本：v1.2.1。该版本新增组织架构图同层对齐、直属竖线和职能虚线通道门禁。公开许可证和本机回归测试已经配置；不同客户端和不同 PowerPoint 版本仍可能产生字体或连接线差异。
