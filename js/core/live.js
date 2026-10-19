// Онлайн-статус, Gizmo и «Зал сейчас»

// ═══ OFFLINE DETECTOR ═══
let _wasOffline=false
function checkOnline(){
  const bar=document.getElementById('offline-bar')
  if(!bar)return
  if(!navigator.onLine){
    bar.classList.add('show');_wasOffline=true
  }else{
    bar.classList.remove('show')
    if(_wasOffline){_wasOffline=false;toast('Соединение восстановлено','✅')}
  }
}

// ═══ СТАТУС ЗАНЯТОСТИ ПК ═══
// Gizmo показывает живые сессии (и сколько осталось), брони — будущее.
let _gizmoCache={hosts:[],ts:0,source:'none',updatedAt:0}
const GIZMO_STALE_MS=5*60000 // мост молчит дольше — данным Gizmo не верим

async function loadGizmoStatus(){
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'getGizmoStatus',_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok&&d.hosts&&d.hosts.length>0){
      const upd=d.updatedAt?new Date(d.updatedAt).getTime():NaN
      _gizmoCache={hosts:d.hosts,ts:Date.now(),source:d.source||'gizmo',updatedAt:isNaN(upd)?Date.now():upd}
      renderLive()
      return d
    }
  }catch(e){}
  return null
}

function gizmoFresh(){
  return _gizmoCache.hosts.length>0&&Date.now()-_gizmoCache.ts<180000&&Date.now()-_gizmoCache.updatedAt<GIZMO_STALE_MS
}
function gizmoHost(pcLabel){
  if(!gizmoFresh())return null
  return _gizmoCache.hosts.find(x=>x.pc===pcLabel)||null
}
// Проверить занятость ПК через Gizmo данные (null — данных нет)
function isGizmoBusy(pcLabel){
  const h=gizmoHost(pcLabel)
  return h?!!h.busy:null
}
// Сколько минут осталось у живой сессии Gizmo (null — мост не прислал)
function gizmoLeftMin(pcLabel){
  const h=gizmoHost(pcLabel);if(!h||!h.busy)return null
  if(h.left!==null&&h.left!==undefined&&h.left!==''&&!isNaN(+h.left)){
    return Math.max(0,Math.round(+h.left-(Date.now()-_gizmoCache.ts)/60000))
  }
  if(h.until){const t=new Date(h.until).getTime();if(!isNaN(t))return Math.max(0,Math.ceil((t-Date.now())/60000))}
  return null
}

// Брони ПК как отрезки [начало, конец) в абсолютных минутах
function pcRanges(pcLabel,bookings){
  return (bookings||[])
    .filter(b=>b.pc===pcLabel&&b.status!=='cancelled'&&b.status!=='completed')
    .map(b=>bookingAbsRange(b.date,b.start,b.end)).filter(Boolean)
    .sort((a,b)=>a[0]-b[0])
}
// Занятые отрезки для выбора времени: брони + идущая сессия в клубе
const GIZMO_UNKNOWN_BUSY_MIN=60
function pcBusyRanges(pcLabel,bookings){
  const out=pcRanges(pcLabel,bookings)
  const h=gizmoHost(pcLabel)
  if(h&&h.busy){
    const now=clubNow().abs,left=gizmoLeftMin(pcLabel)
    // Остаток неизвестен: если сейчас идёт бронь на этот ПК — сессия по ней (как на сервере)
    const cur=out.find(r=>r[0]<=now&&now<r[1])
    const end=left!==null?now+left:cur?cur[1]:now+GIZMO_UNKNOWN_BUSY_MIN
    if(!cur||end>cur[1])out.push([now-1,end])
    out.sort((a,b)=>a[0]-b[0])
  }
  return out
}
// Склеить пересекающиеся и стыкующиеся отрезки — для показа клиенту
function mergeRanges(ranges){
  const out=[]
  for(const r of [...ranges].sort((a,b)=>a[0]-b[0])){
    const last=out[out.length-1]
    if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1])
    else out.push([r[0],r[1]])
  }
  return out
}
// Конец занятости, если брони идут встык
function chainEnd(ranges,t){
  let end=t,changed=true
  while(changed){changed=false;for(const r of ranges){if(r[0]<=end&&end<r[1]){end=r[1];changed=true}}}
  return end
}

