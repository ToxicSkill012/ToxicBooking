// Запуск приложения

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════


// 📱 Telegram на Android открывает Mini App свёрнутым и часто игнорирует expand().
// Пробуем настойчиво: сразу, по таймерам и при любом касании. Это только вызовы
// API — стили не трогаются, поэтому на производительность не влияет.
;(function(){
  let ok=false
  const tryExpand=()=>{
    if(ok)return
    try{
      const t=window.Telegram?.WebApp
      if(!t||!t.expand)return
      t.expand()
      if(t.isExpanded===true)ok=true
    }catch(e){}
  }
  tryExpand()
  ;[0,60,150,300,600,1000,1600,2400,3500,5000].forEach(ms=>setTimeout(tryExpand,ms))
  document.addEventListener('touchstart',tryExpand,{passive:true})
  document.addEventListener('click',tryExpand,{passive:true})
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){ok=false;tryExpand()}},{passive:true})
  try{
    const t=window.Telegram?.WebApp
    if(t&&t.onEvent)t.onEvent('viewportChanged',()=>{
      tryExpand()
      try{
        if(t.isExpanded===true){t.disableVerticalSwipes&&t.disableVerticalSwipes()}
        else{t.enableVerticalSwipes&&t.enableVerticalSwipes()}
      }catch(e){}
    })
  }catch(e){}
})()

document.addEventListener('DOMContentLoaded',()=>{
  // 🛠 Проверка техработ при старте (клиентам — экран, админу — бейдж)
  checkMaintenance()
  // ── Telegram Mini App init ──────────────────
  try{
    const twa=window.Telegram?.WebApp
    if(twa){
      twa.ready()
      twa.expand()
      // 🔑 Отключаем вертикальные свайпы Telegram (мешают скроллу)
      // Свайпы блокируем ТОЛЬКО когда окно уже развёрнуто,
      // иначе пользователь не сможет развернуть приложение жестом
      try{
        if(twa.isExpanded===false){ twa.enableVerticalSwipes&&twa.enableVerticalSwipes() }
        else { twa.disableVerticalSwipes&&twa.disableVerticalSwipes() }
      }catch(e){}
      try{twa.setHeaderColor&&twa.setHeaderColor('#06060f')}catch(e){}
      try{twa.setBackgroundColor&&twa.setBackgroundColor('#06060f')}catch(e){}
      // Подтягиваем данные пользователя из Telegram
      const tu=twa.initDataUnsafe?.user
      if(tu){
        let changed=false
        // Всегда сохраняем свежие TG данные
        if(tu.id&&String(tu.id)!==D.user._tgId){D.user._tgId=String(tu.id);changed=true}
        if(tu.username&&tu.username!==D.user._tgHandle){D.user._tgHandle=tu.username;changed=true}
        if(tu.photo_url&&tu.photo_url!==D.user._tgPhoto){D.user._tgPhoto=tu.photo_url;changed=true}
        // Если не зарегистрирован — подставляем данные из TG
        if(!D.user.reg){
          if(tu.first_name){const n=(tu.first_name+(tu.last_name?' '+tu.last_name:'')).trim();if(n!==D.user.name){D.user.name=n;changed=true}}
          if(tu.username&&!D.user.handle){D.user.handle=tu.username;changed=true}
        }
        if(changed)sv()
      }
      // Определяем админа по Telegram ID
      // Админ определяется динамически через isAdmin()
      // Цвет темы из Telegram
      twa.setHeaderColor('#06060f')
      twa.setBackgroundColor('#06060f')
      try{twa.setBottomBarColor&&twa.setBottomBarColor('#06060f')}catch(e){}
      // Кнопка «Назад» Telegram ведёт по шагам брони
      try{twa.BackButton&&twa.BackButton.onClick(onTgBack)}catch(e){}
    }
  }catch(e){}
  // Apply saved theme (сохраняем onboarding класс)
  if(D.theme)document.body.classList.add(D.theme)
  // Apply saved theme button state
  const themes=['','amoled','toxic']
  document.querySelectorAll('.TO').forEach((el,i)=>{
    el.classList.toggle('sel',themes[i]===D.theme)
  })
  // Apply language to all data-i elements
  applyLang()
  // Build navs
  buildNav('ob')
  // Load shared promos from Google Sheets (all users)
  loadPromosFromSheets()
  renderPromoList()
  // Clock tick — раз в минуту, не 30 сек
  setInterval(()=>{ if(!document.hidden) updateGr() },60000)
  // Onboarding
  startObSlides()
  initObParticles()
  // Offline detector — реже
  checkOnline()
  window.addEventListener('online',checkOnline,{passive:true})
  window.addEventListener('offline',checkOnline,{passive:true})
  setInterval(()=>{ if(!document.hidden) idle(checkOnline) },20000)
  // Gizmo — раз в 45 сек, и только когда приложение открыто (экономия батареи/сети)
  idle(loadGizmoStatus)
  setInterval(()=>{ if(!document.hidden) idle(loadGizmoStatus) },45000)
  // ⏱ Живые таймеры («ещё 42 мин») — пересчёт раз в 20 сек, без сетевых запросов
  setInterval(()=>{
    if(document.hidden)return
    if(D.cur==='home')renderLive()
    if(D.cur==='bklist')tickBkList()
  },20000)
  // Брони, которые уже прошли, — в историю; статусы — с сервера
  expireLocalBookings()
  idle(()=>syncMyBookings(true).catch(()=>{}),3000)
  // Вернулись в приложение — освежаем данные в простое (не блокируя кадр)
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) idle(()=>{ checkOnline(); loadGizmoStatus(); updateGr(); if(D.cur==='bklist')renderBkList() })
  },{passive:true})
  // Passive listeners для производительности
  document.addEventListener('touchstart',()=>{},{passive:true})
})
