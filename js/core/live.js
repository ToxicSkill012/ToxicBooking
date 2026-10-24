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
// От сессий в зале зависит бронь: ПК можно занять только после того, как за ним доиграют.
// Сервер v7.4 присылает готовый список занятых ПК (live): сколько осталось — из Gizmo или указал админ —
// и с каких пор играют. Старый сервер — только сырые данные Gizmo (hosts), свежесть тогда проверяем сами.
// ts — когда загрузили (часы телефона), updatedAt — когда мост прислал данные (часы сервера)
let _gizmoCache={hosts:[],live:null,ts:0,source:'none',updatedAt:0,bridge:false}
const GIZMO_STALE_MS=5*60000 // мост молчит дольше — данным Gizmo не верим
const LIVE_TTL_MS=180000      // данные о зале старше 3 минут — устарели, перезагружаем

async function loadGizmoStatus(){
  try{
    const t0=Date.now()
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'getGizmoStatus',_t:t0}),{cache:'no-store'})
    const d=await r.json()
    syncClock(d.now,t0)
    if(d.ok&&Array.isArray(d.live)){
      const upd=d.updatedAt?new Date(d.updatedAt).getTime():NaN
      _gizmoCache={hosts:d.hosts||[],live:d.live,ts:Date.now(),source:d.source||'gizmo',updatedAt:isNaN(upd)?0:upd,bridge:!!d.bridge}
      renderLive()
      return d
    }
    if(d.ok&&d.hosts&&d.hosts.length>0){
      const upd=d.updatedAt?new Date(d.updatedAt).getTime():NaN
      _gizmoCache={hosts:d.hosts,live:null,ts:Date.now(),source:d.source||'gizmo',updatedAt:isNaN(upd)?srvNow():upd,bridge:true}
      renderLive()
      return d
    }
  }catch(e){}
  return null
}

// Есть свежие данные о зале (сессии из Gizmo или время от админа)
function liveKnown(){
  if(_gizmoCache.live)return Date.now()-_gizmoCache.ts<LIVE_TTL_MS
  return gizmoFresh()
}
// Мост Gizmo на связи — «онлайн из клуба»
function gizmoFresh(){
  if(Date.now()-_gizmoCache.ts>=LIVE_TTL_MS)return false
  if(_gizmoCache.live)return _gizmoCache.bridge
  return _gizmoCache.hosts.length>0&&srvNow()-_gizmoCache.updatedAt<GIZMO_STALE_MS
}
// Сессия на ПК по данным сервера: {busy, left, src, since} или null (нет данных / свободен)
function gizmoHost(pcLabel){
  if(_gizmoCache.live){
    if(!liveKnown())return null
    const s=_gizmoCache.live.find(x=>x.pc===pcLabel)
    return s?{pc:s.pc,busy:true,left:s.left,until:s.until||'',src:s.src||'gizmo',since:s.since||''}:null
  }
  if(!gizmoFresh())return null
  return _gizmoCache.hosts.find(x=>x.pc===pcLabel)||null
}
// Занят ли ПК прямо сейчас по данным зала (null — данных нет)
function isGizmoBusy(pcLabel){
  const h=gizmoHost(pcLabel)
  return h?!!h.busy:null
}
// Конец сессии в минутах клуба из точного времени окончания — так же, как считает сервер
function gizmoEndAbs(pcLabel){
  const h=gizmoHost(pcLabel);if(!h||!h.busy||!h.until)return null
  const t=Date.parse(h.until);if(isNaN(t))return null
  return Math.max(clubNow().abs,Math.round((t+CLUB_TZ_OFFSET*60000)/60000))
}
// Сколько минут осталось у сессии (null — неизвестно)
function gizmoLeftMin(pcLabel){
  const h=gizmoHost(pcLabel);if(!h||!h.busy)return null
  const end=gizmoEndAbs(pcLabel);if(end!==null)return end-clubNow().abs
  if(h.left!==null&&h.left!==undefined&&h.left!==''&&!isNaN(+h.left)){
    return Math.max(0,Math.round(+h.left-(Date.now()-_gizmoCache.ts)/60000))
  }
  return null
}
// «в игре 40 мин» / «только сел» — когда конец сессии неизвестен, но видели её начало
function playingLabel(m){
  const en=D.lang!=='ru'
  return m<1?(en?'just sat down':'только сел'):(en?'playing ':'в игре ')+fmtDur(m)
}
// Сколько минут уже идёт сессия (null — мост не знает, сервер не видел её начало)
function gizmoSinceMin(pcLabel){
  const h=gizmoHost(pcLabel);if(!h||!h.busy||!h.since)return null
  const t=new Date(h.since).getTime();if(isNaN(t))return null
  const m=Math.floor((srvNow()-t)/60000)
  return m>=0&&m<24*60?m:null
}

