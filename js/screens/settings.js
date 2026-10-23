// Настройки, баг-репорт, PWA, уведомления

// ═══════════════════════════════════════════════
// DELETE ACCOUNT
// ═══════════════════════════════════════════════
// Проверка бота — теперь в панели владельца: тест от каждого бота с точной причиной ошибки
function testBot(){
  const box=document.getElementById('adm-tg')
  if(box){box.scrollIntoView({behavior:'smooth',block:'center'});adminTestNotif()}
}

let _bugCat='',_bugShot=null
function renderBugDiag(){
  const box=document.getElementById('bug-diag-live');if(!box)return
  const d=buildDiagReport()
  const row=(ic,t)=>`<div style="display:flex;gap:7px"><span style="flex-shrink:0">${ic}</span><span>${t}</span></div>`
  let h=''
  h+=row('🧭',`Экран: <b style="color:var(--txt)">${D.cur||'?'}</b> · сборка <b style="color:var(--lime)">${typeof BUILD_ID!=='undefined'?BUILD_ID:'?'}</b>`)
  h+=row('📱',`${d.plat}${d.pver?' '+d.pver:''} · ${d.screen} · сеть ${d.net}`)
  h+=row('📐',`<span style="font-family:var(--m);font-size:9.5px">${d.vp}</span>`)
  const problems=_freezeLog.length+_errLog.length+_netLog.length
  if(_freezeLog.length)h+=row('🔴',`<b style="color:var(--red)">Зафиксировано зависаний: ${_freezeLog.length}</b> — где именно, уже знаем`)
  if(_errLog.length)h+=row('⚠️',`<b style="color:var(--gold)">Ошибок в работе: ${_errLog.length}</b> — приложены к отчёту`)
  if(_netLog.length)h+=row('📡',`<b style="color:var(--gold)">Проблем со связью: ${_netLog.length}</b>`)
  if(!problems)h+=row('✅',`Сбоев не зафиксировано — опиши, что не так`)
  if(_actLog.length)h+=row('👣',`Последние действия (${Math.min(6,_actLog.length)}) — приложим автоматически`)
  box.innerHTML=h
}
function pickBugCat(el,v){
  _bugCat=(_bugCat===v)?'':v
  document.querySelectorAll('.bugchip').forEach(c=>c.classList.remove('on'))
  if(_bugCat)el.classList.add('on')
}
// 📸 Скриншот: сжимаем на устройстве, чтобы отправка была мгновенной
function pickBugShot(inp){
  const f=inp.files&&inp.files[0];if(!f)return
  if(!/^image\//.test(f.type)){toast('Нужен файл-картинка','⚠️');return}
  const rd=new FileReader()
  rd.onload=e=>{
    const img=new Image()
    img.onload=()=>{
      const MAX=1280
      let w=img.width,h=img.height
      if(w>MAX||h>MAX){const k=Math.min(MAX/w,MAX/h);w=Math.round(w*k);h=Math.round(h*k)}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h
      cv.getContext('2d').drawImage(img,0,0,w,h)
      _bugShot=cv.toDataURL('image/jpeg',0.72)
      const box=document.getElementById('bug-shot-box')
      const prev=document.getElementById('bug-shot-prev')
      if(prev){prev.style.display='block';prev.innerHTML='<img src="'+_bugShot+'" style="width:100%;height:100%;object-fit:cover">'}
      const x=document.getElementById('bug-shot-x');if(x)x.style.display='flex'
      const t=document.getElementById('bug-shot-t');if(t)t.textContent='Скриншот прикреплён'
      const s=document.getElementById('bug-shot-s')
      if(s)s.textContent=Math.round(_bugShot.length/1400)+' КБ · нажми ✕ чтобы убрать'
      if(box){box.style.borderColor='var(--lime30)';box.style.borderStyle='solid'}
    }
    img.onerror=()=>toast('Не удалось прочитать картинку','⚠️')
    img.src=e.target.result
  }
  rd.onerror=()=>toast('Не удалось открыть файл','⚠️')
  rd.readAsDataURL(f)
}
function clearBugShot(){
  _bugShot=null
  const inp=document.getElementById('bug-file');if(inp)inp.value=''
  const prev=document.getElementById('bug-shot-prev');if(prev){prev.style.display='none';prev.innerHTML=''}
  const x=document.getElementById('bug-shot-x');if(x)x.style.display='none'
  const t=document.getElementById('bug-shot-t');if(t)t.textContent='Прикрепить скриншот'
  const s=document.getElementById('bug-shot-s');if(s)s.textContent='Так мы починим в разы быстрее'
  const box=document.getElementById('bug-shot-box')
  if(box){box.style.borderColor='var(--b2)';box.style.borderStyle='dashed'}
}
function sendBug(){
  const txt=document.getElementById('bug-txt').value.trim()
  const where=_bugCat
  if(!txt){toast(_('bugEmpty'),'⚠️');return}
  const d=buildDiagReport()
  // 🩺 Автоотчёт: всё собрано приложением, пользователь ничего не вводит
  let ctx='\n──── АВТОДИАГНОСТИКА ────\n'+
    `🧭 Экран: <b>${D.cur||'?'}</b> · версия ${typeof WN_VERSION!=='undefined'?WN_VERSION:'?'} · СБОРКА <b>${typeof BUILD_ID!=='undefined'?BUILD_ID:'?'}</b>\n`+
    `📱 ${d.plat}${d.pver?' '+d.pver:''} · ${d.screen} · ${D.theme||'dark'} · ${D.lang}\n`+
    `⚙️ ОЗУ ${d.mem} · ядер ${d.cores} · сеть ${d.net}${d.jsMem}\n`+
    `📐 Вьюпорт: ${d.vp}\n`+
    `⏱ В приложении: ${d.uptime}\n`+
    `🆔 TG: ${D.user._tgId||'—'}`
  if(_freezeLog.length) ctx+=`\n\n🔴 <b>ЗАВИСАНИЯ:</b>\n`+_freezeLog.map(x=>'· '+x).join('\n')
  if(_errLog.length)    ctx+=`\n\n⚠️ <b>ОШИБКИ JS:</b>\n`+_errLog.map(x=>'· '+x).join('\n')
  if(_netLog.length)    ctx+=`\n\n📡 <b>СЕТЬ:</b>\n`+_netLog.map(x=>'· '+x).join('\n')
  if(_actLog.length)    ctx+=`\n\n👣 <b>ПОСЛЕДНИЕ ДЕЙСТВИЯ:</b>\n`+_actLog.slice(-6).map(x=>'· '+x).join('\n')
  if(!_freezeLog.length&&!_errLog.length&&!_netLog.length) ctx+='\n\n✅ Сбоев и зависаний приложение не зафиксировало'
  const msg=`🐛 <b>Репорт бага!</b>\n\n`+
    `👤 <b>${D.user.name||'Аноним'}</b>${D.user.phone?' · '+D.user.phone:''}`+
    (D.user.handle?` · @${D.user.handle}`:'')+`\n`+
    (where?`📍 Категория: <b>${where}</b>\n`:'')+
    `\n💬 ${txt}\n${ctx}\n\n#баг`
  const shot=_bugShot
  ;(async()=>{
    try{
      if(shot){
        await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'bugReport',caption:msg,photo:shot}),mode:'no-cors'})
      }else{
        await tgNotify(msg)
      }
    }catch(e){}
  })()
  document.getElementById('bug-txt').value=''
  _bugCat='';document.querySelectorAll('.bugchip').forEach(c=>c.classList.remove('on'))
  clearBugShot()
  closeM('bug-m')
  toast(shot?'Спасибо! Репорт со скриншотом отправлен 🙏':_('bugThanks'),'🙏')
}

