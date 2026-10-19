// Бронь для команды

// ═══ ГРУППОВОЕ БРОНИРОВАНИЕ (умное, реальные брони) ═══
const GRP_LIMITS={std:13,vip:3,bc:5}
const GRP_PRICES={std:{1:6,3:15,5:21},vip:{1:8,3:20,5:25},bc:{1:8,3:20,5:25}}
const GRP_NAMES={std:'Standard',vip:'VIP',bc:'Bootcamp'}
const GRP_PREFIX={std:'ST',vip:'VIP',bc:'BC'}
const GRP_PCCOUNT={std:13,vip:3,bc:5}
let _grpZone='std',_grpHrs=1,_grpTime=18,_grpMin=18*60,_grpSelectedPcs=[],_grpTF=null

// Сегодня по времени клуба в формате поля <input type="date">
function clubIsoDate(){const p=clubNow().date.split('.');return p[2]+'-'+p[1]+'-'+p[0]}
// yyyy-mm-dd → dd.MM.yyyy
function isoToRuDate(iso){const p=String(iso||'').split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''}

function openGroupBooking(){
  const di=document.getElementById('grp-date')
  if(di){di.min=clubIsoDate();di.value=clubIsoDate()}
  const ni=document.getElementById('grp-name')
  if(ni&&D.user.name)ni.value=D.user.name+(D.user.phone?' · '+D.user.phone:'')
  // Время прихода — ближайшие 15 минут, дальше настраивается поминутно
  _grpZone='std';_grpHrs=1;_grpMin=Math.min(1439,Math.ceil((clubNow().min+15)/5)*5);_grpTime=Math.floor(_grpMin/60);_grpSelectedPcs=[]
  const tEl=document.getElementById('grp-time')
  if(tEl){
    if(!_grpTF)_grpTF=timeField(tEl,{value:_grpMin,onChange:v=>{_grpMin=v;_grpTime=Math.floor(v/60);loadGroupPcs()}})
    else _grpTF.set(_grpMin)
  }
  selectGroupZone('std');selectGroupPkg(1)
  openM('group-m')
}
function selectGroupZone(zone){
  _grpZone=zone;_grpSelectedPcs=[]
  ;['std','vip','bc'].forEach(z=>{
    const card=document.getElementById('grpz-'+z);if(!card)return
    const on=z===zone,chk=card.querySelector('.grp-check')
    card.style.borderColor=on?'var(--blue)':'var(--b1)'
    card.style.background=on?'rgba(75,158,255,.06)':'var(--s1)'
    if(chk){chk.style.borderColor=on?'var(--blue)':'var(--b2)';chk.style.background=on?'var(--blue)':'';chk.innerHTML=on?'<div style="width:8px;height:8px;border-radius:50%;background:#fff;margin:5px auto"></div>':''}
  })
  const prices=GRP_PRICES[zone]||GRP_PRICES.std
  ;[1,3,5].forEach(h=>{const el=document.getElementById('grpp-'+h+'-p');if(el)el.textContent=prices[h]+' BYN'})
  loadGroupPcs()
  updateGroupPrice()
}
function grpTimeStep(d){
  _grpMin=((_grpMin+d*60)%1440+1440)%1440;_grpTime=Math.floor(_grpMin/60)
  if(_grpTF)_grpTF.set(_grpMin)
  haptic('tick')
  loadGroupPcs()
}
function selectGroupPkg(hrs){
  _grpHrs=hrs
  ;[1,3,5].forEach(h=>{
    const card=document.getElementById('grpp-'+h);if(!card)return
    const on=h===hrs
    card.style.borderColor=on?'var(--blue)':'var(--b1)'
    card.style.background=on?'rgba(75,158,255,.06)':'var(--s1)'
  })
  loadGroupPcs()
  updateGroupPrice()
}

