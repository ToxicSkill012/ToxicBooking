// Профиль и регистрация

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════
function renderProfile(){
  const u=D.user
  const $=id=>document.getElementById(id)
  $('ph-name').textContent=u.name
  const bestHandle=u._tgHandle||u.handle
  $('ph-handle').textContent=bestHandle?`@${bestHandle}`:'@—'
  // Кликабельный если есть TG
  const phH=$('ph-handle')
  if(phH&&u._tgHandle){phH.style.cursor='pointer';phH.onclick=()=>window.open('https://t.me/'+u._tgHandle,'_blank')}
  countUp($('st-bk'),(u.bks||[]).filter(b=>b.status==='active').length)
  // Часы — по броням (кроме отменённых), а не накопленным счётчиком: отмена раньше не уменьшала их
  const hrsLive=(u.bks||[]).filter(b=>b.status!=='cancelled').reduce((s,b)=>{let d=timeToMinJS(b.end)-timeToMinJS(b.start);if(d<=0)d+=1440;return s+d/60},0)
  countUp($('st-hr'),Math.round(hrsLive))
  countUp(document.getElementById('st-pts'),u.pts||0)
  // Обновляем аватарку в топбаре
  const topavIn=document.getElementById('topav-inner')
  if(topavIn){
    if(u._tgPhoto){
      topavIn.innerHTML=`<img src="${u._tgPhoto}" style="width:100%;height:100%;object-fit:cover" alt="">`
      // Фото из Telegram не загрузилось — показываем ☠️ (раньше обработчик был с ошибкой в кавычках)
      topavIn.querySelector('img').onerror=function(){this.parentElement.innerHTML='<span style="font-size:18px">☠️</span>'}
      topavIn.style.background='none'
    } else if(u.reg&&u.name){
      topavIn.innerHTML=`<span style="font-family:var(--F);font-size:16px;font-weight:800;color:var(--lime)">${u.name[0].toUpperCase()}</span>`
      topavIn.style.background='linear-gradient(135deg,var(--lime15),var(--s3))'
    }
  }
  // Аватарка в шапке профиля
  const phAvIn=document.getElementById('ph-av-inner')
  if(phAvIn){
    if(u._tgPhoto){
      phAvIn.innerHTML=`<img src="${u._tgPhoto}" style="width:100%;height:100%;object-fit:cover;display:block" alt="">`
      phAvIn.querySelector('img').onerror=function(){this.outerHTML='<span style="font-size:26px">☠️</span>'}
    } else {
      const letter=u.name?.[0]?.toUpperCase()||'☠️'
      phAvIn.innerHTML=`<span style="font-family:var(--F);font-size:26px;font-weight:800;color:var(--lime)">${letter}</span>`
    }
  }
  const badge=$('ph-badge')
  if(badge){badge.textContent=u.reg?_('registered'):_('notReg');badge.className='B '+(u.reg?'Bl':'Br')}
  const bb=$('bonus-blk');if(bb)bb.style.display=u.reg?'none':'block'
  // snake highscore
  const hsel=document.getElementById('snake-hs')
  if(hsel)hsel.textContent='HIGHSCORE: '+(D.user._snakeHs||0)
  _sk.hs=D.user._snakeHs||0
  const pc=$('prof-card')
  if(u.reg&&u.phone){
    const pts=u.pts||0
    const bkCount=(u.bks||[]).length
    const combinedScore=pts+bkCount*5
    const lvls=[{m:500,l:'👑 BOSS',c:'#ff9f47'},{m:300,l:'🥇 LEGEND',c:'var(--gold)'},{m:150,l:'💎 ELITE',c:'var(--cyan)'},{m:75,l:'🔥 VETERAN',c:'var(--lime)'},{m:30,l:'⚡ PLAYER',c:'#6ee7f7'},{m:0,l:'🎮 ROOKIE',c:'var(--t2)'}]
    const lv=lvls.find(x=>combinedScore>=x.m)||lvls[5]
    const lvl=lv.l;const lvlColor=lv.c
    pc.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:var(--s2);border:1px solid var(--b1);border-radius:var(--R);overflow:hidden;margin-bottom:4px">
      <div style="padding:14px;border-right:1px solid var(--b1)">
        <div style="font-size:9px;color:var(--t2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">☎️ Телефон</div>
        <div style="font-family:var(--m);font-size:10px;font-weight:600;color:var(--txt)">${u.phone}</div>
      </div>
      <div style="padding:14px;border-right:1px solid var(--b1)">
        <div style="font-size:9px;color:var(--t2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">🎂 Возраст</div>
        <div style="font-family:var(--m);font-size:14px;font-weight:700">${u.age||'—'}</div>
      </div>
      <div style="padding:14px">
        <div style="font-size:9px;color:var(--t2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">🎮 Уровень</div>
        <div style="font-family:var(--m);font-size:10px;font-weight:700;color:${lvlColor}">${lvl}</div>
      </div>
    </div>
    <button class="BTN ghost sm" onclick="openRegModal()" style="width:100%;margin-top:6px;font-size:12px">✏️ Редактировать профиль</button>`
  } else { pc.innerHTML='' }
  // Recent bookings
  const bksEl=document.getElementById('prof-bks')
  if(bksEl&&u.bks&&u.bks.length){
    bksEl.style.display='block'
    const recent=u.bks.slice(0,3)
    bksEl.innerHTML=`<div style="font-family:var(--F);font-size:13px;font-weight:700;color:var(--t2);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Последние брони</div>`+
    recent.map(b=>`<div style="background:var(--s2);border:1px solid var(--b1);border-radius:14px;padding:13px 15px;margin-bottom:7px;display:flex;align-items:center;gap:12px">
      <div style="font-size:22px">${b.zone==='vip'?'👑':(b.zone==='bootcamp'||b.zone==='bc')?'⚡':'🖥'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.pc} · ${b.pkg}</div>
        <div style="font-size:11px;color:var(--t2);margin-top:2px;font-family:var(--m)">${b.date} · ${b.start}–${b.end}</div>
      </div>
      <div style="font-family:var(--m);font-size:13px;font-weight:700;color:var(--lime);flex-shrink:0">${b.price} BYN</div>
    </div>`).join('')
  } else if(bksEl){ bksEl.style.display='none' }
  // Блок бонусных баллов: баланс, шкала наград, ваучеры (js/screens/rewards.js)
  renderPoints()
  if(u._tgId){loadServerPoints();loadVouchers()}
  // Статус в зависимости от баллов и количества бронирований
  const stEl=document.getElementById('ps-status')?.querySelector('.ps-n')
  if(stEl){
    const myPts=u.pts||0
    const myBks=(u.bks||[]).length
    // Комбинированный score: баллы + бронирования*5
    const score=myPts+myBks*5
    const levels=[
      {min:500,icon:'👑',name:'BOSS',    color:'#ff9f47'},
      {min:300,icon:'🥇',name:'LEGEND',  color:'var(--gold)'},
      {min:150,icon:'💎',name:'ELITE',   color:'var(--cyan)'},
      {min:75, icon:'🔥',name:'VETERAN', color:'var(--lime)'},
      {min:30, icon:'⚡',name:'PLAYER',  color:'#6ee7f7'},
      {min:0,  icon:'🎮',name:'ROOKIE',  color:'var(--t2)'},
    ]
    const lvl=levels.find(l=>score>=l.min)||levels[levels.length-1]
    stEl.textContent=lvl.icon;stEl.style.color=lvl.color
    if(stEl.nextElementSibling) stEl.nextElementSibling.textContent=lvl.name
  }

  // ── Статистика пользователя ──
  const emptyBlk=document.getElementById('prof-empty')
  if(emptyBlk)emptyBlk.style.display=(u.reg&&(!u.bks||u.bks.length===0))?'block':'none'
  const statsBlk=document.getElementById('user-stats-blk')
  if(statsBlk&&u.bks&&u.bks.length>0){
    statsBlk.style.display='block'
    const bks=u.bks.filter(b=>b.status!=='cancelled')
    const totalBks=bks.length

    // Часы
    let totalHrs=0
    bks.forEach(b=>{
      const bs=timeToMinJS(b.start),be=timeToMinJS(b.end)
      let dur=be-bs;if(dur<=0)dur+=1440
      totalHrs+=dur/60
    })

    // Любимая зона
    const zoneCounts={}
    bks.forEach(b=>{zoneCounts[b.zone]=(zoneCounts[b.zone]||0)+1})
    const favZone=Object.entries(zoneCounts).sort((a,b)=>b[1]-a[1])[0]
    const zoneNames={std:'Standard',vip:'VIP',bootcamp:'Bootcamp',bc:'Bootcamp'}

    // Любимый ПК
    const pcCounts={}
    bks.forEach(b=>{pcCounts[b.pc]=(pcCounts[b.pc]||0)+1})
    const favPc=Object.entries(pcCounts).sort((a,b)=>b[1]-a[1])[0]

    // Любимый день
    const dayCounts={}
    const dayNames=['Вс','Пн','Вт','Ср','Чт','Пт','Сб']
    bks.forEach(b=>{
      try{
        const p=String(b.date).split('.');if(p.length===3){
          const d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]))
          const day=dayNames[d.getDay()]
          dayCounts[day]=(dayCounts[day]||0)+1
        }
      }catch(e){}
    })
    const favDay=Object.entries(dayCounts).sort((a,b)=>b[1]-a[1])[0]

    // Средний сеанс
    const avgHrs=totalBks>0?Math.round(totalHrs/totalBks*10)/10:0

    // Заполняем
    const $=id=>document.getElementById(id)
    if($('stat-bookings'))$('stat-bookings').textContent=totalBks
    if($('stat-hours'))$('stat-hours').textContent=Math.round(totalHrs)+'ч'
    if($('stat-fav-zone'))$('stat-fav-zone').textContent=favZone?zoneNames[favZone[0]]||favZone[0]:'—'
    if($('stat-fav-pc'))$('stat-fav-pc').textContent=favPc?favPc[0]:'—'
    if($('stat-fav-day'))$('stat-fav-day').textContent=favDay?favDay[0]:'—'
    if($('stat-avg-hrs'))$('stat-avg-hrs').textContent=avgHrs?avgHrs+'ч':'—'
    if($('stat-streak'))$('stat-streak').textContent=u._snakeHs||0
  } else if(statsBlk){statsBlk.style.display='none'}

  // ── Достижения ──
  const achBlk=document.getElementById('achievements-blk')
  if(achBlk){
    const achs=getAchievements()
    const done=achs.filter(a=>a.done).length
    achBlk.style.display='block'
    document.getElementById('ach-counter').textContent=done+'/'+achs.length
    const grid=document.getElementById('ach-grid')
    grid.innerHTML=achs.map(a=>`<div onclick="toast('${a.done?'✅':'🔒'} ${a.name}: ${a.desc}')" style="flex-shrink:0;width:74px;text-align:center;padding:12px 6px;border-radius:14px;background:${a.done?'linear-gradient(160deg,rgba(255,202,80,.12),rgba(255,202,80,.03))':'var(--s2)'};border:1px solid ${a.done?'rgba(255,202,80,.25)':'var(--b1)'};cursor:pointer;transition:transform .15s;${a.done?'box-shadow:0 0 16px rgba(255,202,80,.1)':''}">
      <div style="font-size:26px;${a.done?'filter:drop-shadow(0 0 6px rgba(255,202,80,.5))':'filter:grayscale(1);opacity:.28'}">${a.icon}</div>
      <div style="font-size:8.5px;color:${a.done?'var(--gold)':'var(--t3)'};margin-top:6px;line-height:1.2;font-weight:600">${a.name}</div>
    </div>`).join('')
  }
}

