// Подсказки новичкам и «Что нового»

// ═══ ПОДСКАЗКИ ДЛЯ НОВИЧКОВ (coach-marks) ═══
const HINTS=[
  {sel:null,ico:'🎮',title:'Добро пожаловать!',text:'Покажем главное за 20 секунд — где бронировать, как копить баллы и что где лежит.'},
  {sel:'[data-tour="zones"]',ico:'⚡',title:'Выбери зону',text:'Standard, VIP или Bootcamp. Дальше — пакет или <b>своё время</b> от 30 минут, точное время и свободный ПК.'},
  {sel:'[data-tour="group"]',ico:'👥',title:'Пришёл с друзьями?',text:'Забронируй <b>до 8 ПК рядом</b> одной бронью — приложение само подберёт соседние места.'},
  {sel:'[data-tour="nav-bklist"]',ico:'📅',title:'Твои брони',text:'Активные сеансы здесь. Бот напомнит за 30 минут до игры.'},
  {sel:'[data-tour="nav-profile"]',ico:'⭐',title:'Профиль и баллы',text:'Звёзды, статистика и достижения. Меняй ⭐ на <b>бесплатные часы</b> — от 40 за час.'}
]

let _hintIdx=0,_hintRetry=0,_hintManual=false
function startHints(manual){
  _hintManual=!!manual
  if(!manual&&D.user._hintsSeen)return
  // Закрываем всё, что открыто — тур должен быть один на экране
  document.querySelectorAll('.MBG.open').forEach(m=>m.classList.remove('open'))
  if(D.cur!=='home')go('home')
  _hintIdx=0;_hintRetry=0
  const ov=document.getElementById('hints-overlay')
  if(!ov)return
  setTimeout(()=>{ov.style.display='block';showHint()},manual?220:0)
}
function showHint(){
  const h=HINTS[_hintIdx];if(!h){endHints(true);return}
  const sp=document.getElementById('hint-spotlight')
  const dim=document.getElementById('hint-dim')
  const card=document.getElementById('hint-card')
  const ico=document.getElementById('hint-ico')
  const stp=document.getElementById('hint-step')
  const ttl=document.getElementById('hint-title')
  const txt=document.getElementById('hint-text')
  const dots=document.getElementById('hint-dots')
  const nx=document.getElementById('hint-next')
  if(!sp||!card){endHints(false);return}

  // ── Содержимое карточки ──
  ;[ico,ttl,txt].forEach(el=>{if(el){el.style.transition='none';el.style.opacity='0'}})
  requestAnimationFrame(()=>{
    if(ico)ico.textContent=h.ico
    if(stp)stp.textContent='ШАГ '+(_hintIdx+1)+' ИЗ '+HINTS.length
    if(ttl)ttl.textContent=h.title
    if(txt)txt.innerHTML=h.text
    ;[ico,ttl,txt].forEach((el,k)=>{if(el){el.style.transition='opacity .34s var(--e) '+(k*55)+'ms';el.style.opacity='1'}})
  })
  if(dots)dots.innerHTML=HINTS.map((_,k)=>`<div style="width:${k===_hintIdx?'22px':'6px'};height:6px;border-radius:3px;background:${k===_hintIdx?'var(--lime)':'#2a2f38'};transition:all .34s var(--e)"></div>`).join('')
  if(nx)nx.textContent=_hintIdx===HINTS.length-1?'Погнали! 🎮':'Далее'

  // Замеряем после отрисовки кадра — иначе позиции «плывут»
  const app=document.getElementById('app').getBoundingClientRect()
  const H=app.height, W=app.width

  // ── Шаг без подсветки: карточка по центру ──
  if(!h.sel){
    sp.style.opacity='0'
    const ring0=document.getElementById('hint-ring');if(ring0)ring0.style.opacity='0'
    if(dim)dim.style.opacity='1'
    card.style.top='';card.style.bottom=''
    card.style.top=Math.round(H/2-110)+'px'
    return
  }

  const target=document.querySelector(h.sel)
  const r=target?target.getBoundingClientRect():null
  if(!target||!r||r.width===0||r.height===0){
    if(_hintRetry++<10){setTimeout(showHint,150);return}
    _hintRetry=0;_hintIdx++
    if(_hintIdx>=HINTS.length){endHints(true);return}
    setTimeout(showHint,40);return
  }
  _hintRetry=0
  if(dim)dim.style.opacity='0'

  // ── Подсветка строго внутри экрана ──
  const pad=9
  let L=r.left-app.left-pad, T=r.top-app.top-pad
  let SW=r.width+pad*2, SH=r.height+pad*2
  if(L<6){SW+=L-6;L=6}
  if(T<6){SH+=T-6;T=6}
  if(L+SW>W-6)SW=W-6-L
  if(T+SH>H-6)SH=H-6-T
  let rad=18
  try{rad=Math.min(26,(parseFloat(getComputedStyle(target).borderRadius)||14)+7)}catch(e){}
  // Двигаем/растягиваем ЧЕРЕЗ transform — слой кэшируется, экран не перерисовывается
  sp.style.transform='translate3d('+Math.round(L)+'px,'+Math.round(T)+'px,0) scale('+(SW/100)+','+(SH/100)+')'
  sp.style.opacity='1'
  const ring=document.getElementById('hint-ring')
  if(ring){
    ring.style.borderRadius=rad+'px'
    ring.style.left=Math.round(L)+'px';ring.style.top=Math.round(T)+'px'
    ring.style.width=Math.round(SW)+'px';ring.style.height=Math.round(SH)+'px'
    ring.style.opacity='1'
  }

  // ── Карточка: снизу или сверху от подсветки, всегда в экране ──
  const cardH=card.offsetHeight||200
  const gap=18, margin=14
  const spotBottom=T+SH, spotTop=T
  let top
  if(spotBottom+gap+cardH+margin<=H) top=spotBottom+gap          // под подсветкой
  else if(spotTop-gap-cardH>=margin) top=spotTop-gap-cardH        // над подсветкой
  else top=Math.max(margin,H-cardH-margin)                        // прижать к низу
  card.style.bottom=''
  card.style.top=Math.round(top)+'px'
}
function nextHint(){
  _hintIdx++;_hintRetry=0
  if(_hintIdx>=HINTS.length){endHints(true);return}
  // Двойной кадр — подсветка и карточка едут синхронно, без рывка
  requestAnimationFrame(()=>requestAnimationFrame(showHint))
}
function endHints(completed){
  const ov=document.getElementById('hints-overlay');if(ov)ov.style.display='none'
  const sp0=document.getElementById('hint-spotlight');if(sp0)sp0.style.opacity='0'
  const rg0=document.getElementById('hint-ring');if(rg0)rg0.style.opacity='0'
  if(completed!==false){D.user._hintsSeen=true;sv()}
  if(completed===true&&!_hintManual)setTimeout(()=>toast('Готово — приятной игры! 🎮','✅'),300)
}
function showGuide(){startHints(true)}

