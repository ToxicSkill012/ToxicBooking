// Бронирование: формат (пакет или своё время, сколько игроков) → когда → ПК → итог.
// Сначала время, потом ПК: показываем только те компьютеры, что свободны на выбранный отрезок,
// поэтому конфликтов «уже занято» почти не бывает. Команда — та же бронь на несколько ПК рядом.

const T=(ru,en)=>D.lang==='en'?en:ru
const STEPS=()=>[T('Формат','Format'),T('Когда','When'),T('Компьютер','PC'),T('Итог','Summary')]

function openZone(key,opts={}){
  const prev=D.bk||{}
  D.bk={zone:key,mode:prev.mode==='free'?'free':'pkg',pkg:null,dur:prev.dur||120,
    team:Math.min(opts.team||1,ZONES[key].pcCount),date:null,sm:null,smDay:null,pcs:[],step:0}
  setBkHeader()
  go('book');renderStep()
}
// Бронь для команды: тот же поток, сразу на 2 игроков
function openTeam(){openZone(D.bk&&D.bk.zone||'std',{team:Math.max(2,D.bk&&D.bk.team||2)})}

function setBkHeader(){
  const z=ZONES[D.bk.zone]
  const t=document.getElementById('bk-title')
  t.textContent=`${z.emoji} ${z.name}`;t.style.color=z.color
  document.getElementById('bk-sub').textContent=`${z.pc.gpu} · ${z.devices.mon}`
}

async function renderStep(){
  const bk=D.bk,z=ZONES[bk.zone],st=STEPS()
  document.getElementById('bk-dots').innerHTML=st.map((_,i)=>`<div class="dot${i<bk.step?' done':i===bk.step?' cur':''}"></div>`).join('')
  document.getElementById('bk-sl').textContent=st[bk.step]
  const body=document.getElementById('bk-body');body.innerHTML='';body.scrollTop=0
  const w=document.createElement('div');w.className='bkw fu';body.appendChild(w)
  await [sFormat,sWhen,sPCs,sConfirm][bk.step](w,z)
}

// ── Общие расчёты ──
const durOf=()=>D.bk.pkg?D.bk.pkg.h*60:D.bk.dur
// Отрезок брони в абсолютных минутах
function bkInterval(){
  const bk=D.bk,p=bk.pkg,day=dayNumOf(bk.date)
  if(p&&p.locked){
    const s=day*1440+p.tStart*60
    return [s,(p.tEnd<=p.tStart?day*1440+1440:day*1440)+p.tEnd*60]
  }
  return [bk.sm,bk.sm+durOf()]
}
// Цена за один ПК и пояснение
function pricePerPc(){
  const bk=D.bk
  if(bk.pkg)return {price:bk.pkg.p,viaPkg:null}
  return freePrice(bk.zone,bk.dur)
}
function tariffLabel(){
  const bk=D.bk
  if(bk.pkg)return D.lang==='en'?bk.pkg.nen:bk.pkg.n
  const fp=freePrice(bk.zone,bk.dur)
  return T('Своё время ','Custom ')+fmtDur(bk.dur)+(fp.viaPkg?T(` · цена пакета «${fp.viaPkg.n}»`,` · ${fp.viaPkg.nen} price`):'')
}
// Брони и живые сессии: грузим один раз на шаг
let _bkData={ts:0,bookings:[]}
async function bkData(force=false){
  if(!force&&Date.now()-_bkData.ts<20000)return _bkData.bookings
  const [,b]=await Promise.all([gizmoFresh()&&!force?null:loadGizmoStatus(),loadBookings(null,null,force)])
  _bkData={ts:Date.now(),bookings:b}
  return b
}
// Занятость каждого ПК зоны: {lbl:[[from,to],…]}
function busyMap(zoneKey,bookings){
  const m={}
  zonePcs(zoneKey).forEach(l=>{m[l]=mergeRanges(pcBusyRanges(l,bookings))})
  return m
}
const pcBlocker=(ranges,s,e)=>ranges.find(r=>r[0]<e&&s<r[1])
const freePcsFor=(map,s,e)=>Object.keys(map).filter(l=>!pcBlocker(map[l],s,e))
const stale=(w,step)=>D.cur!=='book'||D.bk.step!==step||!w.isConnected

