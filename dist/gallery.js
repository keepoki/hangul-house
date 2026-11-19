import * as THREE from './assets/three.module.js';
import { tourStops as stops, tourGlyphs, chapterAt, sampleTour } from './camera-tour.js';
import { exhibitionSites } from './exhibition-layout.js';
import { buildHangulBuilding } from './hangul-building.js';
import { createEnvironment, createReflectingPool } from './environment.js';

const $ = (id) => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
import { chapters } from './exhibition-content.js';
let progress = 0, desired = 0, chapter = -1, frame = 0, lastTime = 0;
let scene, camera, renderer, house, dust;
let reflectingPool=null;
let bright = false, textTimer, scrollHeight = 1;
let zoom = 1, desiredZoom = 1;
const lamps = [];
const sculptures = [];
const exhibitionGroups=[];
const stage = $('stage');
const clamp = THREE.MathUtils.clamp;

function updateScroll() {
  if(document.documentElement.dataset.view!=='3d')return;
  scrollHeight = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  desired = clamp(scrollY / scrollHeight, 0, 1);
  if (motion.matches) { progress = desired; draw(performance.now()); }
  else requestDraw();
}
function goTo(p) {
  setZoom(1);
  scrollTo({ top: p * Math.max(1, document.documentElement.scrollHeight - innerHeight), behavior: motion.matches ? 'instant' : 'smooth' });
}
function setZoom(value) {
  desiredZoom = clamp(value,.75,1.8);
  if(motion.matches)zoom=desiredZoom;
  $('zoom-in').disabled=desiredZoom>=1.8;
  $('zoom-out').disabled=desiredZoom<=.75;
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
  document.querySelectorAll('[data-stop]').forEach((button,i)=>{
    button.classList.toggle('active',i===index);
    if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  });
  $('scroll-label').textContent=index===7?'처음부터 다시 관람':index===0?'아래로 스크롤해 관람':'다음 공간으로';
}

