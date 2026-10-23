// Баллы и награды

// ═══════════════════════════════════════════════
// ⭐ СЕРВЕРНЫЕ БАЛЛЫ + НАГРАДЫ
// ═══════════════════════════════════════════════

// Загрузить актуальный баланс с сервера
async function loadServerPoints(){
  const tgId=D.user._tgId;if(!tgId)return
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({action:'getPoints',tgId}),{cache:'no-store'})
    const d=await r.json()
    if(d.ok&&d.balance!==undefined){
      const changed=d.balance!==D.user.pts
      D.user.pts=d.balance;sv()
      const el=document.getElementById('pts-val');if(el)el.textContent=d.balance
      // Баланс изменился (бонус от админа, ДР) — перерисовываем профиль целиком: замки наград, прогресс, счётчик
      if(changed&&D.cur==='profile')renderProfile()
    }
  }catch(e){}
}

// Обмен баллов на награду (через UI)
async function redeemRewardUI(rewardId,label,cost){
  const tgId=D.user._tgId
  if(!tgId){toast('Нужен Telegram для баллов','⚠️');return}
  const bal=D.user.pts||0
  if(bal<cost){
    const need=cost-bal
    toast(`Не хватает ${need} ⭐ — ещё накопишь!`,'⚠️');return
  }
  const after=bal-cost
  const modal=document.createElement('div')
  modal.className='MBG open';modal.style.zIndex='400'
  modal.innerHTML=`<div class="MOD" style="transform:none;max-height:88%">
    <div class="MH"></div>
    <div style="text-align:center;padding:4px 0 14px">
      <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;width:76px;height:76px;margin-bottom:10px">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(196,255,62,.2),transparent 70%);animation:glow-pulse 2.4s ease-in-out infinite"></div>
        <span style="font-size:38px;filter:drop-shadow(0 0 14px rgba(196,255,62,.5))">🎁</span>
      </div>
      <div style="font-family:var(--F);font-size:23px;font-weight:800;background:linear-gradient(120deg,#fff 25%,var(--lime));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">Обмен баллов</div>
    </div>

    <!-- Что получаешь -->
    <div style="margin-bottom:12px;padding:18px;background:linear-gradient(135deg,rgba(196,255,62,.1),rgba(196,255,62,.02));border:1.5px solid var(--lime30);border-radius:16px;text-align:center">
      <div style="font-family:var(--F);font-size:24px;font-weight:800;color:var(--lime);text-shadow:0 0 16px rgba(196,255,62,.35)">${label}</div>
      <div style="font-size:11px;color:var(--t2);margin-top:4px">бесплатного игрового времени</div>
    </div>

    <!-- Баланс до/после -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div style="flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--s2);border:1px solid var(--b1)">
        <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px">Сейчас</div>
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--gold);margin-top:2px">${bal} ⭐</div>
      </div>
      <div style="font-size:18px;color:var(--t3)">→</div>
      <div style="flex:1;text-align:center;padding:11px;border-radius:12px;background:rgba(255,63,96,.06);border:1px solid rgba(255,63,96,.2)">
        <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px">Спишется</div>
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--red);margin-top:2px">−${cost}</div>
      </div>
      <div style="font-size:18px;color:var(--t3)">→</div>
      <div style="flex:1;text-align:center;padding:11px;border-radius:12px;background:var(--s2);border:1px solid var(--b1)">
        <div style="font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:1px">Останется</div>
        <div style="font-family:var(--m);font-size:18px;font-weight:700;color:var(--txt);margin-top:2px">${after} ⭐</div>
      </div>
    </div>

    <!-- Как это работает: 3 шага -->
    <div class="SL" style="margin:0 0 10px">Как это работает</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
      <div style="display:flex;gap:11px;align-items:center">
        <div style="width:26px;height:26px;flex-shrink:0;border-radius:50%;background:var(--lime);color:#000;font-family:var(--m);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center">1</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.45">Нажимаешь «Активировать» — баллы спишутся, создастся <b style="color:var(--txt)">ваучер</b></div>
      </div>
      <div style="display:flex;gap:11px;align-items:center">
        <div style="width:26px;height:26px;flex-shrink:0;border-radius:50%;background:var(--cyan);color:#000;font-family:var(--m);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center">2</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.45">Приходишь в клуб и <b style="color:var(--txt)">показываешь ваучер админу</b> с экрана телефона</div>
      </div>
      <div style="display:flex;gap:11px;align-items:center">
        <div style="width:26px;height:26px;flex-shrink:0;border-radius:50%;background:var(--gold);color:#000;font-family:var(--m);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center">3</div>
        <div style="font-size:12px;color:var(--t2);line-height:1.45">Админ активирует — <b style="color:var(--lime)">играешь бесплатно</b> положенные часы 🎮</div>
      </div>
    </div>

    <!-- Важное предупреждение -->
    <div style="display:flex;gap:10px;align-items:flex-start;padding:13px 15px;border-radius:13px;background:rgba(255,202,80,.07);border:1.5px solid rgba(255,202,80,.3);margin-bottom:18px">
      <span style="font-size:20px;flex-shrink:0">⏰</span>
      <div>
        <div style="font-size:12.5px;font-weight:800;color:var(--gold);margin-bottom:3px">Ваучер действует ровно 24 часа!</div>
        <div style="font-size:11px;color:var(--t2);line-height:1.55">Активируй только когда <b style="color:var(--txt)">собираешься в клуб сегодня-завтра</b>. Просроченный ваучер сгорит, а баллы не вернутся.</div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:9px">
      <button class="BTN" id="rw-yes" style="background:linear-gradient(135deg,var(--lime),var(--cyan));color:#000;font-weight:800">Активировать за ${cost} ⭐</button>
      <button class="BTN ghost" id="rw-no">Пока коплю дальше</button>
    </div>
  </div>`
  document.getElementById('app').appendChild(modal)
  modal.querySelector('#rw-no').onclick=()=>modal.remove()
  modal.onclick=e=>{if(e.target===modal)modal.remove()}
  modal.querySelector('#rw-yes').onclick=async()=>{
    const btn=modal.querySelector('#rw-yes')
    btn.innerHTML='<span class="spin"></span>';btn.disabled=true
    try{
      const r=await fetch(API_URL+'?'+new URLSearchParams({
        action:'redeemReward',rewardId,tgId,
        user:D.user.name||'Гость',phone:D.user.phone||''
      }),{cache:'no-store'})
      const d=await r.json()
      if(d.ok){
        modal.remove()
        D.user.pts=d.balance;sv()
        toast('🎁 Ваучер активен! Покажи админу в течение 24ч','🎁')
        renderProfile()
      }else{
        toast(d.error||'Ошибка','❌')
        btn.innerHTML=`Активировать за ${cost} ⭐`;btn.disabled=false
      }
    }catch(e){
      toast('Ошибка соединения','⚠️')
      btn.innerHTML=`Активировать за ${cost} ⭐`;btn.disabled=false
    }
  }
}