// ═══════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════
// ДД.ММ.ГГГГ по мере ввода: точки ставятся сами
function maskDate(v){
  const d=String(v||'').replace(/\D/g,'').slice(0,8)
  return d.slice(0,2)+(d.length>2?'.'+d.slice(2,4):'')+(d.length>4?'.'+d.slice(4):'')
}
// «17.05.2000» → {str, age} · '' → пусто (поле необязательное) · null → такой даты нет
function parseBday(v){
  const t=String(v||'').trim();if(!t)return {str:'',age:''}
  const m=t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);if(!m)return null
  const dd=+m[1],mm=+m[2],yy=+m[3],dt=new Date(Date.UTC(yy,mm-1,dd))
  if(dt.getUTCFullYear()!==yy||dt.getUTCMonth()!==mm-1||dt.getUTCDate()!==dd)return null
  const p=clubNow().date.split('.').map(Number)
  let age=p[2]-yy;if(p[1]<mm||(p[1]===mm&&p[0]<dd))age--
  if(age<5||age>100)return null
  return {str:t,age:String(age)}
}
const phoneOk=v=>{const d=String(v||'').replace(/\D/g,'');return d.length===12&&d.startsWith('375')}
// Ошибка под полем (пустая строка — убрать)
function regErr(field,msg){
  const f=document.getElementById('rg-f-'+field);if(!f)return
  f.classList.toggle('err',!!msg)
  const e=f.querySelector('.rg-e');if(e)e.textContent=msg||''
}
function regMarks(){
  const ph=document.getElementById('r-phone'),bd=document.getElementById('r-bday')
  document.getElementById('rg-f-phone').classList.toggle('ok',phoneOk(ph.value))
  const b=parseBday(bd.value)
  document.getElementById('rg-f-bday').classList.toggle('ok',!!(b&&b.str))
}

