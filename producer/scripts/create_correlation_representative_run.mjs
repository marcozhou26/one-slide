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
payload.subtitle = { text:"Synthetic sample data, not real customer data", source_ids:["G02"] };
const run = path.resolve(output);
for (const dir of ["brief","handoff","review","internal","internal/verify","delivery"]) await fs.mkdir(path.join(run, dir), { recursive:true });
const handoff = {
  schema_version:"1.0", product:"single-consulting-slide-producer", output_mode:"PPT_DRAFT", generation_mode:"SYNTHETIC_AUGMENTATION", single_slide:true,
  subject:"Anonymous operational indicator relationship filtering", story:payload.title.text, audience_task:"Identify the strongest positive, strongest negative and weak relationships among the six indicators, and select subsequent key variable combinations", source_ids:["G01","G02","C01"],
  content:{ title:{ text:payload.title.text, source_ids:["C01"] }, subtitle:{ text:payload.subtitle.text, source_ids:["G02"] }, insights:payload.diagram.insights, actions:[], footnotes:[payload.diagram.causality_note] },
  structure:{ primary_question:"Which indicators are most likely to move together, in opposite directions, or have a weak relationship", primary_relationship:"metric x signed correlation coefficient", primary_exhibit:"correlation-matrix", visual_intent:"Matrix positions, signed values and divergent colors are jointly encoded", layout_intent:"Main matrix plus right-hand candidate relationship" },
  information_budget:{ primary_exhibit_count:1, supporting_evidence_count:0, action_or_condition_count:0, status:"pass" },
  display_blocks:[{ block_id:"B01", budget_role:"primary_exhibit", display_intent:"relationship-screening", source_ids:["G01","C01"], items:payload.diagram.metrics.map((metric,index)=>({ item_id:`M${String(index+1).padStart(2,"0")}`, label:metric.label.text, value:"monthly indicators", unit:"original unit", source_ids:["G01"] })) }], datasets:[],
  review_marking:{ required:true, synthetic_data_disclosure:"Synthetic sample data, not real customer data", qualitative_marker:"Pending confirmation" },
  constraints:{ must_include:["method","sample size","Missing value handling","period","Overall","Source","unit","display threshold","Correlation does not mean causation","synthetic disclosure"], must_avoid:["Second page","static image","Internal collaboration information","causal suggestion"], slide_count:1 },
  requested_module:"correlation-matrix", module_payload:payload
};
const writes = {
  "brief/slide-brief.md":"# single page Brief\n\nFor those in charge of business analysis, only one page is created. Readers need to identify the strongest positive correlation, the strongest negative correlation, and the weakest relationship among the six anonymous operating indicators, and select candidates for subsequent key variable analysis. The data is24Monthly Anonymous Synthetic Example; Reserved Pearson,pairwise deletion, period, population, source and non-causal boundaries.\n",
  "handoff/builder-prompt.md":"# single page Builder Prompt\n\nGenerate only one page 16:9 Natively editable PowerPoint. The main graph uses row and column positions, signed coefficients and divergent colors to express the relationship between the six indicators. On the right side, only the strongest positive, strongest negative and weakest relationships are listed, retaining method, sample, missing value processing, period, population, source, unit and threshold. The page must display "Correlation does not mean causation" and "Synthetic sample data, not real customer data." Module names, prompt words,QA, testing or rework instructions, full images or full page images may not be used.\n",
  "handoff/builder-handoff.json":`${JSON.stringify(handoff,null,2)}\n`,
  "review/content-review.md":"# Single page content confirmation\n\n- Model-generated completion, pending confirmation: six anonymous operating indicators and their24Period synthesis relationship coefficient.\n- Calculated based on data: the strongest positive correlation +0.84, the strongest negative correlation -0.79, the weakest relationship -0.06.\n- External disclosure: synthetic sample data, not real customer data; correlation does not mean causation.\n- Not included: real customer facts, reason judgments, second main image, second page or internal collaboration information.\n",
  "internal/source-baseline.json":`${JSON.stringify({schema_version:"1.0",sources:[{source_id:"G01",type:"synthetic_generated",status:"read",description:"anonymous metric definitions, metadata and coefficients"},{source_id:"G02",type:"synthetic_generated",status:"read",description:"visible synthetic disclosure"},{source_id:"C01",type:"calculated",status:"read",description:"strongest positive, strongest negative and weakest relationship findings"}]},null,2)}\n`,
  "internal/provenance-ledger.json":`${JSON.stringify({schema_version:"1.0",entries:[{source_id:"G01",kind:"synthetic_generated",statement:"Six anonymous operating indicators,24Period sample size, methods and coefficients",origin:"deterministic representative fixture seed 20260717",status:"pending_confirmation",affects:["content.subtitle","display_blocks.B01","module_payload.diagram"],gap_id:"GAP01",generation_rule:"fixed symmetric illustrative coefficient matrix"},{source_id:"G02",kind:"synthetic_generated",statement:"Synthetic data disclosed to the public",origin:"required disclosure",status:"pending_confirmation",affects:["module_payload.diagram.disclosure"],gap_id:"GAP01",generation_rule:"fixed disclosure"},{source_id:"C01",kind:"calculated",statement:"The strongest positive correlation, the strongest negative correlation, and the weakest relationship",origin:"upper triangle scan of G01",status:"locked",affects:["content.title","content.insights","module_payload.diagram.insights"],formula:"max r, min r, min absolute r across unique metric pairs",input_source_ids:["G01"]}]},null,2)}\n`,
  "internal/generation-ledger.json":`${JSON.stringify({generation_mode:"SYNTHETIC_AUGMENTATION",gaps:[{gap_id:"GAP01",filled:"anonymous metric relationship example",reversible:true,visible_disclosure:"Synthetic sample data, not real customer data"}]},null,2)}\n`
};
for (const [relative, content] of Object.entries(writes)) await fs.writeFile(path.join(run, relative), content);
const manifest = { schema_version:"1.0", product:"single-consulting-slide-producer", output_mode:"PPT_DRAFT", generation_mode:"SYNTHETIC_AUGMENTATION", single_slide:true, synthetic_content:true, synthetic_data:true, status:"ready", builder_target:"single-consulting-slide-builder", entrypoints:{builder_prompt:"builder-prompt.md",builder_handoff:"builder-handoff.json",content_review:"../review/content-review.md"}, files:[] };
await fs.writeFile(path.join(run,"handoff/handoff-manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
await fs.writeFile(path.join(run,"internal/source-baseline.sha256"),`${crypto.createHash("sha256").update(await fs.readFile(path.join(run,"handoff/builder-handoff.json"))).digest("hex")}  handoff/builder-handoff.json\n`);
process.stdout.write(`${JSON.stringify({ok:true,run})}\n`);
