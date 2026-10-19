// Пошаговое бронирование

// ═══════════════════════════════════════════════
// BOOKING
// ═══════════════════════════════════════════════
const STEPS=()=>[_('stepPkg'),_('stepPc'),_('stepDate'),_('stepTime'),_('stepSum')]

function openZone(key){
  const z=ZONES[key]
  Object.assign(D.bk,{zone:key,pkg:null,pc:null,date:null,sh:14,step:0})
  document.getElementById('bk-title').textContent=`${z.emoji} ${z.name}`
  document.getElementById('bk-title').style.color=z.color
  document.getElementById('bk-sub').textContent=`${z.pc.gpu} · ${z.devices.mon}`
  go('book');renderStep()
}

async function renderStep(){
  const bk=D.bk,z=ZONES[bk.zone],st=STEPS()
  const dd=document.getElementById('bk-dots')
  dd.innerHTML=st.map((_,i)=>`<div class="dot${i<bk.step?' done':i===bk.step?' cur':''}"></div>`).join('')
  document.getElementById('bk-sl').textContent=st[bk.step]
  const body=document.getElementById('bk-body');body.innerHTML=''
  const w=document.createElement('div');w.style.padding='0 16px';w.className='fu';body.appendChild(w)
  ;await [sPkgs,sPCs,sDates,sTime,sConfirm][bk.step](w,z)
}

const fmt=h=>`${String(h).padStart(2,'0')}:00`

function pkgAvail(pid){
  // Все пакеты доступны для бронирования всегда
  // Ограничение только по времени действия уже применяется в sTime
  return true
}
function pkgIsNow(pid){
  // Проверяет — доступен ли пакет прямо сейчас (для подсказок)
  const h=new Date().getHours()
  if(pid.endsWith('3')) return h>=8&&h<11
  if(pid.endsWith('4')) return h>=11&&h<17
  if(pid.endsWith('5')) return h>=22||h<8
  return true
}
function sPkgs(w,z){
  const L=D.lang,h=new Date().getHours()
  // Time hint
  let hint='',hclr='var(--t2)'
  if(h>=8&&h<11){hint=L==='en'?'☀️ Morning packages available now':'☀️ Утренние пакеты доступны сейчас';hclr='var(--gold)'}
  else if(h>=11&&h<17){hint=L==='en'?'🌤 Day packages available now':'🌤 Дневные пакеты доступны сейчас';hclr='var(--cyan)'}
  else if(h>=17&&h<22){hint=L==='en'?'🌙 Night packages from 22:00':'🌙 Ночные пакеты с 22:00';hclr='var(--blue)'}
  else{hint=L==='en'?'🌙 Night packages available now':'🌙 Ночные пакеты доступны сейчас';hclr='var(--blue)'}
  w.innerHTML=`<div class="SL">${_('pkgLbl')}</div>`+
    `<div style="padding:9px 13px;border-radius:11px;background:var(--s3);border:1px solid var(--b1);font-size:11px;font-weight:500;color:${hclr};margin-bottom:12px;display:flex;align-items:center;gap:7px">${hint}</div>`+
    `<div class="PG" id="pg"></div>`
  const pg=w.querySelector('#pg')
  z.pkgs.forEach(p=>{
    const avail=pkgAvail(p.id),sel=D.bk.pkg?.id===p.id
    const d=document.createElement('div')
    d.className='PK'+(sel?' sel':'')+(avail?'':' pk-na')
    const isNow=pkgIsNow(p.id)
    const timeLbl=p.locked?(isNow?'✅ Сейчас доступен':'⏰ '+p.t):(L==='en'?p.te:p.t)
    const timeLblColor=p.locked&&!isNow?'var(--gold)':''
    const lockedBadge=p.locked?(' <span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(196,255,62,.12);color:var(--lime);font-weight:600;font-family:var(--m)">'+p.t+'</span>'):'';
    d.innerHTML=
      '<div class="pk-c">✓</div>'+
      '<div class="pk-n">'+(L==='en'?p.nen:p.n)+lockedBadge+'</div>'+
      '<div class="pk-t" style="color:'+timeLblColor+'">'+timeLbl+'</div>'+
      '<div class="pk-p" style="color:'+z.color+'">'+p.p+'<span class="pk-b"> BYN</span></div>'
    d.style.position='relative'
    d.onclick=()=>{D.bk.pkg=p;D.bk.step=1;renderStep()}
    pg.appendChild(d)
  })
}

