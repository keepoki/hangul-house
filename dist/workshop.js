import { createWorkshopWorld, pieces } from './workshop-physics.js';

export function createWorkshop() {
  const $=id=>document.getElementById(id);
  const canvas=$('workshop-canvas'),ctx=canvas.getContext('2d'),grip=$('workshop-grip');
  if(!ctx)throw new Error('Canvas is unavailable');

  const steps=[...document.querySelectorAll('[data-workshop-step]')];
  const exhibit=$('workshop-exhibit'),status=$('workshop-status'),placeButton=$('place-piece');
  const undoButton=$('undo-workshop'),resetButton=$('reset-workshop'),gravityToggle=$('gravity-toggle');
  const events=new AbortController(),options={signal:events.signal};
  const exhibitParts=[
    {id:'mieum',room:'나무의 뜰',object:'입구를',guide:'바닥에 네모난 입구를 세워보세요.',detail:'ㅁ의 네 획으로 드나들 수 있는 입구를 만듭니다.'},
    {id:'siot',room:'고요의 방',object:'지붕을',guide:'입구 위에 두 획이 만나는 지붕을 얹어보세요.',detail:'ㅅ의 두 획을 기대어 입구 위에 지붕을 얹습니다.'},
    {id:'ieung',room:'물의 뜰',object:'창을',guide:'입구 오른쪽에 둥근 창을 맞춰보세요.',detail:'ㅇ의 빈 가운데로 물과 빛을 담는 창을 냅니다.'}
  ];
  const pieceShades=['#edc894','#f1e5cb','#e0bc76'];
  let active=false,frame=0,last=0,drag=null,aligned=false,ending=false;
  let width=600,height=400,unit=40,originX=300,originY=330;
  const model=createWorkshopWorld({gravity:false,assembly:true,onChange:kick});

  const preview=document.querySelector('#structure-figure .structure-model').cloneNode(true);
  preview.querySelectorAll('.structure-lifted').forEach(part=>part.remove());
  const named=preview.getAttribute('aria-labelledby').split(' ');
  for(const id of named)preview.querySelector('#'+id).id='workshop-'+id;
  preview.setAttribute('aria-labelledby',named.map(id=>'workshop-'+id).join(' '));
  const shadow=preview.querySelector('[filter]');
  const shadowId=preview.querySelector('filter');
  shadowId.id='workshop-'+shadowId.id;
  shadow.setAttribute('filter','url(#'+shadowId.id+')');
  preview.setAttribute('viewBox','30 35 646 430');
  $('workshop-model').replaceChildren(preview);

  function feedback(type,message){
    status.dataset.feedback=type;
    if(status.textContent!==message)status.textContent=message;
  }
  function guide(){feedback('ready',exhibitParts[model.selected].guide);}
  function update(){
    const {selected,complete,count}=model;
    ending=false;
    steps.forEach((step,index)=>{
      const placed=index<count,current=!complete&&index===selected;
      step.dataset.state=placed?'placed':current?'current':'waiting';
      if(current)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');
      step.querySelector('small').textContent=placed?'완료':current?'조립 중':'';
    });
    $('workshop-assembly').hidden=complete;
    $('workshop-completion').hidden=!complete;
    $('return-to-exhibition').hidden=!complete;
    gravityToggle.closest('label').hidden=complete;
    undoButton.disabled=count===0;
    resetButton.disabled=count===0;
    placeButton.textContent=pieces[selected].name+' 놓기';
    const part=exhibitParts[selected];
    exhibit.dataset.part=complete?'whole':part.id;
    $('workshop-exhibit-title').textContent=complete?'한글 건축관 완성 모형':part.room+' · '+pieces[selected].char+' '+pieces[selected].name;
    $('workshop-exhibit-detail').textContent=complete?'ㄱ의 기둥과 처마에 입구, 지붕, 창이 더해졌습니다.':part.detail;
    if(active&&!complete)resize();
  }
  function afterPlacement(index){
    update();
    if(model.complete){
      feedback('placed','한 채의 집이 완성됐어요.');
      $('workshop-complete-title').focus({preventScroll:true});
      $('workshop-dialog').scrollTop=0;
      return;
    }
    feedback('placed',exhibitParts[index].object+' 놓았어요. 다음은 '+pieces[model.selected].name+'입니다.');
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||rect.height<=45)return;
    width=rect.width;
    height=rect.height;
    const dpr=Math.min(devicePixelRatio,2);
    canvas.width=Math.round(width*dpr);
    canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    unit=Math.min(width/10.8,(height-45)/5.5);
    originX=width/2;
    originY=(height+4.8*unit)/2+9;
    kick();
  }
  function shape(index){
    ctx.beginPath();
    if(index===0){ctx.rect(-1.45,-1.35,2.9,2.7);ctx.rect(-1.1,-1,2.2,2);}
    if(index===1){ctx.moveTo(-1.82,-.72);ctx.lineTo(0,1.18);ctx.lineTo(1.82,-.72);ctx.lineTo(1.58,-.96);ctx.lineTo(0,.72);ctx.lineTo(-1.58,-.96);ctx.closePath();}
    if(index===2){ctx.arc(0,0,1.08,0,Math.PI*2);ctx.moveTo(.74,0);ctx.arc(0,0,.74,0,Math.PI*2,true);}
  }
  function draw(){
    if(model.complete)return;
    const index=model.selected,piece=pieces[index],body=model.bodies[index];
    ctx.clearRect(0,0,width,height);
    const pitch=unit/2;
    ctx.beginPath();
    ctx.strokeStyle='#c3a77916';
    ctx.lineWidth=1;
    for(let x=originX%pitch;x<width;x+=pitch){ctx.moveTo(x,0);ctx.lineTo(x,height);}
    for(let y=(originY-.12*unit)%pitch;y<height;y+=pitch){ctx.moveTo(0,y);ctx.lineTo(width,y);}
    ctx.stroke();
    ctx.strokeStyle='#716652';ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(12,originY-.12*unit);ctx.lineTo(width-12,originY-.12*unit);
    ctx.moveTo(originX+2.05*unit,9);ctx.lineTo(originX+2.05*unit,32);
    ctx.stroke();

    ctx.save();
    ctx.translate(originX+piece.target[0]*unit,originY-piece.target[1]*unit);
    ctx.scale(unit,-unit);
    ctx.strokeStyle=aligned?'#f6e8bf':'#c7a974';
    ctx.lineWidth=(aligned?3:1.5)/unit;
    ctx.setLineDash(aligned?[]:[5/unit,4/unit]);
    shape(index);
    if(aligned){ctx.fillStyle='#d7b97144';ctx.fill('evenodd');}
    ctx.stroke();
    ctx.restore();

    model.bodies.forEach((entry,i)=>{
      if(i!==index&&!entry.userData.placed)return;
      ctx.save();
      ctx.translate(originX+entry.position.x*unit,originY-entry.position.y*unit);
      ctx.rotate(-2*Math.atan2(entry.quaternion.z,entry.quaternion.w));
      ctx.scale(unit,-unit);
      const pigment=ctx.createLinearGradient(-1,-1,1,1);
      pigment.addColorStop(0,pieces[i].color);
      pigment.addColorStop(1,pieceShades[i]);
      ctx.fillStyle=pigment;
      ctx.strokeStyle=i===index?'#f4e4c5':'#a18b66';
      ctx.lineWidth=(i===index?1.5:1)/unit;
      ctx.shadowColor='#0007';ctx.shadowBlur=8;ctx.shadowOffsetX=2;ctx.shadowOffsetY=4;
      shape(i);
      ctx.fill('evenodd');
      ctx.shadowColor='transparent';
      ctx.stroke();
      ctx.restore();
    });

    grip.style.left=originX+body.position.x*unit+'px';
    grip.style.top=originY-body.position.y*unit+'px';
    grip.style.width=Math.max(44,piece.width*unit)+'px';
    grip.style.height=Math.max(44,piece.height*unit)+'px';
  }
  function tick(time){
    frame=0;
    if(!active)return;
    if(model.complete){
      if(ending){
        ending=false;
        afterPlacement(model.selected);
      }
      return;
    }
    const dt=last?Math.min(.06,(time-last)/1000):1/90;
    last=time;
    model.step(dt);
    draw();
    if(model.moving())kick();
  }
  function kick(){if(active&&!document.hidden&&!frame)frame=requestAnimationFrame(tick);}
  function point(event){
    const rect=canvas.getBoundingClientRect();
    return {x:(event.clientX-rect.left-originX)/unit,y:(originY-(event.clientY-rect.top))/unit};
  }
  function dropPosition(event){
    const p=point(event);
    return {x:p.x+drag.offsetX,y:p.y+drag.offsetY};
  }
  function release(event){
    if(!drag)return;
    const {id,surface}=drag,index=model.selected;
    const position=event?dropPosition(event):undefined;
    drag=null;
    aligned=false;
    const placed=model.endDrag(!!event,position);
    if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
    if(placed){
      // Keep the touch target mounted until the browser finishes the drop gesture.
      if(model.complete&&event.pointerType==='touch')ending=true;
      else afterPlacement(index);
    }
    else if(event)feedback('retry','윤곽에 닿지 않았어요. 조각을 다시 끌어보세요.');
    else guide();
    kick();
  }
  function begin(event){
    if(!active||model.complete||drag||event.button>0)return;
    if(event.pointerType==='touch'&&event.target!==grip)return;
    const p=point(event),index=model.selected,body=model.bodies[index];
    const angle=2*Math.atan2(body.quaternion.z,body.quaternion.w);
    const dx=p.x-body.position.x,dy=p.y-body.position.y;
    const x=Math.cos(angle)*dx+Math.sin(angle)*dy,y=-Math.sin(angle)*dx+Math.cos(angle)*dy;
    if(event.target!==grip&&(Math.abs(x)>pieces[index].width/2+.15||Math.abs(y)>pieces[index].height/2+.15))return;
    if(!model.beginDrag(index,p.x,p.y))return;
    if(event.pointerType!=='touch')event.preventDefault();
    const surface=event.currentTarget;
    drag={id:event.pointerId,surface,offsetX:-dx,offsetY:-dy};
    surface.setPointerCapture(event.pointerId);
    guide();
    kick();
  }
  function move(event){
    if(event.pointerId!==drag?.id)return;
    const p=point(event);
    model.dragTo(p.x,p.y);
    const near=model.isNearTarget(model.selected,dropPosition(event));
    if(near!==aligned){
      aligned=near;
      if(near)feedback('aligned','자리가 맞았어요. 조각을 놓아보세요.');
      else guide();
    }
    kick();
  }
  function end(event){if(event.pointerId===drag?.id)release(event);}
  function cancel(event){if(event.pointerId===drag?.id)release();}
  for(const surface of [canvas,grip]){
    surface.addEventListener('pointerdown',begin,options);
    surface.addEventListener('pointermove',move,options);
    surface.addEventListener('pointerup',end,options);
    surface.addEventListener('pointercancel',cancel,options);
    surface.addEventListener('lostpointercapture',cancel,options);
  }
  addEventListener('blur',()=>release(),options);
  function placeCurrent(){
    release();
    const index=model.selected;
    if(model.place())afterPlacement(index);
  }
  canvas.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    if(!event.repeat)placeCurrent();
  },options);
  placeButton.addEventListener('click',placeCurrent,options);
  undoButton.addEventListener('click',()=>{
    release();
    if(!model.undo())return;
    update();
    placeButton.focus();
    feedback('ready',exhibitParts[model.selected].object+' 작업대로 돌려놓았어요.');
  },options);
  resetButton.addEventListener('click',()=>{
    release();
    model.reset();
    update();
    placeButton.focus({preventScroll:true});
    $('workshop-dialog').scrollTop=0;
    guide();
  },options);
  gravityToggle.checked=false;
  gravityToggle.addEventListener('change',event=>{
    release();
    model.setGravity(event.target.checked);
  },options);
  $('return-to-exhibition').addEventListener('click',()=>$('workshop-dialog').close(),options);
  function stop(){
    if(frame)cancelAnimationFrame(frame);
    frame=0;
    last=0;
    release();
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stop();else kick();
  },options);
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  $('workshop-loading').hidden=true;
  $('workshop-layout').hidden=false;
  update();
  guide();
  return {
    open(){active=true;last=0;resize();kick();},
    pause(){active=false;stop();},
    dispose(){active=false;stop();observer.disconnect();events.abort();},
    model
  };
}
