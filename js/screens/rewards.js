// Баллы и награды

// ═══════════════════════════════════════════════
// ⭐ СЕРВЕРНЫЕ БАЛЛЫ + НАГРАДЫ
// ═══════════════════════════════════════════════
// Правила и каталог — те же числа, что в backend/Code.gs (PTS и REWARDS). Сервер присылает свои правила
// вместе с балансом (getPoints → rules), и приложение показывает их: цифры на экране и в расчёте совпадают.
// Всё, что видно в профиле и в окне «Как это работает», собирается отсюда — подписи больше не расходятся.
const PTS_RULES={perHour:1,vipBonus:2,tgBonus:1,firstMonthBonus:5,maxBookPerDay:2,maxPtsPerDay:10,minHoursBetween:1,voucherExpiry:24,maxVouchers:2,bday:50}
const REWARDS=[
  {id:'R1',cost:40,hours:1,zone:'std',pkg:'s0',c:'var(--lime)'},
  {id:'R2',cost:100,hours:3,zone:'std',pkg:'s1',c:'var(--cyan)'},
  {id:'R3',cost:170,hours:5,zone:'std',pkg:'s2',c:'var(--blue)'},
  {id:'R4',cost:300,hours:5,zone:'vip',pkg:'v2',c:'var(--gold)',top:true}
]
const rwLabel=r=>D.lang!=='ru'
  ?`${r.hours} ${r.hours===1?'hour':'hours'} ${r.zone==='vip'?'VIP / Bootcamp':'Standard'}`
  :`${r.hours} ${hoursWord(r.hours)} ${r.zone==='vip'?'VIP / Bootcamp':'Standard'}`
// Сколько стоит это же время по прайсу — «вместо 15 BYN»
const rwValue=r=>{const p=ZONES[r.zone].pkgs.find(x=>x.id===r.pkg);return p?p.p:null}
// Баллы за бронь по тем же правилам, что на сервере (без дневного лимита) — для примеров
function ptsFor(zoneKey,mins){
  const R=PTS_RULES
  return Math.max(1,Math.floor(mins/60))*R.perHour+(zoneKey==='std'?0:R.vipBonus)+R.tgBonus
}

let _vouchers=[],_ptsHist=[],_ptsTs=0,_vchTs=0

// Актуальный баланс, правила и история — с сервера
async function loadServerPoints(force=false){
  if(!D.user._tgId)return
  if(!force&&Date.now()-_ptsTs<15000)return
  _ptsTs=Date.now()
  const d=await apiGetJSON({action:'getPoints'})
  if(!d||!d.ok||d.balance===undefined)return
  if(d.rules)Object.keys(PTS_RULES).forEach(k=>{if(typeof d.rules[k]==='number')PTS_RULES[k]=d.rules[k]})
  _ptsHist=Array.isArray(d.history)?d.history:[]
  const changed=d.balance!==D.user.pts
  if(changed){D.user.pts=d.balance;sv()}
  // Баланс изменился (бонус от админа, ДР) — перерисовываем профиль целиком: награды, шкала, уровень
  if(D.cur==='profile'){if(changed)renderProfile();else renderPoints()}
}
// Активные ваучеры: раньше после обмена ваучер было негде показать админу — только сообщение от бота
async function loadVouchers(force=false){
  if(!D.user._tgId)return
  if(!force&&Date.now()-_vchTs<15000)return
  _vchTs=Date.now()
  const d=await apiGetJSON({action:'getRewards'})
  if(!d||!d.ok||!Array.isArray(d.vouchers))return
  _vouchers=d.vouchers
  if(D.cur==='profile')renderPoints()
}

