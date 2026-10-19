// Запросы к бэкенду Apps Script

// Подпись Telegram (initData) — по ней сервер узнаёт, кто реально прислал запрос
function tgInit(){try{return window.Telegram?.WebApp?.initData||''}catch(e){return ''}}

// 🔐 Ко всем запросам к бэкенду автоматически добавляем подпись Telegram,
// а к админским — ключ владельца. Так ни один вызов не забудет авторизацию.
;(function attachAuth(){
  const orig=window.fetch
  const ADMIN_POST=['usePromo','syncPromos','createPromo','togglePromo','deletePromo']
  window.fetch=function(input,init){
    try{
      const url=typeof input==='string'?input:''
      if(url&&API_URL&&url.indexOf(API_URL)===0){
        const init2=Object.assign({},init||{})
        const method=String(init2.method||'GET').toUpperCase()
        const initData=tgInit()
        if(method==='GET'){
          const u=new URL(url)
          if(initData&&!u.searchParams.has('initData'))u.searchParams.set('initData',initData)
          if(!u.searchParams.has('tgId')&&typeof D!=='undefined'&&D.user&&D.user._tgId)u.searchParams.set('tgId',D.user._tgId)
          return orig.call(this,u.toString(),init2)
        }
        if(method==='POST'&&typeof init2.body==='string'){
          const body=JSON.parse(init2.body)
          if(initData&&!body.initData)body.initData=initData
          if(!body.tgId&&typeof D!=='undefined'&&D.user&&D.user._tgId)body.tgId=D.user._tgId
          if(ADMIN_POST.includes(body.action)&&typeof D!=='undefined'&&D._admKey&&!body.adminKey)body.adminKey=D._admKey
          init2.body=JSON.stringify(body)
          return orig.call(this,url,init2)
        }
      }
    }catch(e){}
    return orig.apply(this,arguments)
  }
})()

// POST-запрос к бэкенду. Ответ теперь читается — ошибки больше не теряются молча
async function apiCall(action, data={}){
  if(!API_URL) return {ok:false}
  try{
    const r=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action,...data})
    })
    try{ return await r.json() }catch(e){ return {ok:r.ok} }
  }catch(e){
    return {ok:false}
  }
}

// GET запрос (для чтения промокодов — Apps Script разрешает GET без CORS)
async function apiGet(action){
  if(!API_URL) return null
  try{
    const r=await fetch(API_URL+'?action='+action)
    return await r.json()
  }catch(e){
    return null
  }
}

// GET с параметрами и таймаутом — для нового кода. Всегда возвращает объект.
async function apiGetJSON(params,timeoutMs=12000){
  if(!API_URL) return {ok:false,error:'no_api'}
  const ctrl=('AbortController' in window)?new AbortController():null
  const tmr=ctrl?setTimeout(()=>{try{ctrl.abort()}catch(e){}},timeoutMs):null
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({...params,_t:Date.now()}),ctrl?{cache:'no-store',signal:ctrl.signal}:{cache:'no-store'})
    const txt=await r.text()
    try{ return JSON.parse(txt) }catch(e){ return {ok:false,error:'bad_json',legacy:/ToxicSkill v\d/.test(txt)} }
  }catch(e){
    return {ok:false,error:e&&e.name==='AbortError'?'timeout':'network'}
  }finally{ if(tmr)clearTimeout(tmr) }
}

// 🔒 Telegram уведомления ТОЛЬКО через сервер (токен убран!)
const SOCIAL = {
  tg:'https://t.me/toxicskill_brest',
  instagram:'https://www.instagram.com/toxicskill_brest?igsh=dnlvc3F0bnluZTdo',
  tiktok:'https://www.tiktok.com/@toxicskill_brest?_r=1&_t=ZS-94tLLb8Giwr',
  website:'https://toxicskill.cfd/',
}
async function tgNotify(msg){
  try{ await apiCall('notify',{msg}) }catch(e){}
}

function isAdmin(){
  // 🔒 ТОЛЬКО по реальному Telegram ID
  try{
    const twa=window.Telegram?.WebApp
    if(!twa||!twa.initData) return false
    const tgUser=twa.initDataUnsafe?.user
    if(tgUser) return TG.admins.includes(String(tgUser.id))
  }catch(e){}
  return false
}