async function sPCs(w,z){
  const pre=z.key==='std'?'ST':z.key==='vip'?'VIP':'BC'
  const devL={h:D.lang==='en'?'🎧 Headphones':'🎧 Наушники',m:D.lang==='en'?'🖱️ Mouse':'🖱️ Мышь',k:D.lang==='en'?'⌨️ Keyboard':'⌨️ Клавиатура',mon:'🖥️ Monitor'}
  const dr=Object.entries(devL).map(([k,l])=>`<div class="RW"><span class="K">${l}</span><span class="V" style="font-size:11.5px;text-align:right;max-width:58%">${z.devices[k]}</span></div>`).join('')
  const pr=`<div class="RW"><span class="K">${D.lang==='en'?'🎮 GPU':'🎮 Видеокарта'}</span><span class="V" style="font-size:11.5px">${z.pc.gpu}</span></div><div class="RW"><span class="K">${D.lang==='en'?'⚙️ CPU':'⚙️ Процессор'}</span><span class="V" style="font-size:11.5px">${z.pc.cpu}</span></div><div class="RW"><span class="K">💾 RAM</span><span class="V" style="font-size:11.5px">${z.pc.ram}</span></div>`

  w.innerHTML=`
    <div class="SL">${_('pcLbl')} <span id="pc-free-lbl" style="color:var(--lime);font-family:var(--m);font-size:11px"></span></div>
    <div class="PCG" id="pcg"><div style="padding:20px;color:var(--t2);font-size:12px;text-align:center"><span class="spin"></span></div></div>
    <div class="SL" style="margin-top:18px">${_('equipment')}</div>
    <div class="CRD">${dr}${pr}</div>
    <div style="height:14px"></div>`
  addBack(w)

  // 🚀 Параллельная загрузка — Gizmo + брони одновременно
  const date = D.bk.date?.v || fmtDateJS(new Date())
  const sh   = D.bk.sh || 12
  const h    = D.bk.pkg?.h || 1
  const endH = Math.min(sh + h, 24)

  const [,allBks] = await Promise.all([
    loadGizmoStatus(),
    loadBookings(null, null, false)
  ])

  const normD=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
  const myDate=normD(date)
  let bookings=(allBks||[]).filter(b=>normD(b.date)===myDate&&b.status!=='cancelled'&&b.status!=='completed')

  // Определяем занятость ПК: Gizmo > бронирования
  function isPcBusy(lbl){
    const gizmo = isGizmoBusy(lbl)
    if(gizmo !== null) return gizmo
    return bookings.some(b=>{
      if(b.pc!==lbl)return false
      const bs=timeToMinJS(b.start),be=timeToMinJS(b.end)
      // Ночная бронь (22:00-08:00)
      if(be<=bs) return (sh*60<1440&&endH*60>bs)||(sh*60<be)
      return sh*60<be&&endH*60>bs
    })
  }

  // До какого времени ПК занят: сначала живая сессия Gizmo, потом брони
  

  const pcg = w.querySelector('#pcg')
  pcg.innerHTML = ''
  let freeCount = 0

  // Источник данных
  const gizmoFresh = _gizmoCache.hosts.length>0 && Date.now()-_gizmoCache.ts<120000
  const srcBadge = gizmoFresh
    ? '<div style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;background:rgba(75,158,255,.08);border:1px solid rgba(75,158,255,.15);font-size:10px;color:var(--blue);margin-bottom:10px"><div class="LD" style="background:var(--blue);width:5px;height:5px"></div>Занятость обновляется автоматически</div>'
    : '<div style="padding:6px 10px;border-radius:8px;background:var(--s3);font-size:10px;color:var(--t3);margin-bottom:10px">📊 По бронированиям</div>'
  pcg.insertAdjacentHTML('beforebegin', srcBadge)

  if(z.key==='std'){
    pcg.style.display='grid'
    pcg.style.gridTemplateColumns='1fr 1fr'
    pcg.style.gap='8px'
    const leftNums=[1,3,5,7,9,11,13,15]
    const rightNums=[2,4,6,8,10]
    const leftCol=document.createElement('div')
    leftCol.innerHTML=`<div style="font-size:9px;color:var(--t2);font-weight:600;text-align:center;margin-bottom:6px;letter-spacing:.5px">← ЛЕВАЯ</div>`
    const rightCol=document.createElement('div')
    rightCol.innerHTML=`<div style="font-size:9px;color:var(--t2);font-weight:600;text-align:center;margin-bottom:6px;letter-spacing:.5px">ПРАВАЯ →</div>`
    const makePCBtn=(num)=>{
      const lbl=`${pre}-${String(num).padStart(2,'0')}`
      const busy=isPcBusy(lbl)
      if(!busy)freeCount++
      const isFav=(D.user._favPcs||[]).includes(lbl)
      const d=document.createElement('div')
      d.className='PCB'+(busy?' busy':D.bk.pc?.lbl===lbl?' sel':'')
      d.style.marginBottom='6px'
      d.style.position='relative'
      d.innerHTML=`<div class="pc-id" style="color:${busy?'var(--red)':z.color}">${String(num).padStart(2,'0')}</div><div class="pc-d" style="background:${busy?'var(--red)':z.color}"></div>${busy?'<div style="font-size:7.5px;color:var(--red);margin-top:3px;font-weight:700;letter-spacing:.6px">ЗАНЯТ</div>':''}${isFav?'<div style="position:absolute;top:3px;right:3px;font-size:8px">❤️</div>':''}`
      if(!busy){
        d.onclick=(e)=>{
          if(e.target.closest('.fav-btn'))return
          D.bk.pc={lbl,id:num};D.bk.step=2;renderStep()
        }
        // Long press = favorite
        let _lt;d.onpointerdown=()=>{_lt=setTimeout(()=>{toggleFavPc(lbl);_lt=null;sPCs(w,z)},600)}
        d.onpointerup=()=>{if(_lt)clearTimeout(_lt)}
        d.onpointerleave=()=>{if(_lt)clearTimeout(_lt)}
      }
      return d
    }
    leftNums.forEach(n=>leftCol.appendChild(makePCBtn(n)))
    rightNums.forEach(n=>rightCol.appendChild(makePCBtn(n)))
    pcg.appendChild(leftCol)
    pcg.appendChild(rightCol)
  } else {
    Array.from({length:z.pcCount},(_,i)=>{
      const lbl=`${pre}-${String(i+1).padStart(2,'0')}`
      const busy=isPcBusy(lbl)
      if(!busy)freeCount++
      const isFav=(D.user._favPcs||[]).includes(lbl)
      const d=document.createElement('div')
      d.className='PCB'+(busy?' busy':D.bk.pc?.lbl===lbl?' sel':'')
      d.style.position='relative'
      d.innerHTML=`<div class="pc-id" style="color:${busy?'var(--red)':z.color}">${String(i+1).padStart(2,'0')}</div><div class="pc-d" style="background:${busy?'var(--red)':z.color}"></div>${busy?'<div style="font-size:7.5px;color:var(--red);margin-top:3px;font-weight:700;letter-spacing:.6px">ЗАНЯТ</div>':''}${isFav?'<div style="position:absolute;top:3px;right:3px;font-size:8px">❤️</div>':''}`
      if(!busy){
        d.onclick=()=>{D.bk.pc={lbl,id:i+1};D.bk.step=2;renderStep()}
        let _lt;d.onpointerdown=()=>{_lt=setTimeout(()=>{toggleFavPc(lbl);sPCs(w,z)},600)}
        d.onpointerup=()=>{if(_lt)clearTimeout(_lt)}
        d.onpointerleave=()=>{if(_lt)clearTimeout(_lt)}
      }
      pcg.appendChild(d)
    })
  }

  const lbl = w.querySelector('#pc-free-lbl')
  if(lbl) lbl.textContent = `· ${freeCount} свободно`
}

