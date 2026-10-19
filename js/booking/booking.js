// Пошаговое бронирование: пакет → ПК → дата → время (поминутно) → итог

// ═══════════════════════════════════════════════
// BOOKING
// ═══════════════════════════════════════════════
const STEPS=()=>[_('stepPkg'),_('stepPc'),_('stepDate'),_('stepTime'),_('stepSum')]

function openZone(key){
  const z=ZONES[key]
  Object.assign(D.bk,{zone:key,pkg:null,pc:null,date:null,sh:14,sm:null,smDay:null,step:0})
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
  // Проверяет — доступен ли пакет прямо сейчас (для подсказок) — по времени клуба
  const h=Math.floor(clubNow().min/60)
  if(pid.endsWith('3')) return h>=8&&h<11
  if(pid.endsWith('4')) return h>=11&&h<17
  if(pid.endsWith('5')) return h>=22||h<8
  return true
}
function sPkgs(w,z){
  const L=D.lang,h=Math.floor(clubNow().min/60)
  // Time hint
  let hint='',hclr='var(--t2)'
  if(h>=8&&h<11){hint=L==='en'?'☀️ Morning packages available now':'☀️ Утренние пакеты доступны сейчас';hclr='var(--gold)'}
  else if(h>=11&&h<17){hint=L==='en'?'🌤 Day packages available now':'🌤 Дневные пакеты доступны сейчас';hclr='var(--cyan)'}
  else if(h>=17&&h<22){hint=L==='en'?'🌙 Night packages from 22:00':'🌙 Ночные пакеты с 22:00';hclr='var(--blue)'}
  else{hint=L==='en'?'🌙 Night packages available now':'🌙 Ночные пакеты доступны сейчас';hclr='var(--blue)'}
  w.innerHTML=`<div class="SL">${_('pkgLbl')}</div>`+
    `<div class="hint-pill" style="color:${hclr}">${hint}</div>`+
    `<div class="PG" id="pg"></div>`
  const pg=w.querySelector('#pg')
  z.pkgs.forEach(p=>{
    const avail=pkgAvail(p.id),sel=D.bk.pkg?.id===p.id
    const d=document.createElement('div')
    d.className='PK'+(sel?' sel':'')+(avail?'':' pk-na')
    const isNow=pkgIsNow(p.id)
    // У пакетов с фиксированным временем окно показываем один раз; «● сейчас» — если оно идёт
    const timeLbl=p.locked?(isNow?'<span class="pk-now">● '+(L==='en'?'now':'сейчас')+'</span> '+p.t:'⏰ '+p.t):(L==='en'?p.te:p.t)
    const timeLblColor=p.locked&&!isNow?'var(--gold)':''
    d.innerHTML=
      '<div class="pk-c">✓</div>'+
      '<div class="pk-n">'+(L==='en'?p.nen:p.n)+'</div>'+
      '<div class="pk-t" style="color:'+timeLblColor+'">'+timeLbl+'</div>'+
      '<div class="pk-p" style="color:'+z.color+'">'+p.p+'<span class="pk-b"> BYN</span></div>'
    d.style.position='relative'
    d.onclick=()=>{D.bk.pkg=p;D.bk.step=1;renderStep()}
    pg.appendChild(d)
  })
}