// ═══ ШАГ 1. ФОРМАТ: зона, игроки, пакет или своё время ═══
function sFormat(w,z){
  const bk=D.bk
  const maxTeam=Math.min(RULES.maxTeam,z.pcCount)
  w.innerHTML=`
  <div class="zt" role="tablist">${Object.values(ZONES).map(zz=>`<button type="button" role="tab" class="zt-b${zz.key===z.key?' on':''}" data-z="${zz.key}" style="--zc:${zz.color};--za:${zA(zz,.16)}"><span>${zz.emoji}</span>${zz.key==='bc'?'Bootcamp':zz.key==='vip'?'VIP':'Standard'}</button>`).join('')}</div>
  <div class="team glass${bk.team>1?' on':''}">
    <div class="team-i">👥</div>
    <div class="team-t"><b>${T('Игроков','Players')}</b><span id="tm-sub"></span></div>
    <div class="team-s">
      <button type="button" class="tp-step sm" id="tm-m" aria-label="−1">−</button>
      <b id="tm-v">${bk.team}</b>
      <button type="button" class="tp-step sm" id="tm-p" aria-label="+1">+</button>
    </div>
  </div>
  <div class="seg" role="tablist">
    <button type="button" data-m="pkg"${bk.mode==='pkg'?' class="on"':''}>📦 ${T('Пакеты','Packages')}</button>
    <button type="button" data-m="free"${bk.mode==='free'?' class="on"':''}>⏱ ${T('Своё время','Custom time')}</button>
    <i class="seg-i"></i>
  </div>
  <div id="fmt-body"></div>`
  addBack(w)

  const teamSub=()=>{
    w.querySelector('#tm-v').textContent=bk.team
    w.querySelector('#tm-sub').textContent=bk.team>1
      ?T(`Бронь для команды · ${bk.team} ПК рядом`,`Team booking · ${bk.team} PCs together`)
      :T('Один компьютер','One PC')
    w.querySelector('.team').classList.toggle('on',bk.team>1)
    w.querySelector('#tm-m').disabled=bk.team<=1
    w.querySelector('#tm-p').disabled=bk.team>=maxTeam
  }
  holdRepeat(w.querySelector('#tm-m'),()=>{if(bk.team>1){bk.team--;haptic('tick');teamSub();body()}})
  holdRepeat(w.querySelector('#tm-p'),()=>{if(bk.team<maxTeam){bk.team++;haptic('tick');teamSub();body()}else haptic('warn')})
  w.querySelectorAll('.zt-b').forEach(b=>b.onclick=()=>{
    if(b.dataset.z===bk.zone)return
    bk.zone=b.dataset.z;bk.pkg=null;bk.pcs=[]
    bk.team=Math.min(bk.team,ZONES[bk.zone].pcCount)
    haptic('light');setBkHeader();renderStep()
  })
  w.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{
    if(bk.mode===b.dataset.m)return
    bk.mode=b.dataset.m
    w.querySelectorAll('.seg button').forEach(x=>x.classList.toggle('on',x===b))
    haptic('light');body()
  })
  teamSub();body()

  function body(){
    const el=w.querySelector('#fmt-body')
    if(bk.mode==='pkg')pkgGrid(el)
    else freeCard(el)
  }
  function pkgGrid(el){
    const h=Math.floor(clubNow().min/60)
    const hint=h>=8&&h<11?['☀️ '+T('Утренний пакет идёт сейчас','Morning package is on now'),'var(--gold)']
      :h>=11&&h<17?['🌤 '+T('Дневной пакет идёт сейчас','Day package is on now'),'var(--cyan)']
      :h>=17&&h<22?['🌙 '+T('Ночной пакет — с 22:00','Night package from 22:00'),'var(--blue)']
      :['🌙 '+T('Ночной пакет идёт сейчас','Night package is on now'),'var(--blue)']
    el.innerHTML=`<div class="hint-pill" style="color:${hint[1]}">${hint[0]}</div><div class="PG">${z.pkgs.map(p=>{
      const now=pkgIsNow(p)
      const tl=p.locked?(now?`<span class="pk-now">● ${T('сейчас','now')}</span> ${p.t}`:'⏰ '+p.t):(D.lang==='en'?p.te:p.t)
      return `<button type="button" class="PK${bk.pkg?.id===p.id?' sel':''}" data-p="${p.id}">
        <div class="pk-n">${D.lang==='en'?p.nen:p.n}</div>
        <div class="pk-t"${p.locked&&!now?' style="color:var(--gold)"':''}>${tl}</div>
        <div class="pk-p" style="color:${z.color}">${p.p}<span class="pk-b"> BYN</span></div>
        ${bk.team>1?`<div class="pk-x">×${bk.team} = ${p.p*bk.team} BYN</div>`:''}
      </button>`}).join('')}</div>
      <button type="button" class="pk-free" data-goto="free">⏱ ${T('Нужно другое время? Своё время — от 30 минут','Need another length? Custom time — from 30 min')} →</button>`
    el.querySelectorAll('.PK').forEach(b=>b.onclick=()=>{
      bk.pkg=z.pkgs.find(p=>p.id===b.dataset.p);bk.sm=null;bk.step=1;haptic('light');renderStep()
    })
    el.querySelector('[data-goto]').onclick=()=>w.querySelector('.seg [data-m="free"]').click()
  }
  function freeCard(el){
    const chips=[60,120,180,240,360,480]
    el.innerHTML=`<div class="dur glass">
      <div class="dur-top">
        <div><div class="dur-k">${T('ДЛИТЕЛЬНОСТЬ','DURATION')}</div><div class="dur-v" id="dur-v"></div></div>
        <div class="dur-p"><b id="dur-p" style="color:${z.color}"></b><span>BYN</span><small id="dur-x"></small></div>
      </div>
      <div id="dur-sl"></div>
      <div class="dur-chips">${chips.map(m=>`<button type="button" class="tp-chip" data-d="${m}">${m/60} ${T('ч','h')}</button>`).join('')}</div>
      <div id="dur-hint"></div>
      <div class="dur-note">${T(`${z.hour} BYN/час · оплата за каждые начатые 30 мин · от 30 мин до 12 ч`,`${z.hour} BYN/hour · billed per started 30 min · 30 min to 12 h`)}</div>
    </div>
    <button type="button" class="BTN" id="fmt-go" style="background:${z.color};color:#000">${T('Выбрать время','Pick the time')} →</button>`
    const sl=new DurSlider(el.querySelector('#dur-sl'),{min:RULES.freeMin,max:RULES.freeMax,step:RULES.freeStep,value:bk.dur,color:z.color,onInput:v=>{bk.dur=v;upd()}})
    el.querySelectorAll('[data-d]').forEach(c=>c.onclick=()=>{bk.dur=+c.dataset.d;sl.set(bk.dur);haptic('light');upd()})
    el.querySelector('#fmt-go').onclick=()=>{bk.pkg=null;bk.sm=null;bk.step=1;renderStep()}
    function upd(){
      const fp=freePrice(bk.zone,bk.dur)
      el.querySelector('#dur-v').textContent=fmtDur(bk.dur)
      el.querySelector('#dur-p').textContent=bk.team>1?fp.price*bk.team:fp.price
      el.querySelector('#dur-x').textContent=bk.team>1?`${fp.price} × ${bk.team} ${T('ПК','PCs')}`:T('за ПК','per PC')
      el.querySelectorAll('[data-d]').forEach(c=>c.classList.toggle('on',+c.dataset.d===bk.dur))
      // Подсказка, если пакет выгоднее: столько же денег — больше времени
      const better=z.pkgs.filter(p=>!p.locked&&p.h*60>bk.dur&&p.p<=fp.price).sort((a,b)=>b.h-a.h)[0]
      const hint=el.querySelector('#dur-hint')
      if(better){
        hint.innerHTML=`<div class="best"><span>💡 ${fp.viaPkg?T('Считаем по цене пакета','Charged at the package price')+` «${D.lang==='en'?fp.viaPkg.nen:fp.viaPkg.n}». `:''}${T(`За ${better.p} BYN можно играть ${better.h} ч`,`For ${better.p} BYN you can play ${better.h} h`)}</span><button type="button" data-best="${better.id}">${T('Взять','Take')} ${D.lang==='en'?better.nen:better.n}</button></div>`
        hint.querySelector('[data-best]').onclick=()=>{bk.pkg=better;bk.mode='pkg';bk.sm=null;bk.step=1;haptic('light');renderStep()}
      }else hint.innerHTML=''
    }
    upd()
  }
}
// Пакет с окном идёт прямо сейчас (по времени клуба)
function pkgIsNow(p){
  if(!p.locked)return true
  const h=Math.floor(clubNow().min/60)
  return p.tEnd>p.tStart?h>=p.tStart&&h<p.tEnd:h>=p.tStart||h<p.tEnd
}