// Блок баллов в профиле: баланс, шкала наград, ваучеры, обмен
function renderPoints(){
  const box=document.getElementById('bonus-pts-blk');if(!box)return
  const u=D.user
  if(!u.reg){box.style.display='none';return}
  box.style.display='block'
  const pts=Math.max(0,+u.pts||0),R=PTS_RULES,n=REWARDS.length
  const next=REWARDS.find(r=>pts<r.cost)
  // Шкала: награды стоят на равном расстоянии, между ними — доля набранного.
  // Раньше полоса обнулялась после каждой награды, а с 300+ баллами писала «ещё 80 ⭐» до несуществующей
  let pos=100
  if(next){const i=REWARDS.indexOf(next),prev=i?REWARDS[i-1].cost:0;pos=(i+(pts-prev)/(next.cost-prev))/n*100}
  const earn=[[R.perHour,T('час игры','per hour')],[R.vipBonus,'VIP · Bootcamp'],[R.tgBonus,T('бронь в приложении','in-app booking')],[R.firstMonthBonus,T('первая в месяце','first of month')]]
  const now=srvNow()
  const vc=_vouchers.map(v=>{
    const t=Date.parse(v.expiresAt),left=isNaN(t)?null:Math.max(0,Math.round((t-now)/60000))
    const till=isNaN(t)?'':fmtAbs(Math.floor((t+CLUB_TZ_OFFSET*60000)/60000))
    return `<div class="vc"><div class="vc-ic">🎫</div><div class="vc-m"><b>${esc(v.label)}</b>
      <small>${T('Покажи этот ваучер админу в клубе','Show this voucher to the admin at the club')}</small>
      <div class="vc-b"><code>${esc(v.voucherId)}</code>${till?`<span>${T('до','till')} ${till}${left!==null?` · ${T('ещё ','')}${fmtDur(left)}${T('',' left')}`:''}</span>`:''}</div></div></div>`
  }).join('')
  box.innerHTML=`
  <div class="pt-card">
    <div class="pt-top">
      <div><div class="pt-k">${T('МОЙ БАЛАНС','MY BALANCE')}</div><div class="pt-v"><b id="pts-val">${pts}</b><span>⭐</span></div></div>
      <button type="button" class="pt-how" onclick="openPtsInfo()">${T('Как это работает','How it works')}</button>
    </div>
    <div class="pt-next">${next
      ?T(`До «${rwLabel(next)}» — ещё <b>${next.cost-pts} ⭐</b>`,`<b>${next.cost-pts} ⭐</b> to “${rwLabel(next)}”`)
      :T('Все награды доступны — выбирай 🎉','Every reward is unlocked — take your pick 🎉')}</div>
    <div class="pt-track"><i class="pt-fill" style="width:${pos.toFixed(1)}%"></i><div class="pt-ticks">${REWARDS.map(r=>`<span${pts>=r.cost?' class="on"':''}></span>`).join('')}</div></div>
    <div class="pt-scale">${REWARDS.map(r=>`<span${pts>=r.cost?' class="on"':''}>${r.cost}</span>`).join('')}</div>
    <div class="pt-earn">${earn.map(e=>`<div><b>+${e[0]}</b><span>${e[1]}</span></div>`).join('')}</div>
  </div>
  ${vc}
  <div class="pt-h"><span>${T('Обменять на часы','Swap for hours')}</span></div>
  <div class="pt-rws">${REWARDS.map(r=>{
    const ok=pts>=r.cost,val=rwValue(r)
    const instead=val?T(`вместо ${val} BYN`,`worth ${val} BYN`):''
    return `<button type="button" class="rw${ok?'':' locked'}${r.top?' top':''}" style="--rc:${r.c}" onclick="redeemRewardUI('${r.id}')">
      <span class="rw-c"><b>${r.cost}</b><i>⭐</i></span>
      <span class="rw-m"><b>${rwLabel(r)}${r.top?' 👑':''}</b><small>${ok?instead:T(`ещё ${r.cost-pts} ⭐`,`${r.cost-pts} ⭐ to go`)+(instead?' · '+instead:'')}</small></span>
      <span class="rw-a">${ok?T('Обменять','Redeem'):'🔒'}</span>
    </button>`}).join('')}</div>`
}

