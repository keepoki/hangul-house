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
import { createPerformanceGovernor } from '../dist/adaptive-quality.js';

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
let renderedScene,renderedCamera,lastScroll,clock=0,renderCount=0,initialFrame;
class Renderer {
  constructor(){this.domElement=element('canvas');this.shadowMap={};}
  setClearColor(){}setPixelRatio(){}setSize(w,h){this.width=w;this.height=h;}
  render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);renderedScene=s;renderedCamera=c;renderCount++;if(!initialFrame){const maps=new Set();s.traverseVisible(o=>{if(o.isMesh)for(const k of ['map','normalMap','roughnessMap'])if(o.material[k]?.isDataTexture)maps.add(o.material[k]);});initialFrame={position:c.position.clone(),visibleSpots:s.children.filter(o=>o.isSpotLight&&o.visible).length,maxMapSize:Math.max(...[...maps].map(m=>m.image.width))};}}
}
const THREE={...Three,WebGLRenderer:Renderer},errors=[];
const media={matches:false,addEventListener(){}};
const boot=new Function('THREE','sampleTour','fitTourPose','chapterAt','stops','tourGlyphs','exhibitionSites','buildHangulBuilding','createEnvironment','createReflectingPool','batchStaticBoxes','detailCount','pickVisibleArtwork','chapters','document','matchMedia','innerWidth','innerHeight','devicePixelRatio','scrollY','scrollTo','addEventListener','requestAnimationFrame','ResizeObserver','performance','location','console','createPerformanceGovernor','initOptions',source+'\nreturn (async()=>{const controls=await initGallery(initOptions);return {sample(p,time){progress=desired=p;draw(time);return {position:camera.position.clone(),direction:camera.getWorldDirection(new THREE.Vector3())};},tick:draw,controls,reinitialize:()=>initGallery(initOptions),inspect:()=>({width:renderer.width,height:renderer.height,aspect:camera.aspect})};})()');
const app=await boot(THREE,sampleTour,fitTourPose,chapterAt,stops,tourGlyphs,exhibitionSites,buildHangulBuilding,createEnvironment,createReflectingPool,batchStaticBoxes,detailCount,pickVisibleArtwork,chapters,document,()=>media,1440,900,1,3500,v=>lastScroll=v,(type,fn)=>handlers.set('window:'+type,fn),()=>1,class{observe(){}},{now:()=>0},{reload(){}},{error:(...a)=>errors.push(a.join(' '))},createPerformanceGovernor);
function sample(p){clock+=17;return app.sample(p,clock);}
function settle(){for(let i=0;i<100;i++){clock+=17;app.tick(clock);}}
function artwork(char){let found;renderedScene.traverse(o=>{if(o.userData.artGlyph===char&&o.isGroup)found=o;});return found;}
function projectedBounds(object,camera=renderedCamera){
  const bounds=new Three.Box3().setFromObject(object),points=[];
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new Three.Vector3(x,y,z).project(camera));
  return {height:Math.max(...points.map(v=>v.y))-Math.min(...points.map(v=>v.y)),points};
}
sample(0);

test('the first render ignores a restored mid-tour offset and has only opening assets',()=>{
  assert.ok(initialFrame.position.distanceTo(renderedCamera.position)<.001);
  assert.equal(initialFrame.visibleSpots,2);assert.equal(initialFrame.maxMapSize,512);
  assert.ok(renderedScene.children.filter(o=>o.isSpotLight).every(o=>o.intensity===0));
  app.controls.refresh();settle();assert.equal(element('tour-progress').textContent,'0%');assert.equal(lastScroll.top,0);
  // A stale position is ignored through repeated scroll/resize events until genuine input.
  handlers.get('window:scroll')();settle();assert.equal(element('tour-progress').textContent,'0%');
  handlers.get('window:wheel')({type:'wheel',isTrusted:false});handlers.get('window:scroll')();settle();assert.equal(element('tour-progress').textContent,'0%');
  handlers.get('window:wheel')({type:'wheel',isTrusted:true});handlers.get('window:scroll')();settle();assert.equal(element('tour-progress').textContent,'65%');
  sample(stops[1]);assert.equal(renderedScene.children.filter(o=>o.isSpotLight&&o.visible).length,2);
});

