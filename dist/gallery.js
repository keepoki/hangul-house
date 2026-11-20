import * as THREE from './assets/three.module.js';
import { tourStops as stops, tourGlyphs, chapterAt, sampleTour, fitTourPose } from './camera-tour.js';
import { exhibitionSites } from './exhibition-layout.js';
import { buildHangulBuilding } from './hangul-building.js';
import { createEnvironment, createReflectingPool } from './environment.js';
import { batchStaticBoxes, detailCount, pickVisibleArtwork } from './scene-quality.js';
import { createPerformanceGovernor } from './adaptive-quality.js';

const $ = (id) => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
import { chapters } from './exhibition-content.js';
let progress = 0, desired = 0, chapter = -1, frame = 0, lastTime = 0;
let scene, camera, renderer, house, dust;
let stageWidth=0,stageHeight=0,stagePixelRatio=0;
let reflectingPool=null;
let governor=null,renderedAt=null,qualityChange=()=>{},performanceFallback=()=>{};
let interactionEvents=null;
let environmentDetail;
let heroBounds,paused=false,renderFailed=false;
let scrollEnabled=false;
const artworkBounds=[],detailMeshes=[],blockers=[];
let bright = false, textTimer, scrollHeight = 1;
let zoom = 1, desiredZoom = 1;
const lamps = [];
const sculptures = [];
const exhibitionGroups=[];
const stage = $('stage');
const clamp = THREE.MathUtils.clamp;
const setText=(id,value)=>{const el=$(id);if(el.textContent!==value)el.textContent=value;};
function measureScrollHeight(){scrollHeight=Math.max(1,document.documentElement.scrollHeight-innerHeight);}

function updateScroll() {
  if(document.documentElement.dataset.view!=='3d')return;
  if(!scrollEnabled){desired=0;if(Math.abs(scrollY)>1)scrollTo({top:0,left:0,behavior:'instant'});return;}
  desired = clamp(scrollY / scrollHeight, 0, 1);
  if(paused||renderFailed)return;
  if (motion.matches) { progress = desired; draw(performance.now()); }
  else requestDraw();
}
function goTo(p) {
  scrollEnabled=true;
  setZoom(1);
  measureScrollHeight();scrollTo({top:p*scrollHeight,behavior:motion.matches?'instant':'smooth'});
}
// A stale restoration, resize or programmatic scroll cannot move the first shot.
function permitUserScroll(e){
  if(scrollEnabled||document.documentElement.dataset.view!=='3d'||document.documentElement.dataset.state==='loading'||e?.isTrusted===false)return;
  if(e?.type==='keydown'&&(!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)||/INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(e.target?.tagName)||e.target?.isContentEditable))return;
  if(e?.type==='pointerdown'&&e.clientX<(document.documentElement.clientWidth??innerWidth))return;
  if(Math.abs(scrollY)>1)scrollTo({top:0,left:0,behavior:'instant'});
  scrollEnabled=true;
}
function setZoom(value) {
  desiredZoom = clamp(value,.75,1.8);
  if(motion.matches)zoom=desiredZoom;
  $('zoom-in').disabled=desiredZoom>=1.8;
  $('zoom-out').disabled=desiredZoom<=.75;
  setText('zoom-value',Math.round(desiredZoom*100)+'%');
  requestDraw();
}
function toggleLighting(){
  bright=!bright;
  $('light-toggle').setAttribute('aria-pressed',String(bright));
  $('light-toggle').setAttribute('aria-label',bright?'조명을 은은하게':'조명을 더 밝게');
  if(renderer)renderer.toneMappingExposure=bright?1.6:1.18;
  requestDraw();
}

