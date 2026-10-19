// Экран «Мои брони»: живой таймер до начала и до конца сессии

// ═══════════════════════════════════════════════
// BOOKINGS LIST
// ═══════════════════════════════════════════════
function renderBkList(){
  expireLocalBookings()
  const bks=D.user.bks,act=bks.filter(b=>b.status==='active')
  const sub=document.getElementById('bkl-sub')
  const title=document.getElementById('bkl-title')
  if(title)title.innerHTML=D.lang==='en'?'MY<br>BOOKINGS':'МОИ<br>БРОНИ'
  const pl=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c}
  if(sub)sub.textContent=D.lang==='en'?`${act.length} active · ${bks.length} total`:`${act.length} ${pl(act.length,'активная','активные','активных')} · ${bks.length} всего`
  const body=document.getElementById('bkl-body');if(!body)return
  if(!bks.length){
    body.innerHTML=`
    <div style="padding:50px 20px 20px;text-align:center">
      <div style="font-size:64px;margin-bottom:16px;filter:drop-shadow(0 0 20px rgba(196,255,62,.2))">🎮</div>
      <div style="font-family:var(--F);font-size:22px;font-weight:800;letter-spacing:-.7px;color:var(--lime);margin-bottom:6px">Броней пока нет</div>
      <div style="font-size:13px;color:var(--t2);margin-bottom:28px;line-height:1.6">Выбери зону на главной и забронируй<br>любимый ПК прямо сейчас!</div>
      <button class="BTN" onclick="go('home')" style="max-width:220px;margin:0 auto">🎮 Выбрать зону</button>
      <div class="glass" style="margin-top:20px;padding:14px 16px;border-radius:14px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">⭐ Первая бронь = первые баллы!</div>
        <div style="font-size:11px;color:var(--t2);line-height:1.6">За каждую бронь ты получаешь ⭐ баллы.<br>Копи и получай часы бесплатно!</div>
      </div>
    </div>`;return
  }
  const active=bks.filter(b=>b.status==='active'),hist=bks.filter(b=>b.status!=='active')
  // Ближайшие — сверху
  active.sort((a,b)=>((bookingAbsRange(a.date,a.start,a.end)||[0])[0])-((bookingAbsRange(b.date,b.start,b.end)||[0])[0]))
  let html=''
  if(active.length)html+=`<div class="SL">${_('activeTab')}</div>`+active.map(b=>bkCard(b)).join('')
  if(hist.length)html+=`<div class="SL" style="margin-top:4px">${_('histTab')}</div>`+hist.slice(0,30).map(b=>bkCard(b,true)).join('')
  body.innerHTML=html
  tickBkList()
}

// Подпись статуса и таймер для карточки
function bkTiming(b){
  const r=bookingAbsRange(b.date,b.start,b.end),now=clubNow().abs
  const en=D.lang==='en'
  if(!r)return {txt:'',pct:0,live:false}
  if(now<r[0])return {txt:(en?'starts in ':'до начала ')+fmtDur(r[0]-now),pct:0,live:false,soon:r[0]-now<=60}
  if(now<r[1])return {txt:(en?'live · ':'идёт · осталось ')+fmtDur(r[1]-now),pct:Math.round((now-r[0])/(r[1]-r[0])*100),live:true}
  return {txt:en?'finished':'завершена',pct:100,live:false}
}

