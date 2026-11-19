export const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
export const fromKey=k=>new Date(k+"T12:00:00");
export const addDays=(k,n)=>{const d=fromKey(k);d.setDate(d.getDate()+n);return key(d)};
export function addMonth(k){const d=fromKey(k),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return key(d)}
export const monthStart=k=>k.slice(0,7)+"-01";
export const monthEnd=k=>{const d=fromKey(k);return key(new Date(d.getFullYear(),d.getMonth()+1,0))};
export const createId=()=>crypto.randomUUID();
export function initJournal(data){data.journal??={entries:[],rules:[]};return data.journal}
export function matches(rule,date){
  if(date<rule.start||(rule.end&&date>=rule.end))return false;
  const day=fromKey(date);
  return rule.repeat==="daily"||(rule.repeat==="weekly"&&rule.days.includes(day.getDay()))||(rule.repeat==="monthly"&&day.getDate()===rule.monthDay);
}
export function occurrence(rule,date){return {id:rule.id+"@"+date,date,type:"task",text:rule.text,category:rule.category,status:"pending",ruleId:rule.id,originDate:date}}
export function listEntries(journal,start,end){
  const found=new Map(journal.entries.filter(e=>e.date>=start&&e.date<=end).map(e=>[e.id,e]));
  for(const rule of journal.rules){
    let d=start>rule.start?start:rule.start;
    const last=rule.end&&rule.end<=end?addDays(rule.end,-1):end;
    for(;d<=last;d=addDays(d,1)){
      if(matches(rule,d)){const entry=occurrence(rule,d);if(!found.has(entry.id))found.set(entry.id,entry)}
    }
  }
  return [...found.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function findEntry(journal,id){
  const existing=journal.entries.find(e=>e.id===id);if(existing)return existing;
  const [ruleId,date]=id.split("@");const rule=journal.rules.find(r=>r.id===ruleId);
  return rule&&date&&matches(rule,date)?occurrence(rule,date):null;
}
export function putEntry(journal,entry){
  const index=journal.entries.findIndex(e=>e.id===entry.id);
  if(index<0)journal.entries.push({...entry});else journal.entries[index]={...entry};
}
export function moveEntry(journal,id,destination,kind="carried"){
  const entry=findEntry(journal,id);
  if(!entry||entry.type!=="task"||entry.status!=="pending"||destination<=entry.date)return null;
  const next={...entry,id:createId(),date:destination,status:"pending",ruleId:null,sourceId:entry.id,originDate:entry.originDate||entry.date};
  delete next.destination;delete next.movedTo;
  putEntry(journal,{...entry,status:kind,destination,movedTo:next.id});putEntry(journal,next);return next;
}
// Keep the old schedule available for historical occurrences. New schedules own new IDs.
export function reviseRule(journal,id,changes,effective){
  const old=journal.rules.find(r=>r.id===id);if(!old||old.end)return null;
  const boundary=effective>old.start?effective:old.start;old.end=boundary;
  if(!changes)return old;
  // A previously edited/completed future occurrence remains intact; suppress duplicates.
  const rule={...old,...changes,id:createId(),start:changes.start>boundary?changes.start:boundary,end:null};
  journal.rules.push(rule);
  for(const entry of journal.entries.filter(e=>e.ruleId===old.id&&e.date>=rule.start&&matches(rule,e.date))){
    putEntry(journal,{...occurrence(rule,entry.date),status:"skipped",replacedBy:entry.id});
  }
  return rule;
}
export function earliest(journal,fallback){return [...journal.entries.map(e=>e.date),...journal.rules.map(r=>r.start),fallback].sort()[0]}
export const symbols={pending:"・",done:"×",carried:"＞",scheduled:"＜",event:"○",note:"−",skipped:"／",removed:""};
export function recurrenceText(r){return r.repeat==="daily"?"毎日":r.repeat==="monthly"?"毎月 "+r.monthDay+"日":"毎週 "+r.days.map(d=>"日月火水木金土"[d]).join("・")}