function updateChapter(){
  const index=chapterAt(progress);if(index===chapter)return;chapter=index;
  const data=chapters[index];
  $('room-context').textContent=data.context;
  $('story-title').innerHTML=data.title;
  $('story-body').innerHTML=data.body;
  $('story-note').textContent=data.note;
  $('work-glyph').textContent=data.glyph;
  $('work-name').textContent=data.name;
  $('work-material').textContent=data.material;
  $('story-action').hidden=index!==7;
  $('structure-action').hidden=index!==0;
  document.querySelectorAll('[data-stop]').forEach((button,i)=>{
    button.classList.toggle('active',i===index);
    if(i===index){button.setAttribute('aria-current','step');const nav=button.parentElement;if(nav?.scrollWidth>nav.clientWidth){const left=button.offsetLeft-nav.offsetLeft; if(left<nav.scrollLeft||left+button.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollLeft=left-(nav.clientWidth-button.offsetWidth)/2;}}else button.removeAttribute('aria-current');
  });
  $('scroll-label').textContent=index===7?'처음부터 다시 관람':index===0?'아래로 스크롤해 관람':'다음 공간으로';
}

// All architecture, lettering, materials and lighting are generated locally.
function material(color, roughness=.7, metalness=0, map=null) {return new THREE.MeshStandardMaterial({color,roughness,metalness,map});}
function mesh(geometry,mat,x=0,y=0,z=0,parent=house) {
  const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(w,h,d,mat,x,y,z,parent=house) {return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
function stoneSlab(w,d,h,mat,x,y,z,parent){
  const s=new THREE.Shape(),a=w/2,b=d/2,r=.09;
  s.moveTo(-a+r,-b);s.lineTo(a-r,-b);s.quadraticCurveTo(a,-b,a,-b+r);s.lineTo(a,b-r);s.quadraticCurveTo(a,b,a-r,b);s.lineTo(-a+r,b);s.quadraticCurveTo(-a,b,-a,b-r);s.lineTo(-a,-b+r);s.quadraticCurveTo(-a,-b,-a+r,-b);
  const geo=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:true,bevelSize:.026,bevelThickness:.018,bevelSegments:2,curveSegments:5,steps:1});geo.translate(0,0,-h/2);geo.rotateX(-Math.PI/2);
  return mesh(geo,mat,x,y,z,parent);
}
function beam(a,b,r,mat,parent=house) {
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
  const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mat,0,0,0,parent);
  m.position.copy(from.add(to).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function bar(x1,y1,x2,y2,width,depth,mat,parent) {
  const length=Math.hypot(x2-x1,y2-y1);
  const m=mesh(new THREE.CapsuleGeometry(width/2,Math.max(0,length-width),7,18),mat,(x1+x2)/2,(y1+y2)/2,0,parent);
  m.rotation.z=-Math.atan2(x2-x1,y2-y1);m.scale.z=depth/width;return m;
}
function ring(radius,tube,mat,parent,x=0,y=0,z=0) {return mesh(new THREE.TorusGeometry(radius,tube,20,72),mat,x,y,z,parent);}
function squareRing(mat,parent) {
  const s=new THREE.Shape(), w=.92,h=1.04,r=.18;
  s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r);s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h);
  const hole=new THREE.Path(),a=.54,b=.66,k=.12;
  hole.moveTo(-a+k,-b);hole.lineTo(-a,-b+k);hole.lineTo(-a,b-k);hole.quadraticCurveTo(-a,b,-a+k,b);hole.lineTo(a-k,b);hole.quadraticCurveTo(a,b,a,b-k);hole.lineTo(a,-b+k);hole.quadraticCurveTo(a,-b,a-k,-b);hole.lineTo(-a+k,-b);s.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(s,{depth:.39,bevelEnabled:true,bevelThickness:.08,bevelSize:.07,bevelSegments:4,steps:1,curveSegments:14});g.translate(0,0,-.195);
  return mesh(g,mat,0,1.17,0,parent);
}
function glyph(type,mat,x,z,scale=1,rotation=0,base=1.08) {
  const g=new THREE.Group();house.add(g);g.position.set(x,base,z);g.scale.setScalar(scale);g.rotation.y=rotation;
  g.userData.artGlyph=type;sculptures.push(g);
  if(type==='ㄱ') {bar(-.8,2.1,.7,2.1,.39,.48,mat,g);bar(.7,2.1,.7,.12,.39,.48,mat,g);}
  if(type==='ㅇ') ring(.95,.23,mat,g,0,1.19,0);
  if(type==='ㅁ') squareRing(mat,g);
  if(type==='ㅅ') {bar(-.85,.15,0,2.12,.36,.43,mat,g);bar(0,2.12,.85,.15,.36,.43,mat,g);}
  if(type==='ㅎ') {bar(-.4,2.55,.4,2.55,.19,.35,mat,g);bar(-.72,2.14,.72,2.14,.21,.4,mat,g);ring(.64,.18,mat,g,0,.92,0);}
  if(type==='ㅏ') {bar(-.32,.15,-.32,2.2,.34,.4,mat,g);bar(-.32,1.23,.8,1.23,.31,.4,mat,g);}
  return g;
}
function plaque(text,x,z) {
  const c=document.createElement('canvas');c.width=128;c.height=64;
  const ctx=c.getContext('2d');ctx.fillStyle='#333028';ctx.fillRect(0,0,128,64);ctx.fillStyle='#b9a689';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(text,64,42);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
  const m=mesh(new THREE.PlaneGeometry(.57,.28),new THREE.MeshBasicMaterial({map:tex}),x,.79,z);return m;
}
function contactMaterial(){
  const n=32,bytes=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=(y*n+x)*4,d=Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1);bytes[k+3]=Math.round(Math.max(0,1-d)**2*205);}
  const map=new THREE.DataTexture(bytes,n,n);map.needsUpdate=true;map.magFilter=map.minFilter=THREE.LinearFilter;
  return new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,opacity:.65});
}
function lightArtwork(p,focus,reveal){
  let a=0;while(a<lamps.length-1&&p>stops[a+2])a++;
  const b=Math.min(lamps.length-1,a+1),t=a===b?0:THREE.MathUtils.smoothstep(p,stops[a+1],stops[b+1]);
  const second=a===b?Math.max(0,a-1):b;
  // The two active light slots always stay the same shader shape. The six actual static lamps
  // retain their own pre-rendered shadow maps, and switch visibility without rebuilding them.
  lamps.forEach((light,index)=>{light.visible=index===a||index===second;const weight=index===a?1-t:index===b?t:0;light.intensity=light.userData.base*weight*(1+.2*focus)*(bright?1.2:1)*reveal;});
}
function setup(onProgress) {
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#10100f',.018);
  camera=new THREE.PerspectiveCamera(35,1,.1,150);
  renderer=new THREE.WebGLRenderer({antialias:innerWidth>=761,alpha:true,powerPreference:'high-performance'});
  if(renderer.isWebGLRenderer)governor=createPerformanceGovernor({onChange:profile=>{stageWidth=0;reflectingPool?.setQuality(profile);resize();qualityChange(profile);},onFallback:()=>performanceFallback()});
  renderer.setClearColor('#10100f',0);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1.25:1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();failRendering(new Error('WebGL context lost'));});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{ /* Recovery is user-initiated, preserving workshop state. */ });
  house=new THREE.Group();scene.add(house);
  scene.fog.density=.009;
  // Generate the premium texture maps off the main thread, while the loader is still active.
  // The map upgrades are awaited before any scene render, including warm-up.
  let loadedMaps=0;environmentDetail=createEnvironment(THREE,{mobile:innerWidth<761,premium:true,progressive:renderer.isWebGLRenderer&&typeof window!=='undefined',onSurfaceReady:()=>onProgress(34+Math.round(++loadedMaps/Object.keys(environmentDetail.materials).length*18),'materials')});
  const {limestone,dark,floor,timber,hall,gravel,soil}=environmentDetail.materials;
  const blackMetal=material('#343632',.4,.45);
  const bronze=material('#c59c5e',.3,.68);
  const ivory=limestone.clone();ivory.color.set('#eee5d1');
  const gold=material('#d6ad65',.27,.63);
  const green=material('#6f8c7c',.48,.28);
  const ceramic=material('#e4e1d2',.32,.05);
  const strip=new THREE.MeshBasicMaterial({color:'#e5c79c',toneMapped:false});
  const glass=new THREE.MeshPhysicalMaterial({color:'#9da99d',metalness:.12,roughness:.16,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false});
  // Soft studio environment: locally painted light panels, warmed with the first shader family.
  const environmentFaces=['#a39c8b','#5b6264','#e5ddca','#1e2422','#9a8b73','#53626a'].map(color=>{
    const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,64,64);
    ctx.fillStyle='#b8ad96';ctx.fillRect(17,1,14,57);ctx.fillStyle='#ded7c5';ctx.fillRect(21,0,7,54);return c;
  });
  const environment=new THREE.CubeTexture(environmentFaces);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;scene.environment=environment;scene.environmentIntensity=.35;
  const ground=mesh(new THREE.PlaneGeometry(160,160),material('#20231f',.85),0,-.14,0,scene);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  box(68,.18,68,floor,0,-.1,0);
  const joint=material('#635f56',.95);
  for(let n=-32;n<=32;n+=4){box(.018,.007,67,joint,n,-.006,0);box(67,.007,.018,joint,0,-.006,n);}
  // The pavilion is one architectural exhibit in a much larger museum.
  box(17.7,.4,10.2,limestone,0,.2,0);
  box(17.25,.08,9.7,floor,0,.44,0);
  for(let i=0;i<3;i++){
    box(8,.12,1.0,limestone,.3,.32-i*.12,5.35+i*.55);
    box(7.9,.018,.025,strip,.3,.37-i*.12,5.85+i*.55);
  }
  const pavilion=buildHangulBuilding(THREE,house,{limestone,timber,charcoal:dark,glass,strip});
  heroBounds=new THREE.Box3().setFromObject(pavilion);
  // A high exhibition hall frames the route without enclosing the artworks in the house.
  box(68,11,.35,hall,0,5.4,-34);box(.35,11,68,hall,-34,5.4,0);box(.35,11,68,hall,34,5.4,0);
  for(let x=-30;x<=30;x+=6){
    box(.16,13.6,.18,blackMetal,x,6.7,-33.6);
    box(.04,5.2,.03,strip,x,6.7,-33.35);
  }
  for(const z of [-28,-14,0,14]){
    box(68,.2,.2,blackMetal,0,13.7,z);
    for(const x of [-33.6,33.6])box(.2,13.8,.2,blackMetal,x,6.8,z);
  }
  const ceiling=mesh(new THREE.PlaneGeometry(67,67),glass,0,13.8,0);ceiling.rotation.x=Math.PI/2;ceiling.castShadow=false;
  batchStaticBoxes(THREE,house);
  for(const object of house.children)if(object!==pavilion&&object.isMesh)object.castShadow=false;
  pavilion.traverse(o=>{if(o.isMesh&&o.material.transparent)o.castShadow=false;});
  const contact=contactMaterial();
  const displayMaterials={'ㄱ':ivory,'ㅇ':bronze,'ㅁ':timber,'ㅎ':gold,'ㅏ':green,'ㅅ':ceramic};
  for(const site of exhibitionSites) {
    const groupStart=house.children.length;
    const zone=new THREE.Group();zone.position.set(site.x,0,site.z);zone.rotation.y=site.rot;zone.name=site.room;zone.userData.exhibitionTheme=site.theme;house.add(zone);
    box(11.5,.2,10.2,site.theme==='quiet'?gravel:limestone,0,.04,0,zone);
    if(site.theme==='stone'){
      box(11,7,.4,hall,0,3.6,-3.8,zone);box(.4,7,4.7,hall,-5.4,3.6,-1.65,zone);
      for(let y=1.5;y<7;y+=1.8)box(10.9,.012,.015,joint,0,y,-3.59,zone);
      for(let x=-4.1;x<5;x+=2.75)box(.014,6.85,.014,joint,x,3.6,-3.585,zone);
      box(10.8,.035,.055,strip,0,.22,-3.53,zone);
      box(4,.35,.85,limestone,3.1,.4,3.2,zone);
    }
    if(site.theme==='water'){
      // A dark stone water court, with a softly lit wall for legible, architectural reflections.
      const waterWall=limestone.clone();waterWall.color.set('#b5b1a1');waterWall.roughness=.93;
      const recessLight=new THREE.MeshBasicMaterial({color:'#c7b78f',toneMapped:false});
      box(11.1,.14,9.8,dark,0,.17,0,zone);
      reflectingPool=createReflectingPool(THREE,zone,scene,renderer,11.1,9.8,innerWidth<761,true);
      for(const x of [-5.7,5.7]){box(.35,.35,10.4,dark,x,.16,0,zone);stoneSlab(.42,10.35,.075,limestone,x,.355,0,zone);}
      for(const z of [-5.05,5.05]){box(11.7,.35,.35,dark,0,.16,z,zone);stoneSlab(11.7,.42,.075,limestone,0,.355,z,zone);}
      box(10.8,5.3,.34,waterWall,0,2.85,-4.77,zone);box(10.95,.20,.62,dark,0,5.54,-4.77,zone);
      for(const y of [1.6,3.2,4.7])box(10.72,.018,.025,joint,0,y,-4.585,zone);
      for(const x of [-3.65,3.65]){box(.19,4.75,.12,dark,x,2.72,-4.57,zone);box(.036,4.42,.03,recessLight,x,2.73,-4.48,zone);}
      box(10.6,.038,.065,recessLight,0,.41,-4.52,zone);
      for(const x of [-5.41,5.41])box(.022,.018,9.72,recessLight,x,.30,0,zone);
      // Asymmetric islands of wet, weathered river stones. Each boulder has a unique sculpted
      // silhouette and fine mineral texture, and the lower portion sits under the water line.
      const stones=[[-4.10,-1.65,1.19,101,'boulder'],[-4.05,1.56,.92,102,'boulder'],[-4.73,-.22,.48,103,'low'],[-3.72,-3.47,.60,104,'low'],[-4.79,2.60,.34,105,'low'],[-3.33,.26,.26,106,'low'],[-4.66,-3.62,.24,107,'low'],[4.14,-2.0,1.13,108,'upright'],[3.98,1.67,.97,109,'boulder'],[4.71,-.06,.49,110,'low'],[3.58,-3.39,.54,111,'low'],[4.57,2.88,.32,112,'low'],[3.33,.49,.27,113,'low'],[4.82,-3.44,.22,114,'low']];
      for(const [x,z,size,seed,shape] of stones)environmentDetail.rock(zone,x,z,size,seed,.267,shape);
      // Keep the central water uninterrupted for the complete reflected ring; the approach
      // follows a diagonal run of smaller stepping stones along the left side of the pool.
      for(const [x,z] of [[-1.92,2.87],[-2.35,3.80],[-2.78,4.75]])stoneSlab(1.62,.80,.105,limestone,x,.329,z,zone);
    }
    if(site.theme==='wood'){
      environmentDetail.timberDeck(zone,timber);
      for(const x of [-4.72,4.72])box(.03,.025,8.4,strip,x,.235,-.15,zone);
    }
    if(site.theme==='light'){
      box(12,7,.42,dark,0,3.6,-3.9,zone);box(.4,7,5,dark,-5.8,3.6,-1.55,zone);
      for(let x=-5;x<=5;x+=1.25){box(.11,6.1,.06,limestone,x,3.6,-3.65,zone);box(.028,5.9,.027,strip,x,3.6,-3.607,zone);}
      box(10,.04,.06,strip,0,.25,-3.5,zone);
    }
    if(site.theme==='garden'){
      for(const x of [-4.3,4.3]){
        const planter=new THREE.Group();planter.position.set(0,.48,0);zone.add(planter);
        box(2.1,.5,8,dark,x,.34,-.5,zone);box(1.96,.035,7.82,soil,x,.63,-.5,zone);
        environmentDetail.tree(planter,x,-2.35,x<0?91:125,x<0?1.12:.92);
        environmentDetail.grasses(planter,x,-.15,1.8,7.1,x<0?61:81);
        environmentDetail.rock(planter,x,.8,.48,x<0?92:126,.15);
        environmentDetail.rock(planter,x,2.5,.27,x<0?93:127,.15);
      }
      for(let z=1.7;z<5;z+=1.3)box(3.5,.08,1.1,limestone,0,.22,z,zone);
    }
    if(site.theme==='quiet'){
      for(const [x,z,r] of [[-4,-2,.75],[4,-3,.65],[-4,2,.4],[3.8,2.4,.5]]){
        environmentDetail.rock(zone,x,z,r,Math.round((x+5)*20+z*7),.19);
      }
      environmentDetail.pebbles(zone,57);
      box(3.7,.25,1.05,limestone,3,.55,-3,zone);
      for(let z=2;z<5;z+=1.4)box(3.6,.09,1.15,limestone,-.2,.2,z,zone);
    }
    // Each letter occupies its own site and is scaled as a full-size installation.
    const plinthHeight=site.base-.2;
    if(site.theme==='water'){
      mesh(new THREE.CylinderGeometry(2.52,2.60,plinthHeight,80),dark,site.x,.2+plinthHeight/2,site.z);
      mesh(new THREE.CylinderGeometry(2.53,2.53,.034,80),bronze,site.x,site.base-.036,site.z);
      mesh(new THREE.CylinderGeometry(2.49,2.49,.025,80),limestone,site.x,site.base-.009,site.z);
    }else box(4.8,plinthHeight,3.2,dark,site.x,.2+plinthHeight/2,site.z);
    glyph(site.char,displayMaterials[site.char],site.x,site.z,site.scale,site.rot,site.base);
    const front=new THREE.Vector3(Math.sin(site.rot),0,Math.cos(site.rot));
    const signOffset=site.theme==='water'?2.59:1.62,sign=plaque(site.char,site.x+front.x*signOffset,site.z+front.z*signOffset);sign.position.y=site.base-.14;sign.rotation.y=site.rot;
    const target=new THREE.Vector3(site.x,site.center,site.z),position=new THREE.Vector3(site.x+front.x*2-Math.cos(site.rot)*1.2,9.5,site.z+front.z*2+Math.sin(site.rot)*1.2);
    const spot=new THREE.SpotLight(site.theme==='water'?'#e0e6d4':'#ffdfb5',0,24,.55,.7,1.8);spot.position.copy(position);spot.target.position.copy(target);spot.userData.artGlyph=site.char;spot.userData.base=620;spot.castShadow=true;spot.visible=false;
    spot.shadow.mapSize.set(innerWidth<761?512:1024,innerWidth<761?512:1024);spot.shadow.bias=-.0003;spot.shadow.normalBias=.06;spot.shadow.camera.near=.3;spot.shadow.camera.far=26;spot.shadow.autoUpdate=false;spot.shadow.needsUpdate=false;
    scene.add(spot,spot.target);lamps.push(spot);
    const fixture=mesh(new THREE.CylinderGeometry(.16,.16,.48,16),blackMetal,position.x,9.57,position.z);
    fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),target.clone().sub(fixture.position).normalize());
    box(4,.08,.1,blackMetal,position.x,9.95,position.z);
    const shade=mesh(new THREE.PlaneGeometry(4.2,2.7),contact,site.x,site.base+.008,site.z);shade.rotation.x=-Math.PI/2;shade.rotation.z=site.rot;shade.receiveShadow=false;
    batchStaticBoxes(THREE,zone);
    const objects=house.children.slice(groupStart);
    objects.forEach(root=>root.traverse(object=>{
      if(!object.isMesh)return;
      const solid=!object.material.transparent&&!object.material.isShaderMaterial&&!object.material.isMeshBasicMaterial;
      object.castShadow=solid&&!object.isInstancedMesh;object.receiveShadow=solid;
    }));
    exhibitionGroups.push({objects,site,visible:true});

  }
  // Only two of the six static lamps are visible at any point; their shadow maps are warmed once.
  scene.add(new THREE.HemisphereLight('#d4d9da','#534531',.43));
  scene.add(new THREE.AmbientLight('#c5beb2',.1));
  const key=new THREE.DirectionalLight('#f0ddbc',1.25);key.position.set(-13,24,15);key.castShadow=true;key.shadow.autoUpdate=false;key.shadow.needsUpdate=true;key.shadow.mapSize.set(innerWidth<761?768:1536,innerWidth<761?768:1536);Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.3,far:65});key.shadow.bias=-.0003;key.shadow.normalBias=.06;scene.add(key);
  const rim=new THREE.DirectionalLight('#adc3cf',.7);rim.position.set(20,16,-20);scene.add(rim);
  const p=new Float32Array(80*3);let seed=123;
  for(let i=0;i<p.length;i++){seed=(seed*16807)%2147483647;p[i]=((seed%1000)/1000-.5)*(i%3===1?15:55);if(i%3===1)p[i]+=8;}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(p,3));
  dust=new THREE.Points(pg,new THREE.PointsMaterial({color:'#dbcba5',size:.025,transparent:true,opacity:.2,depthWrite:false}));scene.add(dust);
  scene.updateMatrixWorld(true);
  sculptures.forEach(o=>artworkBounds.push(new THREE.Box3().setFromObject(o)));
  scene.traverse(o=>{
    if(!o.isMesh)return;
    if(o.userData.fullDetailCount){const center=o.geometry.boundingSphere?.center.clone()??new THREE.Vector3();o.localToWorld(center);detailMeshes.push({mesh:o,center:o.boundingSphere?.center.clone().applyMatrix4(o.matrixWorld)??center});return;}
    let ancestor=o;while(ancestor&&!ancestor.userData.artGlyph)ancestor=ancestor.parent;
    if(!ancestor&&!o.material.transparent&&o.material.opacity>=.92)blockers.push(o);
  });
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function pickArtwork(e) {
    if(paused||renderFailed)return;
    const rect=renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)return;
    pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    return pickVisibleArtwork(THREE,raycaster,sculptures,blockers);
  }
  interactionEvents=new AbortController();const interactionOptions={signal:interactionEvents.signal};
  stage.addEventListener('click',e=>{const art=pickArtwork(e);if(art)goTo(stops[tourGlyphs.indexOf(art)+1]);},interactionOptions);
  let lastPick=-Infinity;
  stage.addEventListener('pointermove',e=>{const now=performance.now();if(e.pointerType!=='touch'&&now-lastPick>80&&Math.abs(progress-desired)<.001){lastPick=now;renderer.domElement.style.cursor=pickArtwork(e)?'pointer':'default';}},interactionOptions);
  stage.addEventListener('pointerleave',()=>{renderer.domElement.style.cursor='default';},interactionOptions);
  resize();
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  // The opening shot is always the first frame, independent of the old document's scroll offset.
  progress=desired=0;cancelDraw();
  draw(performance.now(),true,true);
}

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
// Compile each distinct shader family in small groups, while the dedicated loading screen can paint.
async function compileGallery(onProgress,shouldContinue){
  const variants=new Map();
  scene.traverse(object=>{
    if(!object.isMesh&&!object.isPoints)return;
    const m=object.material;if(!m||Array.isArray(m))return;
    const key=[m.type,m.isShaderMaterial?m.uuid:'',!!m.map,!!m.normalMap,!!m.roughnessMap,!!m.metalnessMap,m.side,m.transparent,m.vertexColors,object.isInstancedMesh===true,!!object.instanceColor,object.receiveShadow,object.geometry.attributes.color!==undefined].join(':');
    if(!variants.has(key))variants.set(key,object);
  });
  const objects=[...variants.values()],parallel=renderer.compileAsync&&renderer.extensions?.has('KHR_parallel_shader_compile');
  for(let i=0;i<objects.length;i+=2){
    if(renderFailed||!shouldContinue())return false;
    onProgress(54+Math.round(i/objects.length*32),'shader');
    await nextPaint();
    if(parallel)await Promise.all(objects.slice(i,i+2).map(object=>renderer.compileAsync(object,camera,scene)));
    else for(const object of objects.slice(i,i+2))renderer.compile?.(object,camera,scene);
  }
  return true;
}