// ═══ PWA INSTALL ═══
let _deferredPWA=null
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();_deferredPWA=e
  const row=document.getElementById('pwa-install-row')
  if(row)row.style.display=''
})
function installPWA(){
  if(_deferredPWA){_deferredPWA.prompt();_deferredPWA=null}
  else{
    // iOS / не-Chrome — показываем инструкцию
    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)
    if(isIOS){toast('Нажми "Поделиться" → "На экран Домой"','📱')}
    else{toast('Открой в Chrome → меню → "Установить"','📱')}
  }
}
function delAccount(){openM('confirm-m')}
function doDelAccount(){
  closeM('confirm-m')
  Object.assign(D.user,{name:'Toxic Player',handle:'',phone:'',age:'',bday:'',reg:false,bks:[],hrs:0,_hintsSeen:false})
  sv()
  // go() сам прячет меню и кнопку «Назад»; слайды онбординга запускаем заново
  go('ob');obSlide(0)
  const btn=document.getElementById('ob-btn')
  if(btn){btn.disabled=false;btn.innerHTML='<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>'+_('loginBtn')+'</span>'}
  // Если уже есть данные из Telegram — сразу входим
  try{
    const tu=window.Telegram?.WebApp?.initDataUnsafe?.user
    if(tu&&tu.first_name&&!D.user.reg){
      setTimeout(()=>doLogin(),300)
    }
  }catch(e){}
  toast(D.lang!=='ru'?'Account deleted':'Аккаунт удалён','👋')
}

// ── 🔔 НАСТРОЙКИ УВЕДОМЛЕНИЙ (сохраняются локально + на сервере) ──
let _notifSyncT=null
function getNotif(){
  const n=D.user.notif||{}
  return {bookings:n.bookings!==false,promos:n.promos!==false,events:n.events!==false}
}
function applyNotifUI(){
  const n=getNotif()
  ;['bookings','promos','events'].forEach(k=>{
    const el=document.getElementById('tog-'+k)
    if(el)el.classList.toggle('on',n[k])
  })
}
function toggleNotif(kind,el){
  const n=getNotif()
  n[kind]=!n[kind]
  D.user.notif=n;sv()
  if(el)el.classList.toggle('on',n[kind])
  toast(n[kind]?'Уведомления включены':'Уведомления отключены',n[kind]?'🔔':'🔕')
  // Синхронизация на сервер (с задержкой — не спамим при быстрых переключениях)
  clearTimeout(_notifSyncT)
  _notifSyncT=setTimeout(syncNotifPrefs,700)
}
// Настройки с сервера: на новом устройстве переключатели раньше все были «вкл» и затирали выбор
let _notifLoaded=false
async function loadNotifPrefs(){
  if(_notifLoaded||!D.user._tgId||!tgInit())return
  _notifLoaded=true
  const d=await apiGetJSON({action:'getNotifPrefs'})
  if(d&&d.ok&&d.prefs&&typeof d.prefs==='object'){
    D.user.notif={bookings:d.prefs.bookings!==false,promos:d.prefs.promos!==false,events:d.prefs.events!==false};sv()
    applyNotifUI()
  }else _notifLoaded=false
}
async function syncNotifPrefs(){
  const tgId=D.user._tgId;if(!tgId)return
  try{
    await fetch(API_URL+'?'+new URLSearchParams({action:'saveNotifPrefs',tgId:tgId,prefs:encodeURIComponent(JSON.stringify(getNotif())),_t:Date.now()}),{cache:'no-store'})
  }catch(e){}
}
