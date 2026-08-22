import { createPresentation, addTextBox, addActionBand, addDataSourceFooter, setSpeakerNotes, exportPresentation, COLORS } from './pptx_core.mjs';

const out = process.argv[2];
if (!out) throw new Error('Usage: render_compensation_skill_chain.mjs <output-dir>');
const { presentation, slide } = createPresentation('#FFFFFF', 'presentation_16_9');
addTextBox(slide,{name:'card-label',text:'专业卡 2',position:{left:52,top:34,width:150,height:34},fontSize:18,bold:true,color:COLORS.white,alignment:'center',fill:COLORS.orange,line:{style:'solid',fill:COLORS.orange,width:0},singleLine:true});
addTextBox(slide,{name:'heading',text:'把薪酬分析从“看数”变成可复核的管理判断',position:{left:52,top:86,width:1176,height:48},fontSize:30,bold:true,color:COLORS.navy,singleLine:true});
const steps=[['01','输入数据','员工薪酬和市场基准'],['02','统一口径','范围、分位、样本和期间'],['03','公式计算','公式可追溯'],['04','多维分析','市场定位和内部公平'],['05','人工判断','结果仍需人工审查']];
const left=52, top=190, gap=16, w=224, h=184;
for(let i=0;i<steps.length;i++){
  const x=left+i*(w+gap); const [num,title,copy]=steps[i];
  slide.shapes.add({name:`step-${i+1}-frame`,geometry:'rect',position:{left:x,top,width:w,height:h},fill:i===2?COLORS.blueLight:'#F4F6F8',line:{style:'solid',fill:COLORS.border,width:1}});
  addTextBox(slide,{name:`step-${i+1}-num`,text:num,position:{left:x+16,top:top+14,width:42,height:28},fontSize:14,bold:true,color:COLORS.blue,alignment:'center',fill:'#FFFFFF',line:{style:'solid',fill:COLORS.border,width:1},singleLine:true});
  addTextBox(slide,{name:`step-${i+1}-title`,text:title,position:{left:x+16,top:top+54,width:w-32,height:34},fontSize:18,bold:true,color:COLORS.navy,singleLine:true});
  addTextBox(slide,{name:`step-${i+1}-copy`,text:copy,position:{left:x+16,top:top+98,width:w-32,height:68},fontSize:14,color:COLORS.text,maxLines:2,minLastLineChars:2});
  if(i<steps.length-1) slide.shapes.add({name:`connector-${i+1}`,geometry:'line',position:{left:x+w+2,top:top+90,width:gap-4,height:1},line:{style:'solid',fill:COLORS.orange,width:2},fill:'none'});
}
addActionBand(slide,{name:'guardrail',position:{left:52,top:430,width:1176,height:64},label:'设计底线',copy:'不编造缺失数据；不隐藏计算逻辑；不把统计关系当成个人结论',labelWidth:150,fill:COLORS.orangeLight,border:COLORS.orange,labelColor:COLORS.orange,copyColor:COLORS.navy});
addTextBox(slide,{name:'deliverable',text:'交付物：可编辑、可追溯、可复核的 Excel 分析工作簿',position:{left:52,top:526,width:1176,height:44},fontSize:18,bold:true,color:COLORS.navy,alignment:'center',fill:COLORS.blueLight,line:{style:'solid',fill:COLORS.blueLight,width:0},singleLine:true});
addDataSourceFooter(slide,{source:'用户提供的 compensation-analysis-workbook Skill 与已确认页面文案',position:{left:52,top:676,width:1070,height:20}});
setSpeakerNotes(slide,[{title:'术语与边界',items:['本页是 Skill 设计逻辑概览，不是 Excel 操作说明。','派生指标应由公式计算；统计结果不能直接替代个人薪酬决定、法律判断或发薪执行。']}]);
await exportPresentation(presentation,{pptx:`${out}/compensation-skill-chain-v1.0.0.pptx`,preview:`${out}/compensation-skill-chain-v1.0.0.png`,layout:`${out}/compensation-skill-chain-v1.0.0.layout.json`});
