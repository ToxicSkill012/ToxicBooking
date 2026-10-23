// Частицы, напоминание, конфетти

// ═══ ONBOARDING PARTICLES ═══
function initObParticles(){
  const cv=document.getElementById('ob-particles');if(!cv)return
  const ctx=cv.getContext('2d')
  const resize=()=>{
    cv.width=window.innerWidth||390
    cv.height=window.innerHeight||844
  }
  resize()
  window.addEventListener('resize',resize)
  const pts=Array.from({length:25},()=>({
    x:Math.random()*cv.width,y:Math.random()*cv.height,
    r:Math.random()*2+1,
    vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,
    color:Math.random()>.5?'#c4ff3e':'#2aedb5'
  }))
  const tick=()=>{
    // Останавливаем цикл когда ушли с онбординга (экономия батареи)
    if(typeof D!=='undefined'&&D.cur&&D.cur!=='ob'){ctx.clearRect(0,0,cv.width,cv.height);return}
    ctx.clearRect(0,0,cv.width,cv.height)
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy
      if(p.x<0)p.x=cv.width;if(p.x>cv.width)p.x=0
      if(p.y<0)p.y=cv.height;if(p.y>cv.height)p.y=0
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2)
      ctx.fillStyle=p.color;ctx.globalAlpha=.6;ctx.fill()
    })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ═══ REMINDER ═══
function scheduleReminder(bk){
  try{
    const today=fmtDateJS(new Date())
    if(bk.date!==today)return
    const[h,m]=bk.start.split(':').map(Number)
    const remindAt=new Date();remindAt.setHours(h,m-30,0,0)
    const delay=remindAt-new Date()
    if(delay>0&&delay<8*3600000){
      setTimeout(async()=>{
        await tgNotify(`⏰ <b>Напоминание!</b>\n\n👤 <b>${D.user.name}</b>\n🖥 <b>${bk.pc}</b>\n⏱ Через 30 минут твой сеанс (${bk.start})\n\nЖдём тебя! 🎮 #напоминание`)
      },delay)
    }
  }catch(e){}
}

// ═══ CONFETTI ═══
function launchConfetti(){
  const cv=document.getElementById('confetti-cv');if(!cv)return
  if(document.body.classList.contains('lowfx')||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return
  const ctx=cv.getContext('2d')
  // Холст на весь экран и с учётом плотности пикселей — конфетти не обрезается и не мылится
  const dpr=Math.min(2,window.devicePixelRatio||1)
  cv.width=cv.clientWidth*dpr;cv.height=cv.clientHeight*dpr
  ctx.setTransform(dpr,0,0,dpr,0,0)
  const W=cv.clientWidth,H=cv.clientHeight
  const particles=Array.from({length:90},()=>({
    x:Math.random()*W, y:-10-Math.random()*H*.3,
    r:Math.random()*6+3,
    color:['#c4ff3e','#2aedb5','#4b9eff','#ffca50','#ff3f60'][Math.floor(Math.random()*5)],
    vx:(Math.random()-0.5)*4, vy:Math.random()*4+2,
    va:(Math.random()-0.5)*0.2, a:0
  }))
  let frame=0
  const tick=()=>{
    ctx.clearRect(0,0,W,H)
    particles.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy; p.a+=p.va; p.vy+=0.08
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a)
      ctx.fillStyle=p.color;ctx.globalAlpha=Math.max(0,1-frame/120)
      ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*2)
      ctx.restore()
    })
    frame++
    if(frame<150) requestAnimationFrame(tick)
    else ctx.clearRect(0,0,W,H)
  }
  requestAnimationFrame(tick)
}
