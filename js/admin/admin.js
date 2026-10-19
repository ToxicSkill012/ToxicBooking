// Панель владельца

// ── АДМИН: ДИАГНОСТИКА ДОСТУПА ──
const _DIAG_WHY={no_token:'в бэкенде не заданы токены ботов — см. инструкцию ниже',no_initdata:'нет initData — открой приложение через бота в Telegram',hash_mismatch:'подпись не сошлась — токен в бэкенде не от этого бота? Используй 🔑 ключ',stale:'сессия устарела — перезапусти Mini App',not_admin:'это не админский Telegram ID',parse_error:'ошибка разбора initData — используй 🔑 ключ',no_hash:'битый initData'}
async function adminRunDiag(){
  const el=document.getElementById('adm-diag');if(!el)return
  el.innerHTML='<span class="spin" style="width:11px;height:11px"></span><span>Проверяю…</span>'
  try{
    // Жёсткий таймаут — иначе при недоступном бэкенде висит «Проверяю…»
    const ctrl=('AbortController' in window)?new AbortController():null
    const tmr=setTimeout(()=>{try{ctrl&&ctrl.abort()}catch(e){}},9000)
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminDiag',initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),
      ctrl?{cache:'no-store',signal:ctrl.signal}:{cache:'no-store'})
    clearTimeout(tmr)
    const d=await r.json()
    adminSetupCard(d)
    adminBridgeCard(d)
    if(d&&d.v){
      if(d.access){
        el.innerHTML=`<span>🟢</span><span style="color:var(--lime)">Бэкенд v${d.v} · бот ${d.bot||'?'} · доступ ОК (${d.why==='key'?'по 🔑 ключу':'Telegram-подпись'})</span>`
        el.style.borderColor='var(--lime30)'
      }else{
        let why=_DIAG_WHY[d.why]||d.why
        if(d.why==='hash_mismatch')why=`подпись не сошлась. Бот бэкенда: <b style="color:var(--gold)">${d.bot||'?'}</b>. Если приложение открыто НЕ через этого бота — в этом причина. Решение: введи 🔑 ключ ниже — он работает всегда`
        el.innerHTML=`<span>🔴</span><span style="color:var(--red)">v${d.v} · ${why}</span>`
        el.style.borderColor='rgba(255,63,96,.4)'
        // Подсвечиваем поле ключа
        const k=document.getElementById('adm-key')
        if(k&&!D._admKey){k.classList.add('keypulse');setTimeout(()=>k.classList.remove('keypulse'),5200)}
      }
    }else{
      el.innerHTML='<span>⚠️</span><span style="color:var(--gold)">Бэкенд СТАРЫЙ — код обновлён, но не задеплоен! Apps Script → Deploy → Manage deployments → ✏️ → New version</span>'
      el.style.borderColor='rgba(255,202,80,.4)'
    }
  }catch(e){
    const aborted=(e&&e.name==='AbortError')
    el.innerHTML='<span>🔴</span><span style="color:var(--red)">'+
      (aborted?'Бэкенд не ответил за 9 сек — проверь, что скрипт задеплоен (Deploy → New version)':'Нет связи с бэкендом')+
      '</span>'
    el.style.borderColor='rgba(255,63,96,.4)'
  }
}

