import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as Three from '../dist/assets/three.module.js';
import { sampleTour, chapterAt, tourStops as stops, tourGlyphs } from '../dist/camera-tour.js';

// Construct the actual scene with a non-GPU renderer so camera framing can be checked.
const source=(await readFile(new URL('../dist/gallery.js',import.meta.url),'utf8')).replace(/^import[^;]+;\s*/gm,'');
const handlers=new Map(),elements=new Map();
function element(id='') {
  if(elements.has(id))return elements.get(id);
  const e={id,style:{},dataset:{},attrs:{},hidden:true,open:false,classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',appendChild(){},addEventListener(type,fn){handlers.set(id+':'+type,fn);},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},showModal(){},close(){},getBoundingClientRect:()=>({width:1200,height:900,left:0,top:0,right:1200,bottom:900})};
  elements.set(id,e);return e;
}
const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){},fillText(){}};
const canvas=()=>({width:0,height:0,getContext:()=>context});
const document={getElementById:element,querySelector:element,querySelectorAll:()=>[],createElement:canvas,documentElement:{scrollHeight:6300}};
let renderedScene,renderedCamera,lastScroll,clock=0;
class Renderer {
  constructor(){this.domElement=element('canvas');this.shadowMap={};}
  setClearColor(){}setPixelRatio(){}setSize(){}
  render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);renderedScene=s;renderedCamera=c;}
}
const THREE={...Three,WebGLRenderer:Renderer},errors=[];
const media={matches:false,addEventListener(){}};
const boot=new Function('THREE','sampleTour','chapterAt','stops','tourGlyphs','document','matchMedia','innerWidth','innerHeight','devicePixelRatio','scrollY','scrollTo','addEventListener','requestAnimationFrame','ResizeObserver','performance','location','console',source+'\nreturn {sample(p,time){progress=desired=p;draw(time);return {position:camera.position.clone(),direction:camera.getWorldDirection(new THREE.Vector3())};},tick:draw};');
const app=boot(THREE,sampleTour,chapterAt,stops,tourGlyphs,document,()=>media,1440,900,1,0,v=>lastScroll=v,()=>{},()=>1,class{observe(){}},{now:()=>0},{reload(){}},{error:(...a)=>errors.push(a.join(' '))});
function sample(p){clock+=17;return app.sample(p,clock);}
function settle(){for(let i=0;i<100;i++){clock+=17;app.tick(clock);}}
function artwork(char){let found;renderedScene.traverse(o=>{if(o.userData.artGlyph===char&&o.isGroup)found=o;});return found;}
function projectedBounds(object,camera=renderedCamera){
  const bounds=new Three.Box3().setFromObject(object),points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new Three.Vector3(x,y,z).project(camera));
  return {height:Math.max(...points.map(v=>v.y))-Math.min(...points.map(v=>v.y)),points};
}

test('all six works have a centered, visibly enlarged close-up',()=>{
  assert.deepEqual(errors,[]);
  for(let i=0;i<tourGlyphs.length;i++){
    sample(0);const object=artwork(tourGlyphs[i]);assert.ok(object);
    const wide=projectedBounds(object);
    sample(stops[i+1]);const close=projectedBounds(object),pose=sampleTour(stops[i+1]);
    assert.equal(pose.focus,1);
    assert.ok(close.height>wide.height*2.5,`${tourGlyphs[i]} must grow substantially on screen`);
    assert.ok(close.points.every(v=>Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z>-1&&v.z<1),`${tourGlyphs[i]} must fit the close-up frame`);
    const center=new Three.Box3().setFromObject(object).getCenter(new Three.Vector3()).project(renderedCamera);
    assert.ok(Math.abs(center.x)<.12&&Math.abs(center.y)<.12,`${tourGlyphs[i]} must remain centered`);
    const selected=renderedScene.children.find(o=>o.isSpotLight&&o.userData.artGlyph===tourGlyphs[i]);
    assert.ok(selected.intensity>155,'The selected work should receive the strongest accent');
  }
});
test('mobile close-ups fit all six complete sculptures',()=>{
  for(let i=0;i<tourGlyphs.length;i++){
    const pose=sampleTour(stops[i+1],{mobile:true});
    const camera=new Three.PerspectiveCamera(pose.fov,390/500,.1,150);
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld(true);
    const bounds=projectedBounds(artwork(tourGlyphs[i]),camera);
    assert.ok(bounds.points.every(v=>Math.abs(v.x)<.98&&Math.abs(v.y)<.98),`${tourGlyphs[i]} must fit on a phone`);
  }
});
test('zoom buttons dolly closer, respect limits and restore the current view',()=>{
  sample(stops[2]);const target=new Three.Vector3(...sampleTour(stops[2]).target);
  const before=renderedCamera.position.distanceTo(target);
  handlers.get('zoom-in:click')();settle();
  assert.ok(renderedCamera.position.distanceTo(target)<before*.9);
  assert.equal(element('zoom-value').textContent,'115%');
  for(let i=0;i<20;i++)handlers.get('zoom-in:click')();settle();
  assert.equal(element('zoom-value').textContent,'180%');assert.equal(element('zoom-in').disabled,true);
  handlers.get('zoom-reset:click')();settle();assert.equal(element('zoom-value').textContent,'100%');
  assert.ok(Math.abs(renderedCamera.position.distanceTo(target)-before)<.001);
  for(let i=0;i<20;i++)handlers.get('zoom-out:click')();settle();
  assert.equal(element('zoom-value').textContent,'75%');assert.equal(element('zoom-out').disabled,true);
  handlers.get('zoom-reset:click')();settle();
});
test('clicking a sculpture navigates to its close-up',()=>{
  sample(0);
  const bar=artwork('ㄱ').children[0];
  const point=new Three.Box3().setFromObject(bar).getCenter(new Three.Vector3()).project(renderedCamera);
  handlers.get('stage:click')({clientX:(point.x+1)*600,clientY:(1-point.y)*450});
  assert.equal(lastScroll.top,stops[1]*(6300-900));
});
test('the route returns home, is continuous in both directions and respects reduced motion',()=>{
  const start=sample(0),end=sample(1);
  assert.ok(start.position.distanceTo(end.position)<1e-10);assert.ok(start.direction.distanceTo(end.direction)<1e-10);
  let previous=sampleTour(0).position;
  for(let i=1;i<=2000;i++){
    const p=i/2000,a=sampleTour(p),b=sampleTour(1-(2000-i)/2000);
    assert.ok(a.position.every(Number.isFinite));assert.ok(new Three.Vector3(...a.position).distanceTo(new Three.Vector3(...previous))<.7);
    assert.ok(a.position.every((v,j)=>Math.abs(v-b.position[j])<1e-10));previous=a.position;
  }
  assert.deepEqual(sampleTour(.245,{reducedMotion:true}),sampleTour(.275,{reducedMotion:true}));
});
test('every close-up has a navigation button',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.equal([...html.matchAll(/data-stop="\d+"/g)].length,stops.length);
});
