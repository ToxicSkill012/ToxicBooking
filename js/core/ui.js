// Навигация, тосты, модалки

// Выполнить в простое (когда браузер свободен) — не мешает анимациям и прокрутке.
// Раньше функция вызывалась по всему приложению, но не была объявлена: из-за этого
// не обновлялся статус Gizmo и не загружалась панель владельца.
function idle(fn,timeout=1500){
  if('requestIdleCallback' in window)return requestIdleCallback(()=>fn(),{timeout})
  return setTimeout(fn,60)
}

// Кнопка «Назад» Telegram в шапке — на экранах брони и настроек
function syncTgBack(id){
  try{
    const bb=window.Telegram?.WebApp?.BackButton;if(!bb)return
    if(id==='book'||id==='settings')bb.show();else bb.hide()
  }catch(e){}
}
function onTgBack(){
  const open=document.querySelector('.MBG.open')
  if(open){open.id?closeM(open.id):open.remove();return}
  if(D.cur==='book')bkBack()
  else go('home')
}

// ═══════════════════════════════════════════════
// NAV
// ═══════════════════════════════════════════════
const NAVS=[
  {id:'home',icon:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',lk:'navBook'},
  {id:'bklist',icon:'<path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>',lk:'navBkl'},
  {id:'profile',icon:'<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>',lk:'navProf'},
  {id:'settings',icon:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',lk:'navSet'},
]

function buildNav(cur){
  const el=document.getElementById('nav-global');if(!el)return
  // Управление видимостью через класс body (надёжнее)
  if(cur==='ob'||cur==='ok')document.body.classList.add('onboarding')
  else document.body.classList.remove('onboarding')
  el.innerHTML=NAVS.map(n=>`<button class="NI${cur===n.id?' on':''}" data-tour="nav-${n.id}" onclick="go('${n.id}')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>${_(n.lk)}</button>`).join('')
}

// ═══════════════════════════════════════════════
// ROUTING
// ═══════════════════════════════════════════════
function go(id){
  document.getElementById(D.cur)?.classList.remove('on')
  document.getElementById(id)?.classList.add('on')
  D.cur=id;buildNav(id)
  try{logAct('экран: '+id)}catch(e){}
  // Ушли с онбординга — гасим его слайдер (иначе крутится весь сеанс)
  if(id!=='ob'&&_obTimer){clearInterval(_obTimer);_obTimer=null}
  syncTgBack(id)
  try{if(id==='bklist'){renderBkList();syncMyBookings().then(ch=>{if(ch&&D.cur==='bklist')renderBkList()}).catch(()=>{})}}catch(e){/*silenced*/}
  try{if(id==='profile')renderProfile()}catch(e){/*silenced*/}
  try{if(id==='home')updateFreeCounter()}catch(e){}
  try{if(id==='settings')renderPromoList()}catch(e){}
}

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
let _tt;function toast(msg,ico='✓'){
  const el=document.getElementById('toast')
  el.innerHTML=`<span style="font-size:16px">${ico}</span><span>${msg}</span>`
  el.classList.add('show');clearTimeout(_tt)
  _tt=setTimeout(()=>el.classList.remove('show'),2800)
}

// ═══════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════
// Telegram на Android перехватывает вертикальные свайпы — из-за этого
// не прокручивается содержимое модалок. Отключаем перехват при каждом открытии.
function killTgSwipes(){
  try{
    const t=window.Telegram?.WebApp
    if(!t)return
    // ⚠️ Пока окно свёрнуто, вертикальные свайпы НЕЛЬЗЯ блокировать —
    // именно ими Telegram разворачивает Mini App на весь экран.
    if(t.isExpanded===false){
      if(t.enableVerticalSwipes)t.enableVerticalSwipes()
      if(t.expand)t.expand()
    }else{
      if(t.disableVerticalSwipes)t.disableVerticalSwipes()
    }
    if(t&&t.isExpanded===false&&t.expand)t.expand()
  }catch(e){}
}
function openM(id){
  killTgSwipes()
  // 🔒 Одновременно может быть открыта только ОДНА модалка
  document.querySelectorAll('.MBG.open').forEach(m=>{if(m.id!==id)m.classList.remove('open')})
  const el=document.getElementById(id);if(!el)return
  if(el.style.display==='none')el.style.display=''
  requestAnimationFrame(()=>el.classList.add('open'))
  if(id==='bug-m'){try{renderBugDiag()}catch(e){}}
  try{logAct('открыл: '+id)}catch(e){}
}
function closeM(id){
  const el=document.getElementById(id);if(!el)return
  el.classList.remove('open')
}