// ═══ ШАГ «ПК»: живой статус у каждого компьютера ═══
// Занятый сейчас ПК всё равно можно выбрать — на потом или на другой день.
async function sPCs(w,z){
  const pre=z.key==='std'?'ST':z.key==='vip'?'VIP':'BC'
  const devL={h:D.lang==='en'?'🎧 Headphones':'🎧 Наушники',m:D.lang==='en'?'🖱️ Mouse':'🖱️ Мышь',k:D.lang==='en'?'⌨️ Keyboard':'⌨️ Клавиатура',mon:'🖥️ Monitor'}
  const dr=Object.entries(devL).map(([k,l])=>`<div class="RW"><span class="K">${l}</span><span class="V" style="font-size:11.5px;text-align:right;max-width:58%">${z.devices[k]}</span></div>`).join('')
  const pr=`<div class="RW"><span class="K">${D.lang==='en'?'🎮 GPU':'🎮 Видеокарта'}</span><span class="V" style="font-size:11.5px">${z.pc.gpu}</span></div><div class="RW"><span class="K">${D.lang==='en'?'⚙️ CPU':'⚙️ Процессор'}</span><span class="V" style="font-size:11.5px">${z.pc.cpu}</span></div><div class="RW"><span class="K">💾 RAM</span><span class="V" style="font-size:11.5px">${z.pc.ram}</span></div>`

  w.innerHTML=`
    <div class="SL">${_('pcLbl')} <span id="pc-free-lbl" style="color:var(--lime);font-family:var(--m);font-size:11px"></span></div>
    <div id="pc-src"></div>
    <div class="PCG" id="pcg"><div style="padding:20px;color:var(--t2);font-size:12px;text-align:center;grid-column:1/-1"><span class="spin"></span></div></div>
    <div class="pc-legend">
      <span><i class="hl free"></i>${D.lang==='en'?'free':'свободен'}</span>
      <span><i class="hl soon"></i>${D.lang==='en'?'booking soon':'скоро бронь'}</span>
      <span><i class="hl busy"></i>${D.lang==='en'?'busy · till':'занят · до'}</span>
    </div>
    <div class="pc-tip">${D.lang==='en'?'Busy PCs can be booked for later — pick the time on the next steps.':'Занятый ПК можно забронировать на потом — время выберешь дальше. Долгое нажатие — ❤️ в избранное.'}</div>
    <div class="SL" style="margin-top:18px">${_('equipment')}</div>
    <div class="CRD">${dr}${pr}</div>
    <div style="height:14px"></div>`
  addBack(w)

  // 🚀 Параллельная загрузка — Gizmo + брони одновременно
  const [,allBks]=await Promise.all([loadGizmoStatus(),loadBookings(null,null,false)])
  if(D.cur!=='book'||D.bk.step!==1||!w.isConnected)return // пока грузилось, ушли со шага

  const pcg=w.querySelector('#pcg')
  pcg.innerHTML=''
  let freeCount=0

  const src=w.querySelector('#pc-src')
  if(src)src.innerHTML=gizmoFresh()
    ?`<div class="src-badge live"><div class="LD"></div>${D.lang==='en'?'Live from the club · see when each PC frees up':'Онлайн из клуба · видно, до скольки занят каждый ПК'}</div>`
    :`<div class="src-badge">📊 ${D.lang==='en'?'By bookings':'По бронированиям'}</div>`

  const makePCBtn=(num)=>{
    const lbl=`${pre}-${String(num).padStart(2,'0')}`
    const st=pcLive(lbl,allBks)
    if(st.state!=='busy')freeCount++
    const L=liveLabel(st)
    const isFav=(D.user._favPcs||[]).includes(lbl)
    const d=document.createElement('button')
    d.type='button'
    d.className='PCB st-'+st.state+(D.bk.pc?.lbl===lbl?' sel':'')
    d.style.setProperty('--zc',z.color)
    d.setAttribute('aria-label',lbl+', '+L.main+(st.state==='busy'&&st.leftMin!==null?', '+L.sub:''))
    d.innerHTML=`<div class="pc-id">${String(num).padStart(2,'0')}</div>`+
      `<div class="pc-st">${L.main}</div>`+
      (st.state==='busy'&&st.leftMin!==null?`<div class="pc-left">${L.sub}</div>`:st.state==='soon'?`<div class="pc-left">${L.sub}</div>`:'')+
      (isFav?'<div class="pc-fav">❤️</div>':'')
    d.onclick=()=>{
      if(d._lp){d._lp=false;return} // долгое нажатие — это «в избранное», а не выбор
      D.bk.pc={lbl,id:num};D.bk.sm=null;D.bk.step=2;renderStep()
    }
    // Long press = favorite
    let _lt;d.onpointerdown=()=>{_lt=setTimeout(()=>{d._lp=true;toggleFavPc(lbl);sPCs(w,z)},600)}
    d.onpointerup=()=>{if(_lt)clearTimeout(_lt)}
    d.onpointerleave=()=>{if(_lt)clearTimeout(_lt)}
    return d
  }

  if(z.key==='std'){
    pcg.classList.add('PCG-std')
    const leftNums=[1,3,5,7,9,11,13,15]
    const rightNums=[2,4,6,8,10]
    const leftCol=document.createElement('div')
    leftCol.className='pc-col'
    leftCol.innerHTML=`<div class="pc-side">← ${D.lang==='en'?'LEFT':'ЛЕВАЯ'}</div>`
    const rightCol=document.createElement('div')
    rightCol.className='pc-col'
    rightCol.innerHTML=`<div class="pc-side">${D.lang==='en'?'RIGHT':'ПРАВАЯ'} →</div>`
    leftNums.forEach(n=>leftCol.appendChild(makePCBtn(n)))
    rightNums.forEach(n=>rightCol.appendChild(makePCBtn(n)))
    pcg.appendChild(leftCol)
    pcg.appendChild(rightCol)
  } else {
    Array.from({length:z.pcCount},(_,i)=>pcg.appendChild(makePCBtn(i+1)))
  }

  const lbl=w.querySelector('#pc-free-lbl')
  if(lbl) lbl.textContent=D.lang==='en'?`· ${freeCount} free now`:`· ${freeCount} свободно сейчас`
}

