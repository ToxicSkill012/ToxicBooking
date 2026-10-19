// Лента времени: выбор с точностью до минуты (листается пальцем, как барабан в iOS)

class TimeRuler{
  // opts: px — пикселей на минуту, onInput(v) — значение изменилось (в абсолютных минутах)
  constructor(root,opts){
    this.root=root
    this.o=Object.assign({px:3,onInput:()=>{}},opts)
    this.min=0;this.max=1;this.value=0;this.segs=[]
    root.classList.add('tr')
    root.tabIndex=0
    root.setAttribute('role','slider')
    root.innerHTML='<div class="tr-sc"><div class="tr-tk"><div class="tr-pre"></div><div class="tr-l tr-segs"></div><div class="tr-ticks"></div><div class="tr-l tr-lbls"></div></div></div><div class="tr-needle"></div>'
    this.sc=root.querySelector('.tr-sc')
    this.track=root.querySelector('.tr-tk')
    this.segL=root.querySelector('.tr-segs')
    this.ticks=root.querySelector('.tr-ticks')
    this.lblL=root.querySelector('.tr-lbls')
    this.sc.addEventListener('scroll',()=>this._onScroll(),{passive:true})
    this.sc.addEventListener('touchstart',()=>{this.lock=false;this.touching=true},{passive:true})
    this.sc.addEventListener('touchend',()=>{this.touching=false;this._settleSoon()},{passive:true})
    this.sc.addEventListener('wheel',()=>{this.lock=false},{passive:true})
    this._mouseDrag()
    root.addEventListener('keydown',e=>{
      const k={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1}[e.key]
      if(!k)return
      e.preventDefault();this.nudge(k*(e.shiftKey?15:1))
    })
    if('ResizeObserver' in window)new ResizeObserver(()=>this.layout()).observe(root)
  }
  _mouseDrag(){
    let x0=0,l0=0,drag=false
    this.sc.addEventListener('mousedown',e=>{drag=true;x0=e.clientX;l0=this.sc.scrollLeft;this.lock=false;e.preventDefault()})
    window.addEventListener('mousemove',e=>{if(drag)this.sc.scrollLeft=l0-(e.clientX-x0)})
    window.addEventListener('mouseup',()=>{if(drag){drag=false;this._settleSoon()}})
  }
  clamp(v){return Math.min(this.max,Math.max(this.min,Math.round(v)))}
  setRange(min,max){
    this.min=min;this.max=Math.max(min+1,max)
    this.layout();this._labels()
    this.segKey=null;this.setSegments(this.segs)
  }
  layout(){
    const w=this.root.clientWidth||320,px=this.o.px,span=(this.max-this.min)*px
    this.track.style.width=(span+w)+'px'
    this.track.firstChild.style.width=(w/2)+'px'
    for(const el of [this.segL,this.ticks,this.lblL]){el.style.left=(w/2)+'px';el.style.width=span+'px'}
    // Деления привязаны к реальным часам: длинное — каждый час, среднее — каждые 5 минут
    const off=p=>(((p-(this.min%p))%p)*px)+'px'
    const t=this.ticks.style
    t.setProperty('--p1',px+'px');t.setProperty('--p5',(5*px)+'px');t.setProperty('--p60',(60*px)+'px')
    t.setProperty('--o5',off(5));t.setProperty('--o60',off(60))
    this._scrollTo(this.value,false)
  }
  _labels(){
    let html=''
    const first=this.min+((30-(this.min%30))%30)
    for(let v=first;v<=this.max;v+=30){
      const m=((v%1440)+1440)%1440
      const cls=m===0?' day':''
      const txt=m===0?(D.lang==='en'?'midnight':'полночь'):minToHM(v)
      html+=`<span class="tr-lbl${cls}" style="left:${(v-this.min)*this.o.px}px">${txt}</span>`
    }
    this.lblL.innerHTML=html
  }
  // segs: [{from,to,cls}] в абсолютных минутах
  setSegments(segs){
    this.segs=segs||[]
    const key=JSON.stringify(this.segs)+this.min+'-'+this.max
    if(key===this.segKey)return
    this.segKey=key
    const px=this.o.px
    this.segL.innerHTML=this.segs.map(s=>{
      const a=Math.max(s.from,this.min),b=Math.min(s.to,this.max+180)
      if(b<=a)return ''
      return `<div class="tr-seg ${s.cls}" style="left:${(a-this.min)*px}px;width:${Math.max(2,(b-a)*px)}px"></div>`
    }).join('')
  }
  set(v,smooth=false){
    this.value=this.clamp(v)
    this.root.setAttribute('aria-valuenow',this.value)
    this.root.setAttribute('aria-valuetext',minToHM(this.value))
    this._scrollTo(this.value,smooth)
  }
  nudge(d){
    const v=this.clamp(this.value+d)
    if(v===this.value){haptic('warn');return}
    this.set(v,false);haptic('tick');this.o.onInput(v)
  }
  _scrollTo(v,smooth){
    const x=(v-this.min)*this.o.px
    if(smooth&&!_reduceMotion){
      this.lock=true;this.target=x
      clearTimeout(this.lockT);this.lockT=setTimeout(()=>{this.lock=false},800)
      this.sc.scrollTo({left:x,behavior:'smooth'})
    }else{
      this.sc.scrollLeft=x
    }
  }
  _onScroll(){
    if(this.raf)return
    this.raf=requestAnimationFrame(()=>{
      this.raf=0
      const x=this.sc.scrollLeft
      if(this.lock){if(Math.abs(x-this.target)<2)this.lock=false;return}
      const v=this.clamp(this.min+x/this.o.px)
      if(v!==this.value){
        const prev=this.value
        this.value=v
        this.root.setAttribute('aria-valuenow',v)
        this.root.setAttribute('aria-valuetext',minToHM(v))
        if(Math.floor(prev/5)!==Math.floor(v/5))haptic('tick')
        this.o.onInput(v)
      }
      this._settleSoon()
    })
  }
  // Доводка ровно на минуту после того, как палец отпустил ленту
  _settleSoon(){
    clearTimeout(this.settleT)
    this.settleT=setTimeout(()=>{
      if(this.touching||this.lock)return
      const x=(this.value-this.min)*this.o.px
      if(Math.abs(this.sc.scrollLeft-x)>.5)this.sc.scrollTo({left:x,behavior:_reduceMotion?'auto':'smooth'})
    },160)
  }
}

