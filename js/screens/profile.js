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
  // Блок бонусных баллов
  const bpBlk=document.getElementById('bonus-pts-blk')
  const ptsVal=document.getElementById('pts-val')
  if(bpBlk&&u.reg){
    bpBlk.style.display='block'
    const pts=u.pts||0
    if(ptsVal) countUp(ptsVal,pts)
    // Подсветка доступных наград
    document.querySelectorAll('.rw-btn').forEach(b=>{
      const cost=+b.dataset.cost||0
      const ok=pts>=cost
      b.classList.toggle('locked',!ok)
      const go=b.querySelector('.rw-go')
      if(go){go.textContent=ok?'›':'🔒';go.style.color=ok?'var(--lime)':'var(--t3)'}
    })
    // Прогресс-бар — пороги по каталогу наград
    const thresholds=[40,100,170,300]
    const next=thresholds.find(t=>pts<t)||400
    const prev=[0,...thresholds].filter(t=>t<=pts).pop()||0
    const pct=next>prev?Math.min(100,Math.round(((pts-prev)/(next-prev))*100)):100
    const fill=document.getElementById('pts-bar-fill')
    const lbl=document.getElementById('pts-next-label')
    const nextVal=document.getElementById('pts-next-val')
    if(fill) fill.style.width=pct+'%'
    const labels={40:'1 час Standard',100:'3 часа Standard',170:'5 часов Standard',300:'5 часов VIP'}
    const rem=next-pts
    if(lbl)lbl.textContent=labels[next]?`До «${labels[next]}»`:'Максимум наград'
    if(nextVal)nextVal.textContent=pts<400?`ещё ${rem} ⭐`:'✓'
    // Загружаем актуальный баланс с сервера (тихо)
    if(u._tgId) loadServerPoints()
  }else if(bpBlk)bpBlk.style.display='none'
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
function openRegModal(){
  openM('reg-m')
  const u=D.user
  // Телефон набирается сразу в формате +375 XX XXX-XX-XX
  const ph=document.getElementById('r-phone')
  if(ph&&!ph._mask){ph._mask=true;ph.addEventListener('input',()=>{ph.value=maskPhone(ph.value)});ph.addEventListener('focus',()=>{if(!ph.value)ph.value='+375 '})}
  const nameEl=document.getElementById('r-name')
  const phoneEl=document.getElementById('r-phone')
  const ageEl=document.getElementById('r-bday')
  const titleEl=document.querySelector('#reg-m .MT')
  // Если уже зарегистрирован — режим редактирования
  if(u.reg){
    if(titleEl)titleEl.textContent=D.lang==='en'?'Edit profile':D.lang==='zh'?'编辑资料':'Редактировать профиль'
    if(nameEl)nameEl.value=u.name||''
    if(phoneEl)phoneEl.value=u.phone||''
    // bday хранится dd.MM.yyyy → конвертируем в yyyy-MM-dd для input[type=date]
    if(ageEl&&u.bday){const p=u.bday.split('.');if(p.length===3)ageEl.value=p[2]+'-'+p[1]+'-'+p[0]}
  }else{
    if(titleEl)titleEl.textContent=I18N[D.lang].regTitle
    try{
      const tu=window.Telegram?.WebApp?.initDataUnsafe?.user
      if(nameEl&&!nameEl.value&&tu?.first_name)nameEl.value=(tu.first_name+(tu.last_name?' '+tu.last_name:'')).trim()
    }catch(e){}
    if(u.name&&nameEl&&!nameEl.value)nameEl.value=u.name
    if(u.phone&&phoneEl&&!phoneEl.value)phoneEl.value=u.phone
    if(u.bday&&ageEl&&!ageEl.value){const p=u.bday.split('.');if(p.length===3)ageEl.value=p[2]+'-'+p[1]+'-'+p[0]}
  }
}

function saveReg(){
  const wasNew=!D.user.reg
  const name=document.getElementById('r-name').value.trim()
  const phone=document.getElementById('r-phone').value.trim()
  const bday=document.getElementById('r-bday')?.value||''
  const L=D.lang
  // ── Имя: 2-40 символов, без HTML ──
  if(!name||name.length<2){
    toast(L==='en'?'Name must be at least 2 characters':L==='zh'?'姓名至少2个字符':'Имя минимум 2 символа','⚠️');return
  }
  if(name.length>40||/[<>{}]/.test(name)){
    toast(L==='en'?'Invalid name':L==='zh'?'无效姓名':'Недопустимое имя','⚠️');return
  }
  // ── Телефон: строго +375 (Беларусь) ──
  const phoneDigits=phone.replace(/\D/g,'')
  if(!phoneDigits.startsWith('375')||phoneDigits.length!==12){
    toast(L==='en'?'Phone must be +375 XX XXX-XX-XX':L==='zh'?'电话必须是 +375 格式':'Формат: +375 XX XXX-XX-XX','⚠️')
    const el=document.getElementById('phone-err')
    if(el){el.style.display='block';el.textContent=L==='en'?'Belarus number +375 required':L==='zh'?'需要白俄罗斯号码 +375':'Нужен белорусский номер +375'}
    return
  }
  // Скрываем ошибку телефона
  const phoneErr=document.getElementById('phone-err');if(phoneErr)phoneErr.style.display='none'
  // ── Форматируем телефон красиво ──
  const formatted='+'+phoneDigits.slice(0,3)+' '+phoneDigits.slice(3,5)+' '+phoneDigits.slice(5,8)+'-'+phoneDigits.slice(8,10)+'-'+phoneDigits.slice(10,12)
  // ── Дата рождения → dd.MM.yyyy + возраст ──
  let bdayStr='',age=''
  if(bday){
    const bd=new Date(bday)
    if(!isNaN(bd.getTime())){
      bdayStr=String(bd.getDate()).padStart(2,'0')+'.'+String(bd.getMonth()+1).padStart(2,'0')+'.'+bd.getFullYear()
      const now=new Date();let a=now.getFullYear()-bd.getFullYear()
      const m=now.getMonth()-bd.getMonth();if(m<0||(m===0&&now.getDate()<bd.getDate()))a--
      if(a>=0&&a<=120)age=String(a)
    }
  }
  Object.assign(D.user,{name,phone:formatted,age:age||D.user.age||'',bday:bdayStr,reg:true,handle:name.toLowerCase().replace(/[^a-zа-яё0-9]/gi,'_').substring(0,30)})
  sv();closeM('reg-m');renderProfile()
  const gn=document.getElementById('gr-n');if(gn)gn.textContent=name
  toast(L==='en'?'Profile saved!':L==='zh'?'资料已保存！':'Профиль сохранён ✓')
  // Новичку (только при ПЕРВОЙ регистрации) — показываем подсказки
  if(wasNew&&!D.user._hintsSeen){D.user._wnSeen=WN_VERSION;sv();go('home');setTimeout(startHints,600)}
  else if(!wasNew&&D.user._hintsSeen===undefined){D.user._hintsSeen=true;sv()}
  // Синхронизируем на сервер (для дня рождения)
  if(D.user._tgId){
    fetch(API_URL+'?'+new URLSearchParams({action:'saveUserProfile',tgId:D.user._tgId,user:name,phone:formatted,birthday:bdayStr,_t:Date.now()})).catch(()=>{})
  }
}