// ═══ ШАГ 2. КОГДА: день и время с точностью до минуты ═══
async function sWhen(w,z){
  const bk=D.bk,L=I18N[D.lang],today=clubNow().day
  const days=Array.from({length:RULES.days},(_,i)=>{
    const d=new Date((today+i)*86400000)
    return {v:dateOfDayNum(today+i),label:i===0?L.today:i===1?L.tomorrow:L.DAYS[d.getUTCDay()],n:d.getUTCDate(),m:L.MONTHS[d.getUTCMonth()]}
  })
  if(!bk.date||!days.some(d=>d.v===bk.date))bk.date=days[0].v
  w.innerHTML=`<div class="DCH" id="dch">${days.map(d=>`<button type="button" class="DC${bk.date===d.v?' sel':''}" data-v="${d.v}"><div class="dc-d">${d.label}</div><div class="dc-n">${d.n}</div><div class="dc-m">${d.m}</div></button>`).join('')}</div>
  <div id="when"><div class="TB2 tp-load"><span class="spin"></span></div></div>`
  addBack(w)
  w.querySelectorAll('.DC').forEach(el=>el.onclick=()=>{
    if(bk.date===el.dataset.v)return
    w.querySelectorAll('.DC').forEach(x=>x.classList.toggle('sel',x===el))
    bk.date=el.dataset.v;haptic('light');draw()
  })
  const bookings=await bkData()
  if(stale(w,1))return
  const map=busyMap(bk.zone,bookings)
  draw()

  function draw(){
    const box=w.querySelector('#when'),en=D.lang==='en'
    const dur=durOf(),need=bk.team,pcs=zonePcs(bk.zone),N=pcs.length
    const day=dayNumOf(bk.date),dayStart=day*1440,now=clubNow(),isToday=day===now.day
    const freeAt=s=>freePcsFor(map,s,s+dur).length
    const p=bk.pkg

    // Пакет с фиксированным окном: время задано, проверяем день
    if(p&&p.locked){
      bk.sm=null
      const [s,e]=bkInterval(),f=freeAt(s)
      const over=isToday&&e-30<=now.abs
      const ok=!over&&f>=need
      box.innerHTML=`<div class="lock-card">
        <div class="lock-ic">🔒</div>
        <div><div class="lock-k">${T('ВРЕМЯ ПАКЕТА','PACKAGE TIME')} · ${en?p.nen:p.n}</div><div class="lock-v">${minToHM(s)} – ${minToHM(e)}${Math.floor((e-1)/1440)>day?` <small>${T('до утра','overnight')}</small>`:''}</div></div>
      </div>
      <div class="avail ${over?'bad':ok?'ok':'bad'}">${over
        ?`⏰ ${T('Сегодня этот пакет уже закончился — выбери другой день','This package is over for today — pick another day')}`
        :f>=need?`<span class="av-dot"></span>${T(`Свободно ${f} из ${N} ПК`,`${f} of ${N} PCs free`)}${isToday&&s<now.abs?T(' · пакет уже идёт, приходи сейчас',' · already on, come now'):''}`
        :`❌ ${T(`Свободно ${f} из ${N} — нужно ${need}`,`${f} of ${N} free — need ${need}`)}`}</div>
      <button type="button" class="BTN" id="tc" style="background:${z.color};color:#000"${ok?'':' disabled'}>${T('Выбрать ПК','Pick PCs')} →</button>`
      box.querySelector('#tc').onclick=()=>{bk.step=2;renderStep()}
      return
    }

    const minStart=isToday?now.abs:dayStart,maxStart=dayStart+1439
    // Ближайшее время ≥ from, когда свободно нужное число ПК (свободных становится больше только в концы броней)
    const firstOk=from=>{
      const cand=[from]
      Object.values(map).forEach(rs=>rs.forEach(r=>{if(r[1]>from&&r[1]<=maxStart)cand.push(r[1])}))
      cand.sort((a,b)=>a-b)
      return cand.find(t=>freeAt(t)>=need)??null
    }
    let sm=bk.sm!=null&&bk.smDay===day&&bk.sm>=minStart?bk.sm
      :(firstOk(isToday?minStart:Math.max(minStart,dayStart+18*60))??firstOk(minStart)??minStart)
    sm=Math.min(maxStart,Math.max(minStart,sm))

    const chips=isToday
      ?[['now',T('Сейчас','Now')],['near','⚡ '+T('Ближайшее','Nearest')],['+30','+30 '+T('мин','min')],['+60','+1 '+T('ч','h')],['@1080','18:00']]
      :[['near','⚡ '+T('Ближайшее','Nearest')],['@600','10:00'],['@840','14:00'],['@1080','18:00'],['@1260','21:00']]
    box.innerHTML=`<div class="TB2 tp" style="--zc:${z.color}">
      <div class="tp-head">
        <label class="tp-big">
          <span class="tp-k">${T('НАЧАЛО','START')}</span>
          <span class="tp-v" id="ts-s" style="color:${z.color}"></span>
          <input type="time" step="60" id="tp-inp" aria-label="${T('Ввести время','Type the time')}">
        </label>
        <div class="tp-mid"><span class="tp-dur">${fmtDur(dur)}</span><span class="tp-arrow">→</span></div>
        <div class="tp-big tp-end">
          <span class="tp-k">${T('КОНЕЦ','END')}</span>
          <span class="tp-v" id="ts-e"></span>
          <span class="tp-day" id="ts-d"></span>
        </div>
      </div>
      <div id="tp-tape"></div>
      <div class="tp-row">
        <button type="button" class="tp-step" id="tp-m" aria-label="−1 ${T('мин','min')}">−</button>
        <div class="tp-chips">${chips.map(([k,t])=>`<button type="button" class="tp-chip" data-k="${k}">${t}</button>`).join('')}</div>
        <button type="button" class="tp-step" id="tp-p" aria-label="+1 ${T('мин','min')}">+</button>
      </div>
      <div class="avail" id="avail"></div>
      <div class="tp-legend"><span><i class="lg sel" style="background:${z.color}"></i>${T('твоё время','your time')}</span><span><i class="lg few"></i>${T('мало ПК','few PCs')}</span><span><i class="lg full"></i>${need>1?T(`нет ${need} ПК`,`no ${need} PCs`):T('всё занято','all busy')}</span></div>
      <div class="tp-hint">${T('Листай ленту или нажми на неё · ± — по минуте · нажми на время, чтобы ввести','Swipe or tap the tape · ± by a minute · tap the time to type it')}</div>
    </div>
    <button type="button" class="BTN" id="tc" style="background:${z.color};color:#000">${need>1?T(`Выбрать ${need} ПК`,`Pick ${need} PCs`):T('Выбрать ПК','Pick a PC')} →</button>`

    const tape=new TimeTape(box.querySelector('#tp-tape'),{px:3,onInput:v=>{sm=v;upd()},onSettle:()=>{}})
    tape.setRange(minStart,maxStart)
    // Подсветка ленты: где не хватает свободных ПК (по старту каждые 5 мин)
    const segs=[]
    for(let t=minStart-(minStart%5);t<=maxStart;t+=5){
      const f=freeAt(Math.max(t,minStart))
      const cls=f<need?'full':(N>need+1&&f-need<=1)?'few':''
      const last=segs[segs.length-1]
      if(last&&last.cls===cls&&last.to===t)last.to=t+5
      else if(cls)segs.push({from:t,to:t+5,cls})
    }
    tape.setSegments(segs)
    if(isToday)tape.setNow(now.abs)
    tape.set(sm)
    const btn=box.querySelector('#tc'),inp=box.querySelector('#tp-inp')
    const set=(v,anim=true)=>{sm=Math.min(maxStart,Math.max(minStart,Math.round(v)));tape.set(sm,anim);upd()}
    holdRepeat(box.querySelector('#tp-m'),c=>{set(sm-(c>12?5:1),false);haptic('tick')})
    holdRepeat(box.querySelector('#tp-p'),c=>{set(sm+(c>12?5:1),false);haptic('tick')})
    box.querySelectorAll('.tp-chip').forEach(c=>c.onclick=()=>{
      const k=c.dataset.k,n=clubNow().abs
      if(k==='now')set(n)
      else if(k==='near'){const t=firstOk(isToday?n:dayStart);if(t!=null)set(t);else toast(T('В этот день свободного времени нет','No free time this day'),'⏰')}
      else if(k[0]==='+')set(n+parseInt(k.slice(1)))
      else if(k[0]==='@'){const t=dayStart+parseInt(k.slice(1));if(t<minStart)toast(T('Это время уже прошло','This time has passed'),'⏰');set(t)}
      haptic('light')
    })
    inp.addEventListener('click',()=>{try{inp.showPicker()}catch(e){}})
    inp.addEventListener('change',()=>{
      if(!inp.value)return
      const v=dayStart+timeToMinJS(inp.value)
      if(v<minStart)toast(T('Это время уже прошло','This time has passed'),'⏰')
      set(v)
    })
    box.addEventListener('click',e=>{const f=e.target.closest('[data-fix]');if(f){set(+f.dataset.fix);haptic('light')}})

    function upd(){
      const e=sm+dur,f=freeAt(sm),ok=f>=need
      box.querySelector('#ts-s').textContent=minToHM(sm)
      box.querySelector('#ts-e').textContent=minToHM(e)
      box.querySelector('#ts-d').textContent=Math.floor((e-1)/1440)>day?T('след. день','next day'):''
      inp.value=minToHM(sm)
      tape.setSelection(sm,e,!ok)
      const av=box.querySelector('#avail')
      if(ok){
        av.className='avail ok'
        av.innerHTML=`<span class="av-dot"></span>${T(`Свободно ${f} из ${N} ПК`,`${f} of ${N} PCs free`)} · ${minToHM(sm)}–${minToHM(e)}${need>1?T(` · нужно ${need}`,` · need ${need}`):''}`
      }else{
        const fix=firstOk(sm)
        av.className='avail bad'
        av.innerHTML=`<span>❌ ${f?T(`Свободно только ${f} из ${N} — нужно ${need}`,`Only ${f} of ${N} free — need ${need}`):T('На это время всё занято','Everything is busy at this time')}${fix==null?T(' · в этот день позже не освободится — выбери другой день',' · nothing later this day — pick another day'):''}</span>${fix!=null?`<button type="button" data-fix="${fix}">${T('С','From')} ${minToHM(fix)}</button>`:''}`
      }
      btn.disabled=!ok
      bk.sm=sm;bk.smDay=day
    }
    upd()
    btn.onclick=()=>{
      if(btn.disabled){toast(T('На это время не хватает ПК — сдвинь ленту','Not enough PCs — move the tape'),'❌');haptic('err');return}
      bk.step=2;renderStep()
    }
  }
}

