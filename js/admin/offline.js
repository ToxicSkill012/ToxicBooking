// Админ: оффлайн-брони

// ═══ АДМИН: ОФФЛАЙН-БРОНЬ ═══
// Клиент пришёл или позвонил: несколько ПК одной бронью, цену считает сервер (как «своё время»)
let _abZone='std',_abMin=18*60,_abDur=1,_abPcs=[],_abTF=null
function openAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  const di=document.getElementById('ab-date')
  if(di){di.min=clubIsoDate();di.value=clubIsoDate()}
  // Клиент пришёл «прямо сейчас» — старт с текущей минуты
  _abZone='std';_abMin=clubNow().min;_abDur=1;_abPcs=[]
  const tEl=document.getElementById('ab-time')
  if(tEl){
    if(!_abTF)_abTF=timeField(tEl,{value:_abMin,onChange:v=>{_abMin=v;loadAdminPcs()}})
    else _abTF.set(_abMin)
  }
  document.getElementById('ab-name').value=''
  adminSelectZone('std');adminSelectDur(1)
  openM('admin-book-m')
}
function adminSelectZone(z){
  _abZone=z;_abPcs=[]
  ;['std','vip','bc'].forEach(k=>{const el=document.getElementById('abz-'+k);if(el){const on=k===z;el.style.borderColor=on?'var(--blue)':'var(--b1)';el.style.background=on?'rgba(75,158,255,.08)':'var(--s1)'}})
  adminPriceHint();loadAdminPcs()
}
function adminSelectDur(h){
  _abDur=h
  ;[1,2,3,5].forEach(k=>{const el=document.getElementById('abd-'+k);if(el){const on=k===h;el.style.borderColor=on?'var(--blue)':'var(--b1)';el.style.background=on?'rgba(75,158,255,.08)':'var(--s1)'}})
  adminPriceHint();loadAdminPcs()
}
function adminPriceHint(){
  const sel=document.getElementById('ab-pc-sel');if(!sel)return
  const pr=freePrice(_abZone,_abDur*60).price
  sel.textContent=(_abPcs.length?_abPcs.length+' ПК: '+_abPcs.join(', ')+' · ':'')+(_abPcs.length>1?pr+'×'+_abPcs.length+' = '+pr*_abPcs.length:pr)+' BYN'
}
async function loadAdminPcs(){
  const grid=document.getElementById('ab-pc-grid');if(!grid)return
  const di=document.getElementById('ab-date'),date=di?di.value:''
  if(!date){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--t3);font-size:11px;padding:14px">Выбери дату</div>';return}
  const dateStr=isoToRuDate(date)
  const mine=bookingAbsRange(dateStr,minToHM(_abMin),minToHM(_abMin+_abDur*60))
  let allBks=[];try{allBks=await loadBookings(null,null,false)}catch(e){}
  // Занят = пересекается с бронью (в т.ч. ночной) или с идущей сессией в клубе
  const isOcc=lbl=>pcBusyRanges(lbl,allBks).some(r=>rangesOverlap(r,mine))
  _abPcs=_abPcs.filter(l=>!isOcc(l))
  const cell=num=>{
    const lbl=pcLbl(_abZone,num),busy=isOcc(lbl),sel=_abPcs.includes(lbl)
    const bg=busy?'rgba(255,63,96,.12)':sel?'linear-gradient(160deg,rgba(196,255,62,.18),rgba(196,255,62,.04))':'var(--s3)'
    const bd=busy?'rgba(255,63,96,.25)':sel?'var(--lime)':'var(--b1)',col=busy?'var(--red)':sel?'var(--lime)':'var(--txt)'
    return `<div ${busy?'':`onclick="adminPickPc('${lbl}')"`} style="padding:10px 2px;border-radius:11px;background:${bg};border:1.5px solid ${bd};text-align:center;cursor:${busy?'not-allowed':'pointer'};opacity:${busy?'.5':'1'}">
      <div style="font-family:var(--F);font-size:13px;font-weight:800;color:${col}">${String(num).padStart(2,'0')}</div>
      ${busy?'<div style="font-size:7px;color:var(--red)">занят</div>':sel?'<div style="font-size:9px">✓</div>':''}</div>`
  }
  const lay=ZONES[_abZone].layout
  if(lay.length>1){
    grid.style.gridTemplateColumns='1fr 1fr';grid.style.gap='10px'
    grid.innerHTML=lay.map((col,i)=>`<div><div style="font-size:9px;color:var(--t2);text-align:center;margin-bottom:6px">${i?'ПРАВЫЙ РЯД →':'← ЛЕВЫЙ РЯД'}</div><div style="display:flex;flex-direction:column;gap:6px">${col.map(cell).join('')}</div></div>`).join('')
  }else{
    grid.style.gridTemplateColumns='repeat(4,1fr)';grid.style.gap='7px'
    grid.innerHTML=lay[0].map(cell).join('')
  }
  adminPriceHint()
}
function adminPickPc(lbl){
  const i=_abPcs.indexOf(lbl)
  if(i>=0)_abPcs.splice(i,1)
  else if(_abPcs.length<RULES.maxTeam)_abPcs.push(lbl)
  else{toast('Максимум '+RULES.maxTeam+' ПК в одной брони','⚠️');return}
  loadAdminPcs()
}
async function createAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  const di=document.getElementById('ab-date'),date=di?di.value:''
  const name=document.getElementById('ab-name')?.value.trim()||'Гость (клуб)'
  if(!date){toast('Выбери дату','⚠️');return}
  if(!_abPcs.length){toast('Выбери хотя бы 1 ПК','⚠️');return}
  const pcs=[..._abPcs]
  const btn=document.getElementById('ab-book-btn')
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>'}
  const r=await checkAndBook({user:name,phone:'',pc:pcs[0],...(pcs.length>1?{pcs:pcs.join(',')}:{}),zone:_abZone,
    date:isoToRuDate(date),start:minToHM(_abMin),end:minToHM(_abMin+_abDur*60),pkg:'',pkgId:'',
    price:freePrice(_abZone,_abDur*60).price,tgId:'',source:'offline',initData:_admInit(),adminKey:(D._admKey||'')})
  if(btn){btn.disabled=false;btn.textContent='📞 Создать'}
  if(!r.ok){toast(r.error||'Не удалось создать бронь','⚠️');loadAdminPcs();return}
  closeM('admin-book-m')
  _bookingsCache.loaded=false;_bkData.ts=0
  toast('✅ Забронировано: '+pcs.join(', ')+' · '+(r.total!=null?r.total:'')+' BYN','✅')
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
    <div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--blue)">${b.pc} <span style="color:var(--t2);font-weight:400;font-size:11px">· ${b.user||'Гость'}</span></div><div style="font-size:11px;color:var(--t2);margin-top:2px;font-family:var(--m)">${b.date} · ${b.start}–${b.end}</div></div>
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
