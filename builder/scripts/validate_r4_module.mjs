import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildAnchorMap, requireCondition, validateAllAnchorsMapped, validateTitle, validateVisibleText } from "./source_fidelity.mjs";
const MODULES=new Set(["sankey-flow","chord-dependency","market-funnel","region-map-table","industry-value-chain","spiral-maturity","gantt-dependency"]);
function ctx(data){
  const anchors=buildAnchorMap(data.source_anchors),mapped=new Set();
  const approvedRewriteMode=data.module_id==="sankey-flow"&&data.title?.origin==="approved_rewrite";
  const source=(ids,label)=>{requireCondition(Array.isArray(ids)&&ids.length,"SOURCE_FIDELITY_FAIL",`${label} needs source_ids`);ids.forEach(id=>{requireCondition(anchors.has(id),"SOURCE_FIDELITY_FAIL",`${label} cites unknown source ${id}`);mapped.add(id);});};
  if(data.title?.origin==="approved_rewrite"){
    requireCondition(data.module_id==="sankey-flow","SOURCE_FIDELITY_FAIL","approved_rewrite title is only supported by sankey-flow in R4");
    requireCondition(typeof data.title.text==="string"&&data.title.text.length>0,"SOURCE_FIDELITY_FAIL","Approved rewrite title text is required");
    requireCondition(typeof data.title.derivation==="string"&&data.title.derivation.trim().length>0,"SOURCE_FIDELITY_FAIL","Approved rewrite title needs derivation");
    source(data.title.source_ids,"Approved rewrite title");
  }else{
    validateTitle(data.title,anchors);
    (data.title.source_ids??[]).forEach(id=>mapped.add(id));
  }
  const text=(item,label)=>{
    if(approvedRewriteMode){
      requireCondition(typeof item?.text==="string"&&item.text.length>0,"SOURCE_FIDELITY_FAIL",`${label} text is required`);
      source(item.source_ids,label);
    }else{
      validateVisibleText(item,anchors,label);(item.source_ids??[]).forEach(id=>mapped.add(id));
    }
  };
  const rawText=(value,ids,label)=>text({text:value,source_ids:ids},label);
  return{anchors,mapped,text,rawText,source};
}