test('all six independent installations have a complete, centered close-up',()=>{
  assert.deepEqual(errors,[]);
  for(let i=0;i<tourGlyphs.length;i++){
    const object=artwork(tourGlyphs[i]);assert.ok(object);
    sample(stops[i+1]);const close=projectedBounds(object),pose=sampleTour(stops[i+1]);
    assert.equal(pose.focus,1);
    assert.ok(close.height>.9,`${tourGlyphs[i]} must occupy at least 45% of the image height`);
    assert.ok(close.points.every(v=>Math.abs(v.x)<1&&Math.abs(v.y)<1&&v.z>-1&&v.z<1),`${tourGlyphs[i]} must fit the close-up frame`);
    const center=new Three.Box3().setFromObject(object).getCenter(new Three.Vector3()).project(renderedCamera);
    assert.ok(Math.abs(center.x)<.12&&(i===1?center.y>.10&&center.y<.50:Math.abs(center.y)<.12),`${tourGlyphs[i]} must remain compositionally framed`);
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
  assert.ok(water.meshes<200);assert.ok(water.triangles<50000);
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
  sample(stops[1]);assert.equal(artwork(tourGlyphs[0]).visible,true);assert.ok(tourGlyphs.some(char=>!artwork(char).visible));
});
test('the first gallery transition activates only the stone room, with no sudden load from other galleries',t=>{
  const visible=()=>{const zones=[],meshes=[];renderedScene.traverseVisible(o=>{if(o.userData.exhibitionTheme)zones.push(o.userData.exhibitionTheme);if(o.isMesh)meshes.push(o);});return {zones,meshes};};
  sample(0);const opening=visible();sample(.04);const first=visible();
  assert.deepEqual(first.zones,['stone']);assert.ok(first.meshes.length-opening.meshes.length<=22);
  t.diagnostic(`Opening to first gallery: ${opening.meshes.length} -> ${first.meshes.length} meshes`);
  sample(.13);assert.deepEqual(visible().zones,['stone']);sample(.20);assert.deepEqual(visible().zones,['stone','water']);sample(.26);assert.deepEqual(visible().zones,['water']);
  for(let p=.04;p<.95;p+=.005){sample(p);assert.ok(visible().zones.length<=2);}
});
test('water court includes distinct high-detail rock islands, a mirror pool and visible stepping stones',()=>{
  sample(stops[2]);let zone;renderedScene.traverseVisible(o=>{if(o.userData.exhibitionTheme==='water')zone=o;});assert.ok(zone);
  const rocks=zone.children.filter(o=>o.userData.environmentDetail==='natural-stone');assert.equal(rocks.length,14);assert.equal(new Set(rocks.map(o=>o.geometry.uuid)).size,14);
  assert.ok(rocks.every(o=>o.material.vertexColors&&o.material.normalMap&&o.material.roughnessMap));
  const major=rocks.filter(o=>o.geometry.getAttribute('position').count>4000);assert.ok(major.length>=4);
  const camera=renderedCamera,points=major.map(o=>o.getWorldPosition(new Three.Vector3()).project(camera));assert.ok(points.some(p=>p.x<-.15&&p.x>-1.1&&p.y>-1.1));assert.ok(points.some(p=>p.x>.15&&p.x<1.1&&p.y>-1.1));
  const pool=zone.children.find(o=>o.userData.environmentDetail==='reflecting-pool');assert.ok(pool);const poolCenter=pool.getWorldPosition(new Three.Vector3()),center=poolCenter.clone().project(camera);assert.ok(center.y>-1&&center.y<0);
  const ringCenter=new Three.Box3().setFromObject(artwork(tourGlyphs[1])).getCenter(new Three.Vector3());ringCenter.y=2*poolCenter.y-ringCenter.y;const mirrorCenter=ringCenter.clone().project(camera);
  assert.ok(mirrorCenter.y>-1&&mirrorCenter.y<-.25,'The reflected ring must be visible in the bottom half of the camera frame');
  const ray=new Three.Raycaster(camera.position,ringCenter.sub(camera.position).normalize()),visible=[];renderedScene.traverseVisible(o=>{if(o.isMesh&&o.material.opacity>.9)visible.push(o);});
  assert.equal(ray.intersectObjects(visible,false)[0]?.object,pool,'The stepping path must not obscure the central reflection');
});
test('premium PBR materials and environment are restored with a fixed number of visible shadow lights',()=>{
  for(const p of stops){sample(p);let shadows=0,pbr=0,spots=0;renderedScene.traverseVisible(o=>{if(o.isLight){if(o.castShadow){shadows++;assert.equal(o.shadow.autoUpdate,false);}if(o.isSpotLight)spots++;}if(o.isMesh&&(o.material.isMeshStandardMaterial||o.material.isMeshPhysicalMaterial))pbr++;});
    assert.equal(spots,2);assert.equal(shadows,3);assert.ok(pbr>15);assert.ok(renderedScene.environment.isCubeTexture);
  }
});
test('hidden shader preparation preserves image captions while compiling and warming every room',async()=>{
  element('tour-progress').textContent='26%';element('story-title').innerHTML='WATER IMAGE';element('view-label').textContent='WATER IMAGE';
  const events=[],steps=[],warmFrames=[],shadowBuilds=[];let active=true;
  class ShaderRenderer extends Renderer{
    constructor(){super();this.isWebGLRenderer=true;this.extensions={has:name=>name==='KHR_parallel_shader_compile'};this.viewport=new Three.Vector4(0,0,1200,900);this.scissor=this.viewport.clone();this.state={buffers:{depth:{setMask(){}}}};this.target=null;}
    setViewport(x,y,w,h){this.viewport.set(x,y,w,h);}getViewport(target){return target.copy(this.viewport);}
    setScissor(x,y,w,h){this.scissor.set(x,y,w,h);}getScissor(target){return target.copy(this.scissor);}
    setScissorTest(value){this.scissorTest=value;}getScissorTest(){return !!this.scissorTest;}
    getRenderTarget(){return this.target;}setRenderTarget(target){this.target=target;}clear(){}
    async compileAsync(object,camera,scene){assert.ok(object.isMesh||object.isPoints);assert.ok(scene.isScene);events.push('compile');}
    render(s,c){if(this.shadowMap.needsUpdate){s.traverseVisible(o=>{if(o.isLight&&o.castShadow&&o.shadow.needsUpdate){shadowBuilds.push(o.userData.artGlyph??'pavilion');o.shadow.needsUpdate=false;}});this.shadowMap.needsUpdate=false;}
      if(this.target){events.push('reflection');assert.equal(this.target.width,1024);}
      else if(this.scissorTest){events.push('warm');const zones=[];s.traverseVisible(o=>{if(o.userData.exhibitionTheme)zones.push(o.userData.exhibitionTheme);});warmFrames.push(zones);assert.equal(this.viewport.z,96);assert.equal(element('tour-progress').textContent,'26%');}else{events.push('render');assert.equal(this.viewport.z,1200);}super.render(s,c);}
  }
  document.documentElement.dataset.view='loading';document.documentElement.dataset.state='loading';
  try{
    const run=await boot({...Three,WebGLRenderer:ShaderRenderer},sampleTour,fitTourPose,chapterAt,stops,tourGlyphs,exhibitionSites,buildHangulBuilding,createEnvironment,createReflectingPool,batchStaticBoxes,detailCount,pickVisibleArtwork,chapters,document,()=>media,1440,900,1,0,()=>{},()=>{},callback=>{setTimeout(()=>{if(active){events.push('yield');callback(performance.now());}},0);return 1;},class{observe(){}},{now:()=>0},{reload(){}},console,createPerformanceGovernor,{onProgress:(n,phase)=>steps.push([n,phase])});
    assert.ok(run.controls);assert.equal(events.at(-1),'render');assert.equal(events.filter(e=>e==='render').length,1);
    assert.ok(events.filter(e=>e==='compile').length>=5);assert.ok(events.filter(e=>e==='yield').length>=9);assert.deepEqual(steps[0],[22,'scene']);assert.deepEqual(steps.at(-1),[100,'ready']);assert.ok(steps.some(([n,phase])=>phase==='frame'&&n===96));
    assert.equal(warmFrames.length,6);assert.deepEqual(warmFrames.map(z=>z[0]),exhibitionSites.map(site=>site.theme));assert.ok(warmFrames.every(z=>z.length===1));assert.equal(element('tour-progress').textContent,'26%');assert.equal(element('story-title').innerHTML,'WATER IMAGE');assert.equal(element('view-label').textContent,'WATER IMAGE');
    assert.deepEqual(shadowBuilds.slice().sort(),['pavilion',...exhibitionSites.map(site=>site.char)].sort());assert.equal(events.filter(e=>e==='reflection').length,1);assert.ok(steps.some(([n,phase])=>phase==='materials'));
  }finally{active=false;document.documentElement.dataset.view='3d';document.documentElement.dataset.state='ready';}
});

test('retrying a disposed gallery rebuilds a correctly sized and illuminated exhibition',async()=>{
  app.controls.dispose();await app.reinitialize();sample(.26);
  assert.deepEqual(app.inspect(),{width:1200,height:900,aspect:4/3});
  assert.equal(renderedScene.children.filter(o=>o.isSpotLight).length,6);
  assert.ok(renderedScene.children.some(o=>o.isSpotLight&&o.userData.artGlyph==='ㅇ'&&o.intensity>500),'The new water gallery must have its own accent light');
});

test('a failed first render disposes the partially created graphics resources',async()=>{
  let disposed=0;class FailedRenderer extends Renderer{render(){throw new Error('GPU upload failed');}dispose(){disposed++;}}
  await assert.rejects(boot({...Three,WebGLRenderer:FailedRenderer},sampleTour,fitTourPose,chapterAt,stops,tourGlyphs,exhibitionSites,buildHangulBuilding,createEnvironment,createReflectingPool,batchStaticBoxes,detailCount,pickVisibleArtwork,chapters,document,()=>media,1440,900,1,0,()=>{},()=>{},()=>1,class{observe(){}},{now:()=>0},{reload(){}},console,createPerformanceGovernor),/GPU upload failed/);
  assert.equal(disposed,1);
});