function sDates(w,z){
  const L=I18N[D.lang]
  const dates=Array.from({length:7},(_,i)=>{
    const d=new Date();d.setDate(d.getDate()+i)
    return{v:fmtDateJS(d),label:i===0?L.today:i===1?L.tomorrow:L.DAYS[d.getDay()],n:d.getDate(),m:L.MONTHS[d.getMonth()]}
  })
  if(!D.bk.date)D.bk.date=dates[0]
  w.innerHTML=`<div class="SL">${_('dateLbl')}</div><div class="DCH">${dates.map(d=>`<div class="DC${D.bk.date.v===d.v?' sel':''}" data-v="${d.v}"><div class="dc-d">${d.label}</div><div class="dc-n">${d.n}</div><div class="dc-m">${d.m}</div></div>`).join('')}</div><div style="height:14px"></div>`
  addBack(w)
  w.querySelectorAll('.DC').forEach(el=>{
    el.onclick=()=>{
      w.querySelectorAll('.DC').forEach(x=>x.classList.remove('sel'));el.classList.add('sel')
      D.bk.date=dates.find(d=>d.v===el.dataset.v);D.bk.step=3;renderStep()
    }
  })
}

// Константы клуба
const CLUB = { open:0, close:24, name:'ToxicSkill', phone:'+375 33 665-66-52' }