// Бэкенд обновлён, но секреты не заданы → без токена нельзя проверить подпись Telegram,
// поэтому «нет доступа», и уведомления в Telegram не уходят. Показываем, что именно добавить.
function adminSetupCard(d){
  const box=document.getElementById('adm-setup');if(!box)return
  const sc=d&&d.secrets
  const miss=sc?[['BOT_TOKEN',sc.bot,'токен бота уведомлений (@toxicskill_booking_bot) — из @BotFather'],
    ['USER_BOT_TOKEN',sc.userBot,'токен клиентского бота (@toxicskill_bot), через которого открывается приложение'],
    ['ADMIN_KEY',sc.adminKey,'свой длинный пароль — потом введи его в поле 🔑 ниже'],
  ].filter(x=>!x[1]):[]  // BRIDGE_KEY необязателен: старый мост работает и без него
  if(!miss.length){box.innerHTML='';box.style.display='none';return}
  box.style.display='block'
  box.innerHTML=`<div class="setup-h">🔧 Бэкенд не настроен: нет ${miss.length===3?'ни одного секрета':miss.map(m=>m[0]).join(', ')}</div>
    <div class="setup-t">Поэтому админка пишет «нет доступа», а уведомления в Telegram не уходят. Добавь в Apps Script:</div>
    <ol class="setup-l">
      <li>Открой проект Apps Script → слева <b>⚙️ Настройки проекта</b></li>
      <li>Внизу <b>«Свойства скрипта»</b> → «Изменить свойства скрипта» → «Добавить свойство»</li>
      <li>${miss.map(m=>`<code>${m[0]}</code> — ${m[2]}`).join('<br>')}</li>
      <li>«Сохранить свойства скрипта» — переразвёртывать не нужно, сработает сразу</li>
    </ol>
    <button type="button" class="BTN ghost" style="margin-top:8px" onclick="adminRunDiag()">🔄 Проверить снова</button>`
}

// 🖥️ Мост Gizmo: онлайн ли, когда последний раз прислал данные, не стучится ли без ключа.
// Без моста занятость ПК в клубе в приложении не видна — только брони.
function adminBridgeCard(d){
  const box=document.getElementById('adm-bridge');if(!box)return
  const g=d&&d.gizmo;if(!g){box.innerHTML='';return}
  const upd=g.updatedAt?new Date(g.updatedAt):null
  const age=upd?Math.round((Date.now()-upd.getTime())/60000):null
  const fresh=age!==null&&age<=(g.staleMin||5)
  const when=upd?minToHM(Math.floor((upd.getTime()+CLUB_TZ_OFFSET*60000)/60000)%1440):''
  const rej=g.rejected,rejAge=rej?Math.round((Date.now()-new Date(rej.at).getTime())/60000):null
  const url=d.bridgeKey?`${API_URL}?action=gizmoSync&key=${d.bridgeKey}&hosts=`:''
  let html
  const legacy=g.legacyAt&&(Date.now()-new Date(g.legacyAt).getTime())<15*60000
  if(fresh){
    html=`<div class="br-h ok"><span class="br-dot"></span>Мост Gizmo онлайн</div>
      <div class="br-t">Обновлено ${age<1?'только что':age+' мин назад'} · занято ${g.busy} из ${g.hosts} ПК. Клиенты видят занятость из клуба.</div>`
    if(legacy)html+=`<div class="br-t sm">Работает старый мост без ключа — это нормально. Чтобы посторонние не могли подменить статусы, добавь ему <code>&key=…</code> (адрес ниже) и свойство <code>BRIDGE_STRICT</code> = <code>1</code>.</div>`
  }else{
    html=`<div class="br-h bad"><span class="br-dot"></span>${upd?`Мост Gizmo молчит с ${when}${age>=60?` (${fmtDur(age)})`:''}`:'Мост Gizmo ещё ни разу не присылал данные'}</div>
      <div class="br-t">Пока мост не на связи, в приложении видны только брони — ПК, за которыми сидят без брони, выглядят свободными.</div>`
    if(rej&&rejAge!==null&&rejAge<360){
      html+=`<div class="br-warn">⚠️ Мост стучится, но сервер его не пускает: ${rej.hadKey?'у него <b>неверный ключ</b>':'у него <b>нет ключа</b>'} (последний раз ${rejAge<1?'только что':rejAge+' мин назад'}).
        Добавь к адресу моста <code>&key=…</code> — готовый адрес ниже.</div>`
    }else{
      html+=`<div class="br-t">Запусти мост на ПК с Gizmo — той же командой в консоли, что и раньше (или <code>start-bridge.cmd</code> из папки <code>bridge</code>). Окно консоли не закрывай — данные идут, пока оно открыто.</div>`
    }
  }
  if(url)html+=`<div class="br-url"><code id="br-url">${url}ST-01:1:45,ST-02:0</code><button type="button" class="tp-chip" onclick="copyBridgeUrl()">📋 Копировать</button></div>
    <div class="br-t sm">Формат: <code>ПК:занят[:минут осталось]</code> через запятую. Для моста из папки <code>bridge</code> ключ вписывается в <code>bridge.config.json</code> → <code>bridgeKey</code>.</div>`
  box.innerHTML=html
  box.className='bridge '+(fresh?'ok':'bad')
  box.style.display='block'
}
function copyBridgeUrl(){
  const t=document.getElementById('br-url')?.textContent||''
  const done=()=>toast('Адрес скопирован','📋')
  try{navigator.clipboard.writeText(t).then(done,()=>{prompt('Скопируй адрес:',t)})}catch(e){prompt('Скопируй адрес:',t)}
}