// Живой статус ПК: busy (до скольки) / soon (скоро бронь) / free
function pcLive(pcLabel,bookings){
  const now=clubNow().abs
  const ranges=pcRanges(pcLabel,bookings)
  const g=gizmoHost(pcLabel)
  let until=null,source=''
  if(g&&g.busy){const left=gizmoLeftMin(pcLabel);until=left!==null?now+left:null;source='gizmo'}
  const cur=ranges.find(r=>r[0]<=now&&now<r[1])
  if(cur){until=Math.max(until||0,cur[1]);source=source||'booking'}
  if(source){
    if(until!==null)until=chainEnd(ranges,until)
    return {state:'busy',untilAbs:until,leftMin:until!==null?until-now:null,source}
  }
  const next=ranges.find(r=>r[0]>now)
  if(next&&next[0]-now<=60)return {state:'soon',nextAbs:next[0],inMin:next[0]-now}
  return {state:'free',nextAbs:next?next[0]:null}
}

// Подпись статуса для плиток и карточек
function liveLabel(st){
  const en=D.lang==='en'
  if(st.state==='busy'){
    const who=st.source==='gizmo'?(en?'In use':'Занят'):(en?'Booked':'Бронь')
    if(st.untilAbs===null)return {main:who,sub:en?'now':'сейчас',cls:'busy'}
    return {main:(en?'till ':'до ')+fmtAbs(st.untilAbs),sub:(en?'':'ещё ')+fmtDur(st.leftMin),cls:'busy',who}
  }
  if(st.state==='soon')return {main:(en?'free till ':'свободен до ')+minToHM(st.nextAbs),sub:(en?'booking in ':'бронь через ')+fmtDur(st.inMin),cls:'soon'}
  return {main:en?'free':'свободен',sub:st.nextAbs?((en?'till ':'до ')+fmtAbs(st.nextAbs)):(en?'all day':'весь день'),cls:'free'}
}

// ═══ «ЗАЛ СЕЙЧАС» — живое табло на главной ═══
const HALL=[
  {key:'std',pre:'ST',name:'STANDARD',nums:[1,2,3,4,5,6,7,8,9,10,11,13,15]},
  {key:'vip',pre:'VIP',name:'VIP',nums:[1,2,3]},
  {key:'bc',pre:'BC',name:'BOOTCAMP',nums:[1,2,3,4,5]},
]
const TOTAL_PCS=HALL.reduce((s,z)=>s+z.nums.length,0)

let _hallHtml=''
function renderLive(){
  const bookings=_bookingsCache.loaded?_bookingsCache.data:[]
  let busy=0
  const rows=HALL.map(z=>{
    const cells=z.nums.map(n=>{
      const lbl=z.pre+'-'+String(n).padStart(2,'0')
      const st=pcLive(lbl,bookings)
      if(st.state==='busy')busy++
      const t=st.state==='busy'&&st.leftMin!==null?fmtLeftShort(st.leftMin):st.state==='soon'?minToHM(st.nextAbs):''
      const title=lbl+' · '+liveLabel(st).main+(st.state==='busy'&&st.leftMin!==null?' ('+fmtDur(st.leftMin)+')':'')
      return `<button class="hc ${st.state}" title="${title}" aria-label="${title}" onclick="openZone('${z.key}')"><b>${String(n).padStart(2,'0')}</b>${t?`<i>${t}</i>`:''}</button>`
    }).join('')
    return `<div class="hz hz-${z.key}"><div class="hz-n">${z.name}</div><div class="hz-c">${cells}</div></div>`
  }).join('')
  const free=Math.max(0,TOTAL_PCS-busy)
  const el=document.getElementById('free-count')
  if(el){
    el.textContent=free
    el.style.color=free<=3?'var(--red)':free<=8?'var(--gold)':'var(--lime)'
  }
  const body=document.getElementById('hall-body')
  // Перерисовываем табло, только если что-то поменялось
  if(body&&(_hallHtml!==rows||!body.firstChild)){body.innerHTML=rows;_hallHtml=rows}
  const upd=document.getElementById('hall-upd')
  if(upd){
    const fresh=gizmoFresh()
    upd.textContent=fresh?((D.lang==='en'?'live · ':'онлайн · ')+minToHM(clubNow().min)):(D.lang==='en'?'by bookings':'по броням')
    upd.classList.toggle('on',fresh)
  }
}