// ═══ ШАГ 3. ПК: свободные на выбранное время, для команды — несколько рядом ═══
async function sPCs(w,z){
  const bk=D.bk,en=D.lang==='en'
  w.innerHTML=`<div class="TB2 tp-load"><span class="spin"></span></div>`
  const bookings=await bkData()
  if(stale(w,2))return
  const [s,e]=bkInterval(),need=bk.team
  const map=busyMap(bk.zone,bookings),free=freePcsFor(map,s,e)
  bk.pcs=bk.pcs.filter(l=>free.includes(l)).slice(0,need)
  const favs=D.user._favPcs||[]
  const day=dayNumOf(bk.date)
  const dayTxt=day===clubNow().day?T('сегодня','today'):day===clubNow().day+1?T('завтра','tomorrow'):bk.date.slice(0,5)

  w.innerHTML=`<div class="pc-head">
      <div><div class="pch-k">${dayTxt} · ${tariffLabel()}</div><div class="pch-v">${minToHM(s)} – ${minToHM(e)}</div></div>
      <div class="pch-f"><b style="color:${z.color}">${free.length}</b><span>${T('свободно','free')}</span></div>
    </div>
    ${need>1?`<div class="pick-bar"><span id="pick-n"></span><button type="button" class="tp-chip" id="pick-auto">✨ ${T('Подобрать рядом','Seat us together')}</button></div>`:''}
    <div class="PCG${z.layout.length>1?' PCG-cols':''}" id="pcg">${z.layout.map((col,ci)=>`<div class="pc-col">${z.sides?`<div class="pc-side">${en?(ci?'RIGHT ROW →':'← LEFT ROW'):z.sides[ci]}</div>`:''}${col.map(n=>pcBtn(pcLbl(bk.zone,n),n)).join('')}</div>`).join('')}</div>
    <div class="pc-legend"><span><i class="hl free"></i>${T('свободен','free')}</span><span><i class="hl sel" style="background:${z.color}"></i>${T('выбран','picked')}</span><span><i class="hl busy"></i>${T('занят в это время','busy at this time')}</span></div>
    <div class="pc-tip">${need>1?T('Нажми на ПК, чтобы выбрать или убрать. Долгое нажатие — ❤️ в избранное.','Tap to pick or unpick. Long press — ❤️ favourite.'):T('Нажми на свободный ПК. Долгое нажатие — ❤️ в избранное.','Tap a free PC. Long press — ❤️ favourite.')}</div>
    ${need>1?`<button type="button" class="BTN sticky-go" id="pc-go" style="background:${z.color};color:#000"></button>`:''}
    <details class="eq CRD"><summary>${_('equipment')}</summary>${eqRows(z)}</details>`
  addBack(w)

  function pcBtn(lbl,n){
    const blk=pcBlocker(map[lbl],s,e),sel=bk.pcs.includes(lbl)
    let sub=''
    if(blk){
      const nowAbs=clubNow().abs,live=blk[0]<=nowAbs
      sub=live?T(`занят до ${fmtAbs(blk[1])}`,`busy till ${fmtAbs(blk[1])}`):T(`бронь ${minToHM(blk[0])}–${minToHM(blk[1])}`,`booked ${minToHM(blk[0])}–${minToHM(blk[1])}`)
    }else{
      const next=map[lbl].find(r=>r[0]>=e)
      sub=next&&next[0]-e<=180?T(`свободен до ${minToHM(next[0])}`,`free till ${minToHM(next[0])}`):T('свободен','free')
    }
    return `<button type="button" class="PCB ${blk?'st-busy':'st-free'}${sel?' sel':''}" data-pc="${lbl}" style="--zc:${z.color}" aria-pressed="${sel}">
      <div class="pc-id">${String(n).padStart(2,'0')}</div><div class="pc-st">${sub}</div>
      ${favs.includes(lbl)?'<div class="pc-fav">❤️</div>':''}<div class="pc-ok">✓</div></button>`
  }
  const refresh=()=>{
    w.querySelectorAll('.PCB').forEach(b=>{const on=bk.pcs.includes(b.dataset.pc);b.classList.toggle('sel',on);b.setAttribute('aria-pressed',on)})
    if(need>1){
      w.querySelector('#pick-n').innerHTML=T(`Выбрано <b>${bk.pcs.length}</b> из ${need}`,`Picked <b>${bk.pcs.length}</b> of ${need}`)
      const go=w.querySelector('#pc-go')
      go.disabled=bk.pcs.length!==need
      go.textContent=bk.pcs.length===need?T('Дальше','Next')+' →':T(`Выбери ещё ${need-bk.pcs.length}`,`Pick ${need-bk.pcs.length} more`)
    }
  }
  w.querySelectorAll('.PCB').forEach(b=>{
    const lbl=b.dataset.pc
    let lt=null
    b.addEventListener('pointerdown',()=>{lt=setTimeout(()=>{b._lp=true;lt=null;toggleFavPc(lbl);haptic('light');renderStep()},600)})
    ;['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>{if(lt){clearTimeout(lt);lt=null}}))
    b.onclick=()=>{
      if(b._lp){b._lp=false;return}
      if(b.classList.contains('st-busy')){toast(`${lbl}: ${b.querySelector('.pc-st').textContent}`,'🔒');haptic('warn');return}
      if(need===1){bk.pcs=[lbl];refresh();haptic('light');setTimeout(()=>{if(!stale(w,2)){bk.step=3;renderStep()}},170);return}
      const i=bk.pcs.indexOf(lbl)
      if(i>=0)bk.pcs.splice(i,1)
      else if(bk.pcs.length<need)bk.pcs.push(lbl)
      else{toast(T(`Уже выбрано ${need} — сними лишний`,`${need} already picked — unpick one`),'👥');haptic('warn');return}
      haptic('tick');refresh()
    }
  })
  if(need>1){
    w.querySelector('#pick-auto').onclick=()=>{
      const pick=seatTogether(z,free,need,favs)
      if(!pick){toast(T(`Свободно только ${free.length} ПК`,`Only ${free.length} PCs free`),'⚠️');return}
      bk.pcs=pick;haptic('ok');refresh()
    }
    w.querySelector('#pc-go').onclick=()=>{if(bk.pcs.length===need){bk.step=3;renderStep()}}
    if(!bk.pcs.length){const pick=seatTogether(z,free,need,favs);if(pick)bk.pcs=pick}
  }
  refresh()
}
// Подобрать N свободных ПК рядом: сначала подряд в одном ряду (с избранными — выше), иначе ближайшие по порядку
function seatTogether(z,free,need,favs){
  if(free.length<need)return null
  let best=null,bestScore=-1
  z.layout.forEach((col,ci)=>{
    const lbls=col.map(n=>pcLbl(z.key,n))
    for(let i=0;i+need<=lbls.length;i++){
      const win=lbls.slice(i,i+need)
      if(!win.every(l=>free.includes(l)))continue
      const score=1000-ci*100-i+win.filter(l=>favs.includes(l)).length*50
      if(score>bestScore){bestScore=score;best=win}
    }
  })
  if(best)return best
  return zonePcs(z.key).filter(l=>free.includes(l)).slice(0,need)
}
function eqRows(z){
  const r=(k,v)=>`<div class="RW"><span class="K">${k}</span><span class="V">${v}</span></div>`
  return r(T('🎮 Видеокарта','🎮 GPU'),z.pc.gpu)+r(T('⚙️ Процессор','⚙️ CPU'),z.pc.cpu)+r('💾 RAM',z.pc.ram)+
    r(T('🖥️ Монитор','🖥️ Monitor'),z.devices.mon)+r(T('🎧 Наушники','🎧 Headset'),z.devices.h)+r(T('🖱️ Мышь','🖱️ Mouse'),z.devices.m)+r(T('⌨️ Клавиатура','⌨️ Keyboard'),z.devices.k)
}

// ═══ ШАГ 4. ИТОГ: проверка, контакты, бронь ═══
function sConfirm(w,z){
  const bk=D.bk,[s,e]=bkInterval(),n=bk.pcs.length,day=dayNumOf(bk.date)
  const {price}=pricePerPc(),total=price*n
  const L=I18N[D.lang],dd=new Date(day*86400000)
  const nextDay=Math.floor((e-1)/1440)>day
  const rows=[
    [_('zone'),`${z.emoji} ${z.name}`],
    [n>1?T('Компьютеры','PCs'):T('Компьютер','PC'),bk.pcs.join(', ')],
    [T('Дата','Date'),`${bk.date} · ${L.DAYS[dd.getUTCDay()]}`],
    [T('Время','Time'),`${minToHM(s)} – ${minToHM(e)}${nextDay?T(' (+1 день)',' (+1 day)'):''}`],
    [T('Тариф','Rate'),tariffLabel()]
  ]
  if(n>1)rows.splice(2,0,[T('Игроков','Players'),String(n)])
  const startsIn=s-clubNow().abs
  w.innerHTML=`<div class="CRD sum-rows"><div class="cbar" style="background:${z.stripe}"></div>
    ${rows.map(([k,v])=>`<div class="RW"><span class="K">${k}</span><span class="V">${v}</span></div>`).join('')}</div>
    ${startsIn>0&&startsIn<36*60?`<div class="when-hint">⏱ ${T('До начала','Starts in')} <b>${fmtDur(startsIn)}</b></div>`:startsIn<=0?`<div class="when-hint">🟢 ${T('Время уже идёт — приходи сейчас','Already on — come now')}</div>`:''}
    <div class="who glass">
      <div class="who-h">${T('Кто бронирует','Who is booking')}</div>
      <label class="fld"><span>${T('Имя','Name')}</span><input class="INP" id="cf-name" maxlength="40" autocomplete="name" value="${String(D.user.name||'').replace(/"/g,'')}"></label>
      <label class="fld"><span>${T('Телефон','Phone')}</span><input class="INP" id="cf-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+375 29 123-45-67" value="${D.user.phone||''}"></label>
      <div class="fld-err" id="cf-err"></div>
    </div>
    <div class="sum-card" style="background:linear-gradient(135deg,${zA(z,.12)},${zA(z,.03)});border-color:${zA(z,.25)}">
      <div><div class="sum-k">${T('К оплате в клубе','Pay at the club')}</div><div class="sum-s">${n>1?`${price} BYN × ${n} ${T('ПК','PCs')} · `:''}${fmtDur(e-s)}</div></div>
      <div class="sum-v" style="color:${z.color};text-shadow:0 0 20px ${zA(z,.4)}">${total}<span>BYN</span></div>
    </div>
    <button type="button" class="BTN" id="cb" style="background:${z.color};color:#000;box-shadow:0 6px 28px ${zA(z,.27)}">${n>1?T(`Забронировать ${n} ПК`,`Book ${n} PCs`):_('bookNow')}</button>`
  addBack(w)

  const nameEl=w.querySelector('#cf-name'),phEl=w.querySelector('#cf-phone'),err=w.querySelector('#cf-err')
  phEl.addEventListener('input',()=>{phEl.value=maskPhone(phEl.value)})
  phEl.addEventListener('focus',()=>{if(!phEl.value)phEl.value='+375 '})
  const btn=w.querySelector('#cb')
  btn.onclick=async()=>{
    const name=nameEl.value.trim(),digits=phEl.value.replace(/\D/g,'')
    const bad=name.length<2?T('Укажи имя — хотя бы 2 буквы','Enter your name'):(digits.length!==12||!digits.startsWith('375'))?T('Телефон в формате +375 XX XXX-XX-XX','Phone as +375 XX XXX-XX-XX'):''
    err.textContent=bad
    if(bad){haptic('err');(name.length<2?nameEl:phEl).focus();return}
    D.user.name=name;D.user.phone=maskPhone(digits);sv()
    btn.innerHTML='<span class="spin"></span>';btn.disabled=true
    const fail=msg=>{btn.textContent=n>1?T(`Забронировать ${n} ПК`,`Book ${n} PCs`):_('bookNow');btn.disabled=false;toast(msg,'❌');btn.classList.add('shake');setTimeout(()=>btn.classList.remove('shake'),400);haptic('err')}
    // Свежая проверка прямо перед бронью: вдруг кто-то успел раньше
    try{
      const fresh=busyMap(bk.zone,await bkData(true))
      const taken=bk.pcs.filter(l=>pcBlocker(fresh[l],s,e))
      if(taken.length){
        bk.pcs=bk.pcs.filter(l=>!taken.includes(l))
        fail(T(`Только что заняли: ${taken.join(', ')} — выбери другой`,`Just taken: ${taken.join(', ')}`))
        setTimeout(()=>{bk.step=2;renderStep()},900)
        return
      }
    }catch(e){}
    const p=bk.pkg
    // price — только для старого бэкенда; новый считает цену сам
    const base={user:name,phone:D.user.phone,zone:bk.zone,date:bk.date,start:minToHM(s),end:minToHM(e),
      pkgId:p?p.id:'',pkg:p?p.n:'',price,tgId:D.user._tgId||'',isTg:!!window.Telegram?.WebApp?.initDataUnsafe?.user}
    const res=await checkAndBook({...base,pc:bk.pcs[0],...(n>1?{pcs:bk.pcs.join(',')}:{})})
    if(res.ok&&n>1&&!res.ids){
      // Старый бэкенд (v6) не умеет бронь для команды — бронируем остальные ПК по одному
      const ids=[res.id]
      for(const pc of bk.pcs.slice(1)){const r=await checkAndBook({...base,pc,silent:1});if(r.ok)ids.push(r.id)}
      res.ids=ids;res.total=price*ids.length
    }
    if(!res.ok){
      if(res.busy&&res.busy.length){bk.pcs=bk.pcs.filter(l=>!res.busy.includes(l));_bkData.ts=0;setTimeout(()=>{bk.step=2;renderStep()},900)}
      return fail(res.error||T('Не удалось забронировать','Booking failed'))
    }
    const paid=res.total!=null?res.total:total
    const nb={id:res.id,ids:res.ids||[res.id],grp:res.group||'',zone:bk.zone,pc:bk.pcs.join(', '),pcs:[...bk.pcs],team:n,
      pkg:res.pkg||tariffLabel(),date:bk.date,start:minToHM(s),end:minToHM(e),h:Math.round((e-s)/6)/10,price:paid,status:'active'}
    D.user.bks.unshift(nb);D.user.hrs=Math.round(((D.user.hrs||0)+(e-s)/60)*10)/10
    if(res.points&&res.points.earned>0){
      D.user.pts=res.points.balance
      setTimeout(()=>toast(`+${res.points.earned} ${T('баллов','points')} (${res.points.tags})`,'⭐'),1000)
    }else if(res.pointsMsg)setTimeout(()=>toast(res.pointsMsg,'ℹ️'),1200)
    sv();_bkData.ts=0
    haptic('ok')
    const sumRows=rows.concat([[T('Сумма','Total'),`${paid} BYN`]])
    document.getElementById('ok-card').innerHTML=`<div class="cbar" style="background:${z.stripe}"></div>${sumRows.map(([k,v])=>`<div class="RW"><span class="K">${k}</span><span class="V">${v}</span></div>`).join('')}`
    const wishes=n>1?['GG, команда! 🏆','Врывайтесь вместе! ⚡','Удачи в катках! 🎮']:['Приятной игры! 🎯','Удачи в матчах! 🏆','Врывайся! ⚡','GG WP! 🎮','Фраги обеспечены! 💀','Удачи, боец! 🔥']
    const wEl=document.getElementById('ok-wish');if(wEl)wEl.textContent=wishes[Math.floor(Math.random()*wishes.length)]
    go('ok')
    launchConfetti()
  }
}
// +375 29 123-45-67 по мере ввода
function maskPhone(v){
  let d=String(v||'').replace(/\D/g,'')
  if(d&&!d.startsWith('375'))d=('375'+d.replace(/^80?/,'')).slice(0,12)
  d=d.slice(0,12)
  const p=[d.slice(0,3),d.slice(3,5),d.slice(5,8),d.slice(8,10),d.slice(10,12)]
  let out=p[0]?'+'+p[0]:''
  if(p[1])out+=' '+p[1]
  if(p[2])out+=' '+p[2]
  if(p[3])out+='-'+p[3]
  if(p[4])out+='-'+p[4]
  return out
}

let _contactCallback = null
function showContactModal(cb){
  _contactCallback = cb
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
  if(phone){
    const digits=phone.replace(/\D/g,'')
    if(!digits.startsWith('375')||digits.length!==12){
      toast(L==='en'?'Phone must be +375 XX XXX-XX-XX':L==='zh'?'电话必须是+375格式':'Формат: +375 XX XXX-XX-XX','⚠️');return
    }
    D.user.phone = maskPhone(digits)
  }
  if(tg) D.user.handle = tg.replace('@','').replace(/[^a-zA-Z0-9_]/g,'').substring(0,32)
  sv()
  closeM('contact-m')
  toast(L==='en'?'Contact saved':L==='zh'?'联系方式已保存':'Контакт сохранён ✓','✅')
  if(_contactCallback) setTimeout(_contactCallback, 300)
}

function addBack(w){
  const d=document.createElement('div');d.className='bk-back'
  d.innerHTML=`<button type="button" class="BTN ghost" onclick="bkBack()">${_('back')}</button>`;w.appendChild(d)
}
function bkBack(){if(D.bk&&D.bk.step>0){D.bk.step--;renderStep()}else go('home')}