// All architecture, lettering, materials and lighting are generated locally.
function material(color, roughness=.7, metalness=0, map=null) { return new THREE.MeshStandardMaterial({color,roughness,metalness,map}); }
function mesh(geometry,mat,x=0,y=0,z=0,parent=house) {
  const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function box(w,h,d,mat,x,y,z,parent=house) {return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z,parent);}
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
function setup() {
  scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#10100f',.018);
  camera=new THREE.PerspectiveCamera(35,1,.1,150);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setClearColor('#10100f',0);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<761?1.5:1.75));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();dispatchEvent(new CustomEvent('museum:failure',{detail:new Error('WebGL context lost')}));});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{ /* Recovery is user-initiated, preserving workshop state. */ });
  house=new THREE.Group();scene.add(house);
  scene.fog.density=.009;
  const environmentDetail=createEnvironment(THREE,{mobile:innerWidth<761});
  const {limestone,dark,floor,timber,hall,gravel,soil}=environmentDetail.materials;
  const blackMetal=material('#343632',.4,.45);
  const bronze=material('#c59c5e',.3,.68);
  const ivory=limestone.clone();ivory.color.set('#eee5d1');
  const gold=material('#d6ad65',.27,.63);
  const green=material('#6f8c7c',.48,.28);
  const ceramic=material('#e4e1d2',.32,.05);
  const strip=new THREE.MeshBasicMaterial({color:'#e5c79c',toneMapped:false});
  const glass=new THREE.MeshPhysicalMaterial({color:'#9da99d',metalness:.12,roughness:.16,transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false});
  const environmentFaces=['#a39c8b','#5b6264','#e5ddca','#1e2422','#9a8b73','#53626a'].map(color=>{
    const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');
    ctx.fillStyle=color;ctx.fillRect(0,0,32,32);ctx.fillStyle='#ded7c5';ctx.fillRect(12,0,5,28);return c;
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
  buildHangulBuilding(THREE,house,{limestone,timber,charcoal:dark,glass,strip});
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
  const displayMaterials={'ㄱ':ivory,'ㅇ':bronze,'ㅁ':timber,'ㅎ':gold,'ㅏ':green,'ㅅ':ceramic};
  for(const site of exhibitionSites) {
    const groupStart=house.children.length,sceneStart=scene.children.length;
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
      box(11.1,.14,9.8,dark,0,.17,0,zone);
      reflectingPool=createReflectingPool(THREE,zone,scene,renderer,11.1,9.8,innerWidth<761);
      for(const x of [-5.7,5.7])box(.35,.32,10.4,dark,x,.16,0,zone);
      for(const z of [-5.05,5.05])box(11.7,.32,.35,dark,0,.16,z,zone);
      for(const x of [-5.4,5.4])box(.025,.02,9.8,strip,x,.29,0,zone);
      environmentDetail.rock(zone,-4,-3.45,.8,101,.27);environmentDetail.rock(zone,4.1,-3.6,.65,102,.27);
      environmentDetail.rock(zone,-4.2,-2.5,.32,103,.27);environmentDetail.rock(zone,3.35,-3.7,.26,104,.27);
      for(let z=2.05;z<5;z+=1.05)box(2.8,.10,.81,limestone,0,.32,z,zone);
      const l=new THREE.PointLight('#b5d6ce',95,14,2);l.position.set(site.x,2,site.z+4);scene.add(l);
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
    box(site.char==='ㅇ'?5.5:4.8,plinthHeight,3.2,dark,site.x,.2+plinthHeight/2,site.z);
    glyph(site.char,displayMaterials[site.char],site.x,site.z,site.scale,site.rot,site.base);
    const front=new THREE.Vector3(Math.sin(site.rot),0,Math.cos(site.rot));
    const sign=plaque(site.char,site.x+front.x*1.62,site.z+front.z*1.62);sign.position.y=site.base-.14;sign.rotation.y=site.rot;
    const target=new THREE.Object3D();target.position.set(site.x,site.center,site.z);scene.add(target);
    const spot=new THREE.SpotLight(site.theme==='water'?'#e0e6d4':'#ffdfb5',620,24,.55,.7,1.8);
    spot.position.set(site.x+front.x*2-Math.cos(site.rot)*1.2,9.5,site.z+front.z*2+Math.sin(site.rot)*1.2);spot.target=target;
    spot.castShadow=true;spot.shadow.mapSize.set(768,768);spot.shadow.bias=-.0003;spot.shadow.normalBias=.06;spot.shadow.camera.near=.3;spot.shadow.camera.far=26;
    spot.userData.base=620;spot.userData.artGlyph=site.char;scene.add(spot);lamps.push(spot);
    const fixture=mesh(new THREE.CylinderGeometry(.16,.16,.48,16),blackMetal,spot.position.x,9.57,spot.position.z);
    fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),target.position.clone().sub(fixture.position).normalize());
    box(4,.08,.1,blackMetal,spot.position.x,9.95,spot.position.z);
    const objects=house.children.slice(groupStart),materialCache=new Map(),fading=[];
    objects.forEach(root=>root.traverse(object=>{
      if(!object.isMesh)return;
      const original=object.material;
      if(!materialCache.has(original)){
        const copy=original.isShaderMaterial?original:original.clone();
        fading.push({material:copy,opacity:original.opacity,transparent:original.transparent,depthWrite:original.depthWrite});
        materialCache.set(original,copy);
      }
      object.material=materialCache.get(original);
    }));
    exhibitionGroups.push({objects,fading,visible:true,lighting:scene.children.slice(sceneStart).filter(object=>object.isLight)});

  }
  scene.add(new THREE.HemisphereLight('#d4d9da','#534531',.43));
  scene.add(new THREE.AmbientLight('#c5beb2',.1));
  const key=new THREE.DirectionalLight('#f0ddbc',1.25);key.position.set(-13,24,15);key.castShadow=true;key.shadow.mapSize.set(innerWidth<761?768:1536,innerWidth<761?768:1536);Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.3,far:65});key.shadow.bias=-.0003;key.shadow.normalBias=.06;scene.add(key);
  const rim=new THREE.DirectionalLight('#adc3cf',.7);rim.position.set(20,16,-20);scene.add(rim);
  const p=new Float32Array(80*3);let seed=123;
  for(let i=0;i<p.length;i++){seed=(seed*16807)%2147483647;p[i]=((seed%1000)/1000-.5)*(i%3===1?15:55);if(i%3===1)p[i]+=8;}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(p,3));
  dust=new THREE.Points(pg,new THREE.PointsMaterial({color:'#dbcba5',size:.025,transparent:true,opacity:.2,depthWrite:false}));scene.add(dust);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function pickArtwork(e) {
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    let picked=raycaster.intersectObjects(sculptures,true)[0]?.object;
    while(picked&&!picked.userData.artGlyph)picked=picked.parent;
    return picked?.userData.artGlyph;
  }
  stage.addEventListener('click',e=>{const art=pickArtwork(e);if(art)goTo(stops[tourGlyphs.indexOf(art)+1]);});
  stage.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')renderer.domElement.style.cursor=pickArtwork(e)?'pointer':'default';});
  stage.addEventListener('pointerleave',()=>{renderer.domElement.style.cursor='default';});
  resize();
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  updateScroll();requestDraw();
  draw(performance.now(),true);
}