// Each room is activated only near its own stop, with a small overlap for the camera handoff.
// The first transition must not activate the water, wood, and quiet galleries simultaneously.
function inExhibitionWindow(p,index){
  const start=index===0?.035:stops[index]+(stops[index+1]-stops[index])*.43;
  const end=index===exhibitionSites.length-1?.92:stops[index+1]+(stops[index+2]-stops[index+1])*.66;
  return p>=start&&p<=end;
}

// compileAsync alone does not upload geometry, instance buffers, or all textures. Render every
// stop once into a tiny scissored region of the real framebuffer while the arrival screen covers it.
async function warmGallery(onProgress,shouldContinue){
  if(!renderer.setViewport||!renderer.setScissor||!renderer.setScissorTest)return true;
  const viewport=renderer.getViewport?.(new THREE.Vector4())??new THREE.Vector4(0,0,stageWidth,stageHeight);
  const scissor=renderer.getScissor?.(new THREE.Vector4())??viewport.clone(),scissorTest=renderer.getScissorTest?.()??false;
  const culling=[];scene.traverse(object=>{if(object.isMesh||object.isPoints){culling.push([object,object.frustumCulled]);object.frustumCulled=false;}});
  const w=Math.min(96,stageWidth),h=Math.min(96,stageHeight);
  renderer.setViewport(0,0,w,h);renderer.setScissor(0,0,w,h);renderer.setScissorTest(true);
  try{
    for(let i=1;i<stops.length-1;i++){
      if(renderFailed||!shouldContinue())return false;
      onProgress(86+Math.floor((i-1)/(stops.length-2)*10),'warmup');await nextPaint();
      if(renderFailed||!shouldContinue())return false;
      // Each room's own static shadow map (including the pavilion map on the first pass) is
      // computed while its geometry is visible and reused unchanged during the entire tour.
      lamps[i-1].shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
      progress=desired=stops[i];draw(performance.now(),true,false,true);
    }
    return true;
  }finally{
    for(const [object,value] of culling)object.frustumCulled=value;
    renderer.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);renderer.setScissor(scissor.x,scissor.y,scissor.z,scissor.w);renderer.setScissorTest(scissorTest);
    progress=desired=0;lastTime=0;draw(performance.now(),true,true);
  }
}

