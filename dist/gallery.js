import * as THREE from './assets/three.module.js';
import { tourStops as stops, tourGlyphs, chapterAt, sampleTour } from './camera-tour.js';
import { exhibitionSites } from './exhibition-layout.js';
import { buildHangulBuilding } from './hangul-building.js';

const $ = (id) => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = [
  {eyebrow:'THE ARCHITECTURE OF HANGUL', title:'글자가<br>공간이 되다.', body:'한글로 지은 집에서 시작해,<br>여섯 개의 다른 풍경으로 걸어갑니다.',note:'한글 건축관 · 여섯 개의 전시 공간',glyph:'ㅁ',name:'한글로 지은 집',material:'STONE · OAK · CHARCOAL'},
  {eyebrow:'돌의 방 · STONE GALLERY', title:'시작은,<br>하나의 꺾임.', body:'거친 석재 벽과 넓은 돌바닥.<br>돌의 무게를 닮은 첫 소리를 만납니다.',note:'ㄱ · 석회암 · 시작의 모양',glyph:'ㄱ',name:'시작의 모양',material:'WARM LIMESTONE'},
  {eyebrow:'물의 뜰 · WATER COURT', title:'비어 있어,<br>가득한 형태.', body:'고요한 수면 곁에 놓인 둥근 여백.<br>청동과 물 사이로 빛이 흐릅니다.',note:'ㅇ · 청동과 수공간 · 여백의 형태',glyph:'ㅇ',name:'여백의 형태',material:'BRONZE & STILL WATER'},
  {eyebrow:'나무의 뜰 · TIMBER COURT', title:'마음에도,<br>방이 있다면.', body:'나무 기둥 사이, 따뜻한 공기의 결.<br>네 개의 획이 또 하나의 뜰을 만듭니다.',note:'ㅁ · 참나무 · 마음의 방',glyph:'ㅁ',name:'마음의 방',material:'OILED OAK'},
  {eyebrow:'빛의 방 · LIGHT GALLERY', title:'소리가 빛이<br>되는 순간.', body:'짙은 벽을 따라 길게 흐르는 빛.<br>황동의 작은 획과 둥근 숨을 비춥니다.',note:'ㅎ · 황동 · 빛의 숨',glyph:'ㅎ',name:'빛의 숨',material:'BRUSHED BRASS'},
  {eyebrow:'초록의 정원 · GREEN COURT', title:'하나의 선,<br>열린 방향.', body:'낮은 식재와 초록빛 금속 사이.<br>식물의 그림자가 새로운 방향을 그립니다.',note:'ㅏ · 녹청과 정원 · 열린 방향',glyph:'ㅏ',name:'열린 방향',material:'PATINATED METAL'},
  {eyebrow:'고요의 방 · QUIET GALLERY', title:'서로를 향해,<br>기울어진 선.', body:'자갈의 결 위에 놓인 하얀 형태.<br>비워 둔 공간에서 두 선이 만납니다.',note:'ㅅ · 도자기와 자갈 · 서로를 향한 선',glyph:'ㅅ',name:'서로를 향한 선',material:'IVORY CERAMIC'},
  {eyebrow:'BACK HOME · A NEW PERSPECTIVE', title:'한 바퀴,<br>새로운 시선.', body:'같은 글자, 달라진 풍경.<br>한글의 또 다른 얼굴을 발견하셨나요.',note:'글자의 집 · 빛과 형태의 수집',glyph:'ㅅ',name:'서로를 향한 선',material:'IVORY CERAMIC'}
];
let progress = 0, desired = 0, chapter = -1, frame = 0, lastTime = 0;
let scene, camera, renderer, house, dust;
let bright = false, textTimer, scrollHeight = 1;
let zoom = 1, desiredZoom = 1;
const lamps = [];
const sculptures = [];
const stage = $('stage');
const clamp = THREE.MathUtils.clamp;