function openRegModal(){
  openM('reg-m')
  const u=D.user,$=id=>document.getElementById(id)
  const nameEl=$('r-name'),phoneEl=$('r-phone'),bdEl=$('r-bday')
  if(!phoneEl._mask){
    phoneEl._mask=true
    // Телефон набирается сразу в формате +375 XX XXX-XX-XX
    phoneEl.addEventListener('input',()=>{phoneEl.value=maskPhone(phoneEl.value);regErr('phone','');regMarks()})
    phoneEl.addEventListener('focus',()=>{if(!phoneEl.value)phoneEl.value='+375 '})
    phoneEl.addEventListener('blur',()=>{if(phoneEl.value.replace(/\D/g,'')==='375')phoneEl.value=''})
    bdEl.addEventListener('input',()=>{bdEl.value=maskDate(bdEl.value);regErr('bday','');regMarks()})
    nameEl.addEventListener('input',()=>regErr('name',''))
    // Enter ведёт по полям, на последнем — сохраняет
    nameEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();phoneEl.focus()}})
    phoneEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();bdEl.focus()}})
    bdEl.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveReg()}})
    // Клавиатура не должна закрывать поле, в которое печатают
    ;[nameEl,phoneEl,bdEl].forEach(el=>el.addEventListener('focus',()=>setTimeout(()=>scrollToEl(el),280)))
  }
  ;['name','phone','bday'].forEach(f=>regErr(f,''))
  // Аватар: фото из Telegram, иначе первая буква имени
  const av=$('rg-av'),letter=String(u.reg?u.name:'').trim()[0]
  if(u._tgPhoto){av.innerHTML=`<img src="${u._tgPhoto}" alt="">`;av.querySelector('img').onerror=function(){av.textContent='🎮'}}
  else av.textContent=letter?letter.toUpperCase():'🎮'
  $('rg-l-name').textContent=T('Имя или ник','Name or nickname')
  $('rg-l-phone').textContent=T('Телефон','Phone')
  $('rg-l-bday').textContent=T('Дата рождения','Date of birth')
  $('rg-opt').textContent=T('необязательно','optional')
  $('rg-h-phone').textContent=T('Только чтобы подтвердить бронь — без рекламы и звонков','Only to confirm your booking — no ads, no calls')
  $('rg-h-bday').innerHTML=T('Подарим <b>+50 ⭐</b> в твой день','We gift <b>+50 ⭐</b> on your day')
  nameEl.placeholder=T('Как тебя зовут?','What should we call you?')
  bdEl.placeholder=T('ДД.ММ.ГГГГ','DD.MM.YYYY')
  $('rg-save').textContent=T('Сохранить','Save')
  if(u.reg){
    // Уже зарегистрирован — режим редактирования
    $('reg-title').textContent=T('Мой профиль','My profile')
    $('rg-sub').textContent=T('Исправь, если что-то изменилось','Update anything that changed')
    $('rg-perks').innerHTML=''
    $('rg-later').textContent=T('Отмена','Cancel')
    nameEl.value=u.name||'';phoneEl.value=u.phone||'';bdEl.value=u.bday||''
  }else{
    $('reg-title').textContent=T('Давай знакомиться','Let’s get you set up')
    $('rg-sub').textContent=T('Три поля — и бронь в пару касаний','Three fields — then booking takes two taps')
    $('rg-perks').innerHTML=[['⚡',T('Бронь','Booking'),T('без ввода данных','with no retyping')],['⭐',T('Баллы','Points'),T('за каждую игру','for every session')],['🎂','+50 ⭐',T('в день рождения','on your birthday')]]
      .map(x=>`<div><i>${x[0]}</i><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')
    $('rg-later').textContent=T('Позже','Later')
    try{
      const tu=window.Telegram?.WebApp?.initDataUnsafe?.user
      if(!nameEl.value&&tu?.first_name)nameEl.value=(tu.first_name+(tu.last_name?' '+tu.last_name:'')).trim()
    }catch(e){}
    if(u.name&&u.name!=='Toxic Player'&&!nameEl.value)nameEl.value=u.name
    if(u.phone&&!phoneEl.value)phoneEl.value=u.phone
    if(u.bday&&!bdEl.value)bdEl.value=u.bday
  }
  regMarks()
}

function saveReg(){
  const wasNew=!D.user.reg,$=id=>document.getElementById(id)
  const name=$('r-name').value.trim().replace(/\s+/g,' ')
  const phone=$('r-phone').value.trim()
  const bd=parseBday($('r-bday').value)
  // Все ошибки — сразу и под своими полями (раньше была одна всплывашка, а поле не подсвечивалось)
  const eName=name.length<2?T('Минимум 2 символа','At least 2 characters'):(name.length>40||/[<>{}]/.test(name))?T('Без символов < > { }','No < > { } symbols'):''
  const ePhone=phoneOk(phone)?'':T('Белорусский номер: +375 XX XXX-XX-XX','Belarus number: +375 XX XXX-XX-XX')
  const eBday=bd?'':T('Такой даты нет — проверь день, месяц и год','That date does not exist — check day, month and year')
  regErr('name',eName);regErr('phone',ePhone);regErr('bday',eBday)
  if(eName||ePhone||eBday){
    haptic('err')
    const first=$(eName?'r-name':ePhone?'r-phone':'r-bday')
    try{first.focus({preventScroll:true})}catch(e){}
    scrollToEl(first)
    return
  }
  const formatted=maskPhone(phone)
  Object.assign(D.user,{name,phone:formatted,age:bd.str?bd.age:(D.user.age||''),bday:bd.str,reg:true,handle:name.toLowerCase().replace(/[^a-zа-яё0-9]/gi,'_').substring(0,30)})
  sv();closeM('reg-m');renderProfile();renderOb()
  const gn=document.getElementById('gr-n');if(gn)gn.textContent=name
  haptic('ok')
  toast(T('Профиль сохранён','Profile saved'),'✅')
  // Новичку (только при ПЕРВОЙ регистрации) — показываем подсказки
  if(wasNew&&!D.user._hintsSeen){D.user._wnSeen=WN_VERSION;sv();go('home');setTimeout(startHints,600)}
  else if(!wasNew&&D.user._hintsSeen===undefined){D.user._hintsSeen=true;sv()}
  // Синхронизируем на сервер (для дня рождения)
  if(D.user._tgId){
    fetch(API_URL+'?'+new URLSearchParams({action:'saveUserProfile',tgId:D.user._tgId,user:name,phone:formatted,birthday:bd.str,_t:Date.now()})).catch(()=>{})
  }
}
