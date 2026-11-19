import * as M from "./journal-model.js";
export function createJournalUI({getData,getDate,modal,form,main,esc,save,render,toast}){
  let view="day", month=M.monthStart(M.key(new Date())), query="", searchCategory="";
  const today=()=>M.key(new Date()), J=()=>M.initJournal(getData());
  const labels={pending:"未完了",done:"完了",carried:"繰り越し",scheduled:"将来へ移動",skipped:"スキップ",event:"イベント",note:"メモ"};
  const visible=e=>e.status!=="removed"&&!e.replacedBy;
  const status=e=>e.type==="task"?e.status:e.type;
  const fmt=d=>d.slice(5).replace("-","/");
  function row(e,showDate=false){
    const s=status(e), clickable=e.type==="task"&&["pending","done"].includes(s), tag=e.category?'<span class="bullet-tag">'+esc(e.category)+'</span>':"";
    return '<div class="bullet-row '+(s==="done"?"bullet-done":"")+'">'+(clickable?'<button type="button" class="bullet-symbol" data-j-toggle="'+esc(e.id)+'" aria-label="'+(s==="done"?"未完了に戻す":"完了する")+'">'+M.symbols[s]+'</button>':'<span class="bullet-symbol static" aria-label="'+labels[s]+'">'+M.symbols[s]+'</span>')+'<div class="bullet-text"><div>'+esc(e.text)+'</div><div class="bullet-meta">'+(showDate?fmt(e.date)+" · ":"")+tag+(e.ruleId?' <span>↻ 繰り返し</span>':"")+(e.sourceId?' <span>繰越元 '+fmt(e.originDate)+'</span>':"")+(e.destination?' <span>'+fmt(e.destination)+' へ'+labels[s]+'</span>':s==="skipped"?'<span>スキップ</span>':"")+'</div></div><button type="button" class="bullet-more" data-j-edit="'+esc(e.id)+'" aria-label="記録の詳細">•••</button></div>';
  }
  function rows(entries,showDate=false,empty="記録はまだありません。"){return entries.filter(visible).length?entries.filter(visible).map(e=>row(e,showDate)).join(""):'<p class="empty">'+empty+'</p>'}
  function quick(date){return '<form class="quick-bullet" data-j-quick="'+date+'"><input name="text" placeholder="タスクを追加…" aria-label="新しいタスク" required autocomplete="off"><button class="primary" type="submit">追加</button></form>'}
  function daily(date,compact=false){const entries=M.listEntries(J(),date,date);return '<section class="journal-section"><div class="row"><h2>バレットジャーナル</h2><button data-j-add="'+date+'">＋ 記録</button></div><div class="card bullet-card">'+quick(date)+rows(entries)+'</div>'+(compact?'<button class="text-link" data-j-view="day">すべてのログを表示</button>':"")+'</section>'}
  function searchResults(){
    const term=query.toLocaleLowerCase().trim(),j=J(),end=month>M.monthStart(today())?M.monthEnd(month):today();
    if(!term&&!searchCategory)return '<p class="empty">検索する言葉またはカテゴリーを指定してください。</p>';
    const items=M.listEntries(j,M.earliest(j,end),end).filter(e=>visible(e)&&(!term||(e.text+" "+e.category).toLocaleLowerCase().includes(term))&&(!searchCategory||e.category===searchCategory));
    // Explicitly registered future items are also searchable.
    for(const e of j.entries.filter(e=>e.date>end&&visible(e)&&(!term||(e.text+" "+e.category).toLocaleLowerCase().includes(term))&&(!searchCategory||e.category===searchCategory)))items.push(e);
    return rows(items.sort((a,b)=>b.date.localeCompare(a.date)),true,"該当する記録はありません。");
  }
  function recurringList(){const j=J(),active=j.rules.filter(r=>!r.end),past=j.rules.filter(r=>r.end);const ruleRow=(r,ended)=>'<div class="bullet-row"><span class="bullet-symbol static">↻</span><div class="bullet-text">'+esc(r.text)+'<div class="bullet-meta">'+esc(r.category||"未分類")+' · '+M.recurrenceText(r)+' · '+r.start+' 開始'+(ended?' · '+r.end+' 終了':'')+'</div></div>'+(!ended?'<button data-j-rule="'+esc(r.id)+'">編集</button>':'<span class="muted">停止済</span>')+'</div>';return '<div class="row"><h2>繰り返しタスク</h2><button class="primary" data-j-new-rule>＋ 追加</button></div><div class="card">'+(active.length?active.map(r=>ruleRow(r,false)).join(""):'<p class="empty">繰り返しタスクはありません。</p>')+'</div>'+(past.length?'<h3>過去の設定</h3><div class="card">'+past.map(r=>ruleRow(r,true)).join("")+'</div>':"")}
  function renderPage(){
    const d=getDate(),j=J();
    const tabs=[["day","日間ログ"],["month","月間ToDo"],["repeat","繰り返し"],["search","検索"]];
    let html='<div class="journal-tabs">'+tabs.map(([v,l])=>'<button data-j-view="'+v+'" class="'+(view===v?"selected":"")+'">'+l+'</button>').join("")+'</div>';
    if(view==="day"){
      const backlog=M.listEntries(j,M.earliest(j,d),M.addDays(d,-1)).filter(e=>e.type==="task"&&e.status==="pending");
      html+='<div class="row datebar"><button data-shift="-1" aria-label="前日">‹</button><strong>'+M.fromKey(d).toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"})+'</strong><button data-shift="1" aria-label="翌日">›</button></div>'+(d!==today()?'<button data-today class="secondary">今日に戻る</button>':'')+daily(d)+(backlog.length?'<h3>以前の未完了 '+backlog.length+' 件</h3><div class="card">'+rows(backlog,true)+'</div>':"");
    }else if(view==="month"){
      const entries=M.listEntries(j,month,M.monthEnd(month)).filter(e=>e.type==="task"&&visible(e));
      const prev=entries.filter(e=>e.status==="pending").length;
      html+='<div class="row datebar"><button data-j-month="-1" aria-label="前月">‹</button><strong>'+month.slice(0,4)+'年 '+Number(month.slice(5,7))+'月</strong><button data-j-month="1" aria-label="翌月">›</button></div><div class="row"><h2>月間ToDo</h2><button data-j-add="'+(month===M.monthStart(d)?d:month)+'">＋ 追加</button></div><p class="muted">未完了 '+prev+' 件 · 完了 '+entries.filter(e=>e.status==="done").length+' 件</p><div class="card">'+rows(entries,true)+'</div>';
    }else if(view==="repeat")html+=recurringList();
    else{
      const cats=[...new Set([...j.entries.map(e=>e.category),...j.rules.map(r=>r.category)].filter(Boolean))];
      html+='<div class="card"><label for="journal-search">過去の記録を検索</label><input id="journal-search" type="search" value="'+esc(query)+'" placeholder="タスク・イベント・メモ"><label for="journal-category">カテゴリー</label><select id="journal-category"><option value="">すべて</option>'+cats.map(c=>'<option value="'+esc(c)+'" '+(searchCategory===c?"selected":"")+'>'+esc(c)+'</option>').join("")+'</select></div><div class="card" id="journal-results">'+searchResults()+'</div>';
    }
    main.innerHTML=html;
  }
  function commit(){save();if(modal.open)modal.close();render()}
  function options(value,items){return items.map(([v,l])=>'<option value="'+esc(v)+'" '+(value===v?"selected":"")+'>'+esc(l)+'</option>').join("")}
  function recurrenceFields(v){return '<div id="repeat-fields"><label>繰り返し</label><select name="repeat">'+options(v.repeat||"none",[["none","なし"],["daily","毎日"],["weekly","毎週（曜日指定）"],["monthly","毎月（指定日）"]])+'</select><fieldset id="repeat-days"><label>曜日（複数選択可）</label><div class="weekdays">'+[0,1,2,3,4,5,6].map(d=>'<label><input type="checkbox" name="repeatDays" value="'+d+'" '+((v.days||[]).includes(d)?"checked":"")+'>'+ "日月火水木金土"[d]+'</label>').join("")+'</div></fieldset><fieldset id="repeat-month"><label>毎月の日付</label><input type="number" name="monthDay" min="1" max="31" value="'+(v.monthDay||1)+'"><p class="muted">指定日がない月はスキップします。</p></fieldset></div>'}
  function editForm(entry,date,rule=null){
    const v=rule||entry||{type:"task",text:"",category:"",date,repeat:"none",days:[M.fromKey(date).getDay()],monthDay:M.fromKey(date).getDate()};
    const isRule=!!rule,existing=!!entry,allowRepeat=isRule||!existing,initialDate=isRule?(rule.start>today()?rule.start:today()):v.date||date;
    const isClosed=existing&&["carried","scheduled","skipped","removed"].includes(entry.status);
    const categories=[...new Set(["研究","勉強","私生活",...J().entries.map(e=>e.category),...J().rules.map(r=>r.category)].filter(Boolean))];
    form.innerHTML='<h2>'+(isRule?"繰り返し設定":existing?"記録の詳細":"記録を追加")+'</h2>'+(isClosed?'<p class="muted">'+labels[entry.status]+' · '+entry.date+(entry.destination?' → '+entry.destination:"")+'</p>':"")+'<label for="bullet-text">内容</label><textarea required id="bullet-text" name="text" rows="3">'+esc(v.text)+'</textarea><label>種類</label><select name="type" '+(isRule||existing?"disabled":"")+'>'+options(v.type||"task",[["task","・ タスク"],["event","○ イベント"],["note","− メモ"]])+'</select><label>カテゴリー（自由入力）</label><input name="category" list="bullet-categories" value="'+esc(v.category)+'" placeholder="例：研究"><datalist id="bullet-categories">'+categories.map(c=>'<option value="'+esc(c)+'"></option>').join("")+'</datalist><label>'+(isRule?"変更適用日":"日付")+'</label><input required type="date" name="date" value="'+initialDate+'" '+(existing?"disabled":"")+(isRule?' min="'+today()+'"':"")+'>'+ (allowRepeat?recurrenceFields(v):"")+(existing&&entry.type==="task"&&entry.status==="pending"?'<h3>繰り越し・移動</h3><div class="move-actions"><button type="button" data-j-move="'+esc(entry.id)+'" data-j-destination="'+M.addDays(entry.date,1)+'">翌日</button><button type="button" data-j-move="'+esc(entry.id)+'" data-j-destination="'+M.addDays(entry.date,7)+'">翌週</button><button type="button" data-j-move="'+esc(entry.id)+'" data-j-destination="'+M.addMonth(entry.date)+'">翌月</button></div><label>将来の日付に移動</label><div class="row"><input type="date" name="moveDate" min="'+M.addDays(entry.date,1)+'" value="'+M.addDays(entry.date,1)+'"><button type="button" data-j-schedule="'+esc(entry.id)+'">移動</button></div>':"")+'<div class="actions"><button type="button" data-cancel>閉じる</button><button class="primary" type="submit">保存</button></div>'+(isRule?'<button type="button" class="danger" data-j-stop="'+esc(rule.id)+'">繰り返しを停止</button>':existing?(entry.ruleId&&entry.status==="pending"?'<button type="button" data-j-skip="'+esc(entry.id)+'">今回のみスキップ</button>':entry.status==="skipped"?'<button type="button" data-j-unskip="'+esc(entry.id)+'">スキップを解除</button>':"")+(!isClosed&&!entry.ruleId?'<button type="button" class="danger" data-j-remove="'+esc(entry.id)+'">記録を削除</button>':""):"");
    const els=form.elements;
    if(allowRepeat){const refresh=()=>{const repeat=els.repeat.value;document.querySelector("#repeat-fields").classList.toggle("hidden",els.type.value!=="task");document.querySelector("#repeat-days").classList.toggle("hidden",repeat!=="weekly");document.querySelector("#repeat-month").classList.toggle("hidden",repeat!=="monthly")};els.repeat.onchange=refresh;els.type.onchange=refresh;refresh()}
    form.onsubmit=e=>{
      e.preventDefault();const text=els.text.value.trim(),category=els.category.value.trim(),type=els.type.value,date=els.date.value;
      if(!text||!date){toast("内容と日付を入力してください");return}
      if(existing){M.putEntry(J(),{...entry,text,category});commit();return}
      const repeat=type==="task"?els.repeat.value:"none",days=[...form.querySelectorAll("[name=repeatDays]:checked")].map(x=>Number(x.value)),monthDay=Number(els.monthDay?.value||1);
      if(repeat==="weekly"&&!days.length){toast("曜日を選択してください");return}
      if(isRule){M.reviseRule(J(),rule.id,repeat==="none"?null:{text,category,repeat,days,monthDay,start:date},date);commit();return}
      if(repeat!=="none")J().rules.push({id:M.createId(),text,category,repeat,days,monthDay,start:date,end:null});
      else M.putEntry(J(),{id:M.createId(),date,type,text,category,status:type==="task"?"pending":type});
      commit();
    };
    if(!modal.open)modal.showModal();
  }
  function handleClick(x){
    if("jView"in x){view=x.jView;return "navigate"}
    if("jMonth"in x){const d=M.fromKey(month);d.setMonth(d.getMonth()+Number(x.jMonth));month=M.monthStart(M.key(d));render();return true}
    if("jAdd"in x){editForm(null,x.jAdd);return true}
    if("jNewRule"in x){editForm(null,today());form.elements.repeat.value="weekly";form.elements.repeat.onchange();return true}
    if("jRule"in x){const rule=J().rules.find(r=>r.id===x.jRule);if(rule)editForm(null,today(),rule);return true}
    if("jEdit"in x){const entry=M.findEntry(J(),x.jEdit);if(entry)editForm(entry,entry.date);return true}
    if("jToggle"in x){const entry=M.findEntry(J(),x.jToggle);if(entry&&["pending","done"].includes(entry.status)){M.putEntry(J(),{...entry,status:entry.status==="pending"?"done":"pending"});save();render()}return true}
    if("jMove"in x||"jSchedule"in x){const id=x.jMove||x.jSchedule,destination=x.jDestination||form.elements.moveDate.value;if(!M.moveEntry(J(),id,destination,x.jSchedule?"scheduled":"carried")){toast("元の日付より後の日を指定してください");return true}commit();toast("移動しました");return true}
    if("jStop"in x){if(confirm("繰り返しを停止しますか？過去の記録は残ります。")){M.reviseRule(J(),x.jStop,null,M.addDays(today(),1));commit()}return true}
    if("jSkip"in x||"jUnskip"in x||"jRemove"in x){const entry=M.findEntry(J(),x.jSkip||x.jUnskip||x.jRemove);if(!entry)return true;if(x.jRemove&&!confirm("この記録を削除しますか？"))return true;M.putEntry(J(),{...entry,status:x.jSkip?"skipped":x.jUnskip?"pending":"removed"});commit();return true}
    return false;
  }
  document.addEventListener("submit",e=>{const f=e.target;if(!f.matches("[data-j-quick]"))return;e.preventDefault();const text=f.elements.text.value.trim();if(text){M.putEntry(J(),{id:M.createId(),date:f.dataset.jQuick,type:"task",text,category:"",status:"pending"});save();render()}});
  document.addEventListener("input",e=>{if(e.target.id==="journal-search"){query=e.target.value;document.querySelector("#journal-results").innerHTML=searchResults()}});
  document.addEventListener("change",e=>{if(e.target.id==="journal-category"){searchCategory=e.target.value;document.querySelector("#journal-results").innerHTML=searchResults()}});
  return {daily,renderPage,handleClick};
}
