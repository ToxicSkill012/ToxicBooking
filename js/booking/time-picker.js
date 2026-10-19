// Выбор времени: лента до минуты (как барабан в iOS) и ползунок длительности.
// Своя обработка жестов вместо нативной прокрутки: нет «прыжков» после отпускания,
// вертикальная прокрутка страницы работает, движение — только transform (без перерисовки).

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

// Горизонтальный жест: палец ушёл вбок — наш, ушёл вверх/вниз — отдаём прокрутке страницы.
// Короткое касание без движения — tap(x).
function hGesture(el,{start,move,end,tap}){
  let g=null
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return
    g={id:e.pointerId,x0:e.clientX,y0:e.clientY,on:e.pointerType==='mouse',t:[[performance.now(),e.clientX]]}
    if(g.on){try{el.setPointerCapture(e.pointerId)}catch(_){}}
    start&&start(e)
  })
  el.addEventListener('pointermove',e=>{
    if(!g||e.pointerId!==g.id)return
    const dx=e.clientX-g.x0,dy=e.clientY-g.y0
    if(!g.on){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){g=null;return}
      if(Math.abs(dx)<7)return
      g.on=true;try{el.setPointerCapture(e.pointerId)}catch(_){}
    }
    g.t.push([performance.now(),e.clientX]);if(g.t.length>6)g.t.shift()
    move(dx,e)
  })
  const fin=e=>{
    if(!g||e.pointerId!==g.id)return
    const dx=e.clientX-g.x0,moved=g.on&&Math.abs(dx)>=4
    // Скорость по последним ~80 мс — для инерции
    let vel=0
    const now=performance.now(),pts=g.t.filter(p=>now-p[0]<100)
    if(pts.length>1){const a=pts[0],b=pts[pts.length-1];if(b[0]>a[0])vel=(b[1]-a[1])/(b[0]-a[0])}
    const wasTap=!moved&&e.type==='pointerup'&&Math.abs(e.clientY-g.y0)<10
    g=null
    if(wasTap)tap&&tap(e.clientX,e)
    else end&&end(vel,e)
  }
  el.addEventListener('pointerup',fin)
  el.addEventListener('pointercancel',fin)
}

