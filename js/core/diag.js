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
;(function watchFreeze(){
  let last=performance.now()
  const tick=()=>{
    const now=performance.now(),gap=now-last
    // Кадр не рисовался дольше 700мс = интерфейс подвис
    if(gap>700&&!document.hidden){
      _freezeLog.push(`[${_ts()}] подвис ${(gap/1000).toFixed(1)}с на экране «${D.cur||'?'}»`)
      if(_freezeLog.length>5)_freezeLog.shift()
      // 🩹 Само-лечение: после 2 фризов гасим декоративные эффекты
      _freezeHits++
      if(_freezeHits>=2&&!document.body.classList.contains('lowfx')){
        document.body.classList.add('lowfx')
        try{localStorage.setItem('ts_lowfx','1')}catch(e){}
      }
    }
    last=now
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})()

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
