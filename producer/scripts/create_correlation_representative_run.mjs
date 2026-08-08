import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = process.argv[2];
if (!output) throw new Error("Usage: create_correlation_representative_run.mjs <new-run-directory>");
try { await fs.access(output); throw new Error(`Run directory already exists: ${output}`); } catch (error) { if (error.code !== "ENOENT") throw error; }
const raw = JSON.parse(await fs.readFile(path.join(root, "builder/assets/test-fixtures/correlation-matrix-valid.json"), "utf8"));
const idMap = new Map([["S01","C01"],["S02","G01"],["G01","G02"]]);
const remap = (value) => Array.isArray(value) ? value.map(remap) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key === "id" && idMap.has(item) ? key : key, key === "id" && idMap.has(item) ? idMap.get(item) : key === "source_ids" ? item.map((id) => idMap.get(id) ?? id) : remap(item)])) : value;
const payload = remap(raw);
payload.subtitle = { text:"合成示例数据，非真实客户数据", source_ids:["G02"] };
const run = path.resolve(output);
for (const dir of ["brief","handoff","review","internal","internal/verify","delivery"]) await fs.mkdir(path.join(run, dir), { recursive:true });
const handoff = {
  schema_version:"1.0", product:"single-consulting-slide-producer", output_mode:"PPT_DRAFT", generation_mode:"SYNTHETIC_AUGMENTATION", single_slide:true,
  subject:"匿名运营指标关系筛选", story:payload.title.text, audience_task:"在六个指标中识别最强正向、最强反向和弱关系，并选择后续重点变量组合", source_ids:["G01","G02","C01"],
  content:{ title:{ text:payload.title.text, source_ids:["C01"] }, subtitle:{ text:payload.subtitle.text, source_ids:["G02"] }, insights:payload.diagram.insights, actions:[], footnotes:[payload.diagram.causality_note] },
  structure:{ primary_question:"哪些指标最可能一起变化、方向相反或关系很弱", primary_relationship:"metric x signed correlation coefficient", primary_exhibit:"correlation-matrix", visual_intent:"矩阵位置、带正负号数值与发散色共同编码", layout_intent:"主矩阵加右侧候选关系" },
  information_budget:{ primary_exhibit_count:1, supporting_evidence_count:0, action_or_condition_count:0, status:"pass" },
  display_blocks:[{ block_id:"B01", budget_role:"primary_exhibit", display_intent:"relationship-screening", source_ids:["G01","C01"], items:payload.diagram.metrics.map((metric,index)=>({ item_id:`M${String(index+1).padStart(2,"0")}`, label:metric.label.text, value:"月度指标", unit:"原始单位", source_ids:["G01"] })) }], datasets:[],
  review_marking:{ required:true, synthetic_data_disclosure:"合成示例数据，非真实客户数据", qualitative_marker:"待确认" },
  constraints:{ must_include:["方法","样本量","缺失值处理","期间","总体","来源","单位","显示阈值","相关不代表因果","合成披露"], must_avoid:["第二页","静态图","内部协作信息","因果暗示"], slide_count:1 },
  requested_module:"correlation-matrix", module_payload:payload
};
const writes = {
  "brief/slide-brief.md":"# 单页 Brief\n\n面向经营分析负责人，只制作一页。读者需要在六个匿名运营指标中识别最强正相关、最强负相关和弱关系，并选出后续重点变量分析候选。数据为24个月度匿名合成示例；保留 Pearson、成对删除、期间、总体、来源和非因果边界。\n",
  "handoff/builder-prompt.md":"# 单页 Builder Prompt\n\n只生成一页 16:9 原生可编辑 PowerPoint。主图用行列位置、带正负号的系数和发散色共同表达六个指标之间的关系。右侧只列最强正、最强负和最弱关系，保留方法、样本、缺失值处理、期间、总体、来源、单位和阈值。页面必须显示“相关不代表因果”和“合成示例数据，非真实客户数据”。不得出现模块名、提示词、QA、测试或返工说明，不得使用整图或整页图片。\n",
  "handoff/builder-handoff.json":`${JSON.stringify(handoff,null,2)}\n`,
  "review/content-review.md":"# 单页内容确认\n\n- 模型补全，待确认：六个匿名运营指标及其24期合成关系系数。\n- 根据数据计算：最强正相关 +0.84，最强负相关 -0.79，最弱关系 -0.06。\n- 对外披露：合成示例数据，非真实客户数据；相关不代表因果。\n- 未加入：真实客户事实、原因判断、第二主图、第二页或内部协作信息。\n",
  "internal/source-baseline.json":`${JSON.stringify({schema_version:"1.0",sources:[{source_id:"G01",type:"synthetic_generated",status:"read",description:"anonymous metric definitions, metadata and coefficients"},{source_id:"G02",type:"synthetic_generated",status:"read",description:"visible synthetic disclosure"},{source_id:"C01",type:"calculated",status:"read",description:"strongest positive, strongest negative and weakest relationship findings"}]},null,2)}\n`,
  "internal/provenance-ledger.json":`${JSON.stringify({schema_version:"1.0",entries:[{source_id:"G01",kind:"synthetic_generated",statement:"六个匿名运营指标、24期样本口径、方法和系数",origin:"deterministic representative fixture seed 20260717",status:"pending_confirmation",affects:["content.subtitle","display_blocks.B01","module_payload.diagram"],gap_id:"GAP01",generation_rule:"fixed symmetric illustrative coefficient matrix"},{source_id:"G02",kind:"synthetic_generated",statement:"合成数据对外披露",origin:"required disclosure",status:"pending_confirmation",affects:["module_payload.diagram.disclosure"],gap_id:"GAP01",generation_rule:"fixed disclosure"},{source_id:"C01",kind:"calculated",statement:"最强正相关、最强负相关和最弱关系",origin:"upper triangle scan of G01",status:"locked",affects:["content.title","content.insights","module_payload.diagram.insights"],formula:"max r, min r, min absolute r across unique metric pairs",input_source_ids:["G01"]}]},null,2)}\n`,
  "internal/generation-ledger.json":`${JSON.stringify({generation_mode:"SYNTHETIC_AUGMENTATION",gaps:[{gap_id:"GAP01",filled:"anonymous metric relationship example",reversible:true,visible_disclosure:"合成示例数据，非真实客户数据"}]},null,2)}\n`
};
for (const [relative, content] of Object.entries(writes)) await fs.writeFile(path.join(run, relative), content);
const manifest = { schema_version:"1.0", product:"single-consulting-slide-producer", output_mode:"PPT_DRAFT", generation_mode:"SYNTHETIC_AUGMENTATION", single_slide:true, synthetic_content:true, synthetic_data:true, status:"ready", builder_target:"single-consulting-slide-builder", entrypoints:{builder_prompt:"builder-prompt.md",builder_handoff:"builder-handoff.json",content_review:"../review/content-review.md"}, files:[] };
await fs.writeFile(path.join(run,"handoff/handoff-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
await fs.writeFile(path.join(run,"internal/source-baseline.sha256"),`${crypto.createHash("sha256").update(await fs.readFile(path.join(run,"handoff/builder-handoff.json"))).digest("hex")}  handoff/builder-handoff.json\n`);
process.stdout.write(`${JSON.stringify({ok:true,run})}\n`);
