import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as Three from '../dist/assets/three.module.js';
import { sampleTour, fitTourPose, chapterAt, tourStops as stops, tourGlyphs } from '../dist/camera-tour.js';
import { exhibitionSites } from '../dist/exhibition-layout.js';
import { buildHangulBuilding } from '../dist/hangul-building.js';
import { chapters } from '../dist/exhibition-content.js';
import { createEnvironment, createReflectingPool } from '../dist/environment.js';
import { batchStaticBoxes, detailCount, pickVisibleArtwork } from '../dist/scene-quality.js';

// Construct the actual scene with a non-GPU renderer so camera framing can be checked.
const source=(await readFile(new URL('../dist/gallery.js',import.meta.url),'utf8')).replace(/^import[^;]+;\s*/gm,'').replace(/^export\s+/gm,'');
const handlers=new Map(),elements=new Map();
function element(id='') {
  if(elements.has(id))return elements.get(id);
  const e={id,style:{},dataset:{},attrs:{},hidden:true,open:false,classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',appendChild(){},addEventListener(type,fn){handlers.set(id+':'+type,fn);},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},showModal(){},close(){},getBoundingClientRect:()=>({width:1200,height:900,left:0,top:0,right:1200,bottom:900})};
  elements.set(id,e);return e;
}
const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},fillRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){},fillText(){}};
const canvas=()=>({width:0,height:0,getContext:()=>context});
const document={getElementById:element,querySelector:element,querySelectorAll:()=>[],createElement:canvas,addEventListener(){},hidden:false,documentElement:{scrollHeight:6300,dataset:{view:'3d'}}};
let renderedScene,renderedCamera,lastScroll,clock=0,renderCount=0;
class Renderer {
  constructor(){this.domElement=element('canvas');this.shadowMap={};}
  setClearColor(){}setPixelRatio(){}setSize(){}
  render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);renderedScene=s;renderedCamera=c;renderCount++;}
}
const THREE={...Three,WebGLRenderer:Renderer},errors=[];
const media={matches:false,addEventListener(){}};
const boot=new Function('THREE','sampleTour','fitTourPose','chapterAt','stops','tourGlyphs','exhibitionSites','buildHangulBuilding','createEnvironment','createReflectingPool','batchStaticBoxes','detailCount','pickVisibleArtwork','chapters','document','matchMedia','innerWidth','innerHeight','devicePixelRatio','scrollY','scrollTo','addEventListener','requestAnimationFrame','ResizeObserver','performance','location','console',source+'\nconst controls=initGallery();return {sample(p,time){progress=desired=p;draw(time);return {position:camera.position.clone(),direction:camera.getWorldDirection(new THREE.Vector3())};},tick:draw,controls};');
const app=boot(THREE,sampleTour,fitTourPose,chapterAt,stops,tourGlyphs,exhibitionSites,buildHangulBuilding,createEnvironment,createReflectingPool,batchStaticBoxes,detailCount,pickVisibleArtwork,chapters,document,()=>media,1440,900,1,0,v=>lastScroll=v,()=>{},()=>1,class{observe(){}},{now:()=>0},{reload(){}},{error:(...a)=>errors.push(a.join(' '))});
function sample(p){clock+=17;return app.sample(p,clock);}
function settle(){for(let i=0;i<100;i++){clock+=17;app.tick(clock);}}
function artwork(char){let found;renderedScene.traverse(o=>{if(o.userData.artGlyph===char&&o.isGroup)found=o;});return found;}
function projectedBounds(object,camera=renderedCamera){
  const bounds=new Three.Box3().setFromObject(object),points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new Three.Vector3(x,y,z).project(camera));
  return {height:Math.max(...points.map(v=>v.y))-Math.min(...points.map(v=>v.y)),points};
}
sample(0);

