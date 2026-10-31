// All input paths produce the same bounded axes. Captured fingers and gamepad disconnection cannot leave a stuck axis.
export function createControls(canvas,{action,orbit,zoom,tap}){
  const keys=new Set(),axes={drive:0,steer:0,lift:0,tool:0,swing:0,tilt:0,extend:0};let enabled=true,previous=[],drag=null,pinches=new Map(),pinchDist=0;
  const neutral=()=>{keys.clear();for(const k in axes)axes[k]=0;for(const dot of document.querySelectorAll('.stick-dot'))dot.style.transform='translate(-50%,-50%)';};
  const isInput=e=>e.target.closest('input,textarea,select,#pz');
  const special={Space:'grab',KeyE:'hop',KeyR:'reset',Escape:'pause',KeyH:'horn'};
  const codes=['KeyW','KeyA','KeyS','KeyD','KeyI','KeyJ','KeyK','KeyL','KeyU','KeyO','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown',e=>{if(!enabled||isInput(e))return;if(e.target.closest('button')&&['Space','Enter'].includes(e.code))return;if(codes.includes(e.code)||special[e.code])e.preventDefault();if(special[e.code]&&!e.repeat)action(special[e.code]);keys.add(e.code);});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',neutral);document.addEventListener('visibilitychange',neutral);
  for(const stick of document.querySelectorAll('[data-stick]')){
    let finger=null;const dot=stick.querySelector('.stick-dot');
    const move=e=>{if(e.pointerId!==finger)return;const r=stick.getBoundingClientRect(),rad=r.width*.34;let x=(e.clientX-r.x-r.width/2)/rad,y=(e.clientY-r.y-r.height/2)/rad;const l=Math.max(1,Math.hypot(x,y));x/=l;y/=l;dot.style.transform=`translate(calc(-50% + ${x*rad}px),calc(-50% + ${y*rad}px))`;if(stick.dataset.stick==='drive'){axes.drive=-y;axes.steer=-x;}else{axes.lift=-y;axes.tool=x;}};
    stick.addEventListener('pointerdown',e=>{if(!enabled)return;finger=e.pointerId;stick.setPointerCapture(finger);move(e);});stick.addEventListener('pointermove',move);
    const end=()=>{finger=null;if(stick.dataset.stick==='drive')axes.drive=axes.steer=0;else axes.lift=axes.tool=0;dot.style.transform='translate(-50%,-50%)';};stick.addEventListener('pointerup',end);stick.addEventListener('pointercancel',end);stick.addEventListener('lostpointercapture',end);
  }
  for(const b of document.querySelectorAll('[data-hold]')){
    const [axis,v]=b.dataset.hold.split(':');const clear=()=>axes[axis]=0;
    b.addEventListener('pointerdown',e=>{if(!enabled)return;b.setPointerCapture(e.pointerId);axes[axis]=Number(v);});b.addEventListener('pointerup',clear);b.addEventListener('pointercancel',clear);b.addEventListener('lostpointercapture',clear);
    b.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();axes[axis]=Number(v);}});b.addEventListener('keyup',clear);b.addEventListener('blur',clear);
  }
  canvas.addEventListener('pointerdown',e=>{if(!enabled)return;pinches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY,total:0};if(pinches.size===2){const p=[...pinches.values()];pinchDist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}});
  canvas.addEventListener('pointermove',e=>{if(!pinches.has(e.pointerId))return;pinches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pinches.size===2){const p=[...pinches.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);zoom((pinchDist-d)*.035);pinchDist=d;return;}if(drag?.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.total+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;orbit(dx,dy);}});
  const stop=e=>{if(drag?.id===e.pointerId&&drag.total<8&&pinches.size===1)tap?.(e);pinches.delete(e.pointerId);drag=null;};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',()=>{pinches.clear();drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.015);},{passive:false});
  const down=(a,b)=>Number(keys.has(a))-Number(keys.has(b));
  return {clear:neutral,setEnabled(v){enabled=v;neutral();},read(){
    if(!enabled)return {};
    const shift=keys.has('ShiftLeft')||keys.has('ShiftRight'),horizontal=down('KeyL','KeyJ')+down('ArrowRight','ArrowLeft');
    const result={...axes,drive:axes.drive+down('KeyW','KeyS'),steer:axes.steer+down('KeyA','KeyD'),lift:axes.lift+down('KeyI','KeyK')+down('ArrowUp','ArrowDown'),tool:axes.tool+(shift?0:horizontal),swing:axes.swing+(shift?horizontal:0),extend:axes.extend+down('KeyO','KeyU')};
    const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);if(pad){const dz=v=>Math.abs(v)>.18?v:0;result.drive+=-dz(pad.axes[1]||0);result.steer+=-dz(pad.axes[0]||0);result.lift+=-dz(pad.axes[3]||0);result.tool+=dz(pad.axes[2]||0);[0,3,1].forEach((b,i)=>{if(pad.buttons[b]?.pressed&&!previous[b])action(['grab','hop','reset'][i]);});previous=pad.buttons.map(b=>b.pressed);}else previous=[];
    return Object.fromEntries(Object.entries(result).map(([k,v])=>[k,Math.max(-1,Math.min(1,v))]));
  }};
}