// ═══ ЛЕНТА ВРЕМЕНИ ═══
// Значение — «абсолютные минуты» (день*1440 + минуты). px — пикселей на минуту.
class TimeTape{
  constructor(root,opts){
    this.o=Object.assign({px:3,onInput:()=>{},onSettle:()=>{}},opts)
    this.root=root;this.min=0;this.max=1;this.pos=0;this.value=0;this.segKey='';this.w=0
    root.classList.add('tt')
    root.tabIndex=0
    root.setAttribute('role','slider')
    root.innerHTML='<div class="tt-vp"><div class="tt-tr"><div class="tt-pre"></div><div class="tt-segs"></div><div class="tt-sel"></div><div class="tt-ticks"></div><div class="tt-lbls"></div><div class="tt-now"></div></div></div><div class="tt-needle"><i></i></div>'
    this.vp=root.querySelector('.tt-vp');this.tr=root.querySelector('.tt-tr')
    this.segL=root.querySelector('.tt-segs');this.selEl=root.querySelector('.tt-sel')
    this.ticks=root.querySelector('.tt-ticks');this.lbl=root.querySelector('.tt-lbls')
    this.pre=root.querySelector('.tt-pre');this.nowEl=root.querySelector('.tt-now')
    let p0=0
    hGesture(this.vp,{
      start:()=>{this._stop();p0=this.pos},
      move:dx=>{
        let p=p0-dx/this.o.px
        // За краем — «резинка», как в iOS
        if(p<this.min)p=this.min-(this.min-p)*.3
        if(p>this.max)p=this.max+(p-this.max)*.3
        this._to(p,true)
      },
      end:vel=>this._fling(-vel/this.o.px),
      tap:x=>{
        const r=this.vp.getBoundingClientRect()
        this.set(this.pos+(x-r.left-r.width/2)/this.o.px,true,true)
      }
    })
    this.vp.addEventListener('wheel',e=>{
      const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:(e.shiftKey?e.deltaY:0)
      if(!d)return
      e.preventDefault();this._stop()
      this._to(Math.min(this.max,Math.max(this.min,this.pos+d/this.o.px)),true)
      clearTimeout(this._wt);this._wt=setTimeout(()=>this._snap(1),140)
    },{passive:false})
    root.addEventListener('keydown',e=>{
      const k={ArrowLeft:-1,ArrowRight:1,ArrowDown:-1,ArrowUp:1,PageDown:-60,PageUp:60}[e.key]
      if(!k)return
      e.preventDefault();this.nudge(k*(e.shiftKey&&Math.abs(k)===1?15:1))
    })
    if('ResizeObserver' in window)new ResizeObserver(()=>this.layout()).observe(root)
  }
  clamp(v){return Math.min(this.max,Math.max(this.min,Math.round(v)))}
  setRange(min,max){
    this.min=min;this.max=Math.max(min+1,max)
    this.segKey=''
    this.layout();this._labels()
  }
  layout(){
    const w=this.vp.clientWidth||320,px=this.o.px,span=(this.max-this.min)*px
    this.w=w
    this.tr.style.width=span+'px'
    this.pre.style.cssText=`left:${-w/2}px;width:${w/2}px`
    // Деления привязаны к часам: длинное — каждый час, среднее — 15 мин, короткое — 5 мин
    const off=p=>(((p-(this.min%p))%p)*px)+'px',t=this.ticks.style
    t.setProperty('--p5',(5*px)+'px');t.setProperty('--p15',(15*px)+'px');t.setProperty('--p60',(60*px)+'px')
    t.setProperty('--o5',off(5));t.setProperty('--o15',off(15));t.setProperty('--o60',off(60))
    this._render()
  }
  _labels(){
    const px=this.o.px,en=D.lang==='en'
    let html=''
    for(let v=this.min+((30-(this.min%30))%30);v<=this.max;v+=30){
      const m=((v%1440)+1440)%1440
      const cls=m===0?' day':m%60?' half':''
      const txt=m===0?(en?'00:00 · next day':'00:00 · завтра'):minToHM(v)
      html+=`<span class="tt-l${cls}" style="left:${(v-this.min)*px}px">${txt}</span>`
    }
    this.lbl.innerHTML=html
  }
  // Подсветка занятости: [{from,to,cls}] в абсолютных минутах
  setSegments(segs){
    const key=JSON.stringify(segs)
    if(key===this.segKey)return
    this.segKey=key
    const px=this.o.px
    this.segL.innerHTML=(segs||[]).map(s=>{
      const a=Math.max(s.from,this.min),b=Math.min(s.to,this.max+720)
      return b>a?`<i class="tt-seg ${s.cls}" style="left:${(a-this.min)*px}px;width:${Math.max(2,(b-a)*px)}px"></i>`:''
    }).join('')
  }
  // Выбранный отрезок — отдельным элементом, чтобы не перерисовывать занятость на каждом кадре
  setSelection(from,to,bad){
    const px=this.o.px
    this.selEl.style.transform=`translateX(${(from-this.min)*px}px)`
    this.selEl.style.width=Math.max(2,(to-from)*px)+'px'
    this.selEl.classList.toggle('bad',!!bad)
  }
  setNow(abs){
    const on=abs>=this.min-1&&abs<=this.max
    this.nowEl.style.display=on?'':'none'
    if(on)this.nowEl.style.transform=`translateX(${(abs-this.min)*this.o.px}px)`
  }
  set(v,animate=false,emit=false){
    const t=this.clamp(v)
    if(animate&&!_reduceMotion)this._animTo(t,emit)
    else{this._stop();this._to(t,emit)}
  }
  nudge(d){
    const v=this.clamp(this.value+d)
    if(v===this.value){haptic('warn');return}
    this.set(v,false,true);haptic('tick');this.o.onSettle(v)
  }
  _to(p,emit){
    this.pos=p
    this._render()
    const v=this.clamp(p)
    if(v!==this.value){
      if(emit&&Math.floor(v/15)!==Math.floor(this.value/15))haptic('tick')
      this.value=v
      this.root.setAttribute('aria-valuenow',v);this.root.setAttribute('aria-valuetext',minToHM(v))
      if(emit)this.o.onInput(v)
    }
  }
  _render(){this.tr.style.transform=`translate3d(${this.w/2-(this.pos-this.min)*this.o.px}px,0,0)`}
  _stop(){if(this.raf){cancelAnimationFrame(this.raf);this.raf=0}}
  // Инерция после броска: замедляется как в iOS, потом доводка до минуты (после сильного броска — до 5 мин)
  _fling(vel){
    this._stop()
    if(_reduceMotion||Math.abs(vel)<.02)return this._snap(1)
    const step=Math.abs(vel)>.6?5:1
    let last=performance.now()
    const tick=now=>{
      const dt=Math.min(32,now-last);last=now
      vel*=Math.exp(-dt/325)
      let p=this.pos+vel*dt
      if(p<this.min||p>this.max){p=Math.min(this.max,Math.max(this.min,p));vel=0}
      this._to(p,true)
      if(Math.abs(vel)>.012)this.raf=requestAnimationFrame(tick)
      else{this.raf=0;this._snap(step)}
    }
    this.raf=requestAnimationFrame(tick)
  }
  _snap(step){
    let t=Math.round(this.pos/step)*step
    t=Math.min(this.max,Math.max(this.min,t))
    this._animTo(t,true,true)
  }
  _animTo(t,emit,settle){
    this._stop()
    const from=this.pos,dur=_reduceMotion?0:Math.min(420,120+Math.abs(t-from)*.8),t0=performance.now()
    const tick=now=>{
      const k=dur?Math.min(1,(now-t0)/dur):1,e=1-Math.pow(1-k,3)
      this._to(from+(t-from)*e,emit)
      if(k<1)this.raf=requestAnimationFrame(tick)
      else{this.raf=0;this._to(t,emit);if(settle||emit)this.o.onSettle(this.value)}
    }
    this.raf=requestAnimationFrame(tick)
  }
}

