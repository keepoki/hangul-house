import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './dom-fixture.mjs';
import {chapters} from '../dist/exhibition-content.js';
const original=await readFile(new URL('../dist/interface.js',import.meta.url),'utf8');
function boot(options,{readFirst=false}={}){
  const f=fixture(),calls=[];
  f.$('viewing-menu').querySelector=()=>f.$('viewing-menu-summary');
  if(readFirst)f.document.documentElement.dataset.readFirst='true';
  const workshop={open(){calls.push('workshop-open');},pause(){calls.push('workshop-pause');}};
  const source=original.replace(/^export\s+/gm,'').replace("import('./workshop.js')",'Promise.resolve({createWorkshop:()=>fakeWorkshop})');
  const init=new Function('document','addEventListener','requestAnimationFrame','scrollY','scrollTo','location','setTimeout','clearTimeout','fakeWorkshop','console','options',source+'\nreturn initInterface(options);');
  const ui=init(f.document,f.window.addEventListener.bind(f.window),fn=>{fn();return 1;},350,f.scrollTo,f.location,f.time,f.clear,workshop,{warn(){}},options);
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
test('exploring a structural part pauses the gallery and returns focus and view after closing',()=>{
  const {f,ui,calls,controller}=boot();ui.attach(controller);
  const opener=f.$('structure-action'),structure=f.$('structure-dialog'),figure=f.$('structure-figure');
  f.fire(opener,'click');
  assert.equal(structure.open,true);
  assert.ok(calls.includes('gallery-pause'));
  assert.equal(figure.dataset.selection,'whole');
  for(const [part,role] of [['giyeok','기둥'],['mieum','입구'],['siot','지붕'],['ieung','창']]){
    const control=f.$('part-'+part);
    f.fire(control,'click');
    assert.equal(figure.dataset.selection,part);
    assert.equal(control.attrs['aria-pressed'],'true');
    assert.match(f.$('structure-part-title').textContent,new RegExp(role));
  }
  assert.equal(f.$('part-giyeok').attrs['aria-pressed'],'false');
  f.fire(f.$('structure-reset'),'click');
  assert.equal(figure.dataset.selection,'whole');
  f.fire(f.$('structure-close'),'click');
  assert.equal(structure.open,false);
  assert.equal(opener.focused,true);
  assert.ok(calls.includes('gallery-resume'));
  assert.equal(f.document.documentElement.dataset.view,'3d');
});
test('manual viewing choices close the menu and the remembered mode is reflected in its radios',()=>{
  const choices=[],{f,ui}=boot({onModeChange:value=>choices.push(value)});
  f.$('viewing-menu').open=true;const images=f.$('mode-images');images.checked=true;f.fire(images,'change');
  assert.deepEqual(choices,['images']);assert.equal(f.$('viewing-menu').open,false);
  assert.equal(f.$('viewing-menu-summary').focused,true);
  ui.setViewingState({preference:'images',active:'images',status:'이미지 관람'});
  assert.equal(f.$('mode-images').checked,true);assert.equal(f.$('mode-auto').checked,false);assert.equal(f.$('viewing-current').textContent,'이미지');
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
test('the interface preserves a text tour opened before its module loaded',()=>{
  const {f,ui,controller}=boot(undefined,{readFirst:true});
  assert.equal(ui.wantsText(),true);
  ui.attach(controller,{view:'images'});
  assert.equal(f.document.documentElement.dataset.view,'static');
  assert.equal(f.$('resume-gallery').hidden,false);
});
test('the text tour names the previous viewing mode on its return button',()=>{
  for(const [view,mode] of [['images','이미지'],['3d','3D']]){
    const {f,ui,controller}=boot();
    ui.attach(controller,{view});
    f.fire(f.groups['[data-show-text]'][0],'click');
    assert.equal(f.$('resume-gallery').textContent,mode+' 관람으로 돌아가기');
    f.fire(f.$('resume-gallery'),'click');
    assert.equal(f.document.documentElement.dataset.view,view);
  }
});
test('gallery copy retains a space where mobile hides the line break',()=>{
  for(const {title,body} of chapters){
    assert.doesNotMatch(title,/<br>\S/);
    assert.doesNotMatch(body,/<br>\S/);
  }
});
test('the workshop opens within the page and restores focus and scrolling when closed',async()=>{
  const {f,calls,ui,controller}=boot();ui.attach(controller);f.document.body.style.overflow='auto';const opener=f.$('open-workshop');
  f.fire(opener,'click');await Promise.resolve();await Promise.resolve();
  assert.equal(f.$('workshop-dialog').open,true);assert.equal(f.document.body.style.overflow,'hidden');assert.ok(calls.includes('workshop-open'));
  assert.ok(calls.includes('gallery-pause'));
  f.fire(f.$('workshop-close'),'click');assert.equal(f.$('workshop-dialog').open,false);assert.equal(f.document.body.style.overflow,'auto');assert.equal(opener.focused,true);assert.ok(calls.includes('workshop-pause'));
  assert.ok(calls.includes('gallery-resume'));
});
test('an unavailable viewing module retains the readable exhibition and a retry action',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),f=fixture();
  let code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].trim();
  code=code.replace("import('./viewing-mode.js')","return Promise.reject(new Error('network failed'))");
  await new Function('document',code)(f.document);
  assert.equal(f.document.documentElement.dataset.view,'static');assert.equal(f.$('failure-actions').hidden,false);
  assert.ok(html.includes('data-view="static"'));assert.equal([...html.matchAll(/class="text-room"/g)].length,6);
});
test('fresh reload disables scroll restoration and shows the arrival screen',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),f=fixture();
  const head=html.match(/<script>([\s\S]*?)<\/script>/)[1],calls=[],history={scrollRestoration:'auto',state:null,replaceState(...args){calls.push(args);}};
  new Function('history','location','performance','document',head)(history,{hash:'#room-water',pathname:'/',search:''},{getEntriesByType:()=>[{type:'reload'}]},f.document);
  assert.equal(history.scrollRestoration,'manual');assert.deepEqual(calls,[[null,'','/']]);assert.equal(f.document.documentElement.dataset.view,'loading');
  let code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].trim();
  let started=false;
  code=code.replace("import('./viewing-mode.js')",'return Promise.resolve({startViewing})');
  await new Function('document','startViewing',code)(f.document,()=>{started=true;return {ready:Promise.resolve()};});
  assert.equal(started,true);assert.equal(f.document.documentElement.dataset.state,'loading');
});
test('the arrival text button can open the text tour before dynamic imports resolve',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),f=fixture();
  const head=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function('history','location','performance','document',head)({}, {hash:''}, {}, f.document);
  f.$('experience').inert=true;
  const click=new Event('click');
  Object.defineProperty(click,'target',{value:{closest:selector=>selector==='.loading-text-link'}});
  f.document.dispatchEvent(click);
  assert.equal(f.document.documentElement.dataset.view,'static');
  assert.equal(f.document.documentElement.dataset.readFirst,'true');
  assert.equal(f.$('experience').inert,false);
  assert.equal(f.$('text-tour').focused,true);
});