async function sTime(w,z){
  const p=D.bk.pkg,h=p.h
  const pid=p.id
  const isLocked=p.locked===true
  const isNightPkg=pid.endsWith('5')

  const pcLabel=D.bk.pc.lbl
  const date=D.bk.date.v

  let sh=isLocked?(p.tStart||22):Math.max(0,Math.min(23,D.bk.sh||10))
  // Если бронь на сегодня и стартовый час уже прошёл — двигаем на текущий+1
  if(!isLocked){
    const todayStr0=fmtDateJS(new Date())
    if(date===todayStr0){
      const minH=new Date().getHours()+1
      if(sh<minH)sh=Math.min(23,minH)
    }
  }
  D.bk.sh=sh

  const endStr=()=>isNightPkg?'08:00':fmt(Math.min(sh+h,24))

  // ── Загружаем брони — используем кэш если свежий (уже загружены в sPCs) ──
  let allBookings=[]
  try{
    // Используем loadBookings с кэшем — если только что загружали в sPCs, не грузим снова
    allBookings=await loadBookings(null,null,false)
    if(!allBookings.length){
      // Кэш пустой — грузим напрямую
      const _r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'getBookings'})})
      const _d=await _r.json()
      if(_d.ok)allBookings=(_d.bookings||[]).filter(b=>b.status!=='offline'&&!String(b.id||'').startsWith('OFF'))
    }
  }catch(e){}

  // Фильтруем по ПК и дате
  const pcBookings=allBookings.filter(b=>{
    if(b.status==='cancelled'||b.status==='completed')return false
    if(b.pc!==pcLabel)return false
    return b.date===date
  })

  // ── Gizmo статус ──
  const gizmoBusy=isGizmoBusy(pcLabel)

  // ── Строим визуальную шкалу 0-24 ──
  const hours=Array.from({length:24},(_,i)=>i)
  function isHourOccupied(hour){
    return pcBookings.some(b=>{
      const bs=timeToMinJS(b.start),be=timeToMinJS(b.end)
      const h0=hour*60,h1=(hour+1)*60
      // Ночная бронь (22:00-08:00): end < start
      if(be<=bs){
        // Занято от start до 24:00 И от 00:00 до end
        return h0<1440&&h1>bs || h0<be
      }
      return h0<be&&h1>bs
    })
  }
  function getBookingAt(hour){
    return pcBookings.find(b=>{
      const bs=timeToMinJS(b.start),be=timeToMinJS(b.end)
      const h0=hour*60,h1=(hour+1)*60
      if(be<=bs) return (h0<1440&&h1>bs) || h0<be
      return h0<be&&h1>bs
    })
  }
  function isSlotFree(startH,dur){
    for(let i=startH;i<startH+dur&&i<24;i++){
      if(isHourOccupied(i))return false
      if(isHourPast(i))return false
    }
    return true
  }
  // Прошедшее время: если бронь на сегодня — часы до текущего недоступны
  function isHourPast(hour){
    if(isNightPkg)return false // ночной пакет с 22:00 — особый случай
    const todayStr=fmtDateJS(new Date())
    if(date!==todayStr)return false
    const nowH=new Date().getHours()
    return hour<nowH
  }

  // ── Форматируем занятые блоки для отображения ──
  const occupiedList=[]
  const seen=new Set()
  pcBookings.forEach(b=>{
    if(seen.has(b.id))return;seen.add(b.id)
    occupiedList.push({start:b.start,end:b.end,id:b.id})
  })

  // ── Locked пакет ──
  const timeBadge=isLocked?`
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:14px;background:linear-gradient(135deg,rgba(196,255,62,.08),rgba(42,237,181,.05));border:1.5px solid var(--lime30);margin-bottom:12px">
      <div style="width:38px;height:38px;border-radius:11px;background:var(--lime15);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🔒</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:700;color:var(--lime);letter-spacing:.3px">ФИКСИРОВАННОЕ ВРЕМЯ</div>
        <div style="font-family:var(--m);font-size:17px;font-weight:800;margin-top:2px;color:var(--txt)">${p.t}</div>
      </div>
    </div>`:
    `<div style="display:flex;align-items:center;gap:8px;padding:10px 13px;border-radius:10px;background:rgba(42,237,181,.06);border:1px solid rgba(42,237,181,.15);margin-bottom:12px;font-size:11px">
      <span style="font-size:14px">⚡</span><span><b style="color:var(--cyan)">Выбери время</b> — занятые часы отмечены красным</span>
    </div>`

  // ── Gizmo предупреждение ──
  const gizmoWarn=gizmoBusy===true?`
    <div style="display:flex;gap:8px;padding:10px 14px;border-radius:10px;background:rgba(255,63,96,.08);border:1px solid rgba(255,63,96,.2);margin-bottom:12px;font-size:11px">
      <span>🔴</span><span style="color:var(--red)"><b>${pcLabel}</b> сейчас занят в клубе (Gizmo live). Бронировать на текущее время нельзя.</span>
    </div>`:''

  // ── Визуальная шкала времени ──
  let timelineHTML=''
  if(!isLocked){
    const cellW=100/24
    let barCells=''
    for(let i=0;i<24;i++){
      const occ=isHourOccupied(i)
      const past=isHourPast(i)
      const bg=past?'rgba(255,255,255,.04)':occ?'var(--red)':'rgba(196,255,62,.15)'
      barCells+=`<div data-h="${i}" style="flex:1;height:28px;background:${bg};border-right:1px solid var(--s4);cursor:${(occ||past)?'not-allowed':'pointer'};position:relative;transition:background .15s${past?';opacity:.5':''}" title="${fmt(i)}-${fmt(i+1)}${past?' прошло':occ?' ЗАНЯТ':''}"></div>`
    }
    // Маркер выбранного диапазона (overlay)
    timelineHTML=`
    <div style="margin-bottom:6px">
      <div style="font-size:10px;color:var(--t2);margin-bottom:6px;display:flex;justify-content:space-between">
        <span>ШКАЛА ЗАНЯТОСТИ ${pcLabel}</span>
        <span style="display:flex;gap:8px"><span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:var(--red)"></span>занят</span><span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:rgba(196,255,62,.3)"></span>свободно</span></span>
      </div>
      <div id="timeline-bar" style="display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--b2);position:relative">${barCells}<div id="sel-marker" style="position:absolute;top:0;bottom:0;background:rgba(196,255,62,.35);border:2px solid var(--lime);border-radius:6px;pointer-events:none;transition:left .2s var(--e),width .2s var(--e);box-shadow:0 0 12px rgba(196,255,62,.3)"></div></div>
      <div style="display:flex;justify-content:space-between;font-family:var(--m);font-size:8px;color:var(--t3);margin-top:3px"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span><span>24</span></div>
    </div>`
  }

  // ── Занятые брони список (компактно, макс 3) ──
  let occupiedHTML=''
  if(occupiedList.length){
    const shown=occupiedList.slice(0,3)
    occupiedHTML=`<div style="margin-top:12px"><div style="font-size:10px;color:var(--t2);margin-bottom:7px;text-transform:uppercase;letter-spacing:1px;font-weight:600">🔒 Занято на ${pcLabel}</div>`
    shown.forEach(o=>{
      occupiedHTML+=`<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;background:linear-gradient(135deg,rgba(255,63,96,.1),rgba(255,63,96,.03));border:1px solid rgba(255,63,96,.18);border-radius:11px;margin-bottom:6px">
        <span style="color:var(--red);font-family:var(--m);font-weight:700;font-size:13px;text-shadow:0 0 8px rgba(255,63,96,.4)">${o.start}–${o.end}</span>
        <span style="color:var(--t2);font-size:11px;margin-left:auto">занято</span>
      </div>`
    })
    if(occupiedList.length>3)occupiedHTML+=`<div style="font-size:10px;color:var(--t3);text-align:center;padding:4px">и ещё ${occupiedList.length-3}</div>`
    occupiedHTML+=`</div>`
  }

  // ── Основной HTML ──
  w.innerHTML=`<div class="SL">${_('timeLbl')}</div>
  ${timeBadge}
  ${gizmoWarn}
  <div class="TB2">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:16px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid var(--b1)">
      <div><div style="font-size:10px;color:var(--t2);margin-bottom:5px;letter-spacing:1px;text-transform:uppercase">${_('begin')}</div><div style="font-family:var(--m);font-size:38px;font-weight:700;color:${z.color};line-height:1;text-shadow:0 0 18px ${z.color}55" id="ts-s">${fmt(sh)}</div></div>
      <div style="font-size:22px;color:${z.color};opacity:.5;padding-top:16px">→</div>
      <div style="text-align:right"><div style="font-size:10px;color:var(--t2);margin-bottom:5px;letter-spacing:1px;text-transform:uppercase">${_('end')}</div><div style="font-family:var(--m);font-size:38px;font-weight:700;line-height:1;color:var(--txt);text-shadow:0 0 18px rgba(255,255,255,.2)" id="ts-e">${endStr()}</div></div>
    </div>
    ${timelineHTML}
    ${isLocked?'':`<input type="range" min="0" max="23" value="${sh}" id="tsr" style="--p:${Math.round(sh/23*100)}%;margin-top:8px">
    <div style="display:flex;justify-content:space-between;font-family:var(--m);font-size:9px;color:var(--t3)"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>`}
    <div style="margin-top:12px;padding:11px 14px;background:var(--s3);border-radius:11px;display:flex;justify-content:space-between;font-size:12px">
      <span style="color:var(--t2)">${_('pkgLbl')}</span><span style="font-weight:600">${D.lang==='en'?p.nen:p.n} · ${h}h</span>
    </div>
    ${occupiedHTML}
    <div id="conflict-warn" style="display:none;margin-top:10px;gap:8px;padding:10px 13px;border-radius:10px;background:rgba(255,63,96,.08);border:1px solid rgba(255,63,96,.2);font-size:11px">
      <span>❌</span><span style="color:var(--red)" id="conflict-msg">Это время уже занято</span>
    </div>
  </div><div style="height:14px"></div>
  <button class="BTN" id="tc" style="background:${z.color};color:#000">${_('cont')}</button>`
  addBack(w)

  // ── Обновление маркера и проверка конфликтов ──
  function updateMarker(){
    if(isLocked)return
    const marker=w.querySelector('#sel-marker')
    const conflictEl=w.querySelector('#conflict-warn')
    const conflictMsg=w.querySelector('#conflict-msg')
    const btn=w.querySelector('#tc')
    if(!marker)return

    const left=(sh/24*100)
    const width=(h/24*100)
    marker.style.left=left+'%'
    marker.style.width=width+'%'

    // Проверяем конфликт
    const hasConflict=!isSlotFree(sh,h)
    if(hasConflict){
      marker.style.background='rgba(255,63,96,.3)'
      marker.style.borderColor='var(--red)'
      marker.style.boxShadow='0 0 12px rgba(255,63,96,.3)'
      if(conflictEl)conflictEl.style.display='flex'
      const blocking=getBookingAt(sh)
      const isPast=isHourPast(sh)
      if(conflictMsg){
        if(isPast)conflictMsg.textContent='Это время уже прошло — выбери позже'
        else if(blocking)conflictMsg.textContent=`${pcLabel} занят ${blocking.start}–${blocking.end}`
        else conflictMsg.textContent='Это время недоступно'
      }
      if(btn){btn.disabled=true;btn.style.opacity='.3'}
    }else{
      marker.style.background='rgba(196,255,62,.35)'
      marker.style.borderColor='var(--lime)'
      marker.style.boxShadow='0 0 12px rgba(196,255,62,.3)'
      if(conflictEl)conflictEl.style.display='none'
      if(btn){btn.disabled=false;btn.style.opacity='1'}
    }
  }
  updateMarker()

  // ── Клик по шкале ──
  const bar=w.querySelector('#timeline-bar')
  if(bar&&!isLocked){
    bar.onclick=(e)=>{
      const rect=bar.getBoundingClientRect()
      const x=e.clientX-rect.left
      const newH=Math.floor(x/rect.width*24)
      if(newH>=0&&newH<=23){
        sh=newH;D.bk.sh=sh
        w.querySelector('#ts-s').textContent=fmt(sh)
        w.querySelector('#ts-e').textContent=fmt(Math.min(sh+h,24))
        const sl=w.querySelector('#tsr');if(sl){sl.value=sh;sl.style.setProperty('--p',Math.round(sh/23*100)+'%')}
        updateMarker()
      }
    }
  }

  // ── Слайдер ──
  if(!isLocked){
    const sl=w.querySelector('#tsr')
    if(sl) sl.oninput=()=>{
      sh=+sl.value;D.bk.sh=sh
      w.querySelector('#ts-s').textContent=fmt(sh)
      w.querySelector('#ts-e').textContent=isNightPkg?'08:00':fmt(Math.min(sh+h,24))
      sl.style.setProperty('--p',Math.round(sh/23*100)+'%')
      updateMarker()
    }
  }
  w.querySelector('#tc').onclick=()=>{
    if(!isSlotFree(sh,h)&&!isLocked){toast('❌ Выбранное время занято — сдвинь слайдер','❌');return}
    D.bk.step=4;renderStep()
  }
}
function sConfirm(w,z){
  const bk=D.bk,p=bk.pkg,h=p.h,en=Math.min(bk.sh+h,24)
  const timeStr=p.locked?p.t:`${fmt(bk.sh)} – ${fmt(en)}`
  const rows=[
    [_('zone'),`${z.emoji} ${z.name}`],[_('pcLbl'),bk.pc.lbl],
    [_('pkgLbl'),`${D.lang==='en'?p.nen:p.n} (${h}h)`],
    [_('dateLbl'),bk.date.v],[_('timeLbl'),timeStr]
  ]
  const lockedWarn=p.locked?`<div style="display:flex;gap:8px;padding:10px 14px;border-radius:10px;background:rgba(255,202,80,.06);border:1px solid rgba(255,202,80,.2);margin-bottom:12px;font-size:11px">
    <span>⚠️</span><span style="color:var(--gold)">Пакет действует только <b>${p.t}</b> — убедись что придёшь вовремя</span>
  </div>`:''
  w.innerHTML=`<div class="SL">${_('stepSum')}</div>
  ${lockedWarn}
  <div class="CRD" style="border-color:rgba(255,255,255,.09)">
    <div class="cbar" style="background:${z.stripe}"></div>
    ${rows.map(([k,v])=>`<div class="RW"><span class="K">${k}</span><span class="V" style="font-family:var(--m);font-size:12px">${v}</span></div>`).join('')}
  </div>
  <!-- Итоговая цена -->
  <div style="margin-top:12px;padding:18px 20px;border-radius:var(--R);background:linear-gradient(135deg,${z.color}1f,${z.color}08);border:1px solid ${z.color}40;display:flex;justify-content:space-between;align-items:center">
    <div><div style="font-size:11px;color:var(--t2);letter-spacing:1px;text-transform:uppercase">${_('totalLbl')}</div><div style="font-size:11px;color:var(--t3);margin-top:2px">${h} ${h===1?'час':'часов'} игры</div></div>
    <div style="font-family:var(--F);font-size:34px;font-weight:800;color:${z.color};text-shadow:0 0 20px ${z.color}66;line-height:1">${p.p}<span style="font-size:15px;margin-left:3px">BYN</span></div>
  </div>
  <div style="height:14px"></div>
  <button class="BTN" id="cb" style="background:${z.color};color:#000;box-shadow:0 6px 28px ${z.color}44">${_('bookNow')}</button>`
  addBack(w)
  w.querySelector('#cb').onclick=async()=>{
    // Проверяем номер телефона — обязателен, +375
    const ph=D.user.phone||''
    const phDigits=ph.replace(/\D/g,'')
    if(!phDigits.startsWith('375')||phDigits.length!==12){
      showContactModal(()=>renderStep())
      return
    }
    const btn=w.querySelector('#cb');btn.innerHTML='<span class="spin"></span>';btn.disabled=true
    try{
      // Для locked пакетов используем tStart/tEnd, для ночного tEnd < tStart
      const isNightPkg=p.locked&&p.tEnd!==undefined&&p.tEnd<=p.tStart
      const bkStart=p.locked?fmt(p.tStart):fmt(bk.sh)
      const bkEnd=p.locked?(isNightPkg?fmt(p.tEnd):fmt(p.tEnd)):fmt(en)

      // 🔒 ФИНАЛЬНАЯ ПРОВЕРКА — загружаем свежие брони прямо перед бронированием
      try{
        const freshAll=await loadBookings(null, null, true)
        const normD2=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
        const freshBookings=freshAll.filter(fb=>normD2(fb.date)===normD2(bk.date.v))
        const startMin=timeToMinJS(bkStart),endMin=timeToMinJS(bkEnd)
        const isNightBk=endMin<=startMin
        const conflict=freshBookings.find(b=>{
          if(b.pc!==bk.pc.lbl||b.status==='cancelled')return false
          const bs=timeToMinJS(b.start),be=timeToMinJS(b.end)
          const rNight=be<=bs
          // Обе ночные = конфликт
          if(isNightBk&&rNight) return true
          // Ночная vs дневная
          if(isNightBk&&!rNight) return bs>=startMin||be>startMin
          if(!isNightBk&&rNight) return startMin>=bs||endMin>bs
          // Обе дневные
          return startMin<be&&endMin>bs
        })
        if(conflict){
          btn.innerHTML=_('bookNow');btn.disabled=false
          toast(`❌ ${bk.pc.lbl} уже забронирован ${conflict.start}-${conflict.end}`,'❌')
          btn.classList.add('shake');setTimeout(()=>btn.classList.remove('shake'),400)
          return
        }
      }catch(e){}

      const checkRes = await checkAndBook({
        user:  D.user.name||'Гость',
        phone: D.user.phone||'',
        pc:    bk.pc.lbl,
        zone:  bk.zone,
        date:  bk.date.v,
        start: bkStart,
        end:   bkEnd,
        pkg:   D.lang==='en'?p.nen:p.n,
        price: p.p,
        tgId:  D.user._tgId||'',
        isTg:  !!window.Telegram?.WebApp?.initDataUnsafe?.user
      })
      if(!checkRes.ok){
        btn.innerHTML=_('bookNow');btn.disabled=false
        toast(checkRes.conflict
          ? `❌ ${checkRes.error}`
          : `⚠️ Ошибка при бронировании`, '❌')
        btn.classList.add('shake');setTimeout(()=>btn.classList.remove('shake'),400)
        return
      }
      // Успех — сохраняем локально
      const nb={id:checkRes.id||Date.now(),zone:bk.zone,pc:bk.pc.lbl,
        pkg:D.lang==='en'?p.nen:p.n,
        date:bk.date.v,start:bkStart,end:bkEnd,h,price:p.p,status:'active'}
      D.user.bks.unshift(nb);D.user.hrs=(D.user.hrs||0)+h
      // ⭐ Баллы начисляются СЕРВЕРОМ — просто читаем ответ
      if(checkRes.points&&checkRes.points.earned>0){
        D.user.pts=checkRes.points.balance;sv()
        setTimeout(()=>toast(`⭐ +${checkRes.points.earned} баллов (${checkRes.points.tags})`,'⭐'),1000)
      } else if(checkRes.pointsMsg){
        setTimeout(()=>toast(checkRes.pointsMsg,'ℹ️'),1200)
      }
      sv()
      const ok=document.getElementById('ok-card')
      ok.innerHTML=`<div class="cbar" style="background:${z.stripe}"></div>${rows.map(([k,v])=>`<div class="RW"><span class="K">${k}</span><span class="V" style="font-family:var(--m);font-size:12px">${v}</span></div>`).join('')}`
      document.querySelectorAll('#ok [data-i]').forEach(el=>{const v=I18N[D.lang][el.dataset.i];if(v)el.textContent=v})
      const wishes=['Приятной игры! 🎯','Удачи в матчах! 🏆','Врывайся! ⚡','GG WP! 🎮','Фраги обеспечены! 💀','Удачи, боец! 🔥']
      const wEl=document.getElementById('ok-wish');if(wEl)wEl.textContent=wishes[Math.floor(Math.random()*wishes.length)]
      scheduleReminder(nb)
      go('ok')
      launchConfetti()
    }catch(e){
      btn.innerHTML=_('bookNow');btn.disabled=false
      toast('Ошибка соединения','⚠️')
    }
  }
}