const SANKEY_FLOW_KINDS=new Set(["neutral","on_time","not_on_time","success","loss"]);
function nearlyEqual(left,right){return Math.abs(left-right)<=1e-6*Math.max(1,Math.abs(left),Math.abs(right));}
function sankey(d,c,data){
  requireCondition(Array.isArray(d.layers)&&d.layers.length>=3&&d.layers.length<=5,"DATA_CONTRACT_FAIL","Sankey requires 3–5 layers");
  const nodes=new Map();
  d.layers.forEach((layer,li)=>{
    if(layer.label)c.text(layer.label,"Sankey layer");
    requireCondition(layer.nodes?.length>=1&&layer.nodes.length<=8,"DATA_CONTRACT_FAIL","Each Sankey layer needs 1–8 nodes");
    layer.nodes.forEach(n=>{
      requireCondition(typeof n.id==="string"&&n.id.length>0&&!nodes.has(n.id),"DATA_CONTRACT_FAIL","Sankey node ids must be unique non-empty strings");
      requireCondition(Number.isFinite(n.value)&&n.value>0,"DATA_CONTRACT_FAIL",`Sankey node ${n.id} value must be positive`);
      nodes.set(n.id,{...n,layer:li});c.text(n.label,"Sankey node");c.source(n.source_ids,"Sankey node value");
    });
  });
  requireCondition(d.flows?.length>=1,"DATA_CONTRACT_FAIL","Sankey flows are required");
  d.flows.forEach((f,index)=>{
    const a=nodes.get(f.from),b=nodes.get(f.to);
    requireCondition(a&&b&&b.layer===a.layer+1,"SANKEY_FLOW_FAIL","Flows must connect adjacent layers left to right");
    requireCondition(Number.isFinite(f.value)&&f.value>0,"DATA_CONTRACT_FAIL","Flow value must be positive");
    requireCondition(SANKEY_FLOW_KINDS.has(f.kind),"SANKEY_FLOW_SEMANTICS_FAIL",`Unsupported Sankey flow kind at index ${index}: ${f.kind}`);
    c.source(f.source_ids,"Sankey flow");
  });
  for(const [id,n] of nodes){
    const incoming=d.flows.filter(f=>f.to===id).reduce((s,f)=>s+f.value,0),outgoing=d.flows.filter(f=>f.from===id).reduce((s,f)=>s+f.value,0);
    if(n.layer>0)requireCondition(nearlyEqual(incoming,n.value),"SANKEY_RECONCILIATION_FAIL",`Node ${id} incoming flow does not match its value`);
    if(n.layer<d.layers.length-1)requireCondition(nearlyEqual(outgoing,n.value),"SANKEY_RECONCILIATION_FAIL",`Node ${id} outgoing flow does not match its value`);
  }
  const layerTotals=d.layers.map(layer=>layer.nodes.reduce((sum,node)=>sum+node.value,0));
  layerTotals.slice(1).forEach((total,index)=>requireCondition(nearlyEqual(total,layerTotals[0]),"SANKEY_RECONCILIATION_FAIL",`Layer ${index+2} total does not reconcile`));
  const sla=(data.display_blocks??[]).find(block=>block.display_intent==="local_verification"||block.block_id==="E25_SLA");
  if(sla){
    requireCondition(Array.isArray(sla.items)&&sla.items.length===5,"SANKEY_SLA_BLOCK_FAIL","SLA verification block must contain exactly five rows");
    const serviceNodes=new Map(d.layers[0].nodes.map(node=>[node.label.text.split("; ")[0],node]));
    sla.items.forEach((item,index)=>{
      requireCondition(typeof item.label==="string"&&item.label.length>0,"SANKEY_SLA_BLOCK_FAIL",`SLA row ${index+1} label is required`);
      c.rawText(item.label,item.source_ids,`SLA row ${index+1} label`);c.source(item.source_ids,`SLA row ${index+1}`);
      const value=item.value??{};
      requireCondition(Number.isFinite(value.monthly_volume)&&value.monthly_volume>=0,"SANKEY_SLA_BLOCK_FAIL",`SLA row ${index+1} monthly_volume is invalid`);
      requireCondition(Number.isFinite(value.fte)&&value.fte>=0,"SANKEY_SLA_BLOCK_FAIL",`SLA row ${index+1} fte is invalid`);
      requireCondition(Number.isFinite(value.on_time_rate)&&value.on_time_rate>=0&&value.on_time_rate<=1,"SANKEY_SLA_BLOCK_FAIL",`SLA row ${index+1} on_time_rate is invalid`);
      requireCondition(typeof value.sla_status==="string"&&value.sla_status.length>0,"SANKEY_SLA_BLOCK_FAIL",`SLA row ${index+1} sla_status is required`);
      requireCondition(serviceNodes.has(item.label)&&nearlyEqual(serviceNodes.get(item.label).value,value.monthly_volume),"SANKEY_SLA_BLOCK_FAIL",`SLA row ${item.label} volume conflicts with the first Sankey layer`);
    });
  }
  (d.insights??[]).forEach(x=>c.text(x,"Insight"));if(d.conclusion)c.text(d.conclusion,"Conclusion");
}
function chord(d,c){requireCondition(d.nodes?.length>=5&&d.nodes.length<=15,"DATA_CONTRACT_FAIL","Chord requires 5–15 nodes");const ids=new Set();d.nodes.forEach(n=>{requireCondition(!ids.has(n.id),"DATA_CONTRACT_FAIL","Chord node ids must be unique");ids.add(n.id);c.text(n.label,"Chord node");c.text(n.group,"Chord group");c.source(n.source_ids,"Chord node total");});requireCondition(d.flows?.length>=3,"DATA_CONTRACT_FAIL","Chord flows are required");d.flows.forEach(f=>{requireCondition(ids.has(f.from)&&ids.has(f.to)&&f.from!==f.to,"DATA_CONTRACT_FAIL","Chord flow endpoints are invalid");requireCondition(Number.isFinite(f.value)&&f.value>0,"DATA_CONTRACT_FAIL","Chord flow must be positive");c.source(f.source_ids,"Chord flow");});(d.insights??[]).forEach(x=>c.text(x,"Insight"));if(d.conclusion)c.text(d.conclusion,"Conclusion");}
function funnel(d,c){requireCondition(d.layers?.length===4,"DATA_CONTRACT_FAIL","Market funnel requires four layers");let prev=Infinity;d.layers.forEach(x=>{c.text(x.label,"Funnel layer");c.text(x.reason,"Funnel reason");requireCondition(Number.isFinite(x.value)&&x.value>=0&&x.value<=prev,"FUNNEL_ORDER_FAIL","Funnel values must descend");prev=x.value;c.source(x.source_ids,"Funnel value");});requireCondition(d.factors?.length>=3&&d.factors.length<=6,"DATA_CONTRACT_FAIL","Funnel requires 3–6 calculation factors");d.factors.forEach(x=>{c.text(x.label,"Factor");c.text(x.value,"Factor value");c.text(x.source,"Factor source");c.text(x.sensitivity,"Factor sensitivity");});if(d.milestone)c.text(d.milestone,"Milestone");if(d.assumptions)d.assumptions.forEach(x=>c.text(x,"Assumption"));}
function region(d,c){requireCondition(d.regions?.length>=4&&d.regions.length<=10,"DATA_CONTRACT_FAIL","Region map requires 4–10 regions");const ids=new Set();d.regions.forEach(x=>{requireCondition(!ids.has(x.id),"DATA_CONTRACT_FAIL","Region ids must be unique");ids.add(x.id);c.text(x.label,"Region");requireCondition([x.intensity,x.headcount,x.efficiency,x.cost_share,x.output_share,x.x,x.y].every(Number.isFinite),"DATA_CONTRACT_FAIL","Region metrics and coordinates must be numeric");c.source(x.source_ids,"Region data");});requireCondition(d.clusters?.length<=3,"DATA_CONTRACT_FAIL","At most three strategic clusters");(d.clusters??[]).forEach(x=>c.text(x,"Cluster"));(d.insights??[]).forEach(x=>c.text(x,"Insight"));if(d.conclusion)c.text(d.conclusion,"Conclusion");}
function valueChain(d,c){requireCondition(d.stages?.length>=4&&d.stages.length<=7,"DATA_CONTRACT_FAIL","Value chain requires 4–7 stages");const ids=new Set();d.stages.forEach(x=>{requireCondition(!ids.has(x.id),"DATA_CONTRACT_FAIL","Stage ids must be unique");ids.add(x.id);c.text(x.label,"Value-chain stage");c.text(x.barrier,"Entry barrier");requireCondition([x.margin,x.market_size,x.concentration,x.value_index].every(Number.isFinite),"DATA_CONTRACT_FAIL","Stage metrics must be numeric");c.source(x.source_ids,"Stage data");});requireCondition(d.players?.length>=3&&d.players.length<=8,"DATA_CONTRACT_FAIL","Value chain requires 3–8 player types");d.players.forEach(p=>{c.text(p.label,"Player");requireCondition(p.coverage?.every(id=>ids.has(id)),"DATA_CONTRACT_FAIL","Player coverage cites unknown stage");(p.planned??[]).forEach(id=>requireCondition(ids.has(id),"DATA_CONTRACT_FAIL","Planned stage is unknown"));});if(d.positioning)c.text(d.positioning,"Positioning");}
function spiral(d,c){requireCondition(d.levels?.length===4,"DATA_CONTRACT_FAIL","Spiral maturity requires four levels");requireCondition(Number.isInteger(d.current_level)&&d.current_level>=1&&d.current_level<=4,"DATA_CONTRACT_FAIL","Current level must be 1–4");const actionIds=d.levels[0]?.actions?.map(a=>a.id)??[];requireCondition(actionIds.length===4,"DATA_CONTRACT_FAIL","Each level requires four actions");d.levels.forEach((level,li)=>{c.text(level.label,"Maturity level");c.text(level.feature,"Level feature");c.text(level.evidence,"Level evidence");c.text(level.exit,"Exit standard");c.text(level.duration,"Level duration");requireCondition(level.actions?.map(a=>a.id).join("|")===actionIds.join("|"),"DATA_CONTRACT_FAIL","Action order must repeat across levels");level.actions.forEach(a=>c.text(a.text,"Level action"));if(li<3)c.text(level.gate,"Stage gate");});c.text(d.core,"Core");if(d.feedback)c.text(d.feedback,"Feedback");}
export function normalizeGanttTimeAxis(d){
  const maxTask=Math.max(...d.tasks.map(task=>task.end),...(d.milestones??[]).map(milestone=>milestone.month),1);
  if(d.month_label_map===undefined)return Array.from({length:18},(_,index)=>({slot:index+1,label:String(index+1),source_offset:null}));
  requireCondition(d.month_label_map&&typeof d.month_label_map==="object"&&!Array.isArray(d.month_label_map),"GANTT_TIME_SCALE_FAIL","month_label_map must be an object");
  const entries=Object.entries(d.month_label_map).map(([key,label])=>({slot:Number(key),label})).sort((a,b)=>a.slot-b.slot);
  requireCondition(entries.length>0,"GANTT_TIME_SCALE_FAIL","month_label_map cannot be empty");
  entries.forEach(({slot,label})=>{
    requireCondition(Number.isInteger(slot)&&slot>=1&&slot<=18,"GANTT_TIME_SCALE_FAIL","Relative time slot must be an integer from 1 to 18");
    requireCondition(typeof label==="string"&&/^(?:T0|T\+\d+)$/.test(label),"GANTT_TIME_SCALE_FAIL",`Invalid relative time label: ${label}`);
    const offset=label==="T0"?0:Number(label.slice(2));
    requireCondition(slot===offset+1,"GANTT_TIME_SCALE_FAIL",`${label} must map to slot ${offset+1}`);
  });
  const slotCount=Math.max(maxTask,...entries.map(entry=>entry.slot));
  return Array.from({length:slotCount},(_,index)=>({slot:index+1,label:index===0?"T0":`T+${index}`,source_offset:index}));
}