test('all six independent installations have a complete, centered close-up',()=>{
  assert.deepEqual(errors,[]);
  for(let i=0;i<tourGlyphs.length;i++){
    const object=artwork(tourGlyphs[i]);assert.ok(object);
    sample(stops[i+1]);const close=projectedBounds(object),pose=sampleTour(stops[i+1]);
    assert.equal(pose.focus,1);
    assert.ok(close.height>.9,`${tourGlyphs[i]} must occupy at least 45% of the image height`);
    assert.ok(close.points.every(v=>Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z>-1&&v.z<1),`${tourGlyphs[i]} must fit the close-up frame`);
    const center=new Three.Box3().setFromObject(object).getCenter(new Three.Vector3()).project(renderedCamera);
    assert.ok(Math.abs(center.x)<.12&&Math.abs(center.y)<.12,`${tourGlyphs[i]} must remain centered`);
    const selected=renderedScene.children.find(o=>o.isSpotLight&&o.userData.artGlyph===tourGlyphs[i]);
    assert.ok(selected.intensity>selected.userData.base,'The selected work should receive the strongest accent');
  }
});
test('mobile close-ups fit all six complete sculptures',()=>{
  for(let i=0;i<tourGlyphs.length;i++){
    const pose=fitTourPose(sampleTour(stops[i+1],{mobile:true}),new Three.Box3().setFromObject(artwork(tourGlyphs[i])),390/500);
    const camera=new Three.PerspectiveCamera(pose.fov,390/500,.1,150);
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld(true);
    const bounds=projectedBounds(artwork(tourGlyphs[i]),camera);
    assert.ok(bounds.points.every(v=>Math.abs(v.x)<.98&&Math.abs(v.y)<.98),`${tourGlyphs[i]} must fit on a phone`);
  }
});
test('zoom buttons dolly closer, respect limits and restore the current view',()=>{
  sample(stops[2]);const target=new Three.Vector3(...sampleTour(stops[2]).target);
  const before=renderedCamera.position.distanceTo(target);
  app.controls.changeZoom(.15);settle();
  assert.ok(renderedCamera.position.distanceTo(target)<before*.9);
  assert.equal(element('zoom-value').textContent,'115%');
  for(let i=0;i<20;i++)app.controls.changeZoom(.15);settle();
  assert.equal(element('zoom-value').textContent,'180%');assert.equal(element('zoom-in').disabled,true);
  app.controls.setZoom(1);settle();assert.equal(element('zoom-value').textContent,'100%');
  assert.ok(Math.abs(renderedCamera.position.distanceTo(target)-before)<.001);
  for(let i=0;i<20;i++)app.controls.changeZoom(-.15);settle();
  assert.equal(element('zoom-value').textContent,'75%');assert.equal(element('zoom-out').disabled,true);
  app.controls.setZoom(1);settle();
});
test('clicking a sculpture navigates to its close-up',()=>{
  sample(stops[1]);
  const bar=artwork('ㄱ').children[0];
  const point=new Three.Box3().setFromObject(bar).getCenter(new Three.Vector3()).project(renderedCamera);
  handlers.get('stage:click')({clientX:(point.x+1)*600,clientY:(1-point.y)*450});
  assert.equal(lastScroll.top,stops[1]*(6300-900));
});
test('portrait opening and closing frames fit the complete pavilion',()=>{
  let pavilion;renderedScene.traverse(o=>{if(o.userData.hangulBuilding)pavilion=o;});
  const bounds=new Three.Box3().setFromObject(pavilion);
  for(const aspect of [320/400,390/500,430/560,320/560,16/9])for(const p of [0,1]){
    const pose=fitTourPose(sampleTour(p,{mobile:aspect<1}),bounds,aspect),camera=new Three.PerspectiveCamera(pose.fov,aspect,.1,150);
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld(true);
    assert.ok(projectedBounds(pavilion,camera).points.every(v=>Math.abs(v.x)<.98&&Math.abs(v.y)<.98));
  }
});
test('hidden sculpture clicks are ignored and paused rendering performs no work',()=>{
  sample(0);lastScroll=undefined;
  for(const char of tourGlyphs){const point=new Three.Box3().setFromObject(artwork(char).children[0]).getCenter(new Three.Vector3()).project(renderedCamera);handlers.get('stage:click')({clientX:(point.x+1)*600,clientY:(1-point.y)*450});}
  assert.equal(lastScroll,undefined);
  app.controls.pause();const before=renderCount;sample(stops[2]);assert.equal(renderCount,before);
  app.controls.resume();sample(stops[2]);assert.ok(renderCount>before);
});
test('environment detail is concentrated near the selected gallery',t=>{
  const counts=()=>{let meshes=0,triangles=0,instances=0;renderedScene.traverseVisible(o=>{if(!o.isMesh)return;meshes++;const n=o.isInstancedMesh?o.count:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*n;if(o.userData.fullDetailCount)instances+=n;});return{meshes,triangles,instances};};
  sample(stops[2]);const water=counts();t.diagnostic('Water gallery scene: '+JSON.stringify(water));
  assert.ok(water.meshes<300);assert.ok(water.triangles<200000);
  const leaves=[];renderedScene.traverse(o=>{if(o.userData.environmentDetail==='leaves')leaves.push(o);});
  const distant=leaves.reduce((n,o)=>n+o.count,0);
  sample(stops[5]);const garden=leaves.reduce((n,o)=>n+o.count,0);
  assert.ok(garden>distant*2);assert.equal(garden,leaves.reduce((n,o)=>n+o.userData.fullDetailCount,0));
  assert.equal(detailCount(3100,10,'leaves'),3100);
});
test('opaque architecture prevents a sculpture from being picked through a wall',()=>{
  const scene=new Three.Scene(),sculpture=new Three.Group();sculpture.userData.artGlyph='work';scene.add(sculpture);
  const material=new Three.MeshBasicMaterial(),piece=new Three.Mesh(new Three.BoxGeometry(1,1,1),material),wall=new Three.Mesh(new Three.BoxGeometry(2,2,.2),material);
  sculpture.add(piece);wall.position.z=2;scene.add(wall);scene.updateMatrixWorld(true);
  const ray=new Three.Raycaster(new Three.Vector3(0,0,5),new Three.Vector3(0,0,-1));
  assert.equal(pickVisibleArtwork(Three,ray,[sculpture],[wall]),undefined);wall.visible=false;
  assert.equal(pickVisibleArtwork(Three,ray,[sculpture],[wall]),'work');sculpture.visible=false;
  assert.equal(pickVisibleArtwork(Three,ray,[sculpture],[wall]),undefined);
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
test('the reference-inspired house is built from Hangul structural forms',()=>{
  let building;renderedScene.traverse(o=>{if(o.userData.hangulBuilding)building=o;});
  assert.ok(building);
  assert.deepEqual(building.children.filter(o=>o.userData.structuralGlyph).map(o=>o.userData.structuralGlyph).sort(),['ㄱ','ㄴ','ㄷ','ㅁ','ㅅ','ㅇ'].sort());
  const circle=building.children.find(o=>o.userData.structuralGlyph==='ㅇ').children[0];
  assert.equal(circle.geometry.parameters.shapes.holes.length,1,'The circular window must be a real opening');
});
test('the six works sit outside the house in separate, differently themed galleries',()=>{
  const themes=[];let building;renderedScene.traverse(o=>{if(o.userData.exhibitionTheme)themes.push(o.userData.exhibitionTheme);if(o.userData.hangulBuilding)building=o;});
  assert.equal(new Set(themes).size,6);
  const houseBounds=new Three.Box3().setFromObject(building);
  for(let i=0;i<exhibitionSites.length;i++){
    const current=artwork(exhibitionSites[i].char);
    assert.equal(houseBounds.intersectsBox(new Three.Box3().setFromObject(current)),false,'Installations must not be inside the house');
    for(let j=i+1;j<exhibitionSites.length;j++)assert.ok(current.position.distanceTo(artwork(exhibitionSites[j].char).position)>15,'Installations need independent space');
  }
});
test('walls and scenery do not block the close-up camera',()=>{
  for(let i=0;i<exhibitionSites.length;i++){
    sample(stops[i+1]);const object=artwork(exhibitionSites[i].char),part=object.children[0];
    const local=part.geometry.type==='TorusGeometry'?new Three.Vector3(part.geometry.parameters.radius,0,0):exhibitionSites[i].char==='ㅁ'?new Three.Vector3(.74,0,0):new Three.Vector3();
    const point=part.localToWorld(local);
    const ray=new Three.Raycaster(renderedCamera.position,point.sub(renderedCamera.position).normalize());
    const hit=ray.intersectObjects(renderedScene.children,true).find(h=>h.object.material.opacity>.3);
    let selected=hit?.object;while(selected&&!selected.userData.artGlyph)selected=selected.parent;
    assert.equal(selected?.userData.artGlyph,exhibitionSites[i].char,'The work must be visible in front of its backdrop');
  }
});
test('the opening frame keeps foreground installations out of the architectural view',()=>{
  sample(0);for(const char of tourGlyphs)assert.equal(artwork(char).visible,false);
  sample(stops[1]);for(const char of tourGlyphs)assert.equal(artwork(char).visible,true);
});
