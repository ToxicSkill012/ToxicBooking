// Админ: оффлайн-брони

// ═══ АДМИН: ОФФЛАЙН-БРОНЬ ═══
// Клиент пришёл или позвонил. Те же детали, что у клиента: лента времени до минуты, ползунок длительности,
// ПК с живой занятостью. Несколько ПК — одной бронью. Цену считает сервер (своё время или пакет).
let AB=null
async function openAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  const now=clubNow()
  AB={zone:AB?AB.zone:'std',mode:'free',pkg:null,day:now.day,sm:null,dur:60,pcs:[],bookings:[],name:'',phone:''}
  const mod=document.querySelector('#admin-book-m .MOD')
  mod.classList.add('ab-mod')
  mod.innerHTML=`<div class="MH"></div>
    <div class="ab-hd"><div class="ab-ic">📞</div><div><div class="ab-t">Оффлайн-бронь</div><div class="ab-s">Клиент пришёл или позвонил · цена по тарифу клуба</div></div>
      <button type="button" class="ab-x" onclick="closeM('admin-book-m')" aria-label="Закрыть">✕</button></div>
    <div id="ab-body"><div class="TB2 tp-load"><span class="spin"></span></div></div>`
  openM('admin-book-m')
  try{
    const [,b]=await Promise.all([liveKnown()?null:loadGizmoStatus(),loadBookings(null,null,true)])
    AB.bookings=b||[]
  }catch(e){AB.bookings=[]}
  abRender()
}

// Отрезок брони в абсолютных минутах
function abInterval(){
  const p=AB.pkg
  if(p&&p.locked){const s=AB.day*1440+p.tStart*60;return [s,(p.tEnd<=p.tStart?AB.day*1440+1440:AB.day*1440)+p.tEnd*60]}
  return [AB.sm,AB.sm+(p?p.h*60:AB.dur)]
}
function abPrice(){return AB.pkg?AB.pkg.p:freePrice(AB.zone,AB.dur).price}

function abRender(){
  const body=document.getElementById('ab-body');if(!body||!AB)return
  const z=ZONES[AB.zone],L=I18N[D.lang],now=clubNow()
  const days=Array.from({length:RULES.days},(_,i)=>{const d=new Date((now.day+i)*86400000);return {day:now.day+i,label:i===0?L.today:i===1?L.tomorrow:L.DAYS[d.getUTCDay()],n:d.getUTCDate(),m:L.MONTHS[d.getUTCMonth()]}})
  body.style.setProperty('--zc',z.color);body.style.setProperty('--zr',ZONE_RGB[z.key])
  body.innerHTML=`
    <div class="zt" role="tablist">${Object.values(ZONES).map(zz=>`<button type="button" class="zt-b${zz.key===AB.zone?' on':''}" data-z="${zz.key}" style="--zc:${zz.color};--za:${zA(zz,.16)}"><span>${zz.emoji}</span>${zz.key==='bc'?'Bootcamp':zz.key==='vip'?'VIP':'Standard'}</button>`).join('')}</div>
    <div class="seg"><button type="button" data-m="free"${AB.mode==='free'?' class="on"':''}>⏱ Своё время</button><button type="button" data-m="pkg"${AB.mode==='pkg'?' class="on"':''}>📦 Пакет</button></div>
    <div id="ab-fmt"></div>
    <div class="ab-k">Когда</div>
    <div class="DCH" id="ab-days">${days.map(d=>`<button type="button" class="DC${d.day===AB.day?' sel':''}" data-day="${d.day}"><div class="dc-d">${d.label}</div><div class="dc-n">${d.n}</div><div class="dc-m">${d.m}</div></button>`).join('')}</div>
    <div id="ab-when"></div>
    <div class="ab-k">Компьютеры <span id="ab-pcn"></span></div>
    <div id="ab-pcs"></div>
    <div class="who glass">
      <div class="who-h">Клиент · необязательно</div>
      <label class="fld"><span>Имя</span><input class="INP" id="ab-name" maxlength="40" placeholder="Гость (клуб)" value="${String(AB.name||'').replace(/"/g,'')}"></label>
      <label class="fld"><span>Телефон</span><input class="INP" id="ab-phone" type="tel" inputmode="tel" placeholder="+375 29 123-45-67" value="${AB.phone||''}"></label>
    </div>
    <div class="ab-foot">
      <div class="ab-sum" id="ab-sum"></div>
      <button type="button" class="BTN ab-go" id="ab-book-btn" style="background:${z.color};color:#000">📞 Создать бронь</button>
    </div>`
  body.querySelectorAll('.zt-b').forEach(b=>b.onclick=()=>{if(b.dataset.z===AB.zone)return;AB.zone=b.dataset.z;AB.pkg=null;AB.pcs=[];haptic('light');abRender()})
  body.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{if(AB.mode===b.dataset.m)return;AB.mode=b.dataset.m;AB.pkg=null;haptic('light');abRender()})
  body.querySelectorAll('#ab-days .DC').forEach(b=>b.onclick=()=>{const d=+b.dataset.day;if(d===AB.day)return;AB.day=d;AB.sm=null;haptic('light');abRender()})
  const nm=body.querySelector('#ab-name'),ph=body.querySelector('#ab-phone')
  nm.oninput=()=>{AB.name=nm.value}
  ph.addEventListener('focus',()=>{if(!ph.value)ph.value='+375 '})
  ph.addEventListener('input',()=>{ph.value=maskPhone(ph.value);AB.phone=ph.value})
  body.querySelector('#ab-book-btn').onclick=createAdminBooking
  abFormat();abWhen()
}

