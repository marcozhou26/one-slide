# Marimekko 模块

适用：3–6 个细分同时表达横向规模和内部 2–5 类构成。`layout_mode=normalized` 保留传统不等宽、列内 100% 堆叠；`layout_mode=absolute` 表达真正的非 100% 不等宽不等高图：列宽按 `total_value`，列高和块高按绝对值编码。

必需输入：细分名称、绝对规模、增速、各构成份额或绝对值、`source_note` 与来源。传统模式要求细分宽度合计 100%、每列构成合计 100%；绝对模式要求每列 `stacks[].value` 对平到 `segment.total_value`，并声明 `value_unit`。

阻塞：任一层不对平时 `MEKKO_RECONCILIATION_FAIL`。禁止用补差项偷平、按视觉调整真实面积或编写主战场结论。绝对模式下不能把 `share` 当作 `value` 使用。

页面把 `CAGR` 改写为普通中文“年均增长”；正式术语和计算公式保留在讲者备注。右侧最多显示两条关键发现和结论，页底只显示数据来源，合成披露并入同一行。