// ═══ ЧТО НОВОГО ═══
const WN_VERSION='v4.1'
const BUILD_ID='B41-final'
let _wnShown=false
function checkWhatsNew(){
  if(_wnShown)return
  if(document.getElementById('whats-new-m')?.classList.contains('open'))return
  if(D.user._wnSeen===WN_VERSION)return
  _wnShown=true
  setTimeout(()=>{
    const el=document.getElementById('whats-new-m')
    if(!el||el.classList.contains('open'))return
    // Не показываем поверх обучения или другой модалки
    if(document.querySelector('.MBG.open'))return
    const hints=document.getElementById('hints-overlay')
    if(hints&&hints.style.display==='block')return
    el.classList.add('open')
  },1500)
}
function closeWhatsNew(){
  D.user._wnSeen=WN_VERSION;sv()
  closeM('whats-new-m')
}
async function sendWnFeedback(emoji){
  const btns=document.getElementById('wn-feedback')
  if(btns)btns.innerHTML='<div style="padding:6px;font-size:13px;color:var(--lime);font-weight:600;text-align:center;width:100%">Спасибо за оценку! '+emoji.split(' ')[0]+'</div>'
  try{await tgNotify('💬 <b>Оценка обновления</b>\n👤 '+(D.user.name||'Гость')+'\n🆔 '+(D.user._tgId||'—')+'\n\n'+emoji+'\n#фидбэк')}catch(e){}
}
