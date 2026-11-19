import {key,fromKey,addDays,monthStart,monthEnd,listEntries} from "./journal-model.js";

export function periodRange(date,mode){
  if(mode==="day")return [date,date];
  if(mode==="month")return [monthStart(date),monthEnd(date)];
  const d=fromKey(date),start=addDays(date,-((d.getDay()+6)%7));
  return [start,addDays(start,6)];
}
export function shiftPeriod(date,mode,n){
  if(mode==="day")return addDays(date,n);
  if(mode==="week")return addDays(date,7*n);
  const d=fromKey(monthStart(date));d.setMonth(d.getMonth()+n);return key(d);
}
export function diaryFor(data,date){return data.diaries?.[date]||{line:"",free:""}}
export function updateDiary(data,date,field,value){
  if(!["line","free","rating"].includes(field))return false;
  if(field==="rating"&&(!Number.isInteger(value)||value<0||value>5))return false;
  data.diaries??={};
  const diary={...diaryFor(data,date),[field]:value};
  if(diary.line||diary.free||diary.rating)data.diaries[date]=diary;else delete data.diaries[date];
  return true;
}
export function ratingSummary(data,start,end){
  let sum=0,count=0;
  for(let date=start;date<=end;date=addDays(date,1)){
    const value=diaryFor(data,date).rating;
    if(Number.isInteger(value)&&value>=1&&value<=5){sum+=value;count++}
  }
  return {count,average:count?sum/count:null};
}
export function recordSummary(data,start,end){
  const counts=[0,0,0,0],habits=data.habits.map(h=>({id:h.id,name:h.name,category:h.category,counts:[0,0,0,0]}));
  let diaryDays=0,recordDays=0;
  for(let date=start;date<=end;date=addDays(date,1)){
    const diary=diaryFor(data,date);if(diary.line.trim()||diary.free.trim())diaryDays++;
    let recorded=false;
    for(const h of habits){
      const n=data.records?.[date]?.[h.id];if(n>=1&&n<=3){h.counts[n]++;counts[n]++;recorded=true}
    }
    if(recorded)recordDays++;
  }
  return {counts,habits:habits.filter(h=>h.counts.slice(1).some(Boolean)),diaryDays,recordDays};
}
export function createDiaryUI({getData,getDate,main,esc,save,render,toast,modal,form}){
  let mode="week",anchor=key(new Date());
  const today=()=>key(new Date()), d=()=>getData(), symbols=["","✓","△","−"], names=["未記録","達成","部分達成","未達成"];
  const fmt=date=>fromKey(date).toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"});
  function editor(date,compact=false){
    const diary=diaryFor(d(),date);
    return '<section class="diary-section"><div class="row"><h2>日記</h2><span class="muted">'+fmt(date)+'</span></div><div class="card diary-card"><label for="diary-line">一言メモ</label><textarea rows="2" id="diary-line" data-diary-field="line" data-diary-date="'+date+'" placeholder="今日の出来事や気づきを一言…">'+esc(diary.line)+'</textarea><label>今日の充実度</label><div class="rating-options" role="group" aria-label="充実度 5段階">'+[1,2,3,4,5].map(n=>'<button type="button" class="rating-choice rating-'+n+(diary.rating===n?' chosen':'')+'" data-rating="'+n+'" data-rating-date="'+date+'" aria-pressed="'+(diary.rating===n)+'">'+n+'</button>').join("")+'</div><div class="row rating-labels"><span>低い</span><span>高い</span></div><details '+(!compact||diary.free?"open":"")+'><summary>自由記述</summary><textarea rows="5" data-diary-field="free" data-diary-date="'+date+'" aria-label="自由記述" placeholder="考えたこと、感じたことを自由に…">'+esc(diary.free)+'</textarea></details><div class="row diary-footer"><span class="muted" id="diary-save-status">入力内容は自動保存されます</span><button type="button" data-diary-save class="secondary">保存</button></div></div></section>';
  }
  function ratingCalendar(start,end){
    const stats=ratingSummary(d(),start,end);
    let cells="";const offset=(fromKey(start).getDay()+6)%7;
    for(let i=0;i<offset;i++)cells+='<span class="rating-empty"></span>';
    for(let date=start;date<=end;date=addDays(date,1)){
      const value=diaryFor(d(),date).rating||0;
      cells+='<button type="button" class="rating-day rating-'+value+(date===today()?' current':'')+'" data-review-day="'+date+'" aria-label="'+date+' 充実度 '+(value||"未記録")+'"><small>'+Number(date.slice(8))+'</small><span>'+ (value||"–")+'</span></button>';
    }
    return '<section class="card rating-calendar"><div class="row"><h2>充実度</h2><span class="muted">平均 '+(stats.average===null?'–':stats.average.toFixed(1)+'/5')+' · '+stats.count+'日</span></div><div class="rating-grid">'+["月","火","水","木","金","土","日"].map(w=>'<span class="rating-weekday">'+w+'</span>').join("")+cells+'</div><div class="rating-key"><span>低い</span>'+[1,2,3,4,5].map(n=>'<span class="rating-'+n+'">'+n+'</span>').join("")+'<span>高い</span><span class="muted">– 未記録</span></div></section>';
  }
  function habitChips(date){
    const data=d(), records=data.records[date]||{};
    const items=data.habits.filter(h=>records[h.id]);
    if(!items.length)return '<span class="muted">習慣の記録なし</span>';
    return '<div class="habit-chips">'+items.map(h=>'<span class="habit-chip s'+records[h.id]+'">'+symbols[records[h.id]]+' '+esc(h.name)+'</span>').join("")+'</div>';
  }
  function summary(start,end){
    const s=recordSummary(d(),start,end),total=s.counts.slice(1).reduce((a,b)=>a+b,0);
    return '<section class="card"><div class="row"><h2>期間の記録</h2><span class="muted">日記 '+s.diaryDays+' 日</span></div><div class="review-stats"><div><span class="s1">'+s.counts[1]+'</span><small>達成</small></div><div><span class="s2">'+s.counts[2]+'</span><small>部分達成</small></div><div><span class="s3">'+s.counts[3]+'</span><small>未達成</small></div></div>'+(total?'<div class="review-bar">'+[1,2,3].map(n=>'<span class="review-bar-'+n+'" style="width:'+(100*s.counts[n]/total)+'%"></span>').join("")+'</div>':'')+'<p class="muted">習慣を記録した日：'+s.recordDays+' 日。未記録は集計に含めません。</p></section>';
  }
  function habitOverview(start,end){
    const s=recordSummary(d(),start,end);
    if(!s.habits.length)return "";
    return '<h3>習慣ごとの記録回数</h3><div class="card">'+s.habits.map(h=>'<div class="habit"><div class="habit-info">'+esc(h.name)+'<div class="goal">'+esc(h.category)+'</div></div><div class="review-counts"><span class="s1">✓ '+h.counts[1]+'</span><span class="s2">△ '+h.counts[2]+'</span><span class="s3">− '+h.counts[3]+'</span></div></div>').join("")+'</div>';
  }
  function dateCard(date){
    const diary=diaryFor(d(),date),entries=listEntries(d().journal,date,date).filter(e=>e.type==="task"&&!["removed","skipped"].includes(e.status)&&!e.replacedBy);
    const has=diary.line.trim()||diary.free.trim()||diary.rating||Object.values(d().records[date]||{}).some(Boolean)||entries.some(e=>e.status==="done");
    if(!has)return "";
    const done=entries.filter(e=>e.status==="done").length;
    return '<article class="card review-day"><div class="row"><h3>'+fmt(date)+'</h3><button class="secondary" data-review-day="'+date+'">詳細</button></div>'+(diary.rating?'<span class="rating-badge rating-'+diary.rating+'">充実度 '+diary.rating+'/5</span>':"")+(diary.line?'<p class="diary-content">'+esc(diary.line)+'</p>':'<p class="muted">一言メモなし</p>')+(diary.free?'<details><summary>自由記述</summary><p class="diary-content">'+esc(diary.free)+'</p></details>':"")+habitChips(date)+(done?'<div class="muted">タスク完了 '+done+' 件</div>':"")+'</article>';
  }
  function renderPage(){
    const [start,end]=periodRange(anchor,mode);
    const tabs=[["day","日"],["week","週"],["month","月"]];
    let html='<div class="journal-tabs">'+tabs.map(([v,l])=>'<button data-review-mode="'+v+'" class="'+(mode===v?"selected":"")+'">'+l+'</button>').join("")+'</div><div class="row datebar"><button data-review-shift="-1" aria-label="前の期間">‹</button><strong>'+(mode==="day"?fmt(start):mode==="month"?start.slice(0,4)+'年 '+Number(start.slice(5,7))+'月':fmt(start)+' 〜 '+fmt(end))+'</strong><button data-review-shift="1" aria-label="次の期間">›</button></div><div class="row review-date"><input type="date" aria-label="振り返りの日付" id="review-date" value="'+anchor+'"><button data-review-today>今日</button></div>';
    if(mode==="day"){
      const entries=listEntries(d().journal,anchor,anchor).filter(e=>e.type==="task"&&e.status==="done");
      html+=editor(anchor)+summary(start,end)+'<h3>この日の習慣</h3><div class="card">'+habitChips(anchor)+'</div><h3>完了したタスク</h3><div class="card">'+(entries.length?entries.map(e=>'<div class="habit"><span class="s1">×</span><div class="habit-info">'+esc(e.text)+'</div></div>').join(""):'<p class="muted">完了したタスクはありません。</p>')+'</div>';
    }else{
      html+=ratingCalendar(start,end)+summary(start,end)+habitOverview(start,end)+'<h3>日ごとの振り返り</h3>';
      let cards="";for(let date=end;date>=start;date=addDays(date,-1)){if(date<=today())cards+=dateCard(date)}
      html+=cards||'<p class="empty">この期間の記録はまだありません。</p>';
    }
    main.innerHTML=html;
  }
  function handleClick(x){
    if("rating"in x){const date=x.ratingDate,n=Number(x.rating),current=diaryFor(d(),date).rating;updateDiary(d(),date,"rating",current===n?0:n);save();render();return true}
    if("reviewMode"in x){mode=x.reviewMode;render();return true}
    if("reviewShift"in x){anchor=shiftPeriod(anchor,mode,Number(x.reviewShift));render();return true}
    if("reviewToday"in x){anchor=today();render();return true}
    if("reviewDay"in x){anchor=x.reviewDay;mode="day";render();return true}
    if("diarySave"in x){save().then(()=>toast("日記を保存しました")).catch(()=>{});return true}
    return false;
  }
  document.addEventListener("input",e=>{const x=e.target.dataset;if(!x.diaryField)return;
    updateDiary(d(),x.diaryDate,x.diaryField,e.target.value);
    const status=document.querySelector("#diary-save-status");if(status)status.textContent="保存中…";
    save().then(()=>{if(status?.isConnected)status.textContent="保存済み"}).catch(()=>{if(status?.isConnected)status.textContent="保存できませんでした"});
  });
  document.addEventListener("change",e=>{if(e.target.id==="review-date"&&e.target.value){anchor=e.target.value;render()}});
  return {editor,renderPage,handleClick};
}
