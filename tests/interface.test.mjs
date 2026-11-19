import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './dom-fixture.mjs';
const original=await readFile(new URL('../dist/interface.js',import.meta.url),'utf8');
function boot(){
  const f=fixture(),calls=[];
  const workshop={open(){calls.push('workshop-open');},pause(){calls.push('workshop-pause');}};
  const source=original.replace(/^export\s+/gm,'').replace("import('./workshop.js')",'Promise.resolve({createWorkshop:()=>fakeWorkshop})');
  const init=new Function('document','addEventListener','requestAnimationFrame','scrollY','scrollTo','location','setTimeout','clearTimeout','fakeWorkshop','console',source+'\nreturn initInterface();');
  const ui=init(f.document,f.window.addEventListener.bind(f.window),fn=>{fn();return 1;},350,f.scrollTo,f.location,f.time,f.clear,workshop,{warn(){}});
  const controller={goTo:p=>calls.push(['go',p]),refresh:()=>calls.push('refresh'),pause:()=>calls.push('gallery-pause'),resume:()=>calls.push('gallery-resume'),changeZoom:p=>calls.push(['zoom',p]),setZoom:p=>calls.push(['setZoom',p]),toggleLighting:()=>calls.push('light'),next:()=>calls.push('next')};
  return{f,ui,calls,controller};
}
test('navigation and zoom controls are wired to the 3D controller',()=>{
  const {f,ui,calls,controller}=boot();ui.attach(controller);
  f.fire(f.groups['[data-stop]'][3],'click');f.fire(f.$('zoom-in'),'click');f.fire(f.$('zoom-out'),'click');f.fire(f.$('zoom-reset'),'click');f.fire(f.$('light-toggle'),'click');
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='go'&&v[1]===.39));
  assert.ok(calls.some(v=>Array.isArray(v)&&v[0]==='zoom'&&v[1]===.15));
  assert.ok(calls.includes('light'));assert.equal(f.$('zoom-in').disabled,false);
});
test('text mode remains useful after 3D failure and can retry',()=>{
  const {f,ui}=boot();ui.fail(new Error('GPU unavailable'));
  assert.equal(f.document.documentElement.dataset.view,'static');assert.equal(f.document.documentElement.dataset.state,'error');
  assert.equal(f.$('failure-actions').hidden,false);assert.equal(f.$('zoom-in').disabled,true);
  f.fire(f.$('.failure-actions a'),'click');assert.equal(ui.wantsText(),true);assert.equal(f.$('text-tour').focused,true);
  f.fire(f.$('resume-gallery'),'click');assert.equal(f.reloads,1);
});
test('a text-reading visitor is not forced back into the 3D view when loading finishes',()=>{
  const {f,ui,controller}=boot();f.fire(f.groups['[data-show-text]'][0],'click');ui.attach(controller);
  assert.equal(f.document.documentElement.dataset.view,'static');assert.equal(f.$('resume-gallery').hidden,false);
  f.fire(f.$('resume-gallery'),'click');assert.equal(f.document.documentElement.dataset.view,'3d');
});
test('the workshop opens within the page and restores focus and scrolling when closed',async()=>{
  const {f,calls,ui,controller}=boot();ui.attach(controller);f.document.body.style.overflow='auto';const opener=f.$('open-workshop');
  f.fire(opener,'click');await Promise.resolve();await Promise.resolve();
  assert.equal(f.$('workshop-dialog').open,true);assert.equal(f.document.body.style.overflow,'hidden');assert.ok(calls.includes('workshop-open'));
  assert.ok(calls.includes('gallery-pause'));
  f.fire(f.$('workshop-close'),'click');assert.equal(f.$('workshop-dialog').open,false);assert.equal(f.document.body.style.overflow,'auto');assert.equal(opener.focused,true);assert.ok(calls.includes('workshop-pause'));
  assert.ok(calls.includes('gallery-resume'));
});
test('a failed gallery import is caught by the inline bootstrap',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),f=fixture();let failed=false;
  let code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].trim();
  code=code.replace("import('./interface.js')",'Promise.resolve({initInterface:()=>ui})').replace("import('./gallery.js')","Promise.reject(new Error('network failed'))");
  await new Function('document','ui','return '+code)(f.document,{wantsText:()=>false,fail:()=>{failed=true;}});
  assert.equal(failed,true);
  assert.ok(html.includes('data-view="static"'));assert.equal([...html.matchAll(/class="text-room"/g)].length,6);
});
test('fresh reload disables scroll restoration and starts 3D from the opening',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),f=fixture();
  const head=html.match(/<script>([\s\S]*?)<\/script>/)[1],calls=[],history={scrollRestoration:'auto',state:null,replaceState(...args){calls.push(args);}};
  new Function('history','location','performance',head)(history,{hash:'#room-water',pathname:'/',search:''},{getEntriesByType:()=>[{type:'reload'}]});
  assert.equal(history.scrollRestoration,'manual');assert.deepEqual(calls,[[null,'','/']]);
  let code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].trim();
  const order=[],position={offset:3500};
  code=code.replace("import('./interface.js')",'Promise.resolve({initInterface:()=>ui})').replace("import('./gallery.js')",'Promise.resolve({initGallery:()=>{order.push(position.offset);return {};}})');
  await new Function('document','window','ui','order','position','return '+code)(f.document,{scrollTo(options){order.push(options.top);position.offset=options.top;}},{wantsText:()=>false,attach(){order.push('attached');},fail(error){throw error;}},order,position);
  assert.deepEqual(order,[0,0,'attached']);assert.equal(f.document.documentElement.dataset.view,'3d');
});