export function extractGanttLayerSteps(d,timeAxis=normalizeGanttTimeAxis(d)){
  let steps=Array.isArray(d.layer_steps)?d.layer_steps.map(step=>({
    label:step.source_time_label,layer_count:step.layer_count,source_ids:step.source_ids??[],
  })):null;
  if(!steps){
    const metric=(d.side_metrics??[]).find(item=>item.text?.startsWith("Stage level"));
    if(metric){
      steps=[];const pattern=/(T0|T\+\d+)for(\d+)layer/g;let match;
      while((match=pattern.exec(metric.text)))steps.push({label:match[1],layer_count:Number(match[2]),source_ids:metric.source_ids??[]});
    }
  }
  if(!steps?.length)return[];
  requireCondition(steps.length>=2&&steps.length<=6,"GANTT_LAYER_STEP_FAIL","Layer step line needs 2–6 points");
  const axisByLabel=new Map(timeAxis.map(item=>[item.label,item]));
  const normalized=steps.map((step,index)=>{
    const axis=axisByLabel.get(step.label);
    requireCondition(axis&&Number.isInteger(step.layer_count)&&step.layer_count>0,"GANTT_LAYER_STEP_FAIL",`Invalid layer step at index ${index}`);
    return{...step,slot:axis.slot,source_offset:axis.source_offset};
  });
  normalized.slice(1).forEach((step,index)=>{
    const previous=normalized[index];
    requireCondition(step.slot>previous.slot,"GANTT_LAYER_STEP_FAIL","Layer step time labels must increase");
    requireCondition(step.layer_count===previous.layer_count-1,"GANTT_LAYER_STEP_FAIL","Layer count must decrease one level at each step");
  });
  return normalized;
}

