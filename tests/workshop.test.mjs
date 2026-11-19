import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkshopWorld,pieces} from '../dist/workshop-physics.js';
import {fixture} from './dom-fixture.mjs';
const source=(await readFile(new URL('../dist/workshop.js',import.meta.url),'utf8')).replace(/^import[^;]+;\s*/gm,'').replace(/^export\s+/gm,'');
function boot(){
  const f=fixture();
  const create=new Function('createWorkshopWorld','pieces','document','matchMedia','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','addEventListener',source+'\nreturn createWorkshop();');
  const workshop=create(createWorkshopWorld,pieces,f.document,()=>({matches:false}),1,f.raf,f.cancel,f.ResizeObserver,f.window.addEventListener.bind(f.window));
  workshop.open();const canvas=f.$('workshop-canvas'),unit=Math.min(600/11.4,365/7.6);
  function point(index){const body=workshop.model.bodies[index];return{clientX:300+body.position.x*unit,clientY:378-body.position.y*unit};}
  return{f,workshop,canvas,point};
}
test('pointer cancellation, second pointers and lost capture never leave the workshop dragging',()=>{
  const {f,workshop,canvas,point}=boot();
  f.fire(canvas,'pointerdown',{pointerId:1,button:0,...point(0)});assert.equal(workshop.model.dragging,0);
  f.fire(canvas,'pointerdown',{pointerId:2,button:0,...point(1)});assert.equal(workshop.model.dragging,0);assert.equal(workshop.model.world.constraints.length,1);
  f.fire(canvas,'pointercancel',{pointerId:1});assert.equal(workshop.model.dragging,-1);assert.equal(canvas.captured.size,0);
  f.fire(canvas,'pointerdown',{pointerId:3,button:0,...point(0)});assert.equal(workshop.model.dragging,0);
  f.fire(canvas,'lostpointercapture',{pointerId:3});assert.equal(workshop.model.dragging,-1);
  f.fire(canvas,'pointerdown',{pointerId:4,button:0,...point(0)});f.fire(f.window,'blur');assert.equal(workshop.model.dragging,-1);assert.equal(workshop.model.world.constraints.length,0);
  workshop.dispose();
});
test('keyboard and selection buttons can complete the house without dragging',()=>{
  const {f,workshop,canvas}=boot();
  for(const key of ['1','2','3']){f.fire(canvas,'keydown',{key});f.fire(canvas,'keydown',{key:'Enter'});}
  assert.equal(workshop.model.complete,true);assert.ok(f.$('workshop-status').textContent.includes('완성'));
  f.fire(f.$('reset-workshop'),'click');assert.equal(workshop.model.complete,false);
  f.fire(f.groups['[data-piece]'][1],'click');f.fire(f.$('place-piece'),'click');assert.equal(workshop.model.bodies[1].userData.placed,true);
  workshop.dispose();
});
test('closing or hiding the workshop stops its render loop and clears gestures',()=>{
  const {f,workshop,canvas,point}=boot();f.fire(canvas,'pointerdown',{pointerId:1,button:0,...point(0)});
  f.document.hidden=true;f.fire(f.document,'visibilitychange');assert.equal(workshop.model.dragging,-1);assert.equal(f.frames.size,0);
  f.document.hidden=false;f.fire(f.document,'visibilitychange');assert.ok(f.frames.size>0);
  workshop.pause();assert.equal(f.frames.size,0);workshop.dispose();
});
