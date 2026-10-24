// Загрузка и создание броней

// ═══════════════════════════════════════════════
// BOOKING SYSTEM — проверка занятости и создание броней
// ═══════════════════════════════════════════════

// Кэш броней из Sheets
let _bookingsCache = { data: [], loaded: false, ts: 0 }

// Загрузить брони (POST = не кэшируется Google CDN)
async function loadBookings(date, zone, forceReload=false){
  const now = Date.now()
  if(!forceReload && _bookingsCache.loaded && (now-_bookingsCache.ts)<60000){
    let res = _bookingsCache.data
    if(date) res = res.filter(b=>b.date===date)
    if(zone) res = res.filter(b=>b.zone===zone)
    return res
  }
  let bookings=null
  try{
    // POST не кэшируется CDN — всегда свежие данные
    const r=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'getBookings'})
    })
    const d=await r.json()
    syncClock(d.now,now)
    if(d.ok) bookings=d.bookings||[]
  }catch(e){}
  if(bookings===null){
    // Запасной GET — и при сбое сети, и когда сервер ответил ошибкой
    try{
      const r2=await fetch(API_URL+'?action=getBookings&_t='+now,{cache:'no-store'})
      const d2=await r2.json()
      if(d2.ok) bookings=d2.bookings||[]
    }catch(e2){}
  }
  if(bookings===null){
    // Сервер не ответил: раньше подставлялся пустой список — и все ПК казались свободными.
    // Оставляем прошлый список (если был) и помечаем, что данные не свежие
    _bookingsCache.err=true
    let res=_bookingsCache.loaded?_bookingsCache.data:[]
    if(date) res=res.filter(b=>b.date===date)
    if(zone) res=res.filter(b=>b.zone===zone)
    return res
  }
  // Оффлайн-брони из Gizmo НЕ показываем как брони — живая занятость
  // уже отражается через Gizmo live статус (isGizmoBusy). Иначе дубли/фантомы.
  bookings=bookings.filter(b=>b.status!=='offline'&&!String(b.id||'').startsWith('OFF'))
  _bookingsCache={data:bookings,loaded:true,ts:now,err:false}
  if(date) bookings=bookings.filter(b=>b.date===date)
  if(zone) bookings=bookings.filter(b=>b.zone===zone)
  return bookings
}

// Создать бронь через Sheets с проверкой конфликтов
// ── Count-up: цифра «набегает» за ~0.6с (одноразово, без фоновой нагрузки) ──
function countUp(el,target){
  if(!el)return
  target=parseInt(target)||0
  const from=parseInt(el.textContent)||0
  if(from===target||target===0){el.textContent=target;return}
  const t0=performance.now(),dur=600
  const step=(t)=>{
    const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3) // easeOutCubic
    el.textContent=Math.round(from+(target-from)*e)
    if(k<1)requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

async function checkAndBook(booking, _retry){
  // Живую сессию Gizmo проверяет сервер — и только если она пересекается с бронью
  try{
    const p = new URLSearchParams({action:'createBooking',_t:Date.now()})
    Object.entries(booking).forEach(([k,v])=>p.append(k,String(v)))
    const res = await fetch(API_URL+'?'+p.toString(), {cache:'no-store'})
    const d = await res.json()
    // ⏳ Сервер временно занят (lock) — тихий авто-повтор один раз
    if(!d.ok && !d.conflict && !_retry && /сервер занят|lock/i.test(String(d.error||''))){
      await new Promise(r=>setTimeout(r,2500))
      return checkAndBook(booking, true)
    }
    if(d.ok) _bookingsCache.loaded=false
    return d
  }catch(e){
    // Сбой сети — один тихий повтор, потом честная ошибка
    if(!_retry){
      await new Promise(r=>setTimeout(r,2000))
      return checkAndBook(booking, true)
    }
    return {ok:false, error:'Нет связи с сервером. Проверь интернет и попробуй снова.'}
  }
}

// 🔐 Полный список броней (с именами) — только для панели владельца.
// Старый бэкенд не знает adminBookings — тогда берём общий список.
async function loadAdminBookings(all=false){
  const d=await apiGetJSON({action:'adminBookings',all:all?'1':'0',adminKey:D._admKey||''})
  if(d&&d.ok&&Array.isArray(d.bookings))return d.bookings.filter(b=>all||(b.status!=='offline'&&!String(b.id||'').startsWith('OFF')))
  return loadBookings(null,null,false)
}

// 📅 «Мои брони» с сервера: статусы (отменена админом, завершена) и брони с других устройств.
// Бронь для команды — одна карточка на все её ПК (группируем по полю group)
let _myBkSyncTs=0
async function syncMyBookings(force=false){
  if(!D.user._tgId||!tgInit())return false
  if(!force&&Date.now()-_myBkSyncTs<45000)return false
  _myBkSyncTs=Date.now()
  const d=await apiGetJSON({action:'getMyBookings'})
  if(!d||!d.ok||!Array.isArray(d.bookings))return false
  const groups=new Map()
  d.bookings.forEach(s=>{const k=s.group||String(s.id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(s)})
  const live=st=>st==='confirmed'||st==='gizmo_synced'||st==='offline'
  const statusOf=rows=>rows.some(r=>live(r.status))?'active':rows.every(r=>r.status==='cancelled')?'cancelled':'completed'
  let changed=false
  D.user.bks=(D.user.bks||[]).map(b=>{
    const k=b.grp||String(b.id),rows=groups.get(k)
    if(!rows)return b
    groups.delete(k)
    const st=statusOf(rows),guest=rows.every(r=>r.guest)
    if(st!==b.status||!!b.guest!==guest){changed=true;return {...b,status:st,guest}}
    return b
  })
  // Брони, сделанные с другого устройства
  groups.forEach((rows,k)=>{
    const s=rows[0],zone=s.zone==='bootcamp'?'bc':s.zone
    const r=bookingAbsRange(s.date,s.start,s.end)||[0,60]
    const pcs=rows.map(x=>x.pc)
    D.user.bks.push({id:s.id,ids:rows.map(x=>x.id),grp:s.group||'',zone,pc:pcs.join(', '),pcs,team:pcs.length,pkg:s.pkg,date:s.date,start:s.start,end:s.end,
      h:Math.round((r[1]-r[0])/6)/10,price:rows.reduce((a,x)=>a+(parseFloat(x.price)||0),0),status:statusOf(rows),guest:rows.every(x=>x.guest)})
    changed=true
  })
  if(changed){
    D.user.bks.sort((a,b)=>((bookingAbsRange(b.date,b.start,b.end)||[0])[0])-((bookingAbsRange(a.date,a.start,a.end)||[0])[0]))
    sv()
  }
  return changed
}

// Брони, время которых прошло, локально считаем завершёнными (даже без сети)
function expireLocalBookings(){
  const now=clubNow().abs
  let changed=false
  D.user.bks=(D.user.bks||[]).map(b=>{
    if(b.status!=='active')return b
    const r=bookingAbsRange(b.date,b.start,b.end)
    if(r&&r[1]<=now){changed=true;return {...b,status:'completed'}}
    return b
  })
  if(changed)sv()
  return changed
}

// Форматирование даты в dd.MM.yyyy (совпадает с сервером)
function fmtDateJS(d){
  if(!d)d=new Date()
  const dd=String(d.getDate()).padStart(2,'0')
  const mm=String(d.getMonth()+1).padStart(2,'0')
  return dd+'.'+mm+'.'+d.getFullYear()
}
function timeToMinJS(t){ if(!t||!t.includes(':'))return 0; const[h,m]=t.split(':').map(Number);return h*60+m }