export function normalizeGanttDependencies(d){
  const tasks=new Map(d.tasks.map(task=>[task.id,task]));
  return(d.dependencies??[]).map((dependency,index)=>{
    requireCondition(tasks.has(dependency.from)&&tasks.has(dependency.to)&&dependency.from!==dependency.to,"GANTT_DEPENDENCY_FAIL","Dependency endpoints are invalid");
    const rawClass=dependency.relationship_class??"prerequisite";
    requireCondition(["time_order_only","prerequisite","necessary_dependency"].includes(rawClass),"GANTT_DEPENDENCY_SEMANTICS_FAIL",`Unsupported relationship_class at dependency ${index+1}`);
    const relationship_class=rawClass==="necessary_dependency"?"prerequisite":rawClass;
    if(relationship_class==="time_order_only"){
      requireCondition(dependency.not_a_prerequisite===true,"GANTT_DEPENDENCY_SEMANTICS_FAIL","time_order_only requires not_a_prerequisite=true");
      requireCondition(tasks.get(dependency.from).start<=tasks.get(dependency.to).start,"GANTT_DEPENDENCY_SEMANTICS_FAIL","time_order_only endpoints must follow source time order");
    }else requireCondition(dependency.not_a_prerequisite!==true,"GANTT_DEPENDENCY_SEMANTICS_FAIL","A prerequisite cannot set not_a_prerequisite=true");
    return{...dependency,relationship_class,not_a_prerequisite:relationship_class==="time_order_only"};
  });
}