function bkCard(b,past=false){
  const z=ZONES[b.zone==='bootcamp'?'bc':b.zone]||{stripe:'var(--t3)',color:'var(--t2)',emoji:'',name:b.zone,badge:'Bx'}
  const t=past?null:bkTiming(b)
  const stLbl=past?(b.status==='completed'?(D.lang==='en'?'done':'завершена'):_('cancelled')):(t.live?(D.lang==='en'?'● LIVE':'● ИДЁТ'):_('active'))
  const pcs=b.pcs&&b.pcs.length?b.pcs:String(b.pc||'').split(/,\s*/)
  const team=pcs.length>1
  return `<div class="BKI fu${past?' past':''}${t&&t.live?' live':''}" data-bk="${b.id}" style="${past?'':'border-color:'+zA(z,.2)}">
    <div style="height:4px;background:${past?'var(--s4)':z.stripe};${past?'':'box-shadow:0 0 12px '+zA(z,.4)}"></div>
    <div class="bki-b">
      <div class="bki-t"><div class="bki-pc" style="color:${past?'var(--t2)':z.color};${past?'':'text-shadow:0 0 16px '+zA(z,.33)}">${team?'👥 ×'+pcs.length:b.pc}</div><span class="B ${past?'Bx':t.live?'Bl':z.badge}">${stLbl}</span></div>
      ${team?`<div class="bki-pcs">${pcs.map(x=>`<span>${x}</span>`).join('')}</div>`:''}
      <div class="bki-z">${z.emoji} ${z.name} · ${b.pkg||''} · <b style="color:${past?'var(--t2)':z.color}">${b.price} BYN</b></div>
      <div class="bki-m"><span>📅 ${b.date}</span><span>🕐 ${b.start}–${b.end}</span><span>⏱ ${fmtDur(Math.round((b.h||1)*60))}</span></div>
      ${past?'':`<div class="bki-timer${t.soon?' soon':''}"><span class="bki-tt">${t.txt}</span><div class="bki-bar"><i style="width:${t.pct}%;background:${z.color}"></i></div></div>`}
      ${!past&&!t.live?`<button class="BTN danger" style="margin-top:13px;width:auto;padding:9px 18px;font-size:13px" onclick="cancelBk('${b.id}')">${team?(D.lang==='en'?'Cancel all PCs':'Отменить всю бронь'):_('cancelBk')}</button>`:''}
    </div>
  </div>`
}

// Обновляем таймеры без перерисовки всего списка
function tickBkList(){
  if(D.cur!=='bklist')return
  let needFull=false
  document.querySelectorAll('#bkl-body .BKI[data-bk]:not(.past)').forEach(el=>{
    const b=D.user.bks.find(x=>String(x.id)===el.dataset.bk);if(!b)return
    const t=bkTiming(b)
    if(t.live!==el.classList.contains('live')||t.pct>=100){needFull=true;return}
    const tt=el.querySelector('.bki-tt');if(tt&&tt.textContent!==t.txt)tt.textContent=t.txt
    const bar=el.querySelector('.bki-bar i');if(bar)bar.style.width=t.pct+'%'
  })
  if(needFull)renderBkList()
}

function cancelBk(id){
  const bk=D.user.bks.find(b=>String(b.id)===String(id));if(!bk){toast('Бронь не найдена','⚠️');return}
  const modal=document.createElement('div')
  modal.className='MBG open';modal.style.zIndex='300'
  modal.innerHTML=`<div class="MOD" style="transform:none">
    <div class="MH"></div>
    <div style="text-align:center;font-size:36px;margin-bottom:10px">🗑</div>
    <div class="MT" style="text-align:center">Отменить бронь?</div>
    <p style="font-size:13px;color:var(--t2);text-align:center;margin:10px 0 18px;line-height:1.6"><b>${bk.pc}</b> · ${bk.date}<br>${bk.start}–${bk.end} · ${bk.price} BYN${bk.grp?'<br>👥 '+(D.lang==='en'?'all PCs of the team booking':'отменятся все ПК команды'):''}</p>
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
    const prev=bk.status
    D.user.bks=D.user.bks.map(b=>b.id==id?{...b,status:'cancelled'}:b)
    sv();renderBkList();toast('Бронь отменена','🗑')
    if(String(bk.id).startsWith('BK')){
      try{
        const r=await fetch(API_URL+'?'+new URLSearchParams({action:'cancelBooking',id:bk.id,all:bk.grp?'1':'0',tgId:D.user._tgId||'',_t:Date.now()}),{cache:'no-store'})
        const d=await r.json()
        if(d.ok){
          _bookingsCache.loaded=false;_bkData.ts=0
          if(d.revoked>0){
            D.user.pts=Math.max(0,(D.user.pts||0)-d.revoked);sv()
            toast(`−${d.revoked} баллов (отмена)`,'⭐')
          }
        }else if(!/уже отменена/i.test(String(d.error||''))){
          // Сервер не отменил — возвращаем как было, чтобы не ввести в заблуждение
          D.user.bks=D.user.bks.map(b=>b.id==id?{...b,status:prev}:b)
          sv();renderBkList()
          toast(d.error||'Не удалось отменить','⚠️')
        }
      }catch(e){
        D.user.bks=D.user.bks.map(b=>b.id==id?{...b,status:prev}:b)
        sv();renderBkList()
        toast('Нет связи — бронь не отменена','⚠️')
      }
    }
  }
}