// Своё время: ползунок длительности; пакет — карточки пакетов зоны
function abFormat(){
  const el=document.getElementById('ab-fmt'),z=ZONES[AB.zone]
  if(AB.mode==='pkg'){
    el.innerHTML=`<div class="PG">${z.pkgs.map(p=>`<button type="button" class="PK${AB.pkg&&AB.pkg.id===p.id?' sel':''}" data-p="${p.id}">
      <div class="pk-n">${p.n}</div><div class="pk-t"${p.locked?' style="color:var(--gold)"':''}>${p.locked?'⏰ ':''}${p.t}</div>
      <div class="pk-p" style="color:${z.color}">${p.p}<span class="pk-b"> BYN</span></div></button>`).join('')}</div>`
    el.querySelectorAll('.PK').forEach(b=>b.onclick=()=>{AB.pkg=z.pkgs.find(p=>p.id===b.dataset.p);haptic('light');el.querySelectorAll('.PK').forEach(x=>x.classList.toggle('sel',x===b));abWhen()})
    return
  }
  el.innerHTML=`<div class="dur glass">
    <div class="dur-top"><div><div class="dur-k">ДЛИТЕЛЬНОСТЬ</div><div class="dur-v" id="ab-dv"></div></div>
      <div class="dur-p"><b id="ab-dp" style="color:${z.color}"></b><span>BYN</span><small id="ab-dx">за ПК</small></div></div>
    <div id="ab-ds"></div>
    <div class="dur-chips">${[60,120,180,300,480,600].map(m=>`<button type="button" class="tp-chip" data-d="${m}">${m/60} ч</button>`).join('')}</div>
  </div>`
  const upd=()=>{
    el.querySelector('#ab-dv').textContent=fmtDur(AB.dur)
    el.querySelector('#ab-dp').textContent=freePrice(AB.zone,AB.dur).price
    el.querySelectorAll('[data-d]').forEach(c=>c.classList.toggle('on',+c.dataset.d===AB.dur))
  }
  const sl=new DurSlider(el.querySelector('#ab-ds'),{min:RULES.freeMin,max:RULES.freeMax,step:RULES.freeStep,value:AB.dur,color:z.color,onInput:v=>{AB.dur=v;upd();abWhen(true)}})
  el.querySelectorAll('[data-d]').forEach(c=>c.onclick=()=>{AB.dur=+c.dataset.d;sl.set(AB.dur);haptic('light');upd();abWhen(true)})
  upd()
}

