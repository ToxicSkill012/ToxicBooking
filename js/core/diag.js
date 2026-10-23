// Автодиагностика: ошибки, зависания, сеть

// ══════════════════════════════════════════════
// 🩺 АВТОДИАГНОСТИКА — приложение само следит за собой
// Журнал ошибок · зависания · действия · сбои сети
// ══════════════════════════════════════════════
const _errLog=[],_actLog=[],_freezeLog=[],_netLog=[]
let _freezeHits=0
const _tStart=Date.now()
const _ts=()=>((Date.now()-_tStart)/1000).toFixed(1)+'с'

// 1) JS-ошибки
window.addEventListener('error',e=>{
  _errLog.push(`[${_ts()}|${D.cur||'?'}] `+(e.message||'?')+' @'+String(e.filename||'').split('/').pop()+':'+(e.lineno||0))
  if(_errLog.length>6)_errLog.shift()
})
window.addEventListener('unhandledrejection',e=>{
  _errLog.push(`[${_ts()}|${D.cur||'?'}] Promise: `+String(e.reason).slice(0,120))
  if(_errLog.length>6)_errLog.shift()
})

// 2) Действия пользователя (хлебные крошки) — что нажимал перед проблемой
function logAct(what){
  _actLog.push(`[${_ts()}] ${what}`)
  if(_actLog.length>10)_actLog.shift()
}
document.addEventListener('click',e=>{
  try{
    const el=e.target.closest('[onclick],button,.NI,.ZC,.PCB,.PK,.BTN')
    if(!el)return
    let name=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,28)
    if(!name)name=el.className?String(el.className).split(' ')[0]:el.tagName
    logAct(`тап: ${name} (${D.cur||'?'})`)
  }catch(_){}
},{passive:true,capture:true})