// Окно «Как работают баллы» — из тех же правил
function openPtsInfo(){
  const R=PTS_RULES,box=document.getElementById('pts-info');if(!box)return
  const row=(ico,t,s,v,c)=>`<div class="pi-r"><i>${ico}</i><div><b>${t}</b><small>${s}</small></div><em${c?` style="color:${c}"`:''}>+${v}</em></div>`
  const ex=(zk,mins,name)=>{
    const R=PTS_RULES,h=Math.max(1,Math.floor(mins/60))*R.perHour,parts=[h]
    if(zk!=='std')parts.push(R.vipBonus)
    parts.push(R.tgBonus)
    return `<div><small>${name}</small><b>+${ptsFor(zk,mins)} ⭐</b><span>${parts.join(' + ')}</span></div>`
  }
  const when=iso=>{const t=Date.parse(iso);if(isNaN(t))return '';const d=new Date(t+CLUB_TZ_OFFSET*60000),p=x=>String(x).padStart(2,'0');return `${p(d.getUTCDate())}.${p(d.getUTCMonth()+1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`}
  const hist=_ptsHist.slice().reverse().slice(0,8)
  box.innerHTML=`<div class="MH"></div>
    <div class="pi-hd"><div class="pi-ic">⭐</div><div><div class="pi-t">${T('Как работают баллы','How points work')}</div>
      <div class="pi-s">${T('Играешь — копишь звёзды — меняешь их на бесплатные часы','Play, collect stars, swap them for free hours')}</div></div></div>

    <div class="pi-k">${T('За что начисляем','How you earn')}</div>
    <div class="pi-list">
      ${row('⏱',T('Каждый полный час брони','Every full booked hour'),T('3 часа = 3 ⭐, 1 ч 30 мин = 1 ⭐','3 hours = 3 ⭐, 1 h 30 min = 1 ⭐'),R.perHour)}
      ${row('👑',T('Зона VIP или Bootcamp','VIP or Bootcamp zone'),T('один раз за бронь, сверху к часам','once per booking, on top of hours'),R.vipBonus)}
      ${row('📱',T('Бронь через приложение','Booking in the app'),T('за каждую бронь из Telegram','for every booking from Telegram'),R.tgBonus,'var(--lime)')}
      ${row('🎉',T('Первая бронь месяца','First booking of the month'),T('один раз каждый месяц','once every month'),R.firstMonthBonus)}
      ${row('🎂',T('День рождения','Birthday'),T('укажи дату в профиле','add the date to your profile'),R.bday,'#ff8fc4')}
    </div>

    <div class="pi-k">${T('Например','For example')}</div>
    <div class="pi-ex">${ex('std',180,T('3 часа в Standard','3 hours in Standard'))}${ex('vip',300,T('5 часов в VIP','5 hours in VIP'))}</div>

    <div class="pi-k">${T('На что менять','What you get')}</div>
    <div class="pi-list">${REWARDS.map(r=>{const v=rwValue(r);return `<div class="pi-r"><i style="font-size:13px;font-family:var(--m);font-weight:700;color:${r.c}">${r.cost}</i><div><b>${rwLabel(r)}${r.top?' 👑':''}</b><small>${v?T(`бесплатно вместо ${v} BYN`,`free instead of ${v} BYN`):''}</small></div><em style="color:${r.c}">${r.cost} ⭐</em></div>`}).join('')}</div>

    <div class="pi-k">${T('Как забрать награду','How to claim')}</div>
    <div class="pi-steps">
      <div><b>1</b><span>${T('В профиле жмёшь «Обменять» — баллы списываются, появляется <u>ваучер</u>','Tap “Redeem” in your profile — points are spent, you get a <u>voucher</u>')}</span></div>
      <div><b>2</b><span>${T('В клубе показываешь ваучер админу — он лежит в профиле и в чате с ботом','Show the voucher to the admin — it is in your profile and in the bot chat')}</span></div>
      <div><b>3</b><span>${T('Садишься и играешь бесплатно 🎮','Sit down and play for free 🎮')}</span></div>
    </div>
    <div class="pi-warn"><i>⏰</i><div><b>${T(`Ваучер действует ${R.voucherExpiry} ${hoursWord(R.voucherExpiry)}`,`A voucher lasts ${R.voucherExpiry} hours`)}</b>
      <span>${T('Меняй баллы, когда собираешься в клуб: просроченный ваучер сгорает, баллы за него не возвращаются.','Redeem when you are about to visit: an expired voucher is gone and the points are not refunded.')}</span></div></div>
    <div class="pi-note">${T(
      `Баллы начисляются за первые <b>${R.maxBookPerDay} брони в день</b> (вторая — не раньше чем через ${R.minHoursBetween} ч после первой), не больше <b>${R.maxPtsPerDay} ⭐ в сутки</b>. За бронь для команды — как за один ПК. Отменил бронь — её баллы списываются, а лимит и бонус месяца возвращаются.`,
      `Points are given for the first <b>${R.maxBookPerDay} bookings a day</b> (the second at least ${R.minHoursBetween} h after the first), up to <b>${R.maxPtsPerDay} ⭐ a day</b>. A team booking counts as one PC. Cancelling a booking takes its points back and restores the limit and the monthly bonus.`)}</div>
    ${hist.length?`<div class="pi-k">${T('Последние операции','Recent activity')}</div>
    <div class="pi-list">${hist.map(h=>`<div class="pi-h"><div><b>${esc(h.reason||h.action)}</b><small>${when(h.date)}</small></div><em class="${h.amount<0?'neg':''}">${h.amount>0?'+':''}${h.amount}</em></div>`).join('')}</div>`:''}
    <div class="pi-foot"><button type="button" class="BTN" onclick="closeM('bonus-info-m')">${T('Понятно','Got it')}</button></div>`
  box.scrollTop=0
  openM('bonus-info-m')
  // История подтягивается с сервера — если её ещё нет, дорисуем окно, когда придёт
  if(!_ptsHist.length&&D.user._tgId)loadServerPoints(true).then(()=>{if(_ptsHist.length&&document.getElementById('bonus-info-m').classList.contains('open'))openPtsInfo()}).catch(()=>{})
}

