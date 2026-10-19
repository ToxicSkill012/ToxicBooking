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
  const now=new Date(),L=I18N[D.lang]
  const el=document.getElementById('gr-t')
  if(el)el.textContent=`${L.DAYS[now.getDay()]}, ${now.getDate()} ${L.MONTHS[now.getMonth()]} · ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  // Персональное приветствие по времени суток
  const h=now.getHours()
  const greetings={ru:h<6?'Ночной игрок 🌙':h<12?'Доброе утро ☀️':h<18?'Привет 👋':h<22?'Добрый вечер 🎮':'Ночная смена 🌙',
    en:h<6?'Night gamer 🌙':h<12?'Good morning ☀️':h<18?'Hello 👋':h<22?'Good evening 🎮':'Night shift 🌙',
    zh:h<6?'夜间玩家 🌙':h<12?'早上好 ☀️':h<18?'你好 👋':h<22?'晚上好 🎮':'深夜模式 🌙'}
  const hiEl=document.querySelector('[data-i="hi"]')
  if(hiEl)hiEl.textContent=greetings[D.lang]||greetings.ru
  const nm=document.getElementById('gr-n');if(nm)nm.textContent=D.user.name
  // Обновляем реальный счётчик свободных компов
  updateFreeCounter()
}

async function updateFreeCounter(){
  // 🖥️ Сначала пробуем Gizmo (реальный статус ПК)
  const TOTAL_PCS=21
  if(_gizmoCache.hosts.length>0 && Date.now()-_gizmoCache.ts<120000){
    const known=_gizmoCache.hosts.length
    // Если Gizmo прислал не все ПК — недостающие считаем свободными,
    // иначе счётчик занижался и показывал неверное число
    const busy=_gizmoCache.hosts.filter(h=>h.busy).length
    const free=Math.max(0,Math.min(TOTAL_PCS,TOTAL_PCS-busy))
    const el=document.getElementById('free-count')
    if(el){
      el.textContent=free
      el.style.color=free<=3?'var(--red)':free<=8?'var(--gold)':'var(--lime)'
    }
    return
  }
  // 📊 Fallback: считаем по бронированиям из Sheets
  try{
    const today = fmtDateJS(new Date())
    const nowH  = new Date().getHours()
    const allBk = await loadBookings(null, null)
    const normD3=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
    const bookings=allBk.filter(b=>normD3(b.date)===normD3(today))
    const busyNow = new Set(
      bookings.filter(b=>{
        const bs=timeToMinJS(b.start), be=timeToMinJS(b.end)
        const now=nowH*60
        // Ночная бронь: end <= start (22:00-08:00)
        if(be<=bs) return now>=bs || now<be
        return now>=bs && now<be
      }).map(b=>b.pc)
    )
    const totalPCs = 13+3+5
    const freeNow  = totalPCs - busyNow.size
    const el = document.getElementById('free-count')||document.querySelector('.pill .LV')
    if(el){
      el.textContent = freeNow
      el.style.color = freeNow<=3?'var(--red)':freeNow<=8?'var(--gold)':'var(--lime)'
    }
  }catch(e){}
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
