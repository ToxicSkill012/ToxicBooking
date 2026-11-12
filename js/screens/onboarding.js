// Первый экран: приветствие и живая занятость зала

const OB_BTN_ICO='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 3.3 2.9 10.5c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.3 4.8 3.6c.9.5 1.5.2 1.8-.8L23 4.6c.3-1.3-.5-1.9-1.4-1.3ZM9.2 13.3l9.3-5.9c.5-.3.9-.1.5.2l-7.7 7-.3 3.2-1.8-4.5Z"/></svg>'

// Тексты и кнопка: новичку — «Войти», своему — «С возвращением»
function renderOb(){
  const u=D.user,back=!!u.reg,T2=(ru,en)=>D.lang!=='ru'?en:ru
  const $=id=>document.getElementById(id)
  if(!$('ob-btn'))return
  const first=String(u.name||'').trim().split(/\s+/)[0]||''
  const hi=$('ob-hi')
  hi.hidden=!back
  if(back)hi.textContent=T2('С возвращением','Welcome back')+(first?', '+first:'')+' 👋'
  $('ob-geo').textContent=T2('Брест · 24/7','Brest · 24/7')
  $('ob-h').innerHTML=T2('Твой ПК<br><em>уже ждёт</em>','Your PC<br><em>is waiting</em>')
  $('ob-p').textContent=T2('Выбери время и место — бронь за 10 секунд, без звонков и очередей.','Pick a time and a seat — booking takes 10 seconds, no calls and no queues.')
  $('ob-hall-t').textContent=T2('Зал сейчас','The hall now')
  $('ob-feats').innerHTML=[
    ['⚡',T2('10 секунд','10 seconds'),T2('и бронь готова','to book')],
    ['⭐',T2('Баллы','Points'),T2('меняй на часы','for free hours')],
    ['👥',T2('Команда','Team'),T2('до 8 ПК рядом','up to 8 PCs')]
  ].map(f=>`<div class="ob-f"><i>${f[0]}</i><b>${f[1]}</b><span>${f[2]}</span></div>`).join('')
  const btn=$('ob-btn')
  if(!btn.disabled)btn.innerHTML=back?`<span>${T2('Продолжить','Continue')}</span><b class="ob-arr">→</b>`:`${OB_BTN_ICO}<span>${_('loginBtn')}</span>`
  $('ob-note').innerHTML=T2('Нажимая кнопку, ты принимаешь <a onclick="openM(\'rules-m\')">правила клуба</a>','By continuing you accept the <a onclick="openM(\'rules-m\')">club rules</a>')
  renderObHall()
}

// Зоны: точки-ПК (как на главной), сколько свободно и цена. zones — из renderLive(); до загрузки — нейтральные точки
let _obZones=null
function renderObHall(zones){
  if(zones)_obZones=zones;else zones=_obZones
  const box=document.getElementById('ob-zones');if(!box)return
  const en=D.lang!=='ru',names={std:'Standard',vip:'VIP',bc:'Bootcamp'}
  let free=0
  box.innerHTML=Object.keys(ZONES).map(k=>{
    const z=ZONES[k],pcs=zones&&zones[k]
    const f=pcs?pcs.filter(p=>p.s!=='busy').length:null
    if(f!==null)free+=f
    const dots=(pcs||zonePcs(k).map(()=>({s:'idle'}))).map(p=>`<i class="zd ${p.s}"></i>`).join('')
    return `<div class="ob-z" style="--zc:${z.color}">
      <div class="ob-z-n"><span>${z.emoji}</span>${names[k]}</div>
      <div class="ob-z-f">${f===null?'':`<b>${f}</b>/${z.pcCount}`}</div>
      <div class="ob-z-d">${dots}</div>
      <div class="ob-z-p">${en?'from ':'от '}${z.hour} BYN${en?'/h':'/час'}</div>
    </div>`
  }).join('')
  const el=document.getElementById('ob-free')
  if(el)el.innerHTML=zones?`<i></i>${free} ${en?'free':plural(free,'ПК свободен','ПК свободно','ПК свободно')}`:''
}
// 1 час / 2 часа / 5 часов
function plural(n,a,b,c){const m=Math.abs(n)%10,h=Math.abs(n)%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c}
