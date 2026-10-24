// Зоны, пакеты, адрес бэкенда

// ═══════════════════════════════════════════════
// ZONE DATA
// ═══════════════════════════════════════════════
// Цвет зоны с прозрачностью: «var(--lime)»+«33» — невалидный CSS, поэтому через rgba
const ZONE_RGB={std:'196,255,62',vip:'255,202,80',bc:'75,158,255',bootcamp:'75,158,255'}
function zA(z,a){const rgb=ZONE_RGB[typeof z==='string'?z:z&&z.key];return rgb?`rgba(${rgb},${a})`:'transparent'}
const ZONES = {
  std:{key:'std',emoji:'⚡',name:'STANDARD',color:'var(--lime)',badge:'Bl',pcCount:14,pre:'ST',hour:6,
    // Как стоят ПК в зале: левый и правый ряд
    layout:[[1,3,5,7,9,11,13],[2,4,6,8,10,12,14]],sides:['← ЛЕВЫЙ РЯД','ПРАВЫЙ РЯД →'],
    devices:{h:'HyperX Cloud 2',m:'HyperX Pulsefire Core',k:'HyperX Alloy Origins Core',mon:'Asus TUF 280Hz'},
    pc:{gpu:'RTX 3060Ti / 4060',cpu:'Ryzen 5 5500',ram:'16 GB'},
    stripe:'linear-gradient(90deg,var(--lime),var(--cyan))',
    pkgs:[
    {id:'s0',n:'1 час',nen:'1 hour',t:'любое время',te:'any time',p:6,h:1,locked:false},
    {id:'s1',n:'3 часа',nen:'3 hours',t:'любое время',te:'any time',p:15,h:3,locked:false},
    {id:'s2',n:'5 часов',nen:'5 hours',t:'любое время',te:'any time',p:21,h:5,locked:false},
    {id:'s3',n:'Утро',nen:'Morning',t:'08:00–11:00',te:'08:00–11:00',p:15,h:3,locked:true,tStart:8,tEnd:11},
    {id:'s4',n:'День',nen:'Day',t:'11:00–17:00',te:'11:00–17:00',p:18,h:6,locked:true,tStart:11,tEnd:17},
    {id:'s5',n:'Ночь',nen:'Night',t:'22:00–08:00',te:'22:00–08:00',p:25,h:10,locked:true,tStart:22,tEnd:8}
  ]},
  vip:{key:'vip',emoji:'👑',name:'VIP',color:'var(--gold)',badge:'Bg',pcCount:3,pre:'VIP',hour:8,layout:[[1,2,3]],
    devices:{h:'HyperX Cloud 3',m:'Aurora IO',k:'Dark Project Arena',mon:'MSI 300Hz'},
    pc:{gpu:'RTX 3060Ti',cpu:'Ryzen 7 5700X',ram:'32 GB'},
    stripe:'linear-gradient(90deg,var(--gold),#ff9f47)',
    pkgs:[
    {id:'v0',n:'1 час',nen:'1 hour',t:'любое время',te:'any time',p:8,h:1,locked:false},
    {id:'v1',n:'3 часа',nen:'3 hours',t:'любое время',te:'any time',p:20,h:3,locked:false},
    {id:'v2',n:'5 часов',nen:'5 hours',t:'любое время',te:'any time',p:25,h:5,locked:false},
    {id:'v3',n:'Утро',nen:'Morning',t:'08:00–11:00',te:'08:00–11:00',p:20,h:3,locked:true,tStart:8,tEnd:11},
    {id:'v4',n:'День',nen:'Day',t:'11:00–17:00',te:'11:00–17:00',p:23,h:6,locked:true,tStart:11,tEnd:17},
    {id:'v5',n:'Ночь',nen:'Night',t:'22:00–08:00',te:'22:00–08:00',p:30,h:10,locked:true,tStart:22,tEnd:8}
  ]},
  bc:{key:'bc',emoji:'🏆',name:'BOOTCAMP',color:'var(--blue)',badge:'Bb',pcCount:5,pre:'BC',hour:8,layout:[[1,2,3,4,5]],
    devices:{h:'HyperX Cloud 2',m:'HyperX Pulsefire Haste 2',k:'Aula F75',mon:'Asus TUF 280Hz'},
    pc:{gpu:'RTX 5060Ti',cpu:'Intel i5-13400F',ram:'32 GB'},
    stripe:'linear-gradient(90deg,var(--blue),var(--cyan))',
    pkgs:[
    {id:'b0',n:'1 час',nen:'1 hour',t:'любое время',te:'any time',p:8,h:1,locked:false},
    {id:'b1',n:'3 часа',nen:'3 hours',t:'любое время',te:'any time',p:20,h:3,locked:false},
    {id:'b2',n:'5 часов',nen:'5 hours',t:'любое время',te:'any time',p:25,h:5,locked:false},
    {id:'b3',n:'Утро',nen:'Morning',t:'08:00–11:00',te:'08:00–11:00',p:20,h:3,locked:true,tStart:8,tEnd:11},
    {id:'b4',n:'День',nen:'Day',t:'11:00–17:00',te:'11:00–17:00',p:23,h:6,locked:true,tStart:11,tEnd:17},
    {id:'b5',n:'Ночь',nen:'Night',t:'22:00–08:00',te:'22:00–08:00',p:30,h:10,locked:true,tStart:22,tEnd:8}
  ]}
}

// ═══════════════════════════════════════════════
// ПРАВИЛА БРОНИ И ЦЕНА «СВОЕГО ВРЕМЕНИ»
// Те же правила и цены — в backend/Code.gs (TARIFF, RULES): сервер пересчитывает цену сам.
// ═══════════════════════════════════════════════
const RULES={freeMin:30,freeMax:720,freeStep:30,maxTeam:8,days:7}

function pcLbl(zoneKey,n){return ZONES[zoneKey].pre+'-'+String(n).padStart(2,'0')}
// Все ПК зоны в порядке рядов
function zonePcs(zoneKey){return ZONES[zoneKey].layout.flat().map(n=>pcLbl(zoneKey,n))}
// Цена «своего времени»: каждые начатые 30 мин по часовому тарифу.
// Лучшая цена: если пакет не короче и дешевле — берём цену пакета (так же считает сервер)
function freePrice(zoneKey,mins){
  const z=ZONES[zoneKey]
  let price=Math.ceil(mins/30)*z.hour/2,viaPkg=null
  z.pkgs.forEach(p=>{if(!p.locked&&p.h*60>=mins&&p.p<price){price=p.p;viaPkg=p}})
  return {price,viaPkg}
}

// ═══════════════════════════════════════════════
// TELEGRAM CONFIG
// ═══════════════════════════════════════════════
// ╔══════════════════════════════════════════════════════╗
// ║  APPS SCRIPT URL — вставь свой после деплоя скрипта ║
// ╚══════════════════════════════════════════════════════╝
const API_URL = 'https://script.google.com/macros/s/AKfycbzKk5f8P8RU9J6DQRxZEjEIp7lc1KlE-6n3yHomFyXolsqEAK2Dwv3ddm_VpAzrscPy/exec'
const TG = { admins: ['8523093520'] }
