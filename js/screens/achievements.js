// Избранные ПК, достижения, отзывы

// ═══ ЛЮБИМЫЙ ПК ═══
function toggleFavPc(lbl){
  if(!D.user._favPcs)D.user._favPcs=[]
  const idx=D.user._favPcs.indexOf(lbl)
  if(idx>=0){D.user._favPcs.splice(idx,1);toast('💔 '+lbl+' убран из избранного')}
  else{D.user._favPcs.push(lbl);toast('❤️ '+lbl+' — твой любимый ПК!')}
  sv()
}

// ═══ ДОСТИЖЕНИЯ ═══
function getAchievements(){
  const u=D.user, bks=(u.bks||[]).filter(b=>b.status!=='cancelled')
  const totalBks=bks.length
  const totalHrs=bks.reduce((s,b)=>{const bs=timeToMinJS(b.start),be=timeToMinJS(b.end);let d=be-bs;if(d<=0)d+=1440;return s+d/60},0)
  const nightBks=bks.filter(b=>timeToMinJS(b.start)>=22||timeToMinJS(b.start)<6).length
  const vipBks=bks.filter(b=>b.zone==='vip').length
  const bcBks=bks.filter(b=>b.zone==='bootcamp'||b.zone==='bc').length
  const uniqueDays=new Set(bks.map(b=>b.date)).size
  const pts=u.pts||0
  const snakeHs=u._snakeHs||0

  const all=[
    {id:'first',     icon:'🎮',name:'Первый визит',     desc:'Сделай первую бронь',         done:totalBks>=1},
    {id:'regular',   icon:'🔥',name:'Завсегдатай',      desc:'5 бронирований',              done:totalBks>=5},
    {id:'veteran',   icon:'⚡',name:'Ветеран',           desc:'15 бронирований',             done:totalBks>=15},
    {id:'legend',    icon:'👑',name:'Легенда клуба',     desc:'50 бронирований',             done:totalBks>=50},
    {id:'night',     icon:'🌙',name:'Ночной игрок',     desc:'5 ночных бронирований',       done:nightBks>=5},
    {id:'vip',       icon:'💎',name:'VIP персона',       desc:'5 бронирований VIP',          done:vipBks>=5},
    {id:'bootcamp',  icon:'🏆',name:'Bootcamp воин',    desc:'5 бронирований Bootcamp',     done:bcBks>=5},
    {id:'marathon',  icon:'⏱',name:'Марафонец',         desc:'Наиграй 100 часов',           done:totalHrs>=100},
    {id:'week',      icon:'📅',name:'Неделя подряд',    desc:'Посещай 7 разных дней',       done:uniqueDays>=7},
    {id:'collector', icon:'⭐',name:'Коллекционер',     desc:'Накопи 100 баллов',           done:pts>=100},
    {id:'snake',     icon:'🐍',name:'Змеиный мастер',   desc:'Набери 20 в Snake',           done:snakeHs>=20},
    {id:'allzones',  icon:'🗺',name:'Исследователь',    desc:'Играй во всех 3 зонах',      done:bks.some(b=>b.zone==='std')&&bks.some(b=>b.zone==='vip')&&(bks.some(b=>b.zone==='bc')||bks.some(b=>b.zone==='bootcamp'))},
  ]
  return all
}

