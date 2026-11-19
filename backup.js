const FORMAT="my-todo-backup", BACKUP_VERSION=1, DATA_VERSION=5;
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const str=x=>typeof x==="string";
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const date=x=>str(x)&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const ident=x=>str(x)&&/^[A-Za-z0-9_-]+(?:@\d{4}-\d{2}-\d{2})?$/.test(x)&&!["__proto__","constructor","prototype"].includes(x);
const days=x=>Array.isArray(x)&&x.every(n=>integer(n,0,6))&&new Set(x).size===x.length;
const fail=msg=>{throw new Error(msg)};
function safeKeys(x){
  if(x&&typeof x==="object")for(const k of Object.keys(x)){
    if(["__proto__","constructor","prototype"].includes(k))fail("不正なデータ項目があります。");
    safeKeys(x[k]);
  }
}
function uniqueIds(items){return items.every(x=>object(x)&&ident(x.id))&&new Set(items.map(x=>x.id)).size===items.length}
export function validateData(d){
  if(!object(d)||d.version!==DATA_VERSION)fail("対応していないデータバージョンです。");
  safeKeys(d);
  if(!["dark","light","system"].includes(d.theme))fail("テーマ設定が不正です。");
  if(!Array.isArray(d.categories)||!d.categories.length||!d.categories.every(c=>str(c)&&c.trim())||new Set(d.categories).size!==d.categories.length)fail("タグ設定が不正です。");
  if(!Array.isArray(d.habits)||!uniqueIds(d.habits))fail("習慣データが不正です。");
  for(const h of d.habits){
    if(!str(h.name)||!str(h.goal)||!str(h.sub)||!d.categories.includes(h.category)||!date(h.started)||(h.ended!==null&&!date(h.ended))||!["daily","days","weekly"].includes(h.frequency)||!days(h.days)||!integer(h.count,1,7)||(h.frequency==="days"&&!h.days.length))fail("習慣の設定が不正です。");
  }
  const habitIds=new Set(d.habits.map(h=>h.id));
  if(!object(d.records))fail("習慣の記録が不正です。");
  for(const [k,r] of Object.entries(d.records)){
    if(!date(k)||!object(r)||!Object.entries(r).every(([id,n])=>habitIds.has(id)&&integer(n,1,3)))fail("習慣の達成記録が不正です。");
  }
  if(!object(d.diaries))fail("日記データが不正です。");
  for(const [k,r] of Object.entries(d.diaries)){
    if(!date(k)||!object(r)||!str(r.line)||!str(r.free)||(r.rating!==undefined&&!integer(r.rating,0,5)))fail("日記の記録が不正です。");
  }
  const j=d.journal;
  if(!object(j)||!Array.isArray(j.entries)||!Array.isArray(j.rules)||!uniqueIds(j.entries)||!uniqueIds(j.rules))fail("ジャーナルのデータが不正です。");
  const ruleIds=new Set(j.rules.map(r=>r.id));
  for(const r of j.rules){
    if(!str(r.text)||!str(r.category)||!date(r.start)||(r.end!==null&&(!date(r.end)||r.end<r.start))||!["daily","weekly","monthly"].includes(r.repeat)||!days(r.days)||!integer(r.monthDay,1,31)||(r.repeat==="weekly"&&!r.days.length))fail("繰り返し設定が不正です。");
  }
  for(const e of j.entries){
    if(!date(e.date)||!str(e.text)||!str(e.category)||!["task","event","note"].includes(e.type)||!(e.type==="task"?["pending","done","carried","scheduled","skipped","removed"].includes(e.status):[e.type,"removed"].includes(e.status)))fail("タスクの記録が不正です。");
    if(e.ruleId!=null&&!ruleIds.has(e.ruleId))fail("繰り返し記録の関連付けが不正です。");
    for(const field of ["sourceId","movedTo","replacedBy"])if(e[field]!=null&&!ident(e[field]))fail("繰り越し記録が不正です。");
    for(const field of ["originDate","destination"])if(e[field]!=null&&!date(e[field]))fail("繰り越し日付が不正です。");
  }
  return structuredClone(d);
}
export function makeBackup(data){return {format:FORMAT,backupVersion:BACKUP_VERSION,exportedAt:new Date().toISOString(),data:validateData(data)}}
export function parseBackup(text){
  let raw;try{raw=JSON.parse(text)}catch{fail("JSONファイルを読み込めませんでした。")}
  if(!object(raw)||raw.format!==FORMAT||raw.backupVersion!==BACKUP_VERSION)fail("My Todoの対応するバックアップファイルではありません。");
  return {exportedAt:raw.exportedAt,data:validateData(raw.data)};
}
export function backupCounts(d){return {habits:d.habits.length,records:Object.values(d.records).reduce((n,r)=>n+Object.keys(r).length,0),entries:d.journal.entries.length,rules:d.journal.rules.length,diaries:Object.keys(d.diaries).length}}
export function downloadBackup(data){
  const json=JSON.stringify(makeBackup(data),null,2),url=URL.createObjectURL(new Blob([json],{type:"application/json"})),a=document.createElement("a");
  a.href=url;a.download="my-todo-backup-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function createBackupUI({getData,replaceData,readUndo,form,modal,render,toast,esc}){
  let pending=null, busy=false, selection=0;
  function show(){
    pending=null;selection++;
    form.innerHTML='<h2>バックアップ・復元</h2><p class="muted">習慣・達成履歴・タスク・繰り返し・日記・設定をまとめて保存します。</p><div class="backup-block"><h3>バックアップ</h3><p>JSONファイルをダウンロードし、iCloud Driveなど安全な場所に保管してください。ファイルには個人的な記録が含まれます。</p><button type="button" class="primary backup-wide" data-backup-export>バックアップを保存</button></div><div class="backup-block"><h3>復元</h3><p>バックアップファイルを選択し、内容を確認した後に復元できます。</p><input type="file" id="backup-file" accept=".json,application/json" aria-label="バックアップファイルを選択"><div id="backup-preview"></div></div><div class="backup-block"><h3>直前の復元を取り消す</h3><p>復元前のデータがこの端末に残っている場合は戻せます。</p><button type="button" data-backup-undo>復元前に戻す</button></div><div class="actions"><button type="button" data-cancel>閉じる</button></div>';
    form.onsubmit=e=>e.preventDefault();if(!modal.open)modal.showModal();
  }
  function preview(data,heading){
    const c=backupCounts(data);return '<div class="backup-preview"><h3>'+esc(heading)+'</h3><ul><li>習慣 '+c.habits+' 件・達成記録 '+c.records+' 件</li><li>タスク等 '+c.entries+' 件・繰り返し '+c.rules+' 件</li><li>日記・充実度 '+c.diaries+' 日</li></ul><p class="danger">現在のデータを置き換えます。復元前のデータは端末に一時保存します。</p><button type="button" class="primary backup-wide" data-backup-apply>このデータを復元</button></div>';
  }
  document.addEventListener("change",async e=>{
    if(e.target.id!=="backup-file")return;const file=e.target.files?.[0],panel=document.querySelector("#backup-preview"),request=++selection;pending=null;panel.innerHTML="";
    if(!file){panel.innerHTML="";return}
    try{if(file.size>50*1024*1024)fail("ファイルが大きすぎます（50MBまで）。");const parsed=parseBackup(await file.text());if(!panel.isConnected||request!==selection)return;pending=parsed.data;panel.innerHTML=preview(pending,file.name)}
    catch(error){if(panel.isConnected&&request===selection)panel.innerHTML='<p class="danger">'+esc(error.message)+'</p>'}
  });
  function handleClick(x){
    if("backupOpen"in x){show();return true}
    if("backupExport"in x){try{downloadBackup(getData());toast("バックアップを作成しました")}catch(e){toast(e.message)}return true}
    if("backupUndo"in x){const request=++selection;pending=null;const panel=document.querySelector("#backup-preview");if(panel)panel.innerHTML="";(async()=>{try{const old=await readUndo();if(request!==selection||!panel?.isConnected)return;if(!old){toast("復元前のデータはありません");return}pending=validateData(old);panel.innerHTML=preview(pending,"復元前のデータ")}catch(e){toast(e.message)}})();return true}
    if("backupApply"in x){if(!pending||busy)return true;if(!confirm("現在の記録を置き換えて復元しますか？"))return true;busy=true;const replacement=pending;Promise.resolve(replaceData(replacement)).then(()=>{pending=null;modal.close();render();toast("復元しました")}).catch(()=>toast("復元に失敗しました。元のデータは保持されています。")).finally(()=>busy=false);return true}
    return false;
  }
  return {handleClick};
}