function updateScroll() {
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
$('zoom-in').addEventListener('click',()=>setZoom(desiredZoom+.15));
$('zoom-out').addEventListener('click',()=>setZoom(desiredZoom-.15));
$('zoom-reset').addEventListener('click',()=>setZoom(1));
addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||dialog.open||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
  if(['+','=','-','0'].includes(e.key)) {
    e.preventDefault();setZoom(e.key==='0'?1:desiredZoom+(e.key==='-'?-.15:.15));
  }
});
document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.goto))));
document.querySelectorAll('[data-stop]').forEach(b => b.addEventListener('click', () => goTo(stops[Number(b.dataset.stop)])));
$('next-stop').addEventListener('click', () => goTo(desired > .985 ? 0 : (stops.find(s => s > desired + .025) ?? 1)));
$('light-toggle').addEventListener('click', () => {
  bright = !bright;
  $('light-toggle').setAttribute('aria-pressed', String(bright));
  $('light-toggle').setAttribute('aria-label', bright ? '조명을 은은하게' : '조명을 더 밝게');
  if (renderer) renderer.toneMappingExposure = bright ? 1.75 : 1.24;
  lamps.forEach(l => l.intensity = l.userData.base * (bright ? 1.25 : 1));
  requestDraw();
});
const dialog = $('about-dialog');
$('about-open').addEventListener('click', () => dialog.showModal());
$('about-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });
addEventListener('scroll', updateScroll, { passive:true });

function updateChapter() {
  const index = chapterAt(progress);
  if (index === chapter) return;
  chapter = index;
  const data = chapters[index];
  const story = document.querySelector('.story');
  story.classList.add('changing');
  clearTimeout(textTimer);
  textTimer = setTimeout(() => {
    $('eyebrow').textContent = data.eyebrow;
    $('story-title').innerHTML = data.title;
    $('story-body').innerHTML = data.body;
    $('story-note').textContent = data.note;
    $('work-glyph').textContent = data.glyph;
    $('work-name').textContent = data.name;
    $('work-material').textContent = data.material;
    story.classList.remove('changing');
  }, chapter === 0 || motion.matches ? 0 : 160);
  document.querySelectorAll('[data-stop]').forEach((b,i) => {
    b.classList.toggle('active', i===index);
    if(i===index) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current');
  });
  $('scroll-label').innerHTML = index===7 ? '처음으로 돌아가기<small>BACK TO THE HOUSE</small>' : index===0 ? '스크롤하며 작품 가까이<small>SCROLL TO DISCOVER</small>' : '천천히, 다음 작품으로<small>CONTINUE THE JOURNEY</small>';
}

// All architecture, lettering, materials and lighting are generated locally.
function stoneTexture(base, amount=18) {
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  const img=ctx.createImageData(256,256);
  let seed=42;
  for(let i=0;i<img.data.length;i+=4) {
    seed=(seed*1664525+1013904223)>>>0;
    const n=((seed/4294967295)-.5)*amount;
    img.data[i]=base[0]+n;img.data[i+1]=base[1]+n;img.data[i+2]=base[2]+n;img.data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,3);tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}
function woodTexture() {
  const c=document.createElement('canvas'); c.width=128;c.height=512;
  const ctx=c.getContext('2d');ctx.fillStyle='#b28a5a';ctx.fillRect(0,0,128,512);
  let seed=13;
  for(let i=0;i<600;i++) { seed=(seed*16807)%2147483647;const x=seed%128;ctx.strokeStyle=`rgba(${seed%2?125:12},${seed%2?89:9},${seed%2?52:5},.18)`;ctx.lineWidth=.3+(seed%10)/10;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+4,160,x-3,350,x+1,512);ctx.stroke(); }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,1);t.colorSpace=THREE.SRGBColorSpace;return t;
}
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
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('fallback').hidden=false;});
  renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
  house=new THREE.Group();scene.add(house);
  scene.fog.density=.009;
  const limestone=material('#ede1c9',.76,.02,stoneTexture([231,224,207],22));
  const dark=material('#3c3e3b',.74,.1,stoneTexture([133,134,127],25));
  const floor=material('#aaa396',.66,.06,stoneTexture([172,168,155],15));
  const timber=material('#e1b780',.63,.02,woodTexture());
  const blackMetal=material('#343632',.4,.45);
  const bronze=material('#c59c5e',.3,.68);
  const ivory=material('#e9e0ce',.52,.02,stoneTexture([238,230,211],12));
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
  const hall=material('#797a72',.87,0,stoneTexture([159,157,146],22));
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
  const leaf=material('#6f7c54',.92),leafDark=material('#485c43',.95);
  const water=new THREE.MeshPhysicalMaterial({color:'#243e38',metalness:.68,roughness:.1,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.8});
  const gravel=material('#a8a193',.96,0,stoneTexture([178,172,157],75));
  const displayMaterials={'ㄱ':ivory,'ㅇ':bronze,'ㅁ':timber,'ㅎ':gold,'ㅏ':green,'ㅅ':ceramic};
  for(const site of exhibitionSites) {
    const zone=new THREE.Group();zone.position.set(site.x,0,site.z);zone.rotation.y=site.rot;zone.name=site.room;zone.userData.exhibitionTheme=site.theme;house.add(zone);
    box(11.5,.2,10.2,site.theme==='quiet'?gravel:limestone,0,.04,0,zone);
    if(site.theme==='stone'){
      box(11,7,.4,hall,0,3.6,-3.8,zone);box(.4,7,4.7,hall,-5.4,3.6,-1.65,zone);
      for(let y=1.5;y<7;y+=1.8)box(10.9,.014,.015,joint,0,y,-3.59,zone);
      box(4,.35,.85,limestone,3.1,.4,3.2,zone);
    }
    if(site.theme==='water'){
      box(11.1,.12,9.8,water,0,.2,0,zone);
      for(const x of [-5.7,5.7])box(.35,.32,10.4,dark,x,.16,0,zone);
      for(const z of [-5.05,5.05])box(11.7,.32,.35,dark,0,.16,z,zone);
      for(const x of [-5.4,5.4])box(.025,.02,9.8,strip,x,.29,0,zone);
      for(const x of [-4,4])mesh(new THREE.IcosahedronGeometry(.75,1),dark,x,.5,-3.5,zone).scale.set(1.4,.65,1);
      const l=new THREE.PointLight('#b5d6ce',95,14,2);l.position.set(site.x,2,site.z+4);scene.add(l);
    }
    if(site.theme==='wood'){
      for(let x=-5.5;x<=5.5;x+=.38)box(.35,.14,10,timber,x,.2,0,zone);
      for(const x of [-4.9,4.9])for(const z of [-4.2,3.7])box(.2,5.6,.2,timber,x,3,z,zone);
      for(const z of [-4.2,3.7])box(10.2,.24,.24,timber,0,5.7,z,zone);
      for(const x of [-4.9,4.9])box(.24,.24,8.2,timber,x,5.7,-.25,zone);
      for(let x=-4.8;x<=4.8;x+=.45)box(.08,4.6,.1,timber,x,2.65,-4.2,zone);
      box(3.6,.22,.85,timber,-2.4,.7,3.8,zone);
    }
    if(site.theme==='light'){
      box(12,7,.42,dark,0,3.6,-3.9,zone);box(.4,7,5,dark,-5.8,3.6,-1.55,zone);
      for(let x=-5;x<=5;x+=1.25)box(.035,5.9,.025,strip,x,3.6,-3.67,zone);
      box(10,.04,.06,strip,0,.25,-3.5,zone);
    }
    if(site.theme==='garden'){
      for(const x of [-4.3,4.3]){
        box(2.1,.6,8,dark,x,.4,-.5,zone);
        box(1.95,.025,7.8,leafDark,x,.715,-.5,zone);
        for(let n=0;n<5;n++){
          const z=-3.3+n*1.3;
          for(let j=0;j<3;j++){
            const stem=mesh(new THREE.ConeGeometry(.19,.85+j*.14,5),j%2?leaf:leafDark,x+(j-1)*.4,1.05,z,zone);stem.rotation.z=(j-1)*.18;
          }
        }
        beam([x,.7,-2.1],[x+.2,3.7,-2.1],.07,timber,zone);
        for(let j=0;j<4;j++){const canopy=mesh(new THREE.IcosahedronGeometry(.9,1),j%2?leaf:leafDark,x+Math.cos(j*2)*.6,3.45+j*.33,-2.1+Math.sin(j*2)*.45,zone);canopy.scale.set(1.1,.7,1);}
      }
      for(let z=1.7;z<5;z+=1.3)box(3.5,.08,1.1,limestone,0,.22,z,zone);
    }
    if(site.theme==='quiet'){
      for(const [x,z,r] of [[-4,-2,.75],[4,-3,.65],[-4,2,.4],[3.8,2.4,.5]]){
        const rock=mesh(new THREE.IcosahedronGeometry(r,1),dark,x,.25,z,zone);rock.scale.set(1.4,.6,1);
      }
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
  }
  scene.add(new THREE.HemisphereLight('#d4d9da','#534531',.8));
  scene.add(new THREE.AmbientLight('#c5beb2',.2));
  const key=new THREE.DirectionalLight('#f0ddbc',1.6);key.position.set(-15,25,20);scene.add(key);
  const rim=new THREE.DirectionalLight('#adc3cf',.85);rim.position.set(20,16,-20);scene.add(rim);
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
  requestAnimationFrame(() => $('loading').classList.add('loaded'));
}

