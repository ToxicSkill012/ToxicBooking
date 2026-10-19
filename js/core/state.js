// Состояние приложения и localStorage

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
const D = {
  lang:'ru',theme:'',
  user:{name:'Toxic Player',handle:'',phone:'',age:'',reg:false,bks:[],hrs:0,pts:0,_tgHandle:'',_tgPhoto:'',_tgId:''},
  promos:[
    {code:'TOXIC2025',name:'Приветственный бонус',bonus:2,disc:0,uses:100,used:0,on:true},
    {code:'BRЕСТ2026',name:'День города Брест',bonus:3,disc:10,uses:50,used:12,on:true},
  ],
  bk:{zone:null,pkg:null,pc:null,date:null,sh:14,step:0},
  cur:'ob'
}
try{const s=JSON.parse(localStorage.getItem('ts4')||'{}');['lang','theme','user'].forEach(k=>{if(s[k]!==undefined)D[k]=s[k]})}catch(e){}
// Инициализируем поля если отсутствуют
if(!D.user.bks)D.user.bks=[]
if(D.user.pts===undefined)D.user.pts=0
if(D.user.hrs===undefined)D.user.hrs=0
// Промокоды НЕ берём из localStorage — всегда из Google Sheets

const sv=()=>{try{localStorage.setItem('ts4',JSON.stringify({lang:D.lang,theme:D.theme,user:D.user}))}catch(e){}}
const _=k=>(I18N[D.lang]&&I18N[D.lang][k])||I18N.ru[k]||k
