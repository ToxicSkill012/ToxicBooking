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

// ═══ Занятость прямо сейчас — на главной: счётчик и точки-ПК на карточках зон ═══
const TOTAL_PCS=Object.keys(ZONES).reduce((s,k)=>s+ZONES[k].pcCount,0)
let _liveKey=''
function renderLive(){
  const bookings=_bookingsCache.loaded?_bookingsCache.data:[]
  const en=D.lang==='en',fresh=gizmoFresh()
  const zones={}
  let total=0
  Object.keys(ZONES).forEach(k=>{
    zones[k]=zonePcs(k).sort().map(lbl=>{
      const st=pcLive(lbl,bookings)
      const L=liveLabel(st)
      return {lbl,s:st.state,t:`${lbl} · ${L.main}${st.state!=='free'&&L.sub?' · '+L.sub:''}`}
    })
    total+=zones[k].filter(p=>p.s!=='busy').length
  })
  const key=fresh+JSON.stringify(zones)
  if(key===_liveKey)return
  _liveKey=key
  const el=document.getElementById('free-count')
  if(el){
    el.textContent=total
    el.style.color=total<=3?'var(--red)':total<=8?'var(--gold)':'var(--lime)'
  }
  const pill=document.querySelector('.pill.live-shimmer')
  if(pill)pill.title=fresh?(en?'live from the club':'онлайн из клуба'):(en?'by bookings':'по броням')
  Object.keys(ZONES).forEach(k=>{
    const card=document.querySelector(`.ZC.${k}`);if(!card)return
    const free=zones[k].filter(p=>p.s!=='busy').length
    const t=card.querySelector('.Ztag')
    if(t){
      t.innerHTML=`<i class="zfree${free?'':' none'}"></i>${free}/${ZONES[k].pcCount}${k==='std'?(en?' free':' свободно'):''}`
      t.title=en?'free now':'свободно сейчас'
    }
    // Точки-ПК: зелёный — свободен, жёлтый — скоро бронь, красный — занят
    let dots=card.querySelector('.zdots')
    if(!dots){dots=document.createElement('div');dots.className='zdots';const p=card.querySelector('.Zp');card.insertBefore(dots,p||null)}
    dots.innerHTML=zones[k].map(p=>`<i class="zd ${p.s}" title="${p.t}"></i>`).join('')
    dots.setAttribute('aria-label',zones[k].map(p=>p.t).join('; '))
  })
}