// ── АДМИН: РЕЗЕРВНЫЙ КЛЮЧ ──
function adminSaveKey(){
  const v=document.getElementById('adm-key')?.value.trim()||''
  D._admKey=v;sv()
  toast(v?'🔑 Ключ сохранён':'Ключ очищен','✅')
}

// ── ТЕХРАБОТЫ: проверка и управление ──
let _maintOn=false,_maintData={},_maintPoll=null
async function checkMaintenance(){
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'getMaint',tgId:D.user._tgId||'',_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    // 🚫 Бан — показываем экран блокировки
    const banOv=document.getElementById('ban-overlay')
    if(d.banned&&!isAdmin()){
      if(banOv)banOv.style.display='flex'
      return
    }else if(banOv){banOv.style.display='none'}
    _maintOn=!!d.on;_maintData=d
    applyMaintUI()
  }catch(e){}
}
// «Вернёмся к 18:30»: сколько осталось и полоска от начала работ
function maintEta(){
  const box=document.getElementById('maint-eta'),ind=document.getElementById('maint-indet')
  const eta=_maintData.eta||''
  if(!box)return
  if(!/^\d{2}:\d{2}$/.test(eta)){box.hidden=true;if(ind)ind.hidden=false;return}
  const now=clubNow().abs
  const since=_maintData.since?Math.floor((Date.parse(_maintData.since)+CLUB_TZ_OFFSET*60000)/60000):now
  let end=clubNow().day*1440+timeToMinJS(eta)
  if(end<since-5)end+=1440
  const left=end-now
  box.hidden=false;if(ind)ind.hidden=true
  document.getElementById('maint-eta-v').textContent=(D.lang==='en'?'by ':'к ')+eta
  document.getElementById('maint-eta-s').textContent=left>0?(D.lang==='en'?'in ':'через ')+fmtDur(left):(D.lang==='en'?'any minute now…':'вот-вот закончим…')
  const pct=end>since?Math.min(100,Math.max(4,(now-since)/(end-since)*100)):100
  document.getElementById('maint-bar').style.width=pct+'%'
}
function applyMaintUI(){
  const ov=document.getElementById('maint-overlay')
  // Клиенты видят экран, админ — работает дальше (с бейджем в панели)
  const show=_maintOn&&!isAdmin()
  if(ov){
    const shown=ov.style.display==='flex'
    if(show){
      const m=document.getElementById('maint-msg')
      if(m&&_maintData.msg)m.textContent=_maintData.msg
      maintEta()
      ov.style.display='flex'
      // Пока идут работы — сами проверяем каждые 30 с и открываемся, когда закончат
      if(!_maintPoll)_maintPoll=setInterval(()=>{if(!document.hidden)checkMaintenance()},30000)
    }else{
      if(_maintPoll){clearInterval(_maintPoll);_maintPoll=null}
      if(shown){
        ov.classList.add('mt-out')
        setTimeout(()=>{ov.style.display='none';ov.classList.remove('mt-out')},480)
        toast(D.lang==='en'?'We are back! 🎉':'Мы снова работаем! 🎉','🎮');haptic('ok')
      }else ov.style.display='none'
    }
  }
  const st=document.getElementById('adm-maint-st'),btn=document.getElementById('adm-maint-btn')
  if(st){st.textContent=_maintOn?'🔴 ВКЛЮЧЕНЫ':'Выключены';st.className='B '+(_maintOn?'Bx':'Bl')}
  const et=document.getElementById('adm-maint-eta');if(et&&_maintOn&&_maintData.eta)et.value=_maintData.eta
  if(btn){
    btn.innerHTML=_maintOn?'✅ Выключить техработы':'⚙️ Включить техработы'
    btn.style.background=_maintOn?'linear-gradient(135deg,var(--lime),var(--cyan))':'linear-gradient(135deg,var(--red),#ff7b4d)'
    btn.style.color=_maintOn?'#000':'#fff'
  }
}
async function adminMaintToggle(){
  const msg=document.getElementById('adm-maint-msg')?.value.trim()||''
  const eta=document.getElementById('adm-maint-eta')?.value||''
  const btn=document.getElementById('adm-maint-btn')
  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminMaint',on:_maintOn?'0':'1',msg:encodeURIComponent(msg),eta,initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_maintOn=!!d.on;_maintData=d;toast(_maintOn?'⚙️ Техработы ВКЛЮЧЕНЫ':'✅ Техработы выключены',_maintOn?'⚙️':'✅')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
  if(btn)btn.disabled=false
  applyMaintUI()
}

