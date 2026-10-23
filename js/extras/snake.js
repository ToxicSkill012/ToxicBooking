// Мини-игра Cyber Snake

// ═══════════════════════════════════════════════
// SNAKE MINI GAME
// ═══════════════════════════════════════════════
let _sk={running:false,loop:null,snake:[],dir:{x:1,y:0},nextDir:{x:1,y:0},food:{x:0,y:0},score:0,hs:0,grid:17,cell:0}
let _swipeStart=null

function startSnake(){
  const cv=document.getElementById('sk-cv')
  if(!cv)return
  const over=document.getElementById('sk-over')
  over.style.display='none'
  // Правильно рассчитываем размер под реальный экран
  const rect=cv.getBoundingClientRect()
  const dpr=window.devicePixelRatio||1
  const W=Math.floor(rect.width)
  const cellSize=Math.floor(W/_sk.grid)
  const realW=cellSize*_sk.grid
  const realH=Math.floor(realW*(300/340)) // сохраняем пропорции
  cv.width=realW
  cv.height=realH
  _sk.cell=cellSize
  _sk.gridH=Math.floor(realH/cellSize) // сколько клеток по вертикали
  _sk.snake=[{x:Math.floor(_sk.grid/2),y:Math.floor(_sk.gridH/2)},{x:Math.floor(_sk.grid/2)-1,y:Math.floor(_sk.gridH/2)},{x:Math.floor(_sk.grid/2)-2,y:Math.floor(_sk.gridH/2)}]
  _sk.dir={x:1,y:0};_sk.nextDir={x:1,y:0}
  _sk.score=0;_sk.running=true
  document.getElementById('sk-score').textContent='0'
  placeFood()
  if(_sk.loop)clearInterval(_sk.loop)
  _sk.loop=setInterval(tickSnake,120)
  document.addEventListener('keydown',snakeKey)
  // Убираем старые обработчики и добавляем новые
  cv.onpointerdown=e=>{_swipeStart={x:e.clientX,y:e.clientY};e.preventDefault()}
  cv.onpointerup=e=>{
    if(!_swipeStart)return
    const dx=e.clientX-_swipeStart.x,dy=e.clientY-_swipeStart.y
    const minSwipe=20
    if(Math.abs(dx)<minSwipe&&Math.abs(dy)<minSwipe)return
    if(Math.abs(dx)>Math.abs(dy)){dx>0?snakeDir(1,0):snakeDir(-1,0)}else{dy>0?snakeDir(0,1):snakeDir(0,-1)}
    _swipeStart=null
  }
}

function placeFood(){
  const gH=_sk.gridH||_sk.grid
  let attempts=0
  do{
    _sk.food={x:Math.floor(Math.random()*_sk.grid),y:Math.floor(Math.random()*gH)}
    attempts++
  }while(attempts<200&&_sk.snake.some(s=>s.x===_sk.food.x&&s.y===_sk.food.y))
}

function snakeDir(x,y){
  if(x!==0&&_sk.dir.x!==0)return
  if(y!==0&&_sk.dir.y!==0)return
  _sk.nextDir={x,y}
}
function snakeKey(e){
  const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}
  const d=m[e.key];if(d){snakeDir(d[0],d[1]);e.preventDefault()}
}

function tickSnake(){
  if(!_sk.running)return
  _sk.dir={..._sk.nextDir}
  const head={x:_sk.snake[0].x+_sk.dir.x,y:_sk.snake[0].y+_sk.dir.y}
  const gH=_sk.gridH||_sk.grid
  // walls
  if(head.x<0||head.x>=_sk.grid||head.y<0||head.y>=gH||_sk.snake.some(s=>s.x===head.x&&s.y===head.y)){
    gameOverSnake();return
  }
  _sk.snake.unshift(head)
  if(head.x===_sk.food.x&&head.y===_sk.food.y){
    _sk.score++;document.getElementById('sk-score').textContent=_sk.score;placeFood()
  } else {_sk.snake.pop()}
  drawSnake()
}

