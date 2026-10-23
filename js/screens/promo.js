// Промокоды

// ═══════════════════════════════════════════════
// PROMO (USER)
// ═══════════════════════════════════════════════
async function usePromo(){
  const code=document.getElementById('promo-in').value.trim().toUpperCase()
  if(!code)return
  const res=document.getElementById('promo-res');res.style.display='block'
  res.innerHTML=`<div style="padding:10px;text-align:center;color:var(--t2);font-size:12px"><span class="spin"></span></div>`

  // 🔒 Всё на сервере — код не утекает, проверка "1 человек = 1 промокод"
  try{
    const r=await fetch(API_URL+'?'+new URLSearchParams({
      action:'validatePromo',
      code:code,
      user:D.user.name||'Гость',
      phone:D.user.phone||'',
      tgId:D.user._tgId||'',
      _t:Date.now()
    }))
    const d=await r.json()

    if(d.ok){
      res.innerHTML=`<div style="padding:10px 13px;border-radius:10px;background:var(--lime08);border:1px solid var(--lime30);font-size:12px;color:var(--lime)">✅ ${_('promoOk')} ${d.bonus?_('bonusLbl')+' +'+d.bonus+'h':''}${d.disc?' -'+d.disc+'%':''}</div>`
      document.getElementById('promo-in').value=''
    }else{
      res.innerHTML=`<div style="padding:10px 13px;border-radius:10px;background:var(--red08);border:1px solid var(--red25);font-size:12px;color:var(--red)">❌ ${d.error||_('promoFail')}</div>`
    }
  }catch(e){
    res.innerHTML=`<div style="padding:10px 13px;border-radius:10px;background:var(--red08);border:1px solid var(--red25);font-size:12px;color:var(--red)">❌ Нет соединения</div>`
  }
}

// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
// ПРОМОКОДЫ — через Apps Script Backend
// ═══════════════════════════════════════════════

async function loadPromosFromSheets(){
  const data=await apiGet('getPromos')
  if(data&&data.ok&&data.promos){
    D.promos=data.promos
    renderPromoList()
  }
}

async function savePromoUse(code,used){ apiCall('usePromo',{code}) }
async function syncPromosToSheets(){ await apiCall('syncPromos',{promos:D.promos});toast('Синхронизировано ✓') }
async function createPromoRemote(p){ apiCall('createPromo',{promo:p}) }
async function togglePromoRemote(code,on){ apiCall('togglePromo',{code,on}) }
async function deletePromoRemote(code){ apiCall('deletePromo',{code}) }
async function tgRaw(method,params){ return apiCall('notify',{msg:params?.text||''}) }

// ═══════════════════════════════════════════════
// PROMO ADMIN
// ═══════════════════════════════════════════════
function createPromo(){
  const code=document.getElementById('p-code').value.trim().toUpperCase()
  const uses=parseInt(document.getElementById('p-uses').value)||100
  const name=document.getElementById('p-name').value.trim()
  const bonus=parseFloat(document.getElementById('p-bonus').value)||0
  const disc=parseInt(document.getElementById('p-disc').value)||0
  if(!code){toast(_('enterCode'),'⚠️');return}
  if(D.promos.find(p=>p.code===code)){toast(_('promoExists'),'⚠️');return}
  const newPromo={code,name:name||code,bonus,disc,uses,used:0,on:true}
  D.promos.unshift(newPromo);sv();renderPromoList()
  createPromoRemote(newPromo)
  ;['p-code','p-name'].forEach(id=>document.getElementById(id).value='')
  document.getElementById('p-uses').value='100'
  document.getElementById('p-bonus').value='1'
  document.getElementById('p-disc').value='0'
  toast(_('promoCreated'))
  syncPromosToSheets()
}

function renderPromoList(){
  // Show/hide admin panel
  const adminSec=document.getElementById('admin-section')
  if(adminSec)adminSec.style.display=isAdmin()?'block':'none'
  applyNotifUI()
  // Админ-блоки тяжёлые — рисуем по очереди в простое, чтобы не подвисало
  if(isAdmin()){
    checkMaintenance()
    const ak=document.getElementById('adm-key');if(ak&&D._admKey)ak.placeholder='🔑 ключ сохранён — можно заменить'
    adminRunDiag()
    idle(()=>renderAdminDash(),2000)
    setTimeout(()=>idle(()=>renderAdminToday()),260)
    setTimeout(()=>idle(()=>renderAdminOffline()),520)
  }
  const botRow=document.getElementById('bot-test-row')
  if(botRow)botRow.style.display=isAdmin()?'block':'none'
  const el=document.getElementById('promo-list');if(!el)return
  if(!D.promos.length){el.innerHTML='';return}
  el.innerHTML=D.promos.map((p,i)=>`
  <div class="PI fu" style="animation-delay:${i*.04}s">
    <div style="height:2.5px;background:${p.on?'linear-gradient(90deg,var(--lime),var(--cyan))':'var(--s4)'}"></div>
    <div class="pi-h">
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--m);font-size:17px;font-weight:700;letter-spacing:1px;color:${p.on?'var(--lime)':'var(--t2)'};margin-bottom:2px">${p.code}</div>
        <div style="font-size:11px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      </div>
      <span class="B ${p.on?'Bl':'Bx'}" style="margin-left:8px">${p.on?_('onPills'):_('offPills')}</span>
    </div>
    <div style="padding:0 16px;margin-bottom:4px;font-family:var(--m);font-size:10px;color:var(--t3)">
      ${p.bonus?`+${p.bonus}h`:''} ${p.bonus&&p.disc?'·':''} ${p.disc?`-${p.disc}%`:''} &nbsp;·&nbsp; ${p.used}/${p.uses} ${_('usesLeft')}
    </div>
    <div style="padding:0 12px 12px;display:flex;gap:7px">
      <button onclick="togP(${i})" style="padding:7px 13px;border-radius:9px;background:${p.on?'var(--red08)':'var(--lime08)'};border:1px solid ${p.on?'var(--red25)':'var(--lime30)'};color:${p.on?'var(--red)':'var(--lime)'};font-size:12px;font-weight:600;cursor:pointer">${p.on?(D.lang!=='ru'?'⏸ Off':'⏸ Выкл'):(D.lang!=='ru'?'▶ On':'▶ Вкл')}</button>
      <button onclick="delP(${i})" style="padding:7px 13px;border-radius:9px;background:var(--s3);border:1px solid var(--b1);color:var(--t2);font-size:12px;font-weight:600;cursor:pointer">🗑</button>
    </div>
  </div>`).join('')
}

function togP(i){const p=D.promos[i];p.on=!p.on;sv();renderPromoList();togglePromoRemote(p.code,p.on)}
function delP(i){const code=D.promos[i].code;D.promos.splice(i,1);sv();renderPromoList();toast(_('promoDel'),'🗑');deletePromoRemote(code)}