// ═══ ШАГ «ДАТА» — по календарю клуба ═══
function sDates(w,z){
  const L=I18N[D.lang]
  const today=clubNow().day
  const dates=Array.from({length:7},(_,i)=>{
    const day=today+i,d=new Date(day*86400000)
    return{v:dateOfDayNum(day),label:i===0?L.today:i===1?L.tomorrow:L.DAYS[d.getUTCDay()],n:d.getUTCDate(),m:L.MONTHS[d.getUTCMonth()]}
  })
  if(!D.bk.date||!dates.some(d=>d.v===D.bk.date.v))D.bk.date=dates[0]
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

// Абсолютные минуты начала и конца выбранной брони
function bkRange(){
  const bk=D.bk,p=bk.pkg,day=dayNumOf(bk.date.v)
  if(p.locked){
    const s=day*1440+p.tStart*60
    const e=p.tEnd<=p.tStart?day*1440+1440+p.tEnd*60:day*1440+p.tEnd*60
    return [s,e]
  }
  return [bk.sm,bk.sm+p.h*60]
}

// ═══ ШАГ «ВРЕМЯ» — поминутно ═══
async function sTime(w,z){
  const p=D.bk.pkg,h=p.h,durMin=h*60
  const isLocked=p.locked===true
  const pcLabel=D.bk.pc.lbl
  const date=D.bk.date.v
  const day=dayNumOf(date)
  const now=clubNow()
  const isToday=day===now.day
  const en=D.lang==='en'

  w.innerHTML=`<div class="SL">${_('timeLbl')}</div><div class="TB2" style="text-align:center;padding:30px"><span class="spin"></span></div>`
  const [,allBookings]=await Promise.all([gizmoFresh()?null:loadGizmoStatus(),loadBookings(null,null,false)])
  if(D.cur!=='book'||D.bk.step!==3||!w.isConnected)return

  const busy=mergeRanges(pcBusyRanges(pcLabel,allBookings))
  const live=pcLive(pcLabel,allBookings)
  const dayStart=day*1440
  const minStart=isToday?clubNow().abs:dayStart
  const maxStart=dayStart+1439
  const clampS=v=>Math.min(maxStart,Math.max(minStart,Math.round(v)))
  const blockerFor=(s,e)=>busy.find(r=>rangesOverlap(r,[s,e]))
  // Первое время ≥ from, когда пакет влезает целиком
  const firstFree=from=>{
    let t=from
    for(let g=0;g<300;g++){
      t=chainEnd(busy,t)
      const b=blockerFor(t,t+durMin)
      if(!b)return t
      t=b[1]
    }
    return t
  }

  // Стартовая позиция: прошлый выбор → иначе ближайшее свободное
  let sm
  if(isLocked) sm=dayStart+p.tStart*60
  else{
    const saved=D.bk.sm!=null&&D.bk.smDay===day?D.bk.sm:null
    sm=clampS(saved!=null?saved:firstFree(isToday?minStart:dayStart+14*60))
  }
  const endOf=s=>isLocked?bkRange()[1]:s+durMin

  // ── Живой статус ПК сегодня ──
  let liveCard=''
  if(isToday&&live.state==='busy'){
    const L=liveLabel(live)
    liveCard=`<div class="live-card busy"><span class="lc-dot"></span><div><b>${pcLabel}</b> ${live.source==='gizmo'?(en?'is in use now':'сейчас занят в клубе'):(en?'is booked now':'сейчас забронирован')}${live.untilAbs!==null?` · <b>${L.main}</b> <span class="lc-sub">(${L.sub})</span>`:''}</div></div>`
  }else if(isToday&&live.state==='soon'){
    liveCard=`<div class="live-card soon"><span class="lc-dot"></span><div><b>${pcLabel}</b> ${en?'is free till':'свободен до'} <b>${minToHM(live.nextAbs)}</b> <span class="lc-sub">(${en?'booking in ':'бронь через '}${fmtDur(live.inMin)})</span></div></div>`
  }

  // ── Занятые отрезки этого дня (список) ──
  const dayBusy=busy.filter(r=>rangesOverlap(r,[dayStart,dayStart+1440+360]))
  let occupiedHTML=''
  if(dayBusy.length){
    const shown=dayBusy.slice(0,4)
    occupiedHTML=`<div class="occ"><div class="occ-h">🔒 ${en?'Busy on':'Занято на'} ${pcLabel}</div>`+
      shown.map(r=>`<div class="occ-i"><span>${minToHM(r[0])}–${minToHM(r[1])}${Math.floor(r[1]/1440)>day?' <small>+1</small>':''}</span><span>${en?'busy':'занято'}</span></div>`).join('')+
      (dayBusy.length>4?`<div class="occ-more">${en?'and':'и ещё'} ${dayBusy.length-4}</div>`:'')+`</div>`
  }

  // ── Фиксированный пакет ──
  const timeBadge=isLocked?`
    <div class="lock-card">
      <div class="lock-ic">🔒</div>
      <div><div class="lock-k">${en?'FIXED TIME':'ФИКСИРОВАННОЕ ВРЕМЯ'}</div><div class="lock-v">${p.t}</div></div>
    </div>`:''

  const chips=isLocked?[]:(isToday
    ?[['now',_('tpNow')],['nearest',_('tpNearest')],['+15','+15 '+(en?'min':'мин')],['+30','+30 '+(en?'min':'мин')],['+60','+1 '+(en?'h':'ч')]]
    :[['nearest',_('tpNearest')],['@600','10:00'],['@840','14:00'],['@1080','18:00'],['@1260','21:00']])

  w.innerHTML=`<div class="SL">${_('timeLbl')}</div>
  ${timeBadge}
  ${liveCard}
  <div class="TB2 tp">
    <div class="tp-head">
      <label class="tp-big">
        <span class="tp-k">${_('begin')}</span>
        <span class="tp-v" id="ts-s" style="color:${z.color}">${minToHM(sm)}</span>
        ${isLocked?'':`<input type="time" step="60" id="tp-inp" aria-label="${_('tpPick')}">`}
      </label>
      <div class="tp-mid"><span class="tp-dur">${fmtDur(durMin)}</span><span class="tp-arrow">→</span></div>
      <div class="tp-big tp-end">
        <span class="tp-k">${_('end')}</span>
        <span class="tp-v" id="ts-e">${minToHM(endOf(sm))}</span>
        <span class="tp-day" id="ts-e-day"></span>
      </div>
    </div>
    ${isLocked?'':`
    <div id="tp-ruler" aria-label="${_('tpStart')}"></div>
    <div class="tp-row">
      <button type="button" class="tp-step" id="tp-m" aria-label="−1 мин">−</button>
      <div class="tp-chips">${chips.map(([k,t])=>`<button type="button" class="tp-chip" data-k="${k}">${t}</button>`).join('')}</div>
      <button type="button" class="tp-step" id="tp-p" aria-label="+1 мин">+</button>
    </div>
    <div class="tp-hint">${en?'Swipe the tape · ± — by a minute · tap the time to type it':'Листай ленту · ± — по минуте · нажми на время, чтобы ввести точно'}</div>`}
    <div id="tp-warn"></div>
    <div class="tp-pkg"><span>${_('pkgLbl')}</span><b>${en?p.nen:p.n} · <span style="color:${z.color}">${p.p} BYN</span></b></div>
    ${occupiedHTML}
  </div><div style="height:14px"></div>
  <button class="BTN" id="tc" style="background:${z.color};color:#000">${_('cont')}</button>`
  addBack(w)

  const btn=w.querySelector('#tc')
  let ruler=null

  function upd(){
    const e=endOf(sm)
    w.querySelector('#ts-s').textContent=minToHM(sm)
    w.querySelector('#ts-e').textContent=minToHM(e)
    const dEl=w.querySelector('#ts-e-day')
    if(dEl)dEl.textContent=Math.floor((e-1)/1440)>day?(en?'next day':'следующий день'):''
    const inp=w.querySelector('#tp-inp');if(inp)inp.value=minToHM(sm)
    const blk=blockerFor(sm,e)
    const warn=w.querySelector('#tp-warn')
    if(ruler){
      const segs=busy.map(r=>({from:r[0],to:r[1],cls:'busy'}))
      segs.push({from:sm,to:e,cls:'sel'+(blk?' bad':'')})
      ruler.setSegments(segs)
    }
    if(blk){
      const free=firstFree(sm)
      const isLive=live.state==='busy'&&blk[0]<=clubNow().abs
      const why=isLive
        ?(en?`${pcLabel} is in use until ${minToHM(blk[1])}`:`${pcLabel} занят в клубе до ${minToHM(blk[1])}`)
        :(en?`${pcLabel} is booked ${minToHM(blk[0])}–${minToHM(blk[1])}`:`${pcLabel} занят ${minToHM(blk[0])}–${minToHM(blk[1])}`)
      const canFix=!isLocked&&free<=maxStart
      warn.innerHTML=`<div class="tp-warn"><span>❌ ${why}</span>${canFix?`<button type="button" data-fix="${free}">${en?'From':'С'} ${minToHM(free)}</button>`:''}</div>`
      btn.disabled=true
    }else{
      warn.innerHTML=''
      btn.disabled=false
    }
    if(!isLocked){D.bk.sm=sm;D.bk.smDay=day;D.bk.sh=Math.floor((sm-dayStart)/60)}
  }

  if(!isLocked){
    ruler=new TimeRuler(w.querySelector('#tp-ruler'),{px:3,onInput:v=>{sm=v;upd()}})
    ruler.setRange(minStart,maxStart)
    ruler.set(sm)
    const set=(v,smooth=true)=>{sm=clampS(v);ruler.set(sm,smooth);upd()}
    holdRepeat(w.querySelector('#tp-m'),c=>{set(sm-(c>12?5:1),false);haptic('tick')})
    holdRepeat(w.querySelector('#tp-p'),c=>{set(sm+(c>12?5:1),false);haptic('tick')})
    w.querySelectorAll('.tp-chip').forEach(c=>c.onclick=()=>{
      const k=c.dataset.k,n=clubNow().abs
      if(k==='now')set(n)
      else if(k==='nearest')set(firstFree(isToday?n:dayStart))
      else if(k[0]==='+')set(n+parseInt(k.slice(1)))
      else if(k[0]==='@')set(dayStart+parseInt(k.slice(1)))
      haptic('light')
    })
    const inp=w.querySelector('#tp-inp')
    inp.addEventListener('click',()=>{try{inp.showPicker()}catch(e){}})
    inp.addEventListener('change',()=>{
      if(!inp.value)return
      const v=dayStart+timeToMinJS(inp.value)
      if(v<minStart){toast(en?'This time has passed':'Это время уже прошло','⏰');set(minStart);return}
      set(v)
    })
  }
  w.addEventListener('click',e=>{
    const f=e.target.closest('[data-fix]');if(!f)return
    sm=clampS(+f.dataset.fix);if(ruler)ruler.set(sm,true);upd();haptic('light')
  })
  upd()

  btn.onclick=()=>{
    if(btn.disabled){toast(en?'❌ This time is taken':'❌ Это время занято — сдвинь ленту','❌');return}
    D.bk.step=4;renderStep()
  }
}

function sConfirm(w,z){
  const bk=D.bk,p=bk.pkg,h=p.h
  const day=dayNumOf(bk.date.v)
  const [startAbs,endAbs]=bkRange()
  const bkStart=minToHM(startAbs),bkEnd=minToHM(endAbs)
  const nextDay=Math.floor((endAbs-1)/1440)>day
  const timeStr=p.locked?p.t:`${bkStart} – ${bkEnd}${nextDay?(D.lang==='en'?' (+1 day)':' (+1 день)'):''}`
  const rows=[
    [_('zone'),`${z.emoji} ${z.name}`],[_('pcLbl'),bk.pc.lbl],
    [_('pkgLbl'),`${D.lang==='en'?p.nen:p.n} (${h}h)`],
    [_('dateLbl'),bk.date.v],[_('timeLbl'),timeStr]
  ]
  const lockedWarn=p.locked?`<div class="warn-gold"><span>⚠️</span><span>Пакет действует только <b>${p.t}</b> — убедись что придёшь вовремя</span></div>`:''
  const startsIn=startAbs-clubNow().abs
  const whenHint=startsIn>0&&startsIn<36*60?`<div class="when-hint">⏱ ${D.lang==='en'?'Starts in':'До начала'} <b>${fmtDur(startsIn)}</b></div>`:''
  w.innerHTML=`<div class="SL">${_('stepSum')}</div>
  ${lockedWarn}
  <div class="CRD" style="border-color:rgba(255,255,255,.09)">
    <div class="cbar" style="background:${z.stripe}"></div>
    ${rows.map(([k,v])=>`<div class="RW"><span class="K">${k}</span><span class="V" style="font-family:var(--m);font-size:12px">${v}</span></div>`).join('')}
  </div>
  ${whenHint}
  <!-- Итоговая цена -->
  <div class="sum-card" style="background:linear-gradient(135deg,${zA(z,.12)},${zA(z,.03)});border-color:${zA(z,.25)}">
    <div><div class="sum-k">${_('totalLbl')}</div><div class="sum-s">${h} ${hoursWord(h)} игры</div></div>
    <div class="sum-v" style="color:${z.color};text-shadow:0 0 20px ${zA(z,.4)}">${p.p}<span>BYN</span></div>
  </div>
  <div style="height:14px"></div>
  <button class="BTN" id="cb" style="background:${z.color};color:#000;box-shadow:0 6px 28px ${zA(z,.27)}">${_('bookNow')}</button>`
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
      // 🔒 ФИНАЛЬНАЯ ПРОВЕРКА — свежие брони и живой статус прямо перед бронированием
      try{
        const [,freshAll]=await Promise.all([loadGizmoStatus(),loadBookings(null,null,true)])
        const blk=pcBusyRanges(bk.pc.lbl,freshAll).find(r=>rangesOverlap(r,[startAbs,endAbs]))
        if(blk){
          btn.innerHTML=_('bookNow');btn.disabled=false
          toast(`❌ ${bk.pc.lbl} занят ${minToHM(blk[0])}–${minToHM(blk[1])}`,'❌')
          btn.classList.add('shake');setTimeout(()=>btn.classList.remove('shake'),400)
          haptic('err')
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
          : `⚠️ ${checkRes.error||'Ошибка при бронировании'}`, '❌')
        btn.classList.add('shake');setTimeout(()=>btn.classList.remove('shake'),400)
        haptic('err')
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
        setTimeout(()=>toast(`+${checkRes.points.earned} баллов (${checkRes.points.tags})`,'⭐'),1000)
      } else if(checkRes.pointsMsg){
        setTimeout(()=>toast(checkRes.pointsMsg,'ℹ️'),1200)
      }
      sv()
      haptic('ok')
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
  d.innerHTML=`<button class="BTN ghost" onclick="bkBack()">${_('back')}</button>`;w.appendChild(d)
}
function bkBack(){if(D.bk&&D.bk.step>0){D.bk.step--;renderStep()}else go('home')}
