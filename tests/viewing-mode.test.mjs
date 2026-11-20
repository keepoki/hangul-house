import test from 'node:test';
import assert from 'node:assert/strict';
import {startViewing} from '../dist/viewing-mode.js';

function setup(preference='auto',loadGallery,storageOverride){
  const state={view:'',status:'',progress:.26},saved=new Map([['hangul-house:viewing-mode',preference]]),listeners={};
  const image={getProgress:()=>state.progress,seek:p=>{state.progress=p;state.seeks=(state.seeks??0)+1;},pause(){},resume(){},refresh(){}};
  const gallery={...image,dispose(){}};
  const ui={wantsText:()=>false,attach(c,{view}={}){state.view=view;state.controller=c;},setViewingState(s){Object.assign(state,s);},fail(){throw new Error('Must retain a useful image tour');}};
  let loads=0;
  const manager=startViewing({storage:storageOverride??{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},document:{documentElement:{dataset:{}}},window:{addEventListener:(k,v)=>listeners[k]=v},imageFactory:()=>image,interfaceFactory:options=>{ui.options=options;return ui;},loadGallery:async()=>{loads++;return loadGallery?loadGallery(gallery):{initGallery:async()=>gallery};},setTimer:()=>1,clearTimer:()=>{}});
  return{state,saved,manager,ui,listeners,get loads(){return loads;},gallery};
}
test('a saved image preference opens images without importing Three.js',async()=>{
  const app=setup('images');await app.manager.ready;
  assert.equal(app.loads,0);assert.equal(app.state.view,'images');
});
test('switching modes preserves the current room and remembers the explicit choice',async()=>{
  const app=setup('images');await app.manager.choose('3d');
  assert.equal(app.state.view,'3d');assert.equal(app.state.progress,.26);
  await app.manager.choose('images');assert.equal(app.state.view,'images');
  assert.equal(app.saved.get('hangul-house:viewing-mode'),'images');assert.equal(app.state.progress,.26);
});
test('an image choice wins over a pending 3D initialization',async()=>{
  let finish;const app=setup('auto',gallery=>({initGallery:()=>new Promise(resolve=>finish=()=>resolve(gallery))}));
  await Promise.resolve();await Promise.resolve();await app.manager.choose('images');
  finish();await app.manager.ready;
  assert.equal(app.state.view,'images');assert.equal(app.saved.get('hangul-house:viewing-mode'),'images');
});
test('unavailable WebGL falls back to images without losing the room',async()=>{
  const app=setup('auto',()=>({initGallery:async()=>{throw new Error('No WebGL');}}));await app.manager.ready;
  assert.equal(app.state.view,'images');assert.equal(app.state.progress,.26);assert.match(app.state.status,/이미지/);
});
test('automatic performance fallback preserves images but manual 3D remains selected',async()=>{
  let fallback;const app=setup('auto',gallery=>({initGallery:async options=>{fallback=options.onFallback;return gallery;}}));await app.manager.ready;
  fallback();assert.equal(app.state.view,'images');
  await app.manager.choose('3d');fallback();assert.equal(app.state.view,'3d');
});
test('storage denial does not prevent image viewing or user selection',async()=>{
  const app=setup('auto',undefined,{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}});
  await app.manager.ready;
  await app.manager.choose('images');assert.equal(app.state.view,'images');
});
test('context failure while reading text does not scroll the visitor out of the text tour',async()=>{
  const app=setup('auto');await app.manager.ready;const seeks=app.state.seeks;
  app.ui.wantsText=()=>true;
  app.listeners['museum:failure']();
  assert.equal(app.state.seeks,seeks);
});
