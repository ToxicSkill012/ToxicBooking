// Экран «Мои брони»

// ═══════════════════════════════════════════════
// BOOKINGS LIST
// ═══════════════════════════════════════════════
function renderBkList(){
  const bks=D.user.bks,act=bks.filter(b=>b.status==='active')
  const sub=document.getElementById('bkl-sub')
  const title=document.getElementById('bkl-title')
  if(title)title.innerHTML=D.lang==='en'?'MY<br>BOOKINGS':'МОИ<br>БРОНИ'
  if(sub)sub.textContent=`${act.length} ${_('activeTab').toLowerCase()} · ${bks.length} ${_('totalLbl').toLowerCase()}`
  const body=document.getElementById('bkl-body');if(!body)return
  if(!bks.length){
    body.innerHTML=`
    <div style="padding:50px 20px 20px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px;filter:drop-shadow(0 0 20px rgba(196,255,62,.2))">🎮</div>
      <div style="font-family:var(--F);font-size:22px;font-weight:800;letter-spacing:-.7px;color:var(--lime);margin-bottom:6px">Броней пока нет</div>
      <div style="font-size:13px;color:var(--t2);margin-bottom:28px;line-height:1.6">Выбери зону на главной и забронируй<br>любимый ПК прямо сейчас!</div>
      <button class="BTN" onclick="go('home')" style="max-width:220px;margin:0 auto">🎮 Выбрать зону</button>
      <div style="margin-top:20px;padding:14px 16px;background:var(--s2);border:1px solid var(--b1);border-radius:14px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">⭐ Первая бронь = первые баллы!</div>
        <div style="font-size:11px;color:var(--t2);line-height:1.6">За каждую бронь ты получаешь ⭐ баллы.<br>Копи и получай часы бесплатно!</div>
      </div>
    </div>`;return
  }
  const active=bks.filter(b=>b.status==='active'),hist=bks.filter(b=>b.status!=='active')
  let html=''
  if(active.length)html+=`<div class="SL">${_('activeTab')}</div>`+active.map(bkCard).join('')
  if(hist.length)html+=`<div class="SL" style="margin-top:4px">${_('histTab')}</div>`+hist.map(b=>bkCard(b,true)).join('')
  body.innerHTML=html
}

function bkCard(b,past=false){
  const z=ZONES[b.zone]||{stripe:'var(--t3)',color:'var(--t2)',emoji:'',name:b.zone,badge:'Bx'}
  return `<div class="BKI fu" style="${past?'opacity:.4':'border-color:'+z.color+'33'}">
    <div style="height:4px;background:${past?'var(--s4)':z.stripe};${past?'':'box-shadow:0 0 12px '+z.color+'66'}"></div>
    <div class="bki-b">
      <div class="bki-t"><div class="bki-pc" style="color:${past?'var(--t2)':z.color};${past?'':'text-shadow:0 0 16px '+z.color+'55'}">${b.pc}</div><span class="B ${past?'Bx':z.badge}">${past?_('cancelled'):_('active')}</span></div>
      <div class="bki-z">${z.emoji} ${z.name} · ${b.pkg} · <b style="color:${past?'var(--t2)':z.color}">${b.price} BYN</b></div>
      <div class="bki-m"><span>📅 ${b.date}</span><span>🕐 ${b.start}–${b.end}</span><span>⏱ ${b.h}h</span></div>
      ${!past?`<button class="BTN danger" style="margin-top:13px;width:auto;padding:9px 18px;font-size:13px" onclick="cancelBk('${b.id}')">${_('cancelBk')}</button>`:''}
    </div>
  </div>`
}

function cancelBk(id){
  const bk=D.user.bks.find(b=>String(b.id)===String(id));if(!bk){toast('Бронь не найдена','⚠️');return}
  const modal=document.createElement('div')
  modal.className='MBG open';modal.style.zIndex='300'
  modal.innerHTML=`<div class="MOD" style="transform:none">
    <div class="MH"></div>
    <div style="text-align:center;font-size:36px;margin-bottom:10px">🗑</div>
    <div class="MT" style="text-align:center">Отменить бронь?</div>
    <p style="font-size:13px;color:var(--t2);text-align:center;margin:10px 0 18px;line-height:1.6"><b>${bk.pc}</b> · ${bk.date}<br>${bk.start}–${bk.end} · ${bk.price} BYN</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="BTN danger" id="cc-yes">Да, отменить</button>
      <button class="BTN ghost" id="cc-no">Назад</button>
    </div>
  </div>`
  document.getElementById('app').appendChild(modal)
  modal.querySelector('#cc-no').onclick=()=>modal.remove()
  modal.onclick=e=>{if(e.target===modal)modal.remove()}
  modal.querySelector('#cc-yes').onclick=async()=>{
    modal.remove()
    D.user.bks=D.user.bks.map(b=>b.id==id?{...b,status:'cancelled'}:b)
    sv();renderBkList();toast('Бронь отменена','🗑')
    if(String(bk.id).startsWith('BK')){
      try{
        const r=await fetch(API_URL+'?'+new URLSearchParams({action:'cancelBooking',id:bk.id,tgId:D.user._tgId||'',_t:Date.now()}),{cache:'no-store'})
        const d=await r.json()
        if(d.ok&&d.revoked>0){
          D.user.pts=Math.max(0,(D.user.pts||0)-d.revoked);sv()
          toast(`⭐ −${d.revoked} баллов (отмена)`,'⭐')
        }
      }catch(e){}
    }
  }
}
