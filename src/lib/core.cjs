(function(root){
'use strict';
const fields=[
 {key:'duty',title:'Duty description',limit:450,short:'Duty',description:'Describe the role, scope, responsibilities, people, and resources entrusted to the officer.',alq:'Position-specific narrative. Include responsibility level, people supervised, resources or projects managed. Use plain English and authorized acronyms. Include brief unit mission context only when needed to explain duties. Prior jobs should be mentioned only when they affect the evaluation. The source calls for the TDY duty description for 365-day extended deployments and total force assigned in a commander’s description.'},
 {key:'mission',title:'Executing the mission',limit:350,short:'Mission',description:'Effectively uses knowledge, initiative, and adaptability to produce timely, high quality/quantity results to positively impact the mission.',alq:'Job proficiency • Initiative • Adaptability. Apply professional knowledge, take appropriate action, and adjust to changing conditions. The source PDF’s Mission ALQ button repeats the Leading People guidance; this app uses the Mission qualities from official Air Force ALQ guidance.'},
 {key:'people',title:'Leading people',limit:350,short:'People',description:'Fosters cohesive teams, effectively communicates, and uses emotional intelligence to take care of people and accomplish the mission.',alq:'Inclusion & teamwork: collaborate to achieve an inclusive climate and common goals. Emotional intelligence: exercise self-awareness, manage emotions, understand others, and manage relationships. Communication: deliver clear, timely messages and listen actively.'},
 {key:'resources',title:'Managing resources',limit:350,short:'Resources',description:'Manages assigned resources effectively and takes responsibility for actions/behaviors to maximize organizational performance.',alq:'Stewardship: responsibly manage time, equipment, people, funds, and facilities. Accountability: take responsibility for personal and team actions; demonstrate reliability and transparency.'},
 {key:'unit',title:'Improving the unit',limit:350,short:'Unit',description:'Demonstrates critical thinking and fosters innovation to find creative solutions and improve mission execution.',alq:'Decision making: make informed, effective, timely decisions that weigh constraints, risks, and benefits. Innovation: think creatively, implement improvements, and take calculated risks.'},
 {key:'reviewer',title:'Higher-level reviewer assessment',limit:250,short:'Reviewer',description:'Provide at least one performance statement within the space available.',alq:'The source requires comments with at least one performance statement; “THIS SECTION NOT USED” may serve as that statement. Review applicable guidance on inappropriate comments and referrals (source references: DAFI 36-2406 paragraphs 1.12 and 1.10). Verify current paragraph numbering before use.'}
];
const columns=['id','name','rank','unit_name','period_start','period_end','duty_title',...fields.map(f=>f.key),'parking','updated_at'];
function blank(){return Object.fromEntries(columns.map(k=>[k,k==='id'?(globalThis.crypto?.randomUUID?.()||'opb-'+Date.now()+'-'+Math.random().toString(36).slice(2)):k==='name'?'Untitled officer':'']));}
function csvParse(text){
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false,ended=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;ended=true;}}else cell+=c;}
  else if(c==='"'){if(cell||ended)throw Error('Unexpected quote in CSV.');quoted=true;}
  else if(c===','){row.push(cell);cell='';ended=false;}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';ended=false;}
  else {if(ended)throw Error('Unexpected text after a closing CSV quote.');cell+=c;}
 }
 if(quoted)throw Error('Unclosed quoted field in CSV.');
 if(cell||row.length||ended){row.push(cell);if(row.some(v=>v!==''))rows.push(row);}
 return rows;
}
// A leading apostrophe makes formula-like cells inert when opened in a spreadsheet.
// Prefix literal apostrophes too, so our import can reverse the encoding losslessly.
function protect(v){v=String(v??'');return /^[\s]*[=+\-@]/.test(v)||v.startsWith("'")?"'"+v:v;}
function unprotect(v){return v.startsWith("'")&&(v[1]==="'"||/^[\s]*[=+\-@]/.test(v.slice(1)))?v.slice(1):v;}
function serialize(reports){return '\uFEFF'+[columns,...reports.map(r=>columns.map(k=>protect(r[k])))].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n';}
function importCSV(text){const rows=csvParse(text);if(rows.length<2)throw Error('CSV must include a header and at least one report.');const h=rows.shift();if(new Set(h).size!==h.length)throw Error('Duplicate CSV headers.');for(const c of columns)if(!h.includes(c))throw Error('Missing CSV column: '+c);const ids=new Set();return rows.map((row,i)=>{if(row.length!==h.length)throw Error('CSV row '+(i+2)+' has the wrong number of columns.');let r=blank();h.forEach((k,j)=>{if(columns.includes(k))r[k]=unprotect(row[j]);});if(!r.id||ids.has(r.id))throw Error('Each report needs a unique, nonempty id.');ids.add(r.id);return r;});}
function issues(r){let out=[];for(const f of fields){const t=r[f.key]||'';if(!t.trim())out.push({key:f.key,type:'missing',text:f.title+': add a narrative.'});if(t.length>f.limit)out.push({key:f.key,type:'over',text:f.title+': '+(t.length-f.limit)+(t.length-f.limit===1?' character over.':' characters over.')});if(t&&/\t|\n|\r/.test(t))out.push({key:f.key,type:'review',text:f.title+': review line breaks or tabs before pasting.'});if(t&&/^\s*[-•]/.test(t))out.push({key:f.key,type:'review',text:f.title+': use narrative sentences rather than bullet formatting.'});if(t&&/ {2,}|^\s|\s$/.test(t))out.push({key:f.key,type:'review',text:f.title+': review extra spaces.'});}if(r.period_start&&r.period_end&&r.period_end<r.period_start)out.push({key:'period_end',type:'review',text:'Reporting period ends before it begins.'});return out;}

const legacyKeys={duty:'duty_description',mission:'executing_mission',people:'leading_people',resources:'managing_resources',unit:'improving_unit',reviewer:'hlr_assessment',parking:'parking_lot'};
function draftFromReport(report){return Object.fromEntries(Object.entries(legacyKeys).map(([k,v])=>[v,report[k]||'']));}
function reportFromDraft(draft,report=blank()){return {...report,...Object.fromEntries(Object.entries(legacyKeys).map(([k,v])=>[k,draft[v]||'']))};}
function sanitizeBackup(candidate,defaults){
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))throw Error('The selected file is not an OPB backup.');
 if(candidate.state)candidate=candidate.state;
 const d=candidate.draft;
 if(!d||typeof d!=='object'||Array.isArray(d)||!Object.values(legacyKeys).some(k=>Object.hasOwn(d,k)))throw Error('The backup does not contain recognized OPB draft fields.');
 const clean=JSON.parse(JSON.stringify(defaults));
 for(const key of Object.values(legacyKeys)){if(d[key]!=null&&typeof d[key]!=='string')throw Error('Invalid text in backup field: '+key);clean.draft[key]=d[key]||'';}
 if(candidate.verbs!==undefined){if(!Array.isArray(candidate.verbs)||candidate.verbs.some(v=>!v||typeof v.verb!=='string'||(v.category!=null&&typeof v.category!=='string')))throw Error('Invalid action verb list.');clean.verbs=candidate.verbs.map(v=>({verb:v.verb.trim(),category:(v.category||'General').trim()||'General'})).filter(v=>v.verb);}
 if(candidate.acronyms!==undefined){if(!Array.isArray(candidate.acronyms)||candidate.acronyms.some(v=>typeof v!=='string'))throw Error('Invalid acronym review list.');clean.acronyms=[...new Set(candidate.acronyms.map(v=>v.trim().toUpperCase()).filter(Boolean))].sort();}
 clean.updatedAt=typeof candidate.updatedAt==='string'?candidate.updatedAt:'';
 if(candidate.reports!==undefined){
  if(!Array.isArray(candidate.reports)||!candidate.reports.length)throw Error('Invalid report list.');
  const ids=new Set();clean.reports=candidate.reports.map(r=>{if(!r||columns.some(k=>typeof r[k]!=='string')||!r.id||ids.has(r.id))throw Error('Invalid or duplicate report in backup.');ids.add(r.id);return Object.fromEntries(columns.map(k=>[k,r[k]]));});
  clean.activeReportId=clean.reports.some(r=>r.id===candidate.activeReportId)?candidate.activeReportId:clean.reports[0].id;
  const i=clean.reports.findIndex(r=>r.id===clean.activeReportId);clean.reports[i]=reportFromDraft(clean.draft,clean.reports[i]);
 }else{const r=reportFromDraft(clean.draft);clean.reports=[r];clean.activeReportId=r.id;}
 return clean;
}
function mergeVerbs(...lists){const seen=new Set();return lists.flat().filter(item=>{const k=JSON.stringify([item.verb.toLowerCase(),item.category.toLowerCase()]);if(seen.has(k))return false;seen.add(k);return true;});}
function advisory(text,key,verbs,acronyms){
 if(!text.trim())return ['Block is empty.'];
 if(/^THIS SECTION NOT USED[.,]?$/i.test(text.trim()))return ['Marked unused. Confirm this is appropriate under your applicable guidance.'];
 const out=[];
 if(!/[.!?]["')\]]?$/.test(text.trim()))out.push('Consider ending the statement with sentence punctuation.');
 if(key!=='duty_description'&&key!=='hlr_assessment'){
 const lower=text.trim().toLowerCase();if(!verbs.some(v=>lower===v.verb.toLowerCase()||lower.startsWith(v.verb.toLowerCase()+' ')))out.push('Review the action or behavior. Beginning with a listed verb is optional.');
 out.push('Confirm each statement connects an action to an impact, result, or outcome. This tool cannot judge that relationship.');
 }
 return out;
}
const api={fields,columns,blank,csvParse,serialize,importCSV,issues,legacyKeys,draftFromReport,reportFromDraft,sanitizeBackup,mergeVerbs,advisory};if(typeof module!=='undefined')module.exports=api;else root.OPB=api;
})(typeof window!=='undefined'?window:globalThis);