// Загружаем какие ПК свободны на выбранную дату/время
async function loadGroupPcs(){
  const grid=document.getElementById('grp-pc-grid');if(!grid)return
  const di=document.getElementById('grp-date')
  const date=di?di.value:''
  if(!date){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--t3);font-size:11px;padding:14px">Выбери дату</div>';return}
  grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--t3);font-size:11px;padding:14px"><span class="spin"></span></div>'

  // Дата в формате dd.MM.yyyy
  const dateStr=isoToRuDate(date)
  const pre=GRP_PREFIX[_grpZone],count=GRP_PCCOUNT[_grpZone]
  const startStr=minToHM(_grpMin),endStr=minToHM(_grpMin+_grpHrs*60)
  const mine=bookingAbsRange(dateStr,startStr,endStr)

  // Грузим брони
  let allBks=[]
  try{allBks=await loadBookings(null,null,false)}catch(e){}

  // Строим сетку: занят = пересекается с бронью (в т.ч. ночной) или с идущей сессией в клубе
  const grid2=document.getElementById('grp-pc-grid')
  const isOccupied=(lbl)=>pcBusyRanges(lbl,allBks).some(r=>rangesOverlap(r,mine))
  const cellHtml=(num)=>{
    const lbl=pre+'-'+String(num).padStart(2,'0')
    const busy=isOccupied(lbl)
    const sel=_grpSelectedPcs.includes(lbl)
    const bg=busy?'rgba(255,63,96,.12)':sel?'linear-gradient(160deg,rgba(196,255,62,.18),rgba(196,255,62,.04))':'var(--s3)'
    const bd=busy?'rgba(255,63,96,.25)':sel?'var(--lime)':'var(--b1)'
    const col=busy?'var(--red)':sel?'var(--lime)':'var(--txt)'
    return `<div ${busy?'':`onclick="toggleGroupPc('${lbl}')"`} style="padding:10px 2px;border-radius:11px;background:${bg};border:1.5px solid ${bd};text-align:center;cursor:${busy?'not-allowed':'pointer'};opacity:${busy?'.5':'1'};transition:all .12s">
      <div style="font-family:var(--F);font-size:13px;font-weight:800;color:${col}">${String(num).padStart(2,'0')}</div>
      ${busy?'<div style="font-size:7px;color:var(--red);margin-top:1px">занят</div>':sel?'<div style="font-size:9px;margin-top:1px">✓</div>':''}
    </div>`
  }

  if(_grpZone==='std'){
    // Стандарт: слева нечётные, справа чётные (как в обычной броне)
    const leftNums=[1,3,5,7,9,11,13,15],rightNums=[2,4,6,8,10]
    grid2.style.gridTemplateColumns='1fr 1fr'
    grid2.style.gap='10px'
    grid2.innerHTML=`
      <div><div style="font-size:9px;color:var(--t2);font-weight:600;text-align:center;margin-bottom:6px;letter-spacing:.5px">← ЛЕВАЯ</div><div style="display:flex;flex-direction:column;gap:6px">${leftNums.map(cellHtml).join('')}</div></div>
      <div><div style="font-size:9px;color:var(--t2);font-weight:600;text-align:center;margin-bottom:6px;letter-spacing:.5px">ПРАВАЯ →</div><div style="display:flex;flex-direction:column;gap:6px">${rightNums.map(cellHtml).join('')}</div></div>`
  }else{
    grid2.style.gridTemplateColumns='repeat(4,1fr)'
    grid2.style.gap='7px'
    let cells=''
    for(let i=1;i<=count;i++)cells+=cellHtml(i)
    grid2.innerHTML=cells
  }
  updateGroupPrice()
}
function toggleGroupPc(lbl){
  const i=_grpSelectedPcs.indexOf(lbl)
  if(i>=0)_grpSelectedPcs.splice(i,1)
  else{
    if(_grpSelectedPcs.length>=GRP_LIMITS[_grpZone]){toast('Достигнут лимит зоны','⚠️');return}
    _grpSelectedPcs.push(lbl)
  }
  if(window.navigator.vibrate)try{navigator.vibrate(8)}catch(e){}
  loadGroupPcs()
}
function updateGroupPrice(){
  const n=_grpSelectedPcs.length
  const perPc=(GRP_PRICES[_grpZone]||GRP_PRICES.std)[_grpHrs]||6,total=perPc*n
  const cntEl=document.getElementById('grp-pc-count')
  if(cntEl)cntEl.textContent=n+' выбрано'
  const calc=document.getElementById('grp-calc'),sum=document.getElementById('grp-sum')
  if(calc)calc.textContent=n>0?n+' ПК × '+perPc+' BYN × '+_grpHrs+'ч':'Выбери компьютеры'
  if(sum)sum.textContent=total+' BYN'
}

