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
  let bookings=[]
  try{
    // POST не кэшируется CDN — всегда свежие данные
    const r=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'getBookings'})
    })
    const d=await r.json()
    if(d.ok) bookings=d.bookings||[]
  }catch(e){
    // Fallback GET
    try{
      const r2=await fetch(API_URL+'?action=getBookings&_t='+now,{cache:'no-store'})
      const d2=await r2.json()
      if(d2.ok) bookings=d2.bookings||[]
    }catch(e2){}
  }
  // Оффлайн-брони из Gizmo НЕ показываем как брони — живая занятость
  // уже отражается через Gizmo live статус (isGizmoBusy). Иначе дубли/фантомы.
  bookings=bookings.filter(b=>b.status!=='offline'&&!String(b.id||'').startsWith('OFF'))
  _bookingsCache={data:bookings,loaded:true,ts:now}
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
  // 🔒 Проверяем Gizmo — если ПК сейчас занят в реале, блокируем
  const gizmoBusy = isGizmoBusy(booking.pc)
  if(gizmoBusy === true){
    return {ok:false, conflict:true, error:booking.pc+' сейчас занят (Gizmo)'}
  }
  try{
    const p = new URLSearchParams({action:'createBooking',_t:Date.now()})
    Object.entries(booking).forEach(([k,v])=>p.append(k,String(v)))
    const res = await fetch(API_URL+'?'+p.toString(), {cache:'no-store'})
    const d = await res.json()
    // ⏳ Сервер временно занят (lock) — тихий авто-повтор один раз
    if(!d.ok && !_retry && /занят|lock/i.test(String(d.error||''))){
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

// Получить занятые слоты для компа на дату
async function getOccupiedSlots(pc, date){
  const bookings = await loadBookings(date, null)
  return bookings
    .filter(b=>b.pc===pc && b.date===date)
    .map(b=>({start:b.start, end:b.end, user:b.user}))
}

// Проверить конфликт локально (быстрая проверка без сети)
function hasConflict(bookings, pc, date, startH, endH){
  return bookings.some(b=>{
    if(b.pc!==pc||b.date!==date) return false
    const bs=timeToMinJS(b.start), be=timeToMinJS(b.end)
    return startH*60 < be && endH*60 > bs
  })
}
// Форматирование даты в dd.MM.yyyy (совпадает с сервером)
function fmtDateJS(d){
  if(!d)d=new Date()
  const dd=String(d.getDate()).padStart(2,'0')
  const mm=String(d.getMonth()+1).padStart(2,'0')
  return dd+'.'+mm+'.'+d.getFullYear()
}
function timeToMinJS(t){ if(!t||!t.includes(':'))return 0; const[h,m]=t.split(':').map(Number);return h*60+m }
