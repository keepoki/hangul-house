import { createWorkshopWorld, pieces } from './workshop-physics.js';

export function createWorkshop() {
  const $=id=>document.getElementById(id),canvas=$('workshop-canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas is unavailable');
  const events=new AbortController(),options={signal:events.signal};
  let active=false,frame=0,last=0,pointer=null,width=600,height=360,unit=40,originX=300,originY=330;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let model=null;
  model=createWorkshopWorld({gravity:!reduced,onChange:()=>{update();kick();}});
  $('gravity-toggle').checked=!reduced;
  function update(){
    if(!model)return;
    document.querySelectorAll('[data-piece]').forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===model.selected));b.dataset.placed=String(model.bodies[i].userData.placed);});
    $('place-piece').disabled=model.bodies[model.selected].userData.placed;
    const message=model.complete?'집 한 채를 완성했습니다. 한글의 선이 공간이 되었어요.':model.count+' / 3 조각 완성 · '+pieces[model.selected].char+' '+pieces[model.selected].name+'를 윤곽에 맞춰 놓아보세요.';
    if($('workshop-status').textContent!==message)$('workshop-status').textContent=message;
  }
  function resize(){const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);unit=Math.min(width/11.4,(height-35)/7.6);originX=width/2;originY=height-22;kick();}
  function shape(index){
    ctx.beginPath();
    if(index===0){ctx.rect(-1.45,-1.35,2.9,2.7);ctx.rect(-1.1,-1,2.2,2);}
    if(index===1){ctx.moveTo(-1.82,-.72);ctx.lineTo(0,1.18);ctx.lineTo(1.82,-.72);ctx.lineTo(1.58,-.96);ctx.lineTo(0,.72);ctx.lineTo(-1.58,-.96);ctx.closePath();}
    if(index===2){ctx.arc(0,0,1.08,0,Math.PI*2);ctx.moveTo(.74,0);ctx.arc(0,0,.74,0,Math.PI*2,true);}
  }
  function draw(){
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#11120f';ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#a39984';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(10,originY-.12*unit);ctx.lineTo(width-10,originY-.12*unit);ctx.stroke();
    pieces.forEach((piece,i)=>{if(model.bodies[i].userData.placed)return;ctx.save();ctx.translate(originX+piece.target[0]*unit,originY-piece.target[1]*unit);ctx.scale(unit,-unit);ctx.strokeStyle=i===model.selected?'#dfbf88':'#908772';ctx.lineWidth=1.5/unit;ctx.setLineDash([5/unit,4/unit]);shape(i);ctx.stroke();ctx.restore();});
    model.bodies.forEach((body,i)=>{ctx.save();ctx.translate(originX+body.position.x*unit,originY-body.position.y*unit);const a=2*Math.atan2(body.quaternion.z,body.quaternion.w);ctx.rotate(-a);ctx.scale(unit,-unit);ctx.fillStyle=pieces[i].color;ctx.strokeStyle=i===model.selected?'#f4e4c5':'#736247';ctx.lineWidth=(i===model.selected?2:1)/unit;ctx.shadowColor='#0007';ctx.shadowBlur=10;ctx.shadowOffsetX=2;ctx.shadowOffsetY=5;shape(i);ctx.fill('evenodd');ctx.shadowColor='transparent';ctx.stroke();ctx.restore();});
  }
  function tick(time){frame=0;if(!active)return;const dt=last?Math.min(.06,(time-last)/1000):1/90;last=time;model.step(dt);draw();if(model.moving())kick();}
  function kick(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left-originX)/unit,y:(originY-(e.clientY-r.top))/unit};}
  function pick(p){
    for(let i=model.bodies.length-1;i>=0;i--){const b=model.bodies[i];if(b.userData.placed)continue;const angle=2*Math.atan2(b.quaternion.z,b.quaternion.w),dx=p.x-b.position.x,dy=p.y-b.position.y;const x=Math.cos(angle)*dx+Math.sin(angle)*dy,y=-Math.sin(angle)*dx+Math.cos(angle)*dy;if(Math.abs(x)<pieces[i].width/2+.15&&Math.abs(y)<pieces[i].height/2+.15)return i;}
    return -1;
  }
  function release(snap=true){const id=pointer;pointer=null;model.endDrag(snap);if(id!==null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);kick();}
  canvas.addEventListener('pointerdown',e=>{if(pointer!==null||e.button>0)return;const p=point(e),index=pick(p);if(index<0)return;e.preventDefault();if(model.beginDrag(index,p.x,p.y)){pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});kick();}},options);
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer)return;e.preventDefault();const p=point(e);model.dragTo(p.x,p.y);kick();},options);
  canvas.addEventListener('pointerup',e=>{if(e.pointerId===pointer)release(true);},options);
  canvas.addEventListener('pointercancel',e=>{if(e.pointerId===pointer)release(false);},options);
  canvas.addEventListener('lostpointercapture',e=>{if(e.pointerId===pointer)release(false);},options);
  addEventListener('blur',()=>release(false),options);
  canvas.addEventListener('keydown',e=>{if(['1','2','3'].includes(e.key)){e.preventDefault();model.select(Number(e.key)-1);}if(e.key==='Enter'||e.key===' '){e.preventDefault();model.place();kick();}},options);
  document.querySelectorAll('[data-piece]').forEach((b,i)=>b.addEventListener('click',()=>model.select(i),options));
  $('place-piece').addEventListener('click',()=>{model.place();kick();},options);
  $('reset-workshop').addEventListener('click',()=>{release(false);model.reset();kick();},options);
  $('gravity-toggle').addEventListener('change',e=>{model.setGravity(e.target.checked);kick();},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;last=0;release(false);}else if(active)kick();},options);
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  $('workshop-loading').hidden=true;update();
  return {open(){active=true;last=0;resize();kick();},pause(){active=false;if(frame)cancelAnimationFrame(frame);frame=0;last=0;release(false);},dispose(){active=false;if(frame)cancelAnimationFrame(frame);release(false);observer.disconnect();events.abort();},model};
}
