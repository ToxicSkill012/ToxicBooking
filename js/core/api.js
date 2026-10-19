// Запросы к бэкенду Apps Script

// Единственная функция для всех запросов к бэкенду
async function apiCall(action, data={}){
  if(!API_URL) return {ok:false}
  try{
    // no-cors нужен для Apps Script
    await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action,...data}),
      mode:'no-cors'
    })
    return {ok:true}
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