function resize() {
  if(!renderer)return;
  const r=stage.getBoundingClientRect();
  renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();requestDraw();
}
new ResizeObserver(resize).observe(stage);
addEventListener('resize',updateScroll,{passive:true});
motion.addEventListener('change',()=>{progress=desired;requestDraw();});

function requestDraw(){if(!frame)frame=requestAnimationFrame(draw);}
function draw(time) {
  frame=0;
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
    lamps.forEach(l=>{const accent=l.userData.artGlyph===selected?1+pose.focus*.2:1-pose.focus*.48;l.intensity=l.userData.base*accent*(bright?1.25:1);});
    $('experience').classList.toggle('is-detail',pose.focus>.35);
    $('view-label').textContent=pose.chapter>0&&pose.chapter<7?exhibitionSites[pose.chapter-1].room:'한글 건축관';
    if(dust) dust.rotation.y=progress*.12;
    renderer.render(scene,camera);
  }
  $('angle').textContent=`${Math.round(progress*100)}%`;
  $('zoom-value').textContent=`${Math.round(zoom*100)}%`;
  $('orbit-point').style.transform=`rotate(${progress*360}deg)`;
  $('page-progress').style.width=`${progress*100}%`;
  $('nav-progress').style.width=`${progress*100}%`;
  updateChapter();
  if(Math.abs(progress-desired)>.00001||Math.abs(zoom-desiredZoom)>.00001)requestDraw();
}
try { setup(); } catch(error) {
  console.error('The gallery could not initialize:',error);
  $('fallback').hidden=false;$('loading').classList.add('loaded');updateScroll();
}
