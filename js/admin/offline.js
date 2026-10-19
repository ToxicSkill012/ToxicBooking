// Админ: оффлайн-брони

// ═══ АДМИН: ОФФЛАЙН-БРОНЬ ═══
const AB_PREFIX={std:'ST',vip:'VIP',bc:'BC'},AB_COUNT={std:13,vip:3,bc:5}
let _abZone='std',_abTime=18,_abMin=18*60,_abDur=1,_abPcs=[],_abTF=null
function openAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  const di=document.getElementById('ab-date')
  if(di){di.min=clubIsoDate();di.value=clubIsoDate()}
  // Клиент пришёл «прямо сейчас» — старт с текущей минуты
  _abZone='std';_abMin=clubNow().min;_abTime=Math.floor(_abMin/60);_abDur=1;_abPcs=[]
  const tEl=document.getElementById('ab-time')
  if(tEl){
    if(!_abTF)_abTF=timeField(tEl,{value:_abMin,onChange:v=>{_abMin=v;_abTime=Math.floor(v/60);loadAdminPcs()}})
    else _abTF.set(_abMin)
  }
  document.getElementById('ab-name').value=''
  adminSelectZone('std');adminSelectDur(1)
  openM('admin-book-m')
}
function adminSelectZone(z){
  _abZone=z;_abPcs=[]
  ;['std','vip','bc'].forEach(k=>{const el=document.getElementById('abz-'+k);if(el){const on=k===z;el.style.borderColor=on?'var(--blue)':'var(--b1)';el.style.background=on?'rgba(75,158,255,.08)':'var(--s1)'}})
  loadAdminPcs()
}
function adminSelectDur(h){
  _abDur=h
  ;[1,2,3,5].forEach(k=>{const el=document.getElementById('abd-'+k);if(el){const on=k===h;el.style.borderColor=on?'var(--blue)':'var(--b1)';el.style.background=on?'rgba(75,158,255,.08)':'var(--s1)'}})
  loadAdminPcs()
}
function abTimeStep(d){
  _abMin=((_abMin+d*60)%1440+1440)%1440;_abTime=Math.floor(_abMin/60)
  if(_abTF)_abTF.set(_abMin)
  loadAdminPcs()
}
async function loadAdminPcs(){
  const grid=document.getElementById('ab-pc-grid');if(!grid)return
  const di=document.getElementById('ab-date'),date=di?di.value:''
  if(!date){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--t3);font-size:11px;padding:14px">Выбери дату</div>';return}
  const dateStr=isoToRuDate(date)
  const pre=AB_PREFIX[_abZone],count=AB_COUNT[_abZone]
  const mine=bookingAbsRange(dateStr,minToHM(_abMin),minToHM(_abMin+_abDur*60))
  let allBks=[];try{allBks=await loadBookings(null,null,false)}catch(e){}
  // Занят = пересекается с бронью (в т.ч. ночной) или с идущей сессией в клубе
  const isOcc=(lbl)=>pcBusyRanges(lbl,allBks).some(r=>rangesOverlap(r,mine))
  const cell=(num)=>{
    const lbl=pre+'-'+String(num).padStart(2,'0'),busy=isOcc(lbl),sel=_abPcs.includes(lbl)
    const bg=busy?'rgba(255,63,96,.12)':sel?'linear-gradient(160deg,rgba(196,255,62,.18),rgba(196,255,62,.04))':'var(--s3)'
    const bd=busy?'rgba(255,63,96,.25)':sel?'var(--lime)':'var(--b1)',col=busy?'var(--red)':sel?'var(--lime)':'var(--txt)'
    return `<div ${busy?'':`onclick="adminPickPc('${lbl}')"`} style="padding:10px 2px;border-radius:11px;background:${bg};border:1.5px solid ${bd};text-align:center;cursor:${busy?'not-allowed':'pointer'};opacity:${busy?'.5':'1'}">
      <div style="font-family:var(--F);font-size:13px;font-weight:800;color:${col}">${String(num).padStart(2,'0')}</div>
      ${busy?'<div style="font-size:7px;color:var(--red)">занят</div>':sel?'<div style="font-size:9px">✓</div>':''}</div>`
  }
  if(_abZone==='std'){
    const L=[1,3,5,7,9,11,13,15],R=[2,4,6,8,10]
    grid.style.gridTemplateColumns='1fr 1fr';grid.style.gap='10px'
    grid.innerHTML=`<div><div style="font-size:9px;color:var(--t2);text-align:center;margin-bottom:6px">← ЛЕВАЯ</div><div style="display:flex;flex-direction:column;gap:6px">${L.map(cell).join('')}</div></div><div><div style="font-size:9px;color:var(--t2);text-align:center;margin-bottom:6px">ПРАВАЯ →</div><div style="display:flex;flex-direction:column;gap:6px">${R.map(cell).join('')}</div></div>`
  }else{
    grid.style.gridTemplateColumns='repeat(4,1fr)';grid.style.gap='7px'
    let c='';for(let i=1;i<=count;i++)c+=cell(i);grid.innerHTML=c
  }
}
function adminPickPc(lbl){
  const i=_abPcs.indexOf(lbl)
  if(i>=0)_abPcs.splice(i,1);else _abPcs.push(lbl)
  const sel=document.getElementById('ab-pc-sel')
  if(sel)sel.textContent=_abPcs.length?(_abPcs.length+' ПК: '+_abPcs.join(', ')):'не выбраны'
  loadAdminPcs()
}
async function createAdminBooking(){
  if(!isAdmin()){toast('Только для админа','🔒');return}
  const di=document.getElementById('ab-date'),date=di?di.value:''
  const name=document.getElementById('ab-name')?.value.trim()||'Гость (клуб)'
  if(!date){toast('Выбери дату','⚠️');return}
  if(!_abPcs.length){toast('Выбери хотя бы 1 ПК','⚠️');return}
  const dateStr=isoToRuDate(date)
  const startStr=minToHM(_abMin)
  const endStr=minToHM(_abMin+_abDur*60)
  const zoneKey=_abZone==='bc'?'bootcamp':_abZone
  const prices={std:{1:6,2:11,3:15,5:21},vip:{1:8,2:15,3:20,5:25},bc:{1:8,2:15,3:20,5:25}}
  const price=(prices[_abZone]||prices.std)[_abDur]||6
  const pcs=[..._abPcs],zoneName=GRP_NAMES[_abZone]
  // Мгновенно закрываем — брони создаются фоном, без лагов
  closeM('admin-book-m')
  toast('Создаю '+pcs.length+' оффлайн-брон'+(pcs.length===1?'ь':pcs.length<5?'и':'ей')+'…','📞')
  ;(async()=>{
    const okPcs=[],failPcs=[]
    for(const pc of pcs){
      const booking={user:name,phone:'',pc:pc,zone:zoneKey,date:dateStr,start:startStr,end:endStr,pkg:'Оффлайн '+_abDur+'ч',price:price,tgId:'',silent:1,source:'offline',initData:_admInit(),adminKey:(D._admKey||'')}
      try{const r=await checkAndBook(booking);if(r&&r.ok)okPcs.push(pc);else failPcs.push(pc)}catch(e){failPcs.push(pc)}
    }
    _bookingsCache.loaded=false
    if(okPcs.length){
      toast('✅ Забронировано: '+okPcs.join(', ')+(failPcs.length?' · занято: '+failPcs.join(', '):''),'✅')
      // ОДНА сводка админу вместо спама
      tgNotify('📞 <b>ОФФЛАЙН-БРОНЬ (админ)</b>\n\n👤 '+name+'\n🖥 <b>'+okPcs.join(', ')+'</b> ('+zoneName+')\n⏱ '+startStr+'–'+endStr+' · '+dateStr+'\n💰 '+(price*okPcs.length)+' BYN ('+okPcs.length+'×'+price+')'+(failPcs.length?'\n⚠️ Занято: '+failPcs.join(', '):'')+'\n#оффлайн').catch(()=>{})
    }else{
      toast('Все выбранные ПК заняты на это время','⚠️')
    }
    renderAdminOffline();renderAdminDash();renderAdminToday()
    if(D.cur==='book')renderStep()
  })()
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
    _bookingsCache.loaded=false
    toast('Бронь снята','✅')
    renderAdminOffline();renderAdminDash()
  }catch(e){toast('Ошибка','⚠️')}
}