let _contactCallback = null
function showContactModal(cb){
  _contactCallback = cb
  // Предзаполняем если есть данные
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user
  setTimeout(()=>{
    const ph = document.getElementById('cm-phone')
    const tg = document.getElementById('cm-tg')
    if(ph && D.user.phone) ph.value = D.user.phone
    if(tg && tgUser?.username) tg.value = '@'+tgUser.username
  }, 50)
  openM('contact-m')
}
function saveContact(){
  const phone = document.getElementById('cm-phone')?.value.trim()
  const tg    = document.getElementById('cm-tg')?.value.trim()
  const L=D.lang
  if(!phone && !tg){ toast(L==='en'?'Enter phone or Telegram':L==='zh'?'请输入电话或Telegram':'Введи телефон или Telegram','⚠️'); return }
  // Валидация +375
  if(phone){
    const digits=phone.replace(/\D/g,'')
    if(!digits.startsWith('375')||digits.length!==12){
      toast(L==='en'?'Phone must be +375 XX XXX-XX-XX':L==='zh'?'电话必须是+375格式':'Формат: +375 XX XXX-XX-XX','⚠️');return
    }
    const fmt='+'+digits.slice(0,3)+' '+digits.slice(3,5)+' '+digits.slice(5,8)+'-'+digits.slice(8,10)+'-'+digits.slice(10,12)
    D.user.phone = fmt
  }
  if(tg) D.user.handle = tg.replace('@','').replace(/[^a-zA-Z0-9_]/g,'').substring(0,32)
  sv()
  closeM('contact-m')
  toast(L==='en'?'Contact saved':L==='zh'?'联系方式已保存':'Контакт сохранён ✓','✅')
  if(_contactCallback) setTimeout(_contactCallback, 300)
}

function addBack(w){
  const d=document.createElement('div');d.style.cssText='margin-top:10px;padding-bottom:4px'
  d.innerHTML=`<button class="BTN ghost" onclick="bkBack()" style="display:flex;align-items:center;justify-content:center;gap:6px"><span style="font-size:16px">←</span>${_('back')}</button>`;w.appendChild(d)
}
function bkBack(){if(D.bk&&D.bk.step>0){D.bk.step--;renderStep()}else go('home')}