// РЕАЛЬНОЕ бронирование всех выбранных ПК
async function bookGroupPcs(){
  const di=document.getElementById('grp-date'),date=di?di.value:''
  const name=document.getElementById('grp-name')?.value.trim()||''
  if(!date){toast('Выбери дату','⚠️');return}
  if(_grpSelectedPcs.length===0){toast('Выбери хотя бы 1 ПК','⚠️');return}
  if(!name){toast('Укажи имя и телефон','⚠️');return}
  // Прошедшее время сегодня — не даём отправить (по времени клуба)
  {
    const r=bookingAbsRange(isoToRuDate(date),minToHM(_grpMin),minToHM(_grpMin+_grpHrs*60))
    if(r&&r[0]<clubNow().abs-5){
      toast('Это время уже прошло — выбери позже','⏰');return
    }
  }
  // Телефон обязателен
  const ph=D.user.phone||''
  if(ph.replace(/\D/g,'').length<9){showContactModal(()=>openGroupBooking());return}

  const btn=document.getElementById('grp-book-btn')
  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}

  const dateStr=isoToRuDate(date)
  const startStr=minToHM(_grpMin)
  const endStr=minToHM(_grpMin+_grpHrs*60)
  const zoneKey=_grpZone==='bc'?'bootcamp':_grpZone
  const perPc=(GRP_PRICES[_grpZone]||GRP_PRICES.std)[_grpHrs]||6

  const booked=[],failed=[]
  for(const pc of _grpSelectedPcs){
    const booking={user:name,phone:D.user.phone||'',pc:pc,zone:zoneKey,date:dateStr,start:startStr,end:endStr,pkg:_grpHrs+'ч',price:perPc,tgId:D.user._tgId||'',silent:1}
    try{
      const r=await checkAndBook(booking)
      if(r&&r.ok){
        booked.push(pc)
        D.user.bks.unshift({id:r.id||('G'+Date.now()+Math.floor(Math.random()*999)),pc,zone:zoneKey,date:dateStr,start:startStr,end:endStr,h:_grpHrs,price:perPc,status:'active'})
      }else failed.push(pc)
    }catch(e){failed.push(pc)}
  }
  D.user.hrs=(D.user.hrs||0)+booked.length*_grpHrs
  sv()

  // Если ничего не забронировано — вернуть кнопку
  if(!booked.length){
    toast('Не удалось — ПК уже заняты','⚠️')
    if(btn){btn.innerHTML='🎮 Забронировать';btn.disabled=false}
    return
  }
  // Закрываем модал и показываем результат СРАЗУ
  closeM('group-m')
  toast(failed.length?('Забронировано '+booked.length+', занято: '+failed.join(', ')):('✅ Забронировано '+booked.length+' ПК!'),'✅')
  renderProfile();renderBkList();go('bklist')

  // Баллы (1 раз) + TG админу — фоном (fire-and-forget)
  if(D.user._tgId){
    fetch(API_URL+'?'+new URLSearchParams({action:'awardGroupPoints',tgId:D.user._tgId,user:D.user.name||name,zone:_grpZone,hours:_grpHrs,isTg:'1',_t:Date.now()}))
      .then(r=>r.json()).then(pd=>{if(pd&&pd.ok&&pd.balance!=null){D.user.pts=pd.balance;sv();if(D.cur==='profile')renderProfile()}}).catch(()=>{})
  }
  const msg='👥 <b>ГРУППОВАЯ БРОНЬ!</b>\n\n👤 <b>'+name+'</b>\n🆔 TG: '+(D.user._tgId||'—')+'\n\n🖥 <b>'+booked.length+' ПК</b> · '+GRP_NAMES[_grpZone]+'\n'+booked.join(', ')+'\n⏱ '+startStr+'–'+endStr+' ('+_grpHrs+'ч)\n📆 '+dateStr+'\n💰 итого '+(perPc*booked.length)+' BYN\n#групповое'
  tgNotify(msg).catch(()=>{})
}