// Время: лента до минуты (как у клиента). Пакет с окном — время задано.
let _abTape=null
function abWhen(keep){
  const box=document.getElementById('ab-when');if(!box)return
  const z=ZONES[AB.zone],now=clubNow(),isToday=AB.day===now.day,dayStart=AB.day*1440
  const map=busyMap(AB.zone,AB.bookings),N=zonePcs(AB.zone).length
  const p=AB.pkg
  if(AB.mode==='pkg'&&!p){box.innerHTML='<div class="ab-note">Выбери пакет выше</div>';_abTape=null;abPcs();return}
  if(p&&p.locked){
    AB.sm=null;_abTape=null
    const [s,e]=abInterval(),over=isToday&&e-30<=now.abs
    box.innerHTML=`<div class="lock-card"><div class="lock-ic">🔒</div><div><div class="lock-k">ВРЕМЯ ПАКЕТА · ${p.n}</div><div class="lock-v">${minToHM(s)} – ${minToHM(e)}${Math.floor((e-1)/1440)>AB.day?' <small>до утра</small>':''}</div></div></div>
      ${over?'<div class="avail bad">⏰ Сегодня этот пакет уже закончился — выбери другой день</div>':''}`
    abPcs();return
  }
  const dur=p?p.h*60:AB.dur
  // Админ может отметить клиента, который пришёл до 30 минут назад (как разрешает сервер)
  const minStart=isToday?now.abs-30:dayStart,maxStart=dayStart+1439
  if(AB.sm==null||AB.sm<minStart||AB.sm>maxStart)AB.sm=isToday?now.abs:dayStart+12*60
  if(keep&&_abTape&&box.contains(_abTape.root)){abTapeSegs(map,dur,N,minStart,maxStart);abTimeUpd();abPcs();return}
  const chips=isToday?[['now','Сейчас'],['-15','−15 мин'],['+15','+15 мин'],['+30','+30 мин'],['+60','+1 ч']]:[['@600','10:00'],['@840','14:00'],['@1080','18:00'],['@1260','21:00']]
  box.innerHTML=`<div class="TB2 tp" style="--zc:${z.color};--zr:${ZONE_RGB[z.key]}">
    <div class="tp-head">
      <label class="tp-big"><span class="tp-k">НАЧАЛО</span><span class="tp-v" id="ab-ts" style="color:${z.color}"></span><input type="time" step="60" id="ab-ti" aria-label="Ввести время"></label>
      <div class="tp-mid"><span class="tp-dur" id="ab-td"></span><span class="tp-arrow">→</span></div>
      <div class="tp-big tp-end"><span class="tp-k">КОНЕЦ</span><span class="tp-v" id="ab-te"></span><span class="tp-day" id="ab-tn"></span></div>
    </div>
    <div id="ab-tape"></div>
    <div class="tp-row">
      <button type="button" class="tp-step" id="ab-m" aria-label="−1 мин">−</button>
      <div class="tp-chips">${chips.map(([k,t])=>`<button type="button" class="tp-chip" data-k="${k}">${t}</button>`).join('')}</div>
      <button type="button" class="tp-step" id="ab-p" aria-label="+1 мин">+</button>
    </div>
    <div class="avail" id="ab-av"></div>
  </div>`
  _abTape=new TimeTape(box.querySelector('#ab-tape'),{px:3,onInput:v=>{AB.sm=v;abTimeUpd();abPcs()}})
  _abTape.setRange(minStart,maxStart)
  if(isToday)_abTape.setNow(now.abs)
  abTapeSegs(map,dur,N,minStart,maxStart)
  _abTape.set(AB.sm)
  const set=v=>{AB.sm=Math.min(maxStart,Math.max(minStart,Math.round(v)));_abTape.set(AB.sm,true);abTimeUpd();abPcs()}
  holdRepeat(box.querySelector('#ab-m'),c=>{set(AB.sm-(c>12?5:1));haptic('tick')})
  holdRepeat(box.querySelector('#ab-p'),c=>{set(AB.sm+(c>12?5:1));haptic('tick')})
  box.querySelectorAll('.tp-chip').forEach(c=>c.onclick=()=>{
    const k=c.dataset.k,n=clubNow().abs
    if(k==='now')set(n)
    else if(k[0]==='+'||k[0]==='-')set(AB.sm+parseInt(k))
    else if(k[0]==='@')set(dayStart+parseInt(k.slice(1)))
    haptic('light')
  })
  const inp=box.querySelector('#ab-ti')
  inp.addEventListener('click',()=>{try{inp.showPicker()}catch(e){}})
  inp.addEventListener('change',()=>{if(inp.value)set(dayStart+timeToMinJS(inp.value))})
  abTimeUpd();abPcs()
}
// Подсветка ленты: где в зоне не осталось свободных ПК (на нужное число ПК)
function abTapeSegs(map,dur,N,minStart,maxStart){
  if(!_abTape)return
  const need=Math.max(1,AB.pcs.length),segs=[]
  for(let t=minStart-(((minStart%5)+5)%5);t<=maxStart;t+=5){
    const f=freePcsFor(map,Math.max(t,minStart),Math.max(t,minStart)+dur).length
    const cls=f<need?'full':(N>need+1&&f-need<=1)?'few':''
    const last=segs[segs.length-1]
    if(last&&last.cls===cls&&last.to===t)last.to=t+5
    else if(cls)segs.push({from:t,to:t+5,cls})
  }
  _abTape.setSegments(segs)
}
function abTimeUpd(){
  const [s,e]=abInterval(),z=ZONES[AB.zone]
  const q=id=>document.getElementById(id)
  if(!q('ab-ts'))return
  q('ab-ts').textContent=minToHM(s);q('ab-te').textContent=minToHM(e);q('ab-ti').value=minToHM(s)
  q('ab-td').textContent=fmtDur(e-s)
  q('ab-tn').textContent=Math.floor((e-1)/1440)>AB.day?'след. день':''
  const map=busyMap(AB.zone,AB.bookings),f=freePcsFor(map,s,e).length,N=zonePcs(AB.zone).length
  const av=q('ab-av'),nowAbs=clubNow().abs
  av.className='avail '+(f?'ok':'bad')
  av.innerHTML=f?`<span class="av-dot"></span>Свободно ${f} из ${N} ПК · ${minToHM(s)}–${minToHM(e)}${s<nowAbs?' · <b>уже идёт</b>':''}`:'❌ На это время в зоне всё занято — сдвинь ленту'
  _abTape&&_abTape.setSelection(s,e,!f)
}