// ═══ ОТЗЫВЫ ═══
function showReviewModal(){
  if(!D.user._tgId){toast('Нужен Telegram','⚠️');return}
  const modal=document.createElement('div')
  modal.className='MBG open';modal.style.zIndex='400'
  modal.innerHTML=`<div class="MOD" style="transform:none;max-height:86%">
    <div class="MH"></div>
    <div style="text-align:center;padding:2px 0 14px">
      <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;margin-bottom:12px">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(255,202,80,.22),transparent 68%);animation:glow-pulse 2.6s ease-in-out infinite"></div>
        <div style="position:absolute;inset:7px;border-radius:50%;border:1.5px solid rgba(255,202,80,.28)"></div>
        <span style="position:relative;font-size:36px">💬</span>
      </div>
      <div style="font-family:var(--F);font-size:23px;font-weight:800;letter-spacing:-.4px;background:linear-gradient(120deg,#fff 28%,var(--gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">Как тебе у нас?</div>
      <div style="font-size:12.5px;color:var(--t2);margin-top:6px;line-height:1.6">Честный отзыв помогает нам становиться лучше</div>
    </div>

    <div style="padding:18px 16px;border-radius:18px;background:linear-gradient(165deg,var(--s2),var(--s1));border:1px solid var(--b1);margin-bottom:13px">
      <div id="rv-stars" style="display:flex;justify-content:center;gap:9px">
        ${[1,2,3,4,5].map(n=>`<div class="rv-star" data-n="${n}" style="font-size:34px;cursor:pointer;opacity:.28;transition:opacity .18s var(--e),transform .18s var(--e)" onclick="selectStar(${n})">⭐</div>`).join('')}
      </div>
      <div id="rv-label" style="text-align:center;font-size:13.5px;font-weight:800;color:var(--gold);margin-top:12px;min-height:20px">Поставь оценку</div>
    </div>

    <div style="padding:13px 15px;border-radius:15px;background:var(--s1);border:1px solid var(--b1);margin-bottom:16px">
      <div style="font-size:9.5px;font-weight:700;color:var(--t3);letter-spacing:1.8px;text-transform:uppercase;margin-bottom:8px">✍️ Пара слов <span style="opacity:.6;letter-spacing:0;text-transform:none">— по желанию</span></div>
      <textarea id="rv-text" placeholder="Что понравилось? Что можно улучшить?" style="width:100%;height:82px;padding:12px;border-radius:12px;background:var(--s2);border:1px solid var(--b2);color:var(--txt);font-size:13px;resize:none;font-family:var(--f);line-height:1.55"></textarea>
    </div>

    <div style="display:flex;flex-direction:column;gap:9px">
      <button class="BTN" id="rv-send" style="background:linear-gradient(135deg,var(--gold),#ffb84d);color:#000;font-weight:800" onclick="sendReview()">Отправить отзыв</button>
      <button class="BTN ghost" onclick="this.closest('.MBG').remove()">Может позже</button>
    </div>
  </div>`
  modal.onclick=e=>{if(e.target===modal)modal.remove()}
  document.getElementById('app').appendChild(modal)
}
let _rvRating=0
function selectStar(n){
  _rvRating=n
  const L=['','Очень плохо 😞','Плохо 😕','Нормально 🙂','Хорошо 😃','Отлично! 🔥']
  document.querySelectorAll('.rv-star').forEach(s=>{
    const k=+s.dataset.n
    s.style.opacity=k<=n?'1':'.28'
    s.style.transform=k<=n?'scale(1.14)':'scale(1)'
    if(k===n){s.style.transform='scale(1.3)';setTimeout(()=>{if(s.style)s.style.transform='scale(1.14)'},170)}
  })
  const lb=document.getElementById('rv-label')
  if(lb){lb.textContent=L[n];lb.style.color=n<=2?'var(--red)':n===3?'var(--gold)':'var(--lime)'}
}
async function sendReview(){
  if(_rvRating===0){toast('Поставь оценку','⚠️');return}
  const text=document.getElementById('rv-text')?.value.trim()||''
  const btn=document.getElementById('rv-send')
  btn.innerHTML='<span class="spin"></span>';btn.disabled=true
  try{
    await fetch(API_URL+'?'+new URLSearchParams({
      action:'submitReview',
      tgId:D.user._tgId||'',
      user:D.user.name||'Гость',
      rating:_rvRating,
      text:text,
      _t:Date.now()
    }))
    // Сохраняем что оставили отзыв
    D.user._lastReview=Date.now();sv()
    document.querySelector('.MBG[style*="z-index"]')?.remove()
    toast('Спасибо за отзыв! ⭐','⭐')
  }catch(e){
    btn.innerHTML='📤 Отправить отзыв';btn.disabled=false
    toast('Ошибка отправки','⚠️')
  }
}