// ═══ ПОЛЗУНОК ДЛИТЕЛЬНОСТИ (шаг 30 мин) ═══
class DurSlider{
  constructor(root,opts){
    this.o=Object.assign({min:30,max:720,step:30,value:60,onInput:()=>{},color:'var(--lime)'},opts)
    this.root=root;this.v=this.o.value
    root.classList.add('ds');root.tabIndex=0;root.setAttribute('role','slider')
    root.style.setProperty('--dc',this.o.color)
    const n=(this.o.max-this.o.min)/60
    let marks=''
    for(let m=Math.ceil(this.o.min/60)*60;m<=this.o.max;m+=60){
      const big=m===60||m%180===0
      marks+=`<i class="ds-m${big?' big':''}" style="left:${this._pct(m)}%">${big?`<b>${m/60}${D.lang==='en'?'h':'ч'}</b>`:''}</i>`
    }
    root.innerHTML=`<div class="ds-tr"><div class="ds-fill"></div>${marks}<div class="ds-th"><span></span></div></div>`
    this.tr=root.querySelector('.ds-tr');this.fill=root.querySelector('.ds-fill');this.th=root.querySelector('.ds-th')
    const fromX=x=>{const r=this.tr.getBoundingClientRect();return this.o.min+Math.min(1,Math.max(0,(x-r.left)/r.width))*(this.o.max-this.o.min)}
    let x0=0
    hGesture(root,{
      start:e=>{x0=e.clientX},
      move:(dx)=>this._set(fromX(x0+dx),true),
      end:()=>root.classList.remove('drag'),
      tap:x=>this._set(fromX(x),true)
    })
    root.addEventListener('pointerdown',()=>root.classList.add('drag'))
    root.addEventListener('pointerup',()=>root.classList.remove('drag'))
    root.addEventListener('keydown',e=>{
      const k={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[e.key]
      if(k){e.preventDefault();this._set(this.v+k*this.o.step,true)}
    })
    this._render()
  }
  _pct(m){return (m-this.o.min)/(this.o.max-this.o.min)*100}
  _set(v,emit){
    const s=this.o.step,nv=Math.min(this.o.max,Math.max(this.o.min,Math.round(v/s)*s))
    if(nv===this.v)return
    this.v=nv;this._render()
    if(emit){haptic('tick');this.o.onInput(nv)}
  }
  set(v){this._set(v,false)}
  get value(){return this.v}
  _render(){
    const p=this._pct(this.v)
    this.fill.style.width=p+'%'
    this.th.style.left=p+'%'
    this.root.setAttribute('aria-valuenow',this.v)
    this.root.setAttribute('aria-valuetext',fmtDur(this.v))
  }
}

// Кнопка ± с автоповтором при удержании (чем дольше держишь — тем быстрее)
function holdRepeat(btn,fire){
  let timer=null,count=0
  const stop=()=>{clearTimeout(timer);timer=null}
  btn.addEventListener('pointerdown',e=>{
    e.preventDefault();stop();count=0;fire(count++)
    const loop=delay=>{timer=setTimeout(()=>{fire(count++);loop(Math.max(45,delay*.85))},delay)}
    loop(380)
  })
  ;['pointerup','pointerleave','pointercancel'].forEach(ev=>btn.addEventListener(ev,stop))
  btn.addEventListener('contextmenu',e=>e.preventDefault())
  btn.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fire(0)}})
}

// Компактное поле времени HH:MM с ±5 мин и точным вводом (оффлайн-бронь в админке)
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