// 3) 🔴 ДЕТЕКТОР ЗАВИСАНИЙ — ловим фризы интерфейса
// Раньше любые две паузы отрисовки (свернул Telegram, открыл выбор времени, системный диалог)
// навсегда выключали стекло и подсветку. Теперь: паузы системы не считаем, нужно 3 настоящих фриза
// за полторы минуты, лёгкий режим включается на 3 дня, а в настройках его можно выключить.
;(function watchFreeze(){
  let last=performance.now(),quietUntil=0,hits=[]
  const quiet=()=>{quietUntil=performance.now()+2500}
  document.addEventListener('visibilitychange',quiet)
  ;['blur','focus','pageshow','resize','orientationchange'].forEach(ev=>window.addEventListener(ev,quiet))
  document.addEventListener('pointerdown',e=>{try{if(e.target.closest('input,select,textarea,[contenteditable]'))quiet()}catch(_){}},true)
  try{const tw=window.Telegram&&Telegram.WebApp;if(tw&&tw.onEvent)['viewportChanged','popupClosed','themeChanged','fullscreenChanged'].forEach(ev=>tw.onEvent(ev,quiet))}catch(_){}
  const tick=()=>{
    const now=performance.now(),gap=now-last
    // Кадр не рисовался дольше 700 мс = интерфейс подвис; дольше 4 с — это пауза системы, а не тормоза
    if(gap>700&&!document.hidden){
      _freezeLog.push(`[${_ts()}] подвис ${(gap/1000).toFixed(1)}с на экране «${D.cur||'?'}»`)
      if(_freezeLog.length>5)_freezeLog.shift()
      if(gap<4000&&now>quietUntil){
        _freezeHits++
        hits=hits.filter(t=>now-t<90000);hits.push(now)
        let forced=null;try{forced=localStorage.getItem('ts_fx')}catch(_){}
        // 🩹 Само-лечение: гасим тяжёлые эффекты (если владелец телефона сам их не включил)
        if(hits.length>=3&&forced!=='on'&&!document.body.classList.contains('lowfx'))setLowFx(true,true)
      }
    }
    last=now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})()
// Лёгкий режим: без размытия и анимаций. auto — включил детектор (на 3 дня), иначе — выбор в настройках
function setLowFx(on,auto){
  document.body.classList.toggle('lowfx',on)
  document.documentElement.classList.toggle('pre-lowfx',on)
  try{
    if(auto)localStorage.setItem('ts_lowfx_until',String(Date.now()+3*86400000))
    else{localStorage.setItem('ts_fx',on?'off':'on');localStorage.removeItem('ts_lowfx_until')}
  }catch(e){}
  syncFxToggle()
}
function syncFxToggle(){
  const t=document.getElementById('tog-fx');if(!t)return
  const low=document.documentElement.classList.contains('pre-lowfx')||document.body.classList.contains('lowfx')
  t.classList.toggle('on',!low)
  const sub=document.getElementById('fx-sub')
  let auto=false;try{auto=!localStorage.getItem('ts_fx')&&(+localStorage.getItem('ts_lowfx_until')||0)>Date.now()}catch(e){}
  if(sub)sub.textContent=auto?'Выключены сами: телефон подтормаживал. Включи, если всё плавно':'Размытие, подсветка и анимации. Выключи, если телефон тормозит'
}
function toggleFx(el){
  const turnOn=!el.classList.contains('on')
  setLowFx(!turnOn,false)
  haptic('light')
  toast(turnOn?'Стекло и эффекты включены':'Лёгкий режим: без размытия и анимаций',turnOn?'✨':'🪶')
}
document.addEventListener('DOMContentLoaded',syncFxToggle)

// 4) Сбои и тормоза сети — оборачиваем fetch
;(function watchNet(){
  const orig=window.fetch
  window.fetch=async function(...args){
    const t0=performance.now()
    let url=''
    try{url=String(args[0]).split('?')[0].split('/').pop()||'api'}catch(_){}
    try{
      const r=await orig.apply(this,args)
      const ms=Math.round(performance.now()-t0)
      if(ms>4000){_netLog.push(`[${_ts()}] медленно ${ms}мс → ${url}`);if(_netLog.length>5)_netLog.shift()}
      if(!r.ok){_netLog.push(`[${_ts()}] HTTP ${r.status} → ${url}`);if(_netLog.length>5)_netLog.shift()}
      return r
    }catch(err){
      _netLog.push(`[${_ts()}] сбой связи → ${url}`)
      if(_netLog.length>5)_netLog.shift()
      throw err
    }
  }
})()

// 5) Сбор полного отчёта об устройстве и состоянии
function buildDiagReport(){
  let plat='web',pver='',tgTheme=''
  try{const t=window.Telegram?.WebApp;if(t){plat=t.platform||'tg';pver=t.version||'';tgTheme=t.colorScheme||''}}catch(_){}
  const nav=navigator||{}
  const conn=nav.connection||nav.mozConnection||nav.webkitConnection||{}
  const mem=nav.deviceMemory?nav.deviceMemory+'ГБ':'?'
  const cores=nav.hardwareConcurrency||'?'
  const net=conn.effectiveType?`${conn.effectiveType}${conn.downlink?' ~'+conn.downlink+'Мбит':''}`:(nav.onLine?'онлайн':'офлайн')
  let jsMem=''
  try{if(performance.memory)jsMem=` · память JS ${Math.round(performance.memory.usedJSHeapSize/1048576)}МБ`}catch(_){}
  const ua=String(nav.userAgent||'').slice(0,90)
  let expanded='?'
  try{const t=window.Telegram?.WebApp;if(t)expanded=String(t.isExpanded)}catch(_){}
  let tgH=0
  try{const t=window.Telegram?.WebApp;if(t)tgH=Math.round(t.viewportStableHeight||t.viewportHeight||0)}catch(_){}
  const vp=`TG:${tgH||'?'} inner:${window.innerHeight} expanded:${expanded}`
  return {
    plat,pver,tgTheme,mem,cores,net,jsMem,ua,vp,
    screen:`${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio||1}x`,
    uptime:_ts()
  }
}