// ── АДМИН: БРОНИ СЕГОДНЯ// ── АДМИН: БРОНИ СЕГОДНЯ (управление залом) ──
async function renderAdminToday(){
  const box=document.getElementById('adm-today');if(!box||!isAdmin())return
  let all=[];try{all=await loadAdminBookings()}catch(e){}
  const normD=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
  const today=normD(clubNow().date)
  const list=all.filter(b=>normD(b.date)===today&&b.status!=='cancelled'&&b.status!=='completed')
    .sort((a,b)=>timeToMinJS(a.start)-timeToMinJS(b.start))
  if(!list.length){box.innerHTML='<div style="text-align:center;color:var(--t3);font-size:11px;padding:14px;border-radius:14px;background:var(--s1);border:1px dashed var(--b1)">Сегодня броней пока нет</div>';return}
  box.innerHTML=list.map(b=>{
    const off=b.source==='offline'
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:13px;background:linear-gradient(160deg,var(--s2),var(--s1));border:1px solid var(--b1);margin-bottom:7px">
      <div style="font-family:var(--m);font-size:13px;font-weight:700;color:var(--cyan);flex-shrink:0;min-width:78px">${b.start}–${b.end}</div>
      <div style="font-family:var(--F);font-size:13px;font-weight:800;color:var(--lime);flex-shrink:0">${b.pc}</div>
      <div style="flex:1;min-width:0;font-size:11px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.user||'—'}</div>
      <span class="B ${off?'Bg':'Bl'}" style="flex-shrink:0;font-size:8px">${off?'ОФФ':'APP'}</span>
      <button onclick="adminCancelAny('${b.id}')" style="flex-shrink:0;width:28px;height:28px;border-radius:9px;background:rgba(255,63,96,.12);border:1px solid rgba(255,63,96,.3);color:var(--red);font-size:13px;cursor:pointer">✕</button>
    </div>`
  }).join('')
}
async function adminCancelAny(id){
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'cancelBooking',id:id,tgId:D.user._tgId||'',initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_bookingsCache.loaded=false;toast('Бронь снята','✅');renderAdminToday();renderAdminOffline();renderAdminDash();if(_admClient)fillAdmHist(_admClient.tgId)}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}

// ── АДМИН: РАССЫЛКА (двухшаговое подтверждение) ──
let _bcArmed=false,_bcTimer=null
async function adminBroadcastSend(){
  const ta=document.getElementById('adm-bc'),btn=document.getElementById('adm-bc-btn')
  const text=ta?.value.trim()||''
  if(!text){toast('Напиши сообщение','⚠️');return}
  if(!_bcArmed){
    _bcArmed=true
    btn.innerHTML='⚠️ Точно отправить всем?'
    btn.style.background='linear-gradient(135deg,var(--red),#ff7b4d)'
    clearTimeout(_bcTimer)
    _bcTimer=setTimeout(()=>{_bcArmed=false;btn.innerHTML='📣 Отправить всем';btn.style.background='linear-gradient(135deg,var(--gold),#ff9d4d)'},4000)
    return
  }
  clearTimeout(_bcTimer);_bcArmed=false
  btn.innerHTML='<span class="spin"></span>';btn.disabled=true
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminBroadcast',text:encodeURIComponent(text),initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){toast('📣 Отправлено: '+d.sent+' клиентам','✅');ta.value=''}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
  btn.innerHTML='📣 Отправить всем';btn.disabled=false
  btn.style.background='linear-gradient(135deg,var(--gold),#ff9d4d)'
}

// ── АДМИН: КЛИЕНТЫ (баллы и бан) ──
let _admClient=null
function _admInit(){try{return window.Telegram?.WebApp?.initData||''}catch(e){return ''}}
async function adminFindClient(){
  const q=document.getElementById('adm-q')?.value.trim()
  const box=document.getElementById('adm-client');if(!box)return
  if(!q){toast('Введи телефон, ник или ID','⚠️');return}
  box.innerHTML='<div style="text-align:center;padding:14px"><span class="spin"></span></div>'
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminFind',q:q,initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(!d.ok){box.innerHTML='<div style="text-align:center;color:var(--t3);font-size:12px;padding:12px">'+(d.error||'Не найден')+'</div>';_admClient=null;return}
    _admClient=d;renderAdmClient()
  }catch(e){box.innerHTML='<div style="text-align:center;color:var(--red);font-size:12px;padding:12px">Нет связи с сервером</div>'}
}
function renderAdmClient(){
  const box=document.getElementById('adm-client');if(!box||!_admClient)return
  const c=_admClient
  box.innerHTML=`
    <div style="padding:14px;border-radius:16px;background:linear-gradient(160deg,var(--s2),var(--s1));border:1px solid ${c.banned?'rgba(255,63,96,.35)':'var(--b1)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:800;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name||'Без имени'}</div>
          <div style="font-family:var(--m);font-size:10px;color:var(--t3);margin-top:2px">${c.phone||'—'} · ID ${c.tgId}</div>
        </div>
        <span class="B ${c.banned?'Bx':'Bl'}">${c.banned?'🚫 БАН':'✅ ОК'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:11px;color:var(--t2)">Баланс:</span>
        <span style="font-family:var(--m);font-size:20px;font-weight:700;color:var(--gold);text-shadow:0 0 10px rgba(255,202,80,.4)" id="adm-bal">${c.balance}</span>
        <span style="font-size:12px">⭐</span>
        <button onclick="adminSetBal()" style="margin-left:auto;padding:5px 10px;border-radius:9px;background:var(--s3);border:1px solid var(--b2);color:var(--t2);font-size:10px;font-weight:700;cursor:pointer">✎ точно</button>
      </div>
      ${c.stats?`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
        <div style="text-align:center;padding:8px 2px;border-radius:10px;background:var(--s3)"><div style="font-family:var(--m);font-size:15px;font-weight:700;color:var(--lime)">${c.stats.active}</div><div style="font-size:8px;color:var(--t3);margin-top:1px">визитов</div></div>
        <div style="text-align:center;padding:8px 2px;border-radius:10px;background:var(--s3)"><div style="font-family:var(--m);font-size:15px;font-weight:700;color:var(--cyan)">${c.stats.hours}</div><div style="font-size:8px;color:var(--t3);margin-top:1px">часов</div></div>
        <div style="text-align:center;padding:8px 2px;border-radius:10px;background:var(--s3)"><div style="font-family:var(--m);font-size:15px;font-weight:700;color:var(--gold)">${c.stats.spent}</div><div style="font-size:8px;color:var(--t3);margin-top:1px">BYN</div></div>
        <div style="text-align:center;padding:8px 2px;border-radius:10px;background:var(--s3)"><div style="font-family:var(--m);font-size:15px;font-weight:700;color:var(--red)">${c.stats.cancelled}</div><div style="font-size:8px;color:var(--t3);margin-top:1px">отмен</div></div>
      </div>${c.stats.lastVisit?`<div style="font-size:10px;color:var(--t3);margin-bottom:12px;text-align:center">Последний визит: <b style="color:var(--t2)">${c.stats.lastVisit}</b></div>`:''}`:''}
      <div style="display:flex;gap:7px;margin-bottom:8px">
        <input id="adm-amt" class="INP" type="number" placeholder="Сумма" style="flex:1;margin:0;padding:10px 12px;font-size:13px">
        <input id="adm-reason" class="INP" placeholder="Причина (увидит клиент)" style="flex:2;margin:0;padding:10px 12px;font-size:13px">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
        <button onclick="adminPts(-1)" style="padding:11px 0;border-radius:12px;background:rgba(255,63,96,.12);border:1px solid rgba(255,63,96,.3);color:var(--red);font-size:12.5px;font-weight:700;cursor:pointer">− Списать</button>
        <button onclick="adminPts(1)" style="padding:11px 0;border-radius:12px;background:rgba(196,255,62,.1);border:1px solid var(--lime30);color:var(--lime);font-size:12.5px;font-weight:700;cursor:pointer">+ Начислить</button>
        <button onclick="adminZeroPts()" style="padding:11px 0;border-radius:12px;background:var(--s3);border:1px solid var(--b2);color:var(--t2);font-size:12.5px;font-weight:700;cursor:pointer">🗑 Обнулить ⭐</button>
        <button onclick="adminToggleBan()" style="padding:11px 0;border-radius:12px;background:${c.banned?'rgba(196,255,62,.1)':'rgba(255,63,96,.12)'};border:1px solid ${c.banned?'var(--lime30)':'rgba(255,63,96,.3)'};color:${c.banned?'var(--lime)':'var(--red)'};font-size:12.5px;font-weight:700;cursor:pointer">${c.banned?'✅ Разбанить':'🚫 Забанить'}</button>
      </div>
      <div style="display:flex;gap:7px;margin-top:8px">
        <input id="adm-msg" class="INP" maxlength="500" placeholder="💬 Личное сообщение клиенту…" style="flex:1;margin:0;padding:10px 12px;font-size:12.5px">
        <button onclick="adminSendMsg()" style="flex-shrink:0;width:46px;border-radius:12px;background:linear-gradient(135deg,var(--blue),var(--cyan));border:none;font-size:16px;cursor:pointer">📨</button>
      </div>
      <div id="adm-hist" style="margin-top:11px"></div>
    </div>`
  fillAdmHist(c.tgId)
}
async function fillAdmHist(tgId){
  const h=document.getElementById('adm-hist');if(!h)return
  let all=[];try{all=await loadAdminBookings(true)}catch(e){}
  const mine=all.filter(b=>String(b.tgId)===String(tgId))
    .sort((a,b)=>{const p=s=>{const x=String(s.date).split('.');return x.length===3?(+x[2])*10000+(+x[1])*100+(+x[0]):0};return p(b)-p(a)})
    .slice(0,4)
  if(!mine.length){h.innerHTML='<div style="font-size:10px;color:var(--t3);text-align:center;padding:6px">Броней не найдено</div>';return}
  h.innerHTML='<div style="font-size:9px;font-weight:700;color:var(--t3);letter-spacing:1.5px;margin-bottom:6px">ПОСЛЕДНИЕ БРОНИ</div>'+
    mine.map(b=>{
      const st=b.status==='cancelled'?'✖':b.status==='completed'?'✓':'●'
      const col=b.status==='cancelled'?'var(--red)':b.status==='completed'?'var(--t3)':'var(--lime)'
      const act=b.status!=='cancelled'&&b.status!=='completed'
      return `<div style="display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--t2);padding:4px 0;font-family:var(--m)"><span style="color:${col}">${st}</span><span style="min-width:52px">${b.date}</span><span style="color:var(--cyan)">${b.start}–${b.end}</span><span style="color:var(--lime);font-weight:700">${b.pc}</span><span style="margin-left:auto">${b.price} BYN</span>${act?`<button onclick="adminCancelAny('${b.id}')" style="width:22px;height:22px;border-radius:7px;background:rgba(255,63,96,.12);border:1px solid rgba(255,63,96,.3);color:var(--red);font-size:10px;cursor:pointer;flex-shrink:0">✕</button>`:''}</div>`
    }).join('')
}
async function adminPts(sign){
  if(!_admClient)return
  const amt=parseInt(document.getElementById('adm-amt')?.value)||0
  const reason=document.getElementById('adm-reason')?.value.trim()||''
  if(!amt||amt<1){toast('Укажи сумму','⚠️');return}
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminPoints',tgId:_admClient.tgId,amount:String(sign*amt),reason:encodeURIComponent(reason),initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_admClient.balance=d.balance;renderAdmClient();toast((sign>0?'+':'−')+amt+' ⭐ · баланс '+d.balance,'✅')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}
async function adminSetBal(){
  if(!_admClient)return
  const v=prompt('Точный баланс баллов для '+(_admClient.name||_admClient.tgId)+':',_admClient.balance)
  if(v===null)return
  const t=parseInt(v)
  if(isNaN(t)||t<0){toast('Введи число ≥ 0','⚠️');return}
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminSetBal',tgId:_admClient.tgId,target:String(t),initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_admClient.balance=d.balance;renderAdmClient();toast('Баланс: '+d.balance+' ⭐','✅')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}
async function adminZeroPts(){  if(!_admClient)return
  const bal=_admClient.balance||0
  if(!bal){toast('Баланс уже 0','⭐');return}
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminPoints',tgId:_admClient.tgId,amount:String(-bal),reason:encodeURIComponent('Обнуление баланса'),initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_admClient.balance=d.balance;renderAdmClient();toast('Баланс обнулён','🗑')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}
async function adminSendMsg(){
  if(!_admClient)return
  const inp=document.getElementById('adm-msg'),text=inp?.value.trim()||''
  if(!text){toast('Напиши сообщение','⚠️');return}
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminMsg',tgId:_admClient.tgId,text:encodeURIComponent(text),initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){if(inp)inp.value='';toast('📨 Отправлено клиенту','✅')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}
async function adminToggleBan(){
  if(!_admClient)return
  const on=_admClient.banned?'0':'1'
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'adminBan',tgId:_admClient.tgId,on:on,initData:_admInit(),adminKey:(D._admKey||''),_t:Date.now()}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok){_admClient.banned=d.banned;renderAdmClient();toast(d.banned?'Клиент забанен':'Бан снят',d.banned?'🚫':'✅')}
    else toast(d.error||'Ошибка','⚠️')
  }catch(e){toast('Нет связи','⚠️')}
}

// ── ДАШБОРД ВЛАДЕЛЬЦА: бизнес-статистика ──
async function renderAdminDash(){
  const box=document.getElementById('admin-dash');if(!box||!isAdmin())return
  let all=[];try{all=await loadAdminBookings(true)}catch(e){}
  const normD=s=>String(s||'').replace(/\s.*/,'').trim().replace(/\b0(\d)/g,'$1')
  const today=normD(clubNow().date)
  // Неделя — последние 7 дат
  const weekDates=[];for(let i=0;i<7;i++){weekDates.push(normD(dateOfDayNum(clubNow().day-i)))}
  const active=all.filter(b=>b.status!=='cancelled'&&b.status!=='completed'||true) // все для статистики
  const valid=all.filter(b=>b.status!=='cancelled')

  // Сегодня
  const todayBks=valid.filter(b=>normD(b.date)===today)
  const todayRev=todayBks.reduce((s,b)=>s+(parseFloat(b.price)||0),0)
  // Неделя
  const weekBks=valid.filter(b=>weekDates.includes(normD(b.date)))
  const weekRev=weekBks.reduce((s,b)=>s+(parseFloat(b.price)||0),0)
  // Загрузка по зонам (сегодня) — кол-во броней по зонам / всего ПК
  const zoneCount={std:0,vip:0,bootcamp:0}
  todayBks.forEach(b=>{const z=b.zone==='bc'?'bootcamp':b.zone;if(zoneCount[z]!==undefined)zoneCount[z]++})
  const zoneTotal={std:13,vip:3,bootcamp:5}
  // Популярные часы (по всем валидным)
  const hourHist={}
  valid.forEach(b=>{const h=parseInt(String(b.start).split(':')[0]);if(!isNaN(h))hourHist[h]=(hourHist[h]||0)+1})
  let peakH='—',peakV=0;Object.entries(hourHist).forEach(([h,v])=>{if(v>peakV){peakV=v;peakH=h}})
  const peakStr=peakH==='—'?'—':(peakH<10?'0':'')+peakH+':00'
  // Уникальные клиенты (по tgId)
  const clients=new Set(valid.filter(b=>b.tgId).map(b=>b.tgId)).size
  // Оффлайн vs онлайн сегодня
  const offToday=todayBks.filter(b=>b.source==='offline'||String(b.pkg||'').includes('Оффлайн')).length

  const zoneBar=(name,key,color)=>{
    const cnt=zoneCount[key],tot=zoneTotal[key],pct=Math.min(100,Math.round(cnt/tot*100))
    return `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--t2)">${name}</span><span style="color:${color};font-family:var(--m);font-weight:700">${cnt}/${tot}</span></div><div style="height:6px;background:var(--s3);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;box-shadow:0 0 8px ${zA(key,.4)};transition:width .5s"></div></div></div>`
  }

  box.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="padding:15px;border-radius:16px;background:linear-gradient(155deg,rgba(196,255,62,.1),rgba(196,255,62,.02));border:1px solid var(--lime15)">
        <div style="font-size:10px;color:var(--t2);letter-spacing:1px;text-transform:uppercase">Сегодня броней</div>
        <div style="font-family:var(--m);font-size:30px;font-weight:700;color:var(--lime);line-height:1;margin-top:4px;text-shadow:0 0 14px rgba(196,255,62,.4)">${todayBks.length}</div>
        ${offToday?`<div style="font-size:9px;color:var(--t3);margin-top:3px">из них ${offToday} оффлайн</div>`:''}
      </div>
      <div style="padding:15px;border-radius:16px;background:linear-gradient(155deg,rgba(255,202,80,.1),rgba(255,202,80,.02));border:1px solid rgba(255,202,80,.18)">
        <div style="font-size:10px;color:var(--t2);letter-spacing:1px;text-transform:uppercase">Выручка сегодня</div>
        <div style="font-family:var(--m);font-size:30px;font-weight:700;color:var(--gold);line-height:1;margin-top:4px;text-shadow:0 0 14px rgba(255,202,80,.4)">${todayRev}<span style="font-size:13px"> BYN</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="padding:12px;border-radius:14px;background:var(--s2);border:1px solid var(--b1);text-align:center">
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--cyan)">${weekBks.length}</div>
        <div style="font-size:9px;color:var(--t2);margin-top:2px">броней/нед</div>
      </div>
      <div style="padding:12px;border-radius:14px;background:var(--s2);border:1px solid var(--b1);text-align:center">
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--cyan)">${weekRev}</div>
        <div style="font-size:9px;color:var(--t2);margin-top:2px">BYN/нед</div>
      </div>
      <div style="padding:12px;border-radius:14px;background:var(--s2);border:1px solid var(--b1);text-align:center">
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--blue)">${peakStr}</div>
        <div style="font-size:9px;color:var(--t2);margin-top:2px">пик-час</div>
      </div>
    </div>
    <div class="PA" style="padding:15px">
      <div style="font-size:10px;font-weight:700;color:var(--t3);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Загрузка зон сегодня</div>
      ${zoneBar('⚡ Standard','std','var(--lime)')}
      ${zoneBar('👑 VIP','vip','var(--gold)')}
      ${zoneBar('🏆 Bootcamp','bootcamp','var(--blue)')}
      <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--b1);font-size:11px"><span style="color:var(--t2)">👥 Всего клиентов</span><span style="color:var(--txt);font-weight:700;font-family:var(--m)">${clients}</span></div>
    </div>`
}
