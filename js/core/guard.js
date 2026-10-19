// Защита от копирования и DevTools

// ╔══════════════════════════════════════════════════════════╗
// ║  TOXICSKILL — PROTECTED CODE                            ║
// ║  Unauthorized copying is prohibited                      ║
// ║  © 2026 ToxicSkill. All rights reserved.                ║
// ╚══════════════════════════════════════════════════════════╝

// ═══ ANTI-DEVTOOLS ═══
;(function(){
  // 1. Блокируем правую кнопку мыши
  document.addEventListener('contextmenu',function(e){e.preventDefault();return false},true)

  // 2. Блокируем клавиши: F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S
  document.addEventListener('keydown',function(e){
    if(e.key==='F12') {e.preventDefault();return false}
    if(e.ctrlKey&&e.shiftKey&&(e.key==='I'||e.key==='i'||e.key==='J'||e.key==='j'||e.key==='C'||e.key==='c')){e.preventDefault();return false}
    if(e.ctrlKey&&(e.key==='U'||e.key==='u'||e.key==='S'||e.key==='s')){e.preventDefault();return false}
  },true)

  // 3. Детектор DevTools
  var _dtOpen=false
  function checkDT(){
    var w=window.outerWidth-window.innerWidth>160
    var h=window.outerHeight-window.innerHeight>160
    if(w||h){if(!_dtOpen){_dtOpen=true;try{console.clear()}catch(e){}}}
    else{_dtOpen=false}
  }
  // Один таймер вместо двух (меньше нагрузки), пауза когда вкладка скрыта
  setInterval(function(){ if(!document.hidden) checkDT() },6000)

  // 7. Iframe защита
  if(window.top!==window.self&&!window.Telegram){
    try{window.top.location=window.self.location}catch(e){
      document.body.innerHTML='<div style="padding:40px;text-align:center;color:red;font-size:18px">⛔</div>'
    }
  }

  // 8. Защита выделения — только для десктопа, не трогаем тач-скролл
  if(!('ontouchstart' in window)){
    document.addEventListener('selectstart',function(e){
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return
      e.preventDefault()
    })
  }
  document.addEventListener('dragstart',function(e){e.preventDefault()},{passive:false})

  // 9. Защита copy
  document.addEventListener('copy',function(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return
    e.preventDefault()
  })

})();
