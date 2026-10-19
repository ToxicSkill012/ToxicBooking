// Слайды онбординга

let _obSlide=0, _obTimer=null

// ═══ ONBOARDING SLIDES ═══
function obSlide(n){
  _obSlide=n
  document.querySelectorAll('.ob-slide').forEach((s,i)=>s.classList.toggle('active',i===n))
  document.querySelectorAll('.ob-dot').forEach((d,i)=>d.classList.toggle('on',i===n))
  clearInterval(_obTimer);_obTimer=setInterval(()=>obSlide((_obSlide+1)%3),4000)
}
function startObSlides(){
  _obTimer=setInterval(()=>obSlide((_obSlide+1)%3),4000)
}