function drawSnake(){
  const cv=document.getElementById('sk-cv');if(!cv)return
  const ctx=cv.getContext('2d'),sz=_sk.cell,g=_sk.grid
  ctx.fillStyle='#04040e';ctx.fillRect(0,0,cv.width,cv.height)
  const gH=_sk.gridH||g
  ctx.fillStyle='rgba(255,255,255,.04)'
  for(let x=0;x<g;x++)for(let y=0;y<gH;y++){ctx.beginPath();ctx.arc(x*sz+sz/2,y*sz+sz/2,1,0,Math.PI*2);ctx.fill()}
  // food
  const fc=_sk.food,pulse=.7+.3*Math.sin(Date.now()/200)
  ctx.shadowBlur=12*pulse;ctx.shadowColor='#ff3f60'
  ctx.fillStyle='#ff3f60'
  roundedRect(ctx,fc.x*sz+2,fc.y*sz+2,sz-4,sz-4,4)
  ctx.fill();ctx.shadowBlur=0
  // snake
  _sk.snake.forEach((s,i)=>{
    const ratio=1-i/_sk.snake.length
    const alpha=.4+.6*ratio
    if(i===0){ctx.shadowBlur=10;ctx.shadowColor='rgba(196,255,62,.8)'}else{ctx.shadowBlur=0}
    const r=i===0?5:3
    ctx.fillStyle=i===0?`rgba(196,255,62,${alpha})`:`rgba(46,237,181,${alpha})`
    roundedRect(ctx,s.x*sz+1,s.y*sz+1,sz-2,sz-2,r)
    ctx.fill()
    if(i===0){
      ctx.fillStyle='#04040e';ctx.shadowBlur=0
      const ey=s.y*sz+sz*.3,ex1=s.x*sz+sz*.28,ex2=s.x*sz+sz*.72
      ctx.beginPath();ctx.arc(ex1,ey,1.5,0,Math.PI*2);ctx.fill()
      ctx.beginPath();ctx.arc(ex2,ey,1.5,0,Math.PI*2);ctx.fill()
    }
  })
  ctx.shadowBlur=0
}
// Polyfill для roundRect (не поддерживается в TG WebView)
function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath()
  ctx.moveTo(x+r,y)
  ctx.lineTo(x+w-r,y)
  ctx.quadraticCurveTo(x+w,y,x+w,y+r)
  ctx.lineTo(x+w,y+h-r)
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h)
  ctx.lineTo(x+r,y+h)
  ctx.quadraticCurveTo(x,y+h,x,y+h-r)
  ctx.lineTo(x,y+r)
  ctx.quadraticCurveTo(x,y,x+r,y)
  ctx.closePath()
}

function gameOverSnake(){
  _sk.running=false;clearInterval(_sk.loop)
  document.removeEventListener('keydown',snakeKey)
  if(_sk.score>_sk.hs){
    _sk.hs=_sk.score
    D.user._snakeHs=_sk.hs;sv()
    const hsel=document.getElementById('snake-hs')
    if(hsel)hsel.textContent='HIGHSCORE: '+_sk.hs
  }
  const over=document.getElementById('sk-over'),go=document.getElementById('sk-gameover')
  over.style.display='flex';go.style.display='block'
  document.getElementById('sk-final').textContent='Score: '+_sk.score+(_sk.score===_sk.hs&&_sk.score>0?' 🏆 NEW RECORD!':'')
  document.querySelector('#sk-over button').textContent='▶ ЕЩЁ РАЗ'
}

function stopSnake(){
  _sk.running=false;clearInterval(_sk.loop)
  document.removeEventListener('keydown',snakeKey)
  // Закрыли посреди игры — при следующем открытии нужна кнопка «Играть», иначе поле зависало
  const over=document.getElementById('sk-over');if(over)over.style.display='flex'
}