// Брони ПК как отрезки [начало, конец) в абсолютных минутах
function pcRanges(pcLabel,bookings){
  return (bookings||[])
    .filter(b=>b.pc===pcLabel&&b.status!=='cancelled'&&b.status!=='completed')
    .map(b=>bookingAbsRange(b.date,b.start,b.end)).filter(Boolean)
    .sort((a,b)=>a[0]-b[0])
}
// Сессия на ПК прямо сейчас — те же правила, что на сервере:
// конец по остатку (Gizmo или админ), иначе по идущей брони (за ПК тот, кто бронировал), иначе неизвестен.
// → {end (абс. минуты или null), left, src:'admin'|'gizmo'|'booking'|'', sinceMin} или null — никто не играет
function pcSession(pcLabel,bookings){
  const h=gizmoHost(pcLabel);if(!h||!h.busy)return null
  const now=clubNow().abs,left=gizmoLeftMin(pcLabel)
  if(left!==null)return {end:now+left,left,src:h.src||'gizmo',sinceMin:gizmoSinceMin(pcLabel)}
  const rs=pcRanges(pcLabel,bookings),cur=rs.find(r=>r[0]<=now&&now<r[1])
  if(cur){const end=chainEnd(rs,cur[1]);return {end,left:end-now,src:'booking',sinceMin:gizmoSinceMin(pcLabel)}}
  return {end:null,left:null,src:'',sinceMin:gizmoSinceMin(pcLabel)}
}
// Занятые отрезки для выбора времени: брони + идущая сессия в клубе
// (конец неизвестен — ПК занят ещё GIZMO_UNKNOWN_BUSY_MIN минут, как на сервере)
const GIZMO_UNKNOWN_BUSY_MIN=60
function pcBusyRanges(pcLabel,bookings){
  const out=pcRanges(pcLabel,bookings),s=pcSession(pcLabel,bookings)
  if(s){
    const now=clubNow().abs
    out.push([now-1,s.end!==null?s.end:now+GIZMO_UNKNOWN_BUSY_MIN])
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
// Ближайшее начало ≥ from, когда ПК свободен все dur минут (null — не в ближайшие двое суток)
function firstFree(ranges,from,dur){
  let t=from
  for(let g=0;g<200;g++){
    const hit=(ranges||[]).find(r=>r[0]<t+dur&&t<r[1])
    if(!hit)return t
    t=hit[1]
    if(t>from+2*1440)return null
  }
  return null
}

// Живой статус ПК: busy (до скольки) / soon (скоро бронь) / free
function pcLive(pcLabel,bookings){
  const now=clubNow().abs
  const ranges=pcRanges(pcLabel,bookings)
  const s=pcSession(pcLabel,bookings)
  if(s){
    const until=s.end!==null?chainEnd(ranges,s.end):null
    // Конец неизвестен (мост шлёт только «занят») — показываем, сколько уже играют, а не выдуманное «до»
    return {state:'busy',untilAbs:until,leftMin:until!==null?until-now:null,source:s.src==='booking'?'booking':'gizmo',src:s.src,sinceMin:until===null?s.sinceMin:null}
  }
  const cur=ranges.find(r=>r[0]<=now&&now<r[1])
  if(cur){const until=chainEnd(ranges,cur[1]);return {state:'busy',untilAbs:until,leftMin:until-now,source:'booking',src:'booking'}}
  const next=ranges.find(r=>r[0]>now)
  if(next&&next[0]-now<=60)return {state:'soon',nextAbs:next[0],inMin:next[0]-now}
  return {state:'free',nextAbs:next?next[0]:null}
}

// Подпись статуса для плиток и карточек
function liveLabel(st){
  const en=D.lang!=='ru'
  if(st.state==='busy'){
    const who=st.source==='gizmo'?(en?'In use':'Занят'):(en?'Booked':'Бронь')
    if(st.untilAbs===null)return {main:who,sub:st.sinceMin!=null?playingLabel(st.sinceMin):(en?'now':'сейчас'),cls:'busy'}
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
  const en=D.lang!=='ru',fresh=gizmoFresh()
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