// Обмен баллов на награду
async function redeemRewardUI(rewardId){
  const rw=REWARDS.find(r=>r.id===rewardId);if(!rw)return
  const tgId=D.user._tgId,label=rwLabel(rw),cost=rw.cost
  if(!tgId){toast(T('Баллы работают в приложении из Telegram','Points work when opened from Telegram'),'⚠️');return}
  const bal=D.user.pts||0
  if(bal<cost){toast(T(`Не хватает ${cost-bal} ⭐ — ещё накопишь!`,`${cost-bal} ⭐ short — keep playing!`),'⚠️');haptic('warn');return}
  if(_vouchers.length>=PTS_RULES.maxVouchers){toast(T(`Сначала используй ваучеры — их уже ${_vouchers.length}`,`Use your ${_vouchers.length} vouchers first`),'🎫');haptic('warn');return}
  const R=PTS_RULES,val=rwValue(rw)
  const modal=document.createElement('div')
  modal.className='MBG open';modal.style.zIndex='400'
  modal.innerHTML=`<div class="MOD pi" style="transform:none">
    <div class="MH"></div>
    <div class="pi-hd"><div class="pi-ic" style="--ic:196,255,62">🎁</div><div><div class="pi-t">${T('Обмен баллов','Redeem points')}</div>
      <div class="pi-s">${T('Проверь и подтверди','Check and confirm')}</div></div></div>
    <div class="rd-what" style="--rc:${rw.c}"><b>${label}</b><span>${T('бесплатного игрового времени','of free play time')}${val?` · ${T('вместо','worth')} ${val} BYN`:''}</span></div>
    <div class="rd-sum">
      <div><small>${T('Сейчас','Now')}</small><b class="gold">${bal} ⭐</b></div>
      <i>−</i>
      <div><small>${T('Спишется','Spent')}</small><b class="red">${cost} ⭐</b></div>
      <i>=</i>
      <div><small>${T('Останется','Left')}</small><b>${bal-cost} ⭐</b></div>
    </div>
    <div class="pi-warn"><i>⏰</i><div><b>${T(`Ваучер действует ${R.voucherExpiry} ${hoursWord(R.voucherExpiry)}`,`The voucher lasts ${R.voucherExpiry} hours`)}</b>
      <span>${T('Обменивай, когда собираешься в клуб сегодня или завтра. Просроченный ваучер сгорает, баллы не возвращаются.','Redeem when you are visiting today or tomorrow. An expired voucher is gone and the points are not refunded.')}</span></div></div>
    <div class="pi-steps">
      <div><b>1</b><span>${T('Жмёшь «Обменять» — появляется <u>ваучер</u>','Tap “Redeem” — you get a <u>voucher</u>')}</span></div>
      <div><b>2</b><span>${T('Показываешь его админу в клубе','Show it to the admin at the club')}</span></div>
      <div><b>3</b><span>${T('Играешь бесплатно 🎮','Play for free 🎮')}</span></div>
    </div>
    <div class="pi-foot">
      <button type="button" class="BTN" id="rw-yes">${T(`Обменять ${cost} ⭐`,`Redeem ${cost} ⭐`)}</button>
      <button type="button" class="rg-later" id="rw-no">${T('Пока коплю дальше','Keep saving')}</button>
    </div>
  </div>`
  document.getElementById('app').appendChild(modal)
  modal.querySelector('#rw-no').onclick=()=>modal.remove()
  modal.onclick=e=>{if(e.target===modal)modal.remove()}
  const btn=modal.querySelector('#rw-yes'),txt=btn.textContent
  btn.onclick=async()=>{
    btn.innerHTML='<span class="spin"></span>';btn.disabled=true
    const d=await apiGetJSON({action:'redeemReward',rewardId,user:D.user.name||'Гость',phone:D.user.phone||''},20000)
    if(d&&d.ok){
      modal.remove()
      D.user.pts=d.balance;sv()
      if(d.voucherId)_vouchers=[..._vouchers,{voucherId:d.voucherId,label:d.label||label,hours:d.hours,zone:d.zone,expiresAt:d.expiresAt}]
      _vchTs=Date.now();haptic('ok')
      toast(T(`Ваучер готов — покажи админу в течение ${R.voucherExpiry} ч`,`Voucher ready — show it within ${R.voucherExpiry} h`),'🎁')
      renderProfile()
      scrollToEl(document.getElementById('bonus-pts-blk'),70)
    }else{
      haptic('err')
      const net=!d||!d.error||/^(network|timeout|bad_json)$/.test(d.error)
      toast(net?T('Сервер не ответил — сверяю баланс','No reply from the server — checking your balance'):d.error,'⚠️')
      btn.textContent=txt;btn.disabled=false
      // Ответ мог потеряться по дороге, а обмен — пройти: сверяем баланс и ваучеры с сервером
      if(net)Promise.all([loadServerPoints(true),loadVouchers(true)]).then(()=>{if(_vouchers.length&&(D.user.pts||0)<bal)modal.remove()}).catch(()=>{})
    }
  }
}