// ПК: занятость на выбранный отрезок (брони + живые сессии), выбор нескольких
function abPcs(){
  const box=document.getElementById('ab-pcs');if(!box)return
  const z=ZONES[AB.zone],p=AB.pkg
  if(AB.mode==='pkg'&&!p){box.innerHTML='';abSum();return}
  const [s,e]=abInterval(),map=busyMap(AB.zone,AB.bookings),nowAbs=clubNow().abs
  AB.pcs=AB.pcs.filter(l=>!pcBlocker(map[l],s,e))
  const cell=n=>{
    const lbl=pcLbl(AB.zone,n),o=pcSlot(lbl,map,AB.bookings,s,e),sel=AB.pcs.includes(lbl)
    return `<button type="button" class="PCB ${o.busy?'st-busy':'st-free'}${o.live?' live':''}${sel?' sel':''}" data-pc="${lbl}" style="--zc:${z.color}">
      <div class="pc-id">${String(n).padStart(2,'0')}</div><div class="pc-st">${o.sub}</div>${o.note?`<div class="pc-nt">${o.note}</div>`:''}${o.now?`<div class="pc-now">${o.now}</div>`:''}
      ${o.frac!=null?`<i class="pc-tl" style="--p:${o.frac.toFixed(3)}"></i>`:''}<div class="pc-ok">✓</div></button>`
  }
  box.innerHTML=`<div class="PCG${z.layout.length>1?' PCG-cols':''}">${z.layout.map((col,ci)=>`<div class="pc-col">${z.sides?`<div class="pc-side">${z.sides[ci]}</div>`:''}${col.map(cell).join('')}</div>`).join('')}</div>`
  box.querySelectorAll('.PCB').forEach(b=>b.onclick=()=>adminPickPc(b.dataset.pc))
  abSum()
}
function adminPickPc(lbl){
  if(!AB)return
  const b=document.querySelector(`#ab-pcs .PCB[data-pc="${lbl}"]`)
  if(b&&b.classList.contains('st-busy')){const nt=b.querySelector('.pc-nt');toast(`${lbl}: ${b.querySelector('.pc-st').textContent}${nt?' · '+nt.textContent:''}`,'🔒');haptic('warn');return}
  const i=AB.pcs.indexOf(lbl)
  if(i>=0)AB.pcs.splice(i,1)
  else if(AB.pcs.length<RULES.maxTeam)AB.pcs.push(lbl)
  else{toast('Максимум '+RULES.maxTeam+' ПК в одной брони','⚠️');haptic('warn');return}
  haptic('tick')
  document.querySelectorAll('#ab-pcs .PCB').forEach(x=>x.classList.toggle('sel',AB.pcs.includes(x.dataset.pc)))
  abSum()
}
function abSum(){
  const el=document.getElementById('ab-sum'),btn=document.getElementById('ab-book-btn'),n=document.getElementById('ab-pcn');if(!el)return
  const ready=!(AB.mode==='pkg'&&!AB.pkg)
  const pr=ready?abPrice():0,k=AB.pcs.length
  if(n)n.textContent=k?`· выбрано ${k}`:''
  if(!ready||!k){el.innerHTML=`<span>${ready?'Выбери один или несколько ПК':'Выбери пакет'}</span>`;if(btn)btn.disabled=true;return}
  const [s,e]=abInterval()
  el.innerHTML=`<div><b>${AB.pcs.join(', ')}</b><small>${minToHM(s)}–${minToHM(e)} · ${AB.pkg?AB.pkg.n:'своё время '+fmtDur(AB.dur)}</small></div>
    <div class="ab-total">${k>1?`<small>${pr} × ${k}</small>`:''}${pr*k}<span> BYN</span></div>`
  if(btn)btn.disabled=false
}
async function createAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  if(!AB||!AB.pcs.length){toast('Выбери хотя бы 1 ПК','⚠️');return}
  if(AB.mode==='pkg'&&!AB.pkg){toast('Выбери пакет','⚠️');return}
  const [s,e]=abInterval(),pcs=[...AB.pcs],p=AB.pkg
  const name=(document.getElementById('ab-name')?.value||'').trim()||'Гость (клуб)'
  const phone=document.getElementById('ab-phone')?.value||''
  const btn=document.getElementById('ab-book-btn')
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>'}
  const r=await checkAndBook({user:name,phone:phone.replace(/\D/g,'').length===12?phone:'',pc:pcs[0],...(pcs.length>1?{pcs:pcs.join(',')}:{}),zone:AB.zone,
    date:dateOfDayNum(Math.floor(s/1440)),start:minToHM(s),end:minToHM(e),pkg:p?p.n:'',pkgId:p?p.id:'',
    price:abPrice(),tgId:'',source:'offline',initData:_admInit(),adminKey:(D._admKey||'')})
  if(btn){btn.disabled=false;btn.textContent='📞 Создать бронь'}
  if(!r.ok){
    toast(r.error||'Не удалось создать бронь','⚠️');haptic('err')
    try{AB.bookings=await loadBookings(null,null,true)}catch(er){}
    abWhen(true);return
  }
  haptic('ok')
  closeM('admin-book-m')
  _bookingsCache.loaded=false;_bkData.ts=0
  toast('✅ Забронировано: '+pcs.join(', ')+' · '+minToHM(s)+'–'+minToHM(e)+(r.total!=null?' · '+r.total+' BYN':''),'✅')
  renderAdminOffline();renderAdminDash();renderAdminToday()
}
// Список оффлайн-броней в админке
async function renderAdminOffline(){
  const box=document.getElementById('admin-offline-list');if(!box||!isAdmin())return
  let all=[];try{all=await loadAdminBookings()}catch(e){}
  const today=clubNow().date
  const normD=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
  const offline=all.filter(b=>String(b.pkg||'').includes('Оффлайн')&&b.status!=='cancelled'&&b.status!=='completed').slice(0,10)
  if(!offline.length){box.innerHTML='<div style="font-size:11px;color:var(--t3);text-align:center;padding:10px">Нет активных оффлайн-броней</div>';return}
  box.innerHTML=offline.map(b=>`<div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:linear-gradient(135deg,rgba(75,158,255,.08),rgba(42,237,181,.03));border:1px solid rgba(75,158,255,.18);border-radius:12px;margin-bottom:7px">
    <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--blue)">${b.pc} <span style="color:var(--t2);font-weight:400;font-size:11px">· ${esc(b.user||'Гость')}</span></div><div style="font-size:11px;color:var(--t2);margin-top:2px;font-family:var(--m)">${b.date} · ${b.start}–${b.end}</div></div>
    <button onclick="adminCancelOffline('${b.id}')" style="padding:7px 12px;border-radius:9px;background:rgba(255,63,96,.1);border:1px solid rgba(255,63,96,.25);color:var(--red);font-size:11px;font-weight:600;cursor:pointer">Снять</button>
  </div>`).join('')
}
async function adminCancelOffline(id){
  try{
    await fetch(API_URL+'?'+new URLSearchParams({action:'cancelBooking',id:id,tgId:D.user._tgId||'',initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    _bookingsCache.loaded=false;_bkData.ts=0
    toast('Бронь снята','✅')
    renderAdminOffline();renderAdminDash()
  }catch(e){toast('Ошибка','⚠️')}
}
