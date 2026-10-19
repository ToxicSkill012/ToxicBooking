// Онлайн-статус и Gizmo

// ═══ OFFLINE DETECTOR ═══
let _wasOffline=false
function checkOnline(){
  const bar=document.getElementById('offline-bar')
  if(!bar)return
  if(!navigator.onLine){
    bar.classList.add('show');_wasOffline=true
  }else{
    bar.classList.remove('show')
    if(_wasOffline){_wasOffline=false;toast('Соединение восстановлено','✅')}
  }
}

// ═══ СТАТУС ЗАНЯТОСТИ ПК ═══
let _gizmoCache={hosts:[],ts:0,source:'none'}
async function loadGizmoStatus(){
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'getGizmoStatus',_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok&&d.hosts&&d.hosts.length>0){
      _gizmoCache={hosts:d.hosts,ts:Date.now(),source:d.source||'gizmo'}
      // Обновляем счётчик на главной
      const free=d.free||d.hosts.filter(h=>!h.busy).length
      const total=d.total||d.hosts.length
      const el=document.getElementById('free-count')
      if(el){
        el.textContent=free
        el.style.color=free<=3?'var(--red)':free<=8?'var(--gold)':'var(--lime)'
      }
      return d
    }
  }catch(e){}
  return null
}

// Проверить занятость ПК через Gizmo данные

function isGizmoBusy(pcLabel){
  if(!_gizmoCache.hosts.length)return null // нет данных — вернуть null (use sheets)
  if(Date.now()-_gizmoCache.ts>120000)return null // данные старше 2 мин
  const h=_gizmoCache.hosts.find(x=>x.pc===pcLabel)
  return h?h.busy:null
}