const _reduceMotion=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)

// Лёгкая вибрация Telegram (если доступна)
function haptic(kind){
  try{
    const h=window.Telegram?.WebApp?.HapticFeedback
    if(!h)return
    if(kind==='tick')h.selectionChanged()
    else if(kind==='ok')h.notificationOccurred('success')
    else if(kind==='err')h.notificationOccurred('error')
    else if(kind==='warn')h.notificationOccurred('warning')
    else h.impactOccurred(kind||'light')
  }catch(e){}
}

// Кнопка ± с автоповтором при удержании (чем дольше держишь — тем быстрее)
function holdRepeat(btn,fire){
  let timer=null,count=0
  const stop=()=>{clearTimeout(timer);timer=null}
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();count=0;fire(count++)
    const loop=delay=>{timer=setTimeout(()=>{fire(count++);loop(Math.max(45,delay*.85))},delay)}
    loop(380)
  })
  ;['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,stop))
  btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fire(0)}})
}

// Компактное поле времени HH:MM с ±5 мин и точным вводом (для групповой и оффлайн-брони)
function timeField(el,{value,onChange}){
  el.classList.add('tf')
  el.innerHTML=`<button type="button" class="tf-b" aria-label="−5 мин">−</button>
    <label class="tf-v"><span></span><input type="time" step="60" aria-label="Время"></label>
    <button type="button" class="tf-b" aria-label="+5 мин">+</button>`
  const [minus,plus]=el.querySelectorAll('.tf-b'),span=el.querySelector('.tf-v span'),inp=el.querySelector('input')
  let v=value
  const show=()=>{span.textContent=minToHM(v);inp.value=minToHM(v)}
  const setV=nv=>{v=((nv%1440)+1440)%1440;show();onChange(v)}
  holdRepeat(minus,c=>{setV(v-(c>8?15:5));haptic('tick')})
  holdRepeat(plus,c=>{setV(v+(c>8?15:5));haptic('tick')})
  inp.addEventListener('click',()=>{try{inp.showPicker()}catch(e){}})
  inp.addEventListener('change',()=>{if(inp.value)setV(timeToMinJS(inp.value))})
  show()
  return {get:()=>v,set:nv=>{v=nv;show()}}
}