function resize() {
  if(!renderer)return;
  const r=stage.getBoundingClientRect();
  if(r.width<=0||r.height<=0)return;
  if(stageWidth===r.width&&stageHeight===r.height)return;
  stageWidth=r.width;stageHeight=r.height;
  // Bound the number of shaded pixels, even on a 4K or high-DPI screen.
  const profile=governor?.profile,maxPixels=Math.min(innerWidth<761?1000000:2200000,profile?.maxPixels??2200000),ratio=Math.min(devicePixelRatio,innerWidth<761?1.25:1.5,profile?.pixelRatio??1.5,Math.sqrt(maxPixels/(r.width*r.height)));
  if(Math.abs(stagePixelRatio-ratio)>.005){stagePixelRatio=ratio;renderer.setPixelRatio(ratio);}
  renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();requestDraw();
}
new ResizeObserver(resize).observe(stage);
addEventListener('resize',()=>{measureScrollHeight();updateScroll();},{passive:true});
addEventListener('scroll',updateScroll,{passive:true});
for(const type of ['wheel','touchmove','keydown','pointerdown'])addEventListener(type,permitUserScroll,{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelDraw();else{lastTime=0;requestDraw();}});
motion.addEventListener('change',()=>{progress=desired;requestDraw();});

function cancelDraw(){if(frame&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(frame);frame=0;renderedAt=null;governor?.reset();}
function failRendering(error){if(renderFailed)return;renderFailed=true;cancelDraw();dispatchEvent(new CustomEvent('museum:failure',{detail:error}));}
function requestDraw(){if(!frame&&!paused&&!renderFailed&&!document.hidden&&document.documentElement.dataset.view==='3d')frame=requestAnimationFrame(draw);}
function draw(time,force=false,prepareOnly=false,warmOnly=false) {
  frame=0;
  if(renderFailed||(!force&&(paused||document.documentElement.dataset.view!=='3d'||document.hidden)))return;
  // Only the first rAF after an actual live render measures its presentation cost.
  // Idle gaps, initialization and deliberate water-frame skipping are excluded.
  if(!force&&renderedAt!==null){const interval=time-renderedAt;renderedAt=null;governor?.sample(interval);if(paused||renderFailed||document.documentElement.dataset.view!=='3d')return;}
  if(!force&&chapter===2&&reflectingPool?.animated&&!motion.matches&&Math.abs(progress-desired)<.00001&&Math.abs(zoom-desiredZoom)<.00001&&time-lastTime<48){requestDraw();return;}
  const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
  progress=motion.matches?desired:THREE.MathUtils.damp(progress,desired,7,dt);
  zoom=motion.matches?desiredZoom:THREE.MathUtils.damp(zoom,desiredZoom,9,dt);
  if(Math.abs(progress-desired)<.00006)progress=desired;
  if(Math.abs(zoom-desiredZoom)<.0001)zoom=desiredZoom;
  if(camera) {
    const mobile=innerWidth<761;
    let pose=sampleTour(progress,{mobile,reducedMotion:motion.matches,zoom});
    const heroWeight=motion.matches?(pose.chapter===0||pose.chapter===7?1:0):Math.max(1-THREE.MathUtils.smoothstep(progress,.025,.075),THREE.MathUtils.smoothstep(progress,.925,.98));
    if(heroWeight>0)pose=fitTourPose(pose,heroBounds,camera.aspect,zoom,heroWeight);
    if(pose.chapter>0&&pose.chapter<7&&pose.focus>0)pose=fitTourPose(pose,artworkBounds[pose.chapter-1],camera.aspect,zoom,pose.focus);
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);
    camera.fov=pose.fov;camera.updateProjectionMatrix();
    const reveal=Math.min(THREE.MathUtils.smoothstep(progress,.035,.075),1-THREE.MathUtils.smoothstep(progress,.9,.95));
    exhibitionGroups.forEach((group,i)=>{
      const visible=reveal>.001&&(pose.chapter===i+1||(!motion.matches&&inExhibitionWindow(progress,i)));
      if(visible!==group.visible){group.visible=visible;group.objects.forEach(object=>object.visible=visible);}
    });
    lightArtwork(progress,pose.focus,reveal);
    if(reveal>.001)for(const item of detailMeshes){const count=detailCount(item.mesh.userData.fullDetailCount,camera.position.distanceTo(item.center),item.mesh.userData.environmentDetail);if(count!==item.mesh.count)item.mesh.count=count;}
    if(!warmOnly&&document.documentElement.dataset.view==='3d'){$('experience').classList.toggle('is-detail',pose.focus>.35);setText('view-label',pose.chapter>0&&pose.chapter<7?exhibitionSites[pose.chapter-1].room:'한글 건축관');}
    if(dust) dust.rotation.y=progress*.12;
    if(!prepareOnly){
      const settled=Math.abs(progress-desired)<.0004&&Math.abs(zoom-desiredZoom)<.0004;
      if(reflectingPool&&(!warmOnly||(pose.chapter===2&&renderer.getRenderTarget)))reflectingPool.update(camera,time/1000,bright,motion.matches,time,reveal>.1&&pose.chapter===2,!settled);
      try{renderer.render(scene,camera);}catch(error){if(force)throw error;failRendering(error);return;}
      if(!force)renderedAt=time;
    }
  }
  if(!warmOnly&&document.documentElement.dataset.view==='3d'){setText('tour-progress',Math.round(progress*100)+'%');updateChapter();}
  if(!warmOnly&&!prepareOnly&&(Math.abs(progress-desired)>.00001||Math.abs(zoom-desiredZoom)>.00001||(!motion.matches&&reflectingPool?.animated&&chapter===2)))requestDraw();
  else renderedAt=null;
}
export async function initGallery({onProgress=()=>{},shouldContinue=()=>true,onQualityChange=()=>{},onFallback=()=>{}}={}){
  paused=false;renderFailed=false;chapter=-1;governor=null;renderedAt=null;qualityChange=onQualityChange;performanceFallback=onFallback;
  progress=desired=lastTime=stageWidth=stageHeight=stagePixelRatio=0;zoom=desiredZoom=1;bright=false;scrollEnabled=false;
  lamps.length=sculptures.length=exhibitionGroups.length=detailMeshes.length=blockers.length=artworkBounds.length=0;
  reflectingPool=null;renderer=null;dust=null;
  onProgress(22,'scene');if(typeof window!=='undefined')await nextPaint();
  if(!shouldContinue())return null;
  try{
  setup(onProgress);
  if(renderer.isWebGLRenderer){
    onProgress(34,'materials');await nextPaint();
    const workerFactory=typeof Worker==='function'&&typeof location!=='undefined'&&location.protocol!=='file:'?()=>new Worker(new URL('./surface-worker.js',document.baseURI),{type:'module'}):undefined;
    await environmentDetail.hydrate({workerFactory,schedule:callback=>nextPaint().then(callback)});
    if(renderFailed||!shouldContinue()){disposeGallery();return null;}
    onProgress(54,'shader');await nextPaint();
    if(!await compileGallery(onProgress,shouldContinue)||renderFailed||!shouldContinue()){disposeGallery();return null;}
    if(!await warmGallery(onProgress,shouldContinue)||renderFailed||!shouldContinue()){disposeGallery();return null;}
    onProgress(96,'frame');await nextPaint();
  }
  if(renderFailed||!shouldContinue()){disposeGallery();return null;}
  draw(performance.now(),true);onProgress(100,'ready');
  return {
    getProgress:()=>progress,
    seek(value){scrollEnabled=true;progress=desired=clamp(value,0,1);measureScrollHeight();scrollTo({top:progress*scrollHeight,behavior:'instant'});chapter=-1;requestDraw();},
    dispose:disposeGallery,
    goTo,setZoom,toggleLighting,refresh(){resize();measureScrollHeight();updateScroll();},
    pause(){paused=true;cancelDraw();},resume(){if(renderFailed)return;paused=false;lastTime=0;resize();updateScroll();requestDraw();},
    changeZoom(delta){setZoom(desiredZoom+delta);},
    next(){goTo(desired>.985?0:(stops.find(stop=>stop>desired+.025)??1));}
  };
  }catch(error){disposeGallery();throw error;}
}

function disposeGallery(){
  paused=true;cancelDraw();interactionEvents?.abort();reflectingPool?.dispose?.();
  const resources=new Set();if(scene?.environment)resources.add(scene.environment);
  scene?.traverse(object=>{object.shadow?.dispose?.();if(object.geometry)resources.add(object.geometry);for(const mat of (Array.isArray(object.material)?object.material:[object.material]).filter(Boolean)){resources.add(mat);for(const value of Object.values(mat))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources)resource.dispose();
  renderer?.dispose?.();renderer?.domElement?.remove?.();
}
