# 统一路由、模板与安装

## 路由

将输入整理为 JSON：

```json
{
  "input_mode": "text | data | mixed",
  "text": "原文或任务描述",
  "data": {},
  "requested_module": "可选；用户明确指定时填写"
}
```

运行：

```bash
node scripts/route_input.mjs input.json
```

- `selected`：读取返回模块的 reference、validator、planner 和 renderer。
- `needs_structure_choice`：只展示返回的两种候选结构，不生成正式页。
- `ROUTE_EVIDENCE_INSUFFICIENT`：缺乏可靠结构证据，停止猜测。
- 用户明确指定图形只决定路由；数据不足仍由对应 validator 阻塞。

## 模板跟随

先生成并通过逻辑、版式和溢出检查的无模板 PPTX，再运行：

```bash
python3 scripts/apply_powerpoint_template.py \
  --template customer-template.pptx \
  --generated generated-page.pptx \
  --output customer/page_V01.pptx \
  --target-slide 1 \
  --manifest internal/template-manifest.json
```

模板页必须与生成页同为 16:9，并提供不与正文冲突的目标页。脚本保留模板包、母版、版式、主题和背景，但模板可见形状必须先通过 `information-contribution-gate.md`；纯装饰色带、眉标、标题饰线或空装饰容器返回 `TEMPLATE_DECORATION_BLOCKED`。通过后才把生成页的原生形状写入目标页；生成页包含需要额外关系的图片、媒体、超链接或图表时停止，不做不完整克隆。

模板输出仍需执行全尺寸渲染、溢出检查和 Microsoft PowerPoint 实际打开检查。清单只放 `internal/`，客户目录只放版本化 PPTX。

## 安装验证

标准交付为保留顶层 `consulting-logic-slide/` 的 ZIP。解压后分别执行 Skill 规范检查、内置测试和目标客户端安装；压缩完整性不能替代安装验证。
