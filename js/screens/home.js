// Вход, главная, язык, тема

// ═══════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════
function doLogin(btn){
  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}
  const delay=btn?1100:0
  setTimeout(()=>{
    go('home');updateGr();renderProfile();buildNav('home')
    if(!D.user.reg)setTimeout(()=>openM('reg-m'),900)
    else{
      // Существующим пользователям подсказки не показываем
      if(D.user._hintsSeen===undefined){D.user._hintsSeen=true;sv()}
      checkWhatsNew()
    }
  },delay)
}

function updateGr(){
  // Время клуба, а не телефона — у всех одинаково
  const now=new Date(Date.now()+CLUB_TZ_OFFSET*60000),L=I18N[D.lang]
  const el=document.getElementById('gr-t')
  if(el)el.textContent=`${L.DAYS[now.getUTCDay()]}, ${now.getUTCDate()} ${L.MONTHS[now.getUTCMonth()]} · ${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`
  // Персональное приветствие по времени суток
  const h=now.getUTCHours()
  const greetings={ru:h<6?'Ночной игрок 🌙':h<12?'Доброе утро ☀️':h<18?'Привет 👋':h<22?'Добрый вечер 🎮':'Ночная смена 🌙',
    en:h<6?'Night gamer 🌙':h<12?'Good morning ☀️':h<18?'Hello 👋':h<22?'Good evening 🎮':'Night shift 🌙',
    zh:h<6?'夜间玩家 🌙':h<12?'早上好 ☀️':h<18?'你好 👋':h<22?'晚上好 🎮':'深夜模式 🌙'}
  const hiEl=document.querySelector('[data-i="hi"]')
  if(hiEl)hiEl.textContent=greetings[D.lang]||greetings.ru
  const nm=document.getElementById('gr-n');if(nm)nm.textContent=D.user.name
  // Обновляем реальный счётчик свободных компов
  updateFreeCounter()
}

// Счётчик свободных ПК и табло «Зал сейчас»: живые сессии Gizmo + брони
async function updateFreeCounter(){
  renderLive()
  try{ await loadBookings(null, null) }catch(e){}
  renderLive()
}

// ═══════════════════════════════════════════════
// LANG — applies to ALL [data-i] elements
// ═══════════════════════════════════════════════
function applyLang(){
  const L=I18N[D.lang]
  document.querySelectorAll('[data-i]').forEach(el=>{
    const v=L[el.dataset.i];if(v!==undefined)el.textContent=v
  })
  document.getElementById('lo-ru').className='LO'+(D.lang==='ru'?' sel':'')
  document.getElementById('lo-en').className='LO'+(D.lang==='en'?' sel':'')
  const loZh=document.getElementById('lo-zh');if(loZh)loZh.className='LO'+(D.lang==='zh'?' sel':'')
  buildNav(D.cur);updateGr()
  if(D.cur==='bklist')renderBkList()
  if(D.cur==='profile')renderProfile()
  if(D.cur==='book')renderStep()
}

function setLang(l){D.lang=l;sv();applyLang()}

// ═══════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════
function setTheme(cls,el){
  const isOb=document.body.classList.contains('onboarding')
  document.body.className=(cls?cls+' ':'')+(isOb?'onboarding':'');D.theme=cls;sv()
  document.querySelectorAll('.TO').forEach(x=>x.classList.remove('sel'))
  el.classList.add('sel')
}