function gantt(d,c){
  requireCondition(d.lanes?.length>=2&&d.lanes.length<=6,"DATA_CONTRACT_FAIL","Gantt requires 2–6 lanes");d.lanes.forEach(x=>c.text(x,"Lane"));
  const laneNames=new Set(d.lanes.map(x=>x.text));requireCondition(laneNames.size===d.lanes.length,"DATA_CONTRACT_FAIL","Gantt lane names must be unique");
  requireCondition(d.tasks?.length>=8&&d.tasks.length<=20,"DATA_CONTRACT_FAIL","Gantt requires 8–20 tasks");const ids=new Set();
  d.tasks.forEach(t=>{requireCondition(typeof t.id==="string"&&t.id.length>0&&!ids.has(t.id),"DATA_CONTRACT_FAIL","Task ids must be unique non-empty strings");ids.add(t.id);c.text(t.label,"Task");c.text(t.owner,"Owner");requireCondition(laneNames.has(t.lane),"DATA_CONTRACT_FAIL","Task lane must match a declared lane");requireCondition(Number.isInteger(t.start)&&Number.isInteger(t.end)&&t.start>=1&&t.end>=t.start&&t.end<=18,"GANTT_RANGE_FAIL","Task range must be within slots 1–18");requireCondition(Number.isFinite(t.progress)&&t.progress>=0&&t.progress<=100,"DATA_CONTRACT_FAIL","Progress must be 0–100");requireCondition(typeof t.critical==="boolean","DATA_CONTRACT_FAIL","Task critical must be boolean");});
  const timeAxis=normalizeGanttTimeAxis(d),layerSteps=extractGanttLayerSteps(d,timeAxis),dependencies=normalizeGanttDependencies(d);
  (d.milestones??[]).forEach(x=>{c.text(x.label,"Milestone");requireCondition(Number.isInteger(x.month)&&x.month>=1&&x.month<=timeAxis.length,"GANTT_RANGE_FAIL","Milestone slot is invalid");});
  (d.side_metrics??[]).forEach(x=>c.text(x,"Gantt side metric"));if(d.conclusion)c.text(d.conclusion,"Conclusion");
  return{timeAxis,layerSteps,dependencies};
}
export function validateR4Module(data){requireCondition(data?.version==="1.0","LOGIC_STRUCTURE_FAIL","Unsupported version");requireCondition(MODULES.has(data?.module_id),"LOGIC_STRUCTURE_FAIL","Expected an R4 module_id");requireCondition(data?.diagram?.type===data.module_id,"LOGIC_STRUCTURE_FAIL","diagram.type must match module_id");const c=ctx(data);if(data.subtitle)c.text(data.subtitle,"Subtitle");const validator=({"sankey-flow":sankey,"chord-dependency":chord,"market-funnel":funnel,"region-map-table":region,"industry-value-chain":valueChain,"spiral-maturity":spiral,"gantt-dependency":gantt})[data.module_id];validator(data.diagram,c,data);return{ok:true,module_id:data.module_id,...validateAllAnchorsMapped(data.source_anchors,c.mapped)};}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const p=process.argv[2];try{if(!p)throw new Error("Usage: validate_r4_module.mjs <input.json>");process.stdout.write(`${JSON.stringify(validateR4Module(JSON.parse(await fs.readFile(p,"utf8"))))}\n`);}catch(error){process.stderr.write(`${JSON.stringify({code:error.code??"DATA_CONTRACT_FAIL",message:error.message})}\n`);process.exitCode=1;}}