function resize() {
  if(!renderer)return;
  const r=stage.getBoundingClientRect();
  renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();requestDraw();
}
new ResizeObserver(resize).observe(stage);
addEventListener('resize',updateScroll,{passive:true});
addEventListener('scroll',updateScroll,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;}else requestDraw();});
motion.addEventListener('change',()=>{progress=desired;requestDraw();});

function requestDraw(){if(!frame&&!document.hidden&&document.documentElement.dataset.view==='3d')frame=requestAnimationFrame(draw);}
function draw(time,force=false) {
  frame=0;
  if(!force&&(document.documentElement.dataset.view!=='3d'||document.hidden))return;
  if(!force&&chapter===2&&reflectingPool?.capable&&!motion.matches&&Math.abs(progress-desired)<.00001&&Math.abs(zoom-desiredZoom)<.00001&&time-lastTime<35){requestDraw();return;}
  const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
  progress=motion.matches?desired:THREE.MathUtils.damp(progress,desired,7,dt);
  zoom=motion.matches?desiredZoom:THREE.MathUtils.damp(zoom,desiredZoom,9,dt);
  if(Math.abs(progress-desired)<.00006)progress=desired;
  if(Math.abs(zoom-desiredZoom)<.0001)zoom=desiredZoom;
  if(camera) {
    const mobile=innerWidth<761;
    const pose=sampleTour(progress,{mobile,reducedMotion:motion.matches,zoom});
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);
    camera.fov=pose.fov;camera.updateProjectionMatrix();
    const selected=chapters[pose.chapter].glyph;
    const reveal=Math.min(THREE.MathUtils.smoothstep(progress,.035,.075),1-THREE.MathUtils.smoothstep(progress,.9,.95));
    exhibitionGroups.forEach(group=>{
      const visible=reveal>.001;
      if(visible&&!group.visible)renderer.shadowMap.needsUpdate=true;
      group.visible=visible;
      group.objects.forEach(object=>object.visible=visible);
      group.fading.forEach(item=>{item.material.opacity=item.opacity*reveal;item.material.transparent=reveal<.999||item.transparent;item.material.depthWrite=reveal<.999?false:item.depthWrite;});
      group.lighting.filter(light=>!light.isSpotLight).forEach(light=>{light.userData.restIntensity??=light.intensity;light.intensity=light.userData.restIntensity*reveal;});
    });
    lamps.forEach(l=>{const accent=l.userData.artGlyph===selected?1+pose.focus*.2:1-pose.focus*.48;l.intensity=l.userData.base*accent*(bright?1.2:1)*reveal;});
    $('experience').classList.toggle('is-detail',pose.focus>.35);
    $('view-label').textContent=pose.chapter>0&&pose.chapter<7?exhibitionSites[pose.chapter-1].room:'한글 건축관';
    if(dust) dust.rotation.y=progress*.12;
    if(reflectingPool)reflectingPool.update(camera,time/1000,bright,motion.matches,time,reveal>.1&&pose.chapter>=1&&pose.chapter<=3);
    renderer.render(scene,camera);
  }
  $('tour-progress').textContent=Math.round(progress*100)+'%';
  $('zoom-value').textContent=Math.round(zoom*100)+'%';
  updateChapter();
  if(Math.abs(progress-desired)>.00001||Math.abs(zoom-desiredZoom)>.00001||(!motion.matches&&reflectingPool?.capable&&chapter===2))requestDraw();
}
export function initGallery(){
  setup();
  return {
    goTo,setZoom,toggleLighting,refresh(){resize();updateScroll();},
    changeZoom(delta){setZoom(desiredZoom+delta);},
    next(){goTo(desired>.985?0:(stops.find(stop=>stop>desired+.025)??1));}
  };
}
