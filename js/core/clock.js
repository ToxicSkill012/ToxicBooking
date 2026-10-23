// Время клуба (Брест, UTC+3) — одинаковое у всех клиентов, как на сервере

const CLUB_TZ_OFFSET = 180 // минут к UTC; в Беларуси нет перехода на летнее время

// Часы телефона могут спешить или отставать на минуты — тогда «занят ещё 40 мин» и «бронь уже идёт» врут.
// Сервер присылает своё время (now), по нему считаем поправку. Мелкие расхождения (< 20 с) не трогаем.
let _clockSkew=0
function syncClock(serverNow,sentAt){
  const n=+serverNow;if(!n||isNaN(n))return
  const t=Date.now(),mid=sentAt?(sentAt+t)/2:t
  if(sentAt&&t-sentAt>8000)return // ответ шёл слишком долго — поправке не верим
  const skew=n-mid
  _clockSkew=Math.abs(skew)<20000?0:Math.max(-864e5,Math.min(864e5,skew))
}
const srvNow=()=>Date.now()+_clockSkew

// «Сейчас» в клубе: дата dd.MM.yyyy, минуты от полуночи, номер дня
function clubNow(){
  const d=new Date(srvNow()+CLUB_TZ_OFFSET*60000)
  const date=String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+d.getUTCFullYear()
  const min=d.getUTCHours()*60+d.getUTCMinutes()
  const day=Math.floor(d.getTime()/86400000)
  return {date,min,day,abs:day*1440+min,sec:d.getUTCSeconds()}
}

// dd.MM.yyyy → номер дня (совпадает с clubNow().day)
function dayNumOf(dateStr){
  const p=String(dateStr||'').replace(/\s.*/,'').split('.')
  if(p.length!==3)return NaN
  return Math.floor(Date.UTC(+p[2],+p[1]-1,+p[0])/86400000)
}
function dateOfDayNum(day){
  const d=new Date(day*86400000)
  return String(d.getUTCDate()).padStart(2,'0')+'.'+String(d.getUTCMonth()+1).padStart(2,'0')+'.'+d.getUTCFullYear()
}

// Минуты ↔ «HH:MM» (с переходом через полночь)
function minToHM(min){
  const m=((Math.round(min)%1440)+1440)%1440
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')
}

// Бронь как отрезок в «абсолютных минутах»: ночная заканчивается на следующий день
function bookingAbsRange(date,start,end){
  const day=dayNumOf(date);if(isNaN(day))return null
  const s=timeToMinJS(start);let e=timeToMinJS(end)
  if(e<=s)e+=1440
  return [day*1440+s,day*1440+e]
}
function rangesOverlap(a,b){return !!(a&&b&&a[0]<b[1]&&b[0]<a[1])}

// «1 ч 12 мин», «45 мин», «2 ч»
function fmtDur(min){
  min=Math.max(0,Math.round(min))
  const h=Math.floor(min/60),m=min%60
  if(D&&D.lang!=='ru')return h&&m?`${h}h ${m}m`:h?`${h}h`:`${m}m`
  return h&&m?`${h} ч ${m} мин`:h?`${h} ч`:`${m} мин`
}
// Короткая форма для плиток: «1ч12», «2ч» или «45м»
function fmtLeftShort(min){
  min=Math.max(0,Math.round(min))
  const h=Math.floor(min/60),m=min%60,en=D&&D.lang!=='ru'
  if(!h)return m+(en?'m':'м')
  return h+(en?'h':'ч')+(m?String(m).padStart(2,'0'):'')
}
// 1 час, 3 часа, 5 часов
function hoursWord(n){
  if(D&&D.lang!=='ru')return n===1?'hour':'hours'
  const a=n%10,b=n%100
  return a===1&&b!==11?'час':a>=2&&a<=4&&(b<12||b>14)?'часа':'часов'
}
// «сегодня 18:45» / «завтра 01:10» / «21.10 18:45»
function fmtAbs(abs){
  const now=clubNow(),day=Math.floor(abs/1440),diff=day-now.day
  const hm=minToHM(abs)
  if(diff===0)return hm
  // Ночью «до 00:30» понятнее, чем «до завтра 00:30»
  if(diff===1)return abs-now.abs<12*60?hm:(D.lang!=='ru'?'tomorrow ':'завтра ')+hm
  return dateOfDayNum(day).slice(0,5)+' '+hm
}

// Сегодня по времени клуба в формате поля <input type="date">
function clubIsoDate(){const p=clubNow().date.split('.');return p[2]+'-'+p[1]+'-'+p[0]}
// yyyy-mm-dd → dd.MM.yyyy
function isoToRuDate(iso){const p=String(iso||'').split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:''}
