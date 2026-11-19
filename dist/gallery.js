import * as THREE from './assets/three.module.js';

const $ = (id) => document.getElementById(id);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const stops = [0, .19, .38, .57, .76, 1];
const chapters = [
  {eyebrow:'A QUIET MUSEUM OF LETTERS', title:'글자가<br>머무는 집.', body:'익숙한 글자를, 낯선 시선으로.<br>빛과 그림자 사이에서 한글을 만납니다.',note:'여섯 개의 조형, 하나의 공간.',glyph:'ㅇ',name:'여백의 형태',material:'PATINATED BRONZE'},
  {eyebrow:'GIYEOK · THE BEGINNING', title:'시작은,<br>하나의 꺾임.', body:'선이 방향을 바꾸는 순간.<br>단단한 돌 위에 첫 소리가 놓입니다.',note:'ㄱ · 석회암 · 시작의 모양',glyph:'ㄱ',name:'시작의 모양',material:'WARM LIMESTONE'},
  {eyebrow:'IEUNG · THE EMPTY SPACE', title:'비어 있어,<br>가득한 형태.', body:'닫힌 원 안에 열린 풍경.<br>청동의 둥근 여백으로 빛이 흐릅니다.',note:'ㅇ · 청동 · 여백의 형태',glyph:'ㅇ',name:'여백의 형태',material:'PATINATED BRONZE'},
  {eyebrow:'MIEUM · A ROOM WITHIN', title:'마음에도,<br>방이 있다면.', body:'네 개의 선이 감싸는 작은 세계.<br>붉은 흙의 온기가 공간에 머뭅니다.',note:'ㅁ · 테라코타 · 마음의 방',glyph:'ㅁ',name:'마음의 방',material:'FIRED TERRACOTTA'},
  {eyebrow:'HIEUT · A BREATH OF LIGHT', title:'소리가 빛이<br>되는 순간.', body:'작은 획과 둥근 숨.<br>고요한 한글의 형태가 어둠을 밝힙니다.',note:'ㅎ · 황동 · 빛의 숨',glyph:'ㅎ',name:'빛의 숨',material:'BRUSHED BRASS'},
  {eyebrow:'BACK HOME · A NEW PERSPECTIVE', title:'한 바퀴,<br>새로운 시선.', body:'같은 글자, 달라진 풍경.<br>한글의 또 다른 얼굴을 발견하셨나요.',note:'글자의 집 · 빛과 형태의 수집',glyph:'ㅅ',name:'서로를 향한 선',material:'IVORY CERAMIC'}
];
let progress = 0, desired = 0, chapter = -1, frame = 0, lastTime = 0;
let scene, camera, renderer, house, dust;
let bright = false, textTimer, scrollHeight = 1;
const lamps = [], roofPanels = [], occluders = [];
const stage = $('stage');
const clamp = THREE.MathUtils.clamp;

function updateScroll() {
  scrollHeight = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  desired = clamp(scrollY / scrollHeight, 0, 1);
  if (motion.matches) { progress = desired; draw(performance.now()); }
  else requestDraw();
}
function goTo(p) {
  scrollTo({ top: p * Math.max(1, document.documentElement.scrollHeight - innerHeight), behavior: motion.matches ? 'instant' : 'smooth' });
}
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
  const index = Math.min(5, Math.floor(progress * 5 + .27));
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
  $('scroll-label').innerHTML = index===5 ? '처음으로 돌아가기<small>BACK TO THE HOUSE</small>' : '스크롤하며 둘러보세요<small>SCROLL TO EXPLORE</small>';
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
  const ctx=c.getContext('2d');ctx.fillStyle='#403124';ctx.fillRect(0,0,128,512);
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
function glyph(type,mat,x,z,scale=1,rotation=0) {
  const g=new THREE.Group();house.add(g);g.position.set(x,1.08,z);g.scale.setScalar(scale);g.rotation.y=rotation;
  if(type==='ㄱ') {bar(-.8,2.1,.7,2.1,.39,.48,mat,g);bar(.7,2.1,.7,.12,.39,.48,mat,g);}
  if(type==='ㅇ') ring(.95,.23,mat,g,0,1.19,0);
  if(type==='ㅁ') squareRing(mat,g);
  if(type==='ㅅ') {bar(-.85,.15,0,2.12,.36,.43,mat,g);bar(0,2.12,.85,.15,.36,.43,mat,g);}
  if(type==='ㅎ') {bar(-.4,2.55,.4,2.55,.19,.35,mat,g);bar(-.72,2.14,.72,2.14,.21,.4,mat,g);ring(.64,.18,mat,g,0,.92,0);}
  if(type==='ㅏ') {bar(-.32,.15,-.32,2.2,.34,.4,mat,g);bar(-.32,1.23,.8,1.23,.31,.4,mat,g);}
  return g;
}
function roofQuad(x1,y1,x2,y2,z1,z2,mat) {
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([x1,y1,z1,x2,y2,z1,x2,y2,z2,x1,y1,z2],3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
  const uv=new Float32Array([0,0,1,0,1,1,0,1]);geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return mesh(geo,mat);
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
  const stone=material('#4a4843',.85,0,stoneTexture([101,98,91],25));
  const dark=material('#292a28',.72,.12,stoneTexture([97,97,91],19));
  const floor=material('#535047',.49,.12,stoneTexture([114,108,95],12));
  const timber=material('#ad8b64',.76,0,woodTexture());
  const blackMetal=material('#302f2b',.42,.48);
  const roofMat=material('#383832',.8,.12,stoneTexture([91,92,85],15));
  const wallMat=material('#686259',.94,0,stoneTexture([132,123,107],32));
  const bronze=material('#bc8c49',.28,.67);
  const ivory=material('#e6d9bd',.5,.03,stoneTexture([235,224,200],8));
  const red=material('#9b4931',.66,.04,stoneTexture([198,141,111],12));
  const gold=material('#d4a85a',.3,.58);
  const green=material('#617367',.54,.18);
  const ceramic=material('#d3d1bd',.34,.08);
  const ground=mesh(new THREE.PlaneGeometry(200,200),material('#181917',.82),0,-.12,0,scene);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  box(16,.42,8.7,dark,0,.11,0);
  box(15.7,.16,8.4,floor,0,.4,0);
  // Stone joints and three floating entry steps.
  const joint=material('#373832',.9);
  for(let x=-6;x<=6;x+=2) box(.018,.008,8.3,joint,x,.485,0);
  for(let z=-2;z<=2;z+=2) box(15.6,.008,.016,joint,0,.486,z);
  for(let i=0;i<3;i++) box(7.2,.12,1.04,dark,-2.9,.29-i*.12,4.2+i*.53);
  const strip=new THREE.MeshBasicMaterial({color:'#eac08a',toneMapped:false});
  for(let i=0;i<3;i++) box(7.05,.018,.025,strip,-2.9,.34-i*.12,4.73+i*.53);
  for(let x of [-7.25,2.15,7.25]) for(let z of [-3.7,3.7]) box(.15,4.65,.17,blackMetal,x,2.79,z);
  // Twin pitched roofs echo the gallery house; the near half opens to the viewer.
  const roofs=[{left:-7.45,right:2.3,peak:-2.575,eave:4.95,ridge:7.08},{left:2.15,right:7.5,peak:4.825,eave:4.12,ridge:5.55}];
  for(const r of roofs) {
    for(const z of [-3.9,3.9]) {
      beam([r.left,r.eave,z],[r.peak,r.ridge,z],.1,blackMetal);
      beam([r.peak,r.ridge,z],[r.right,r.eave,z],.1,blackMetal);
      beam([r.left,r.eave-.12,z],[r.peak,r.ridge-.12,z],.055,timber);
      beam([r.peak,r.ridge-.12,z],[r.right,r.eave-.12,z],.055,timber);
    }
    beam([r.peak,r.ridge,-3.9],[r.peak,r.ridge,3.9],.09,blackMetal);
    for(const [z1,z2,side] of [[-3.9,0,-1],[0,3.9,1]]) {
      for(const [xa,ya,xb,yb] of [[r.left,r.eave,r.peak,r.ridge],[r.peak,r.ridge,r.right,r.eave]]) {
        const m=roofMat.clone();m.side=THREE.DoubleSide;m.transparent=true;m.depthWrite=false;
        const panel=roofQuad(xa,ya,xb,yb,z1,z2,m);panel.castShadow=false;roofPanels.push({mesh:panel,side});
      }
    }
    for(const x of [r.left,r.right]) beam([x,r.eave,-3.9],[x,r.eave,3.9],.09,blackMetal);
  }
  // Back walls and timber fins become translucent only when they obstruct the orbit.
  for(const [x,w,h] of [[-5.15,4.3,4.3],[.7,2.8,4.3],[6.2,2.2,3.5]]) {
    const m=wallMat.clone();m.transparent=true;const b=box(w,h,.2,m,x,h/2+.5,-3.7);occluders.push(b);
  }
  for(let x=-7.2;x<-5.6;x+=.23) box(.07,4.3,.11,timber,x,2.65,3.67);
  for(let z=-3.5;z<=3.5;z+=.65) {box(.07,4.3,.07,blackMetal,-7.25,2.65,z);box(.07,3.5,.07,blackMetal,7.25,2.25,z);}
  const glass=new THREE.MeshPhysicalMaterial({color:'#8d9a8e',metalness:.1,roughness:.2,transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false});
  box(.02,4.25,7.2,glass,-7.25,2.65,0);box(.02,3.5,7.2,glass,7.25,2.25,0);
  // Six Hangul sculptures, each built as genuine volumetric geometry.
  const artworks=[
    {char:'ㄱ',x:-5.2,z:1.65,mat:ivory,scale:1.06,rot:-.08},
    {char:'ㅇ',x:-1.9,z:.9,mat:bronze,scale:1.13,rot:.12},
    {char:'ㅁ',x:2,z:1.5,mat:red,scale:.95,rot:-.11},
    {char:'ㅎ',x:5.45,z:.45,mat:gold,scale:.91,rot:-.12},
    {char:'ㅅ',x:-4,z:-1.9,mat:ceramic,scale:.84,rot:2.9},
    {char:'ㅏ',x:.1,z:-2,mat:green,scale:.95,rot:3.3}
  ];
  for(const art of artworks) {
    box(art.char==='ㅇ'?2.7:2.25,.55,1.65,stone,art.x,.765,art.z);
    box(art.char==='ㅇ'?2.74:2.29,.035,1.69,dark,art.x,1.06,art.z);
    glyph(art.char,art.mat,art.x,art.z,art.scale,art.rot);
    plaque(art.char,art.x,art.z+.83);
    // The fixtures, targets and shadow-casting spotlights occupy the same space.
    const ly=art.x>3?4.45:5.35;
    const sx=art.x-.4,sz=art.z+.95;
    const target=new THREE.Object3D();target.position.set(art.x,1.7,art.z);scene.add(target);
    const spot=new THREE.SpotLight('#ffdbab',155,13,.48,.75,1.8);spot.position.set(sx,ly,sz);spot.target=target;
    spot.castShadow=true;spot.shadow.mapSize.set(768,768);spot.shadow.bias=-.0003;spot.shadow.normalBias=.045;spot.shadow.camera.near=.2;spot.shadow.camera.far=15;spot.shadow.blurSamples=8;spot.userData.base=155;
    scene.add(spot);lamps.push(spot);
    const fixture=mesh(new THREE.CylinderGeometry(.105,.105,.34,16),blackMetal,sx,ly+.05,sz);fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),target.position.clone().sub(fixture.position).normalize());
    const bulb=mesh(new THREE.CircleGeometry(.077,20),new THREE.MeshBasicMaterial({color:'#ffe3b5'}),0,0,0,fixture);bulb.position.y=-.173;bulb.rotation.x=Math.PI/2;
    box(1.3,.055,.07,blackMetal,sx,ly+.3,sz);
    const pool=mesh(new THREE.CircleGeometry(1.6,48),new THREE.MeshBasicMaterial({color:'#d8a45e',transparent:true,opacity:.025,depthWrite:false}),art.x,.493,art.z+.2);pool.rotation.x=-Math.PI/2;pool.scale.y=.8;pool.castShadow=false;
  }
  // Benches, a slender branch and warm cove lighting make it a house, not a display case.
  box(2.2,.12,.58,timber,3.1,.95,3.3);box(.12,.48,.48,blackMetal,2.2,.69,3.3);box(.12,.48,.48,blackMetal,4,.69,3.3);
  box(2.2,.12,.58,timber,-1.3,.95,-3.2);box(.12,.48,.48,blackMetal,-2.2,.69,-3.2);box(.12,.48,.48,blackMetal,-.4,.69,-3.2);
  box(8.8,.025,.025,strip,-2.8,.54,-3.55);box(4.9,.025,.025,strip,4.75,.54,-3.55);
  mesh(new THREE.CylinderGeometry(.12,.19,.55,24),material('#baa482',.64),-6.5,.77,-2.7);
  for(let i=0;i<6;i++) beam([-6.5,1,-2.7],[-6.5+Math.sin(i*2.1)*.37,1.6+i*.12,-2.7+Math.cos(i)*.26],.012,timber);
  scene.add(new THREE.HemisphereLight('#d0d4d7','#413021',.68));
  const ambient=new THREE.AmbientLight('#b8b4ab',.2);scene.add(ambient);
  const key=new THREE.DirectionalLight('#e3d5be',1.7);key.position.set(-9,15,13);scene.add(key);
  const rim=new THREE.DirectionalLight('#9cabc4',1.15);rim.position.set(8,10,-10);scene.add(rim);
  const bounce=new THREE.PointLight('#d4b18b',45,35,2);bounce.position.set(0,7,10);scene.add(bounce);
  const warm=new THREE.PointLight('#ffc27e',18,15,2);warm.position.set(-2,1.7,-3.2);scene.add(warm);
  const p=new Float32Array(100*3);let s=123;
  for(let i=0;i<p.length;i++){s=(s*16807)%2147483647;p[i]=((s%1000)/1000-.5)*(i%3===1?9:23);if(i%3===1)p[i]+=5;}
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(p,3));
  dust=new THREE.Points(pg,new THREE.PointsMaterial({color:'#dbbc82',size:.017,transparent:true,opacity:.23,depthWrite:false}));scene.add(dust);
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
  if(Math.abs(progress-desired)<.00006)progress=desired;
  if(camera) {
    // Exactly one revolution: both ends share the same camera position.
    const orbit = motion.matches ? stops[Math.min(5, Math.floor(progress*5+.27))] : progress;
    const theta=.46+orbit*Math.PI*2;
    const mobile=innerWidth<761;
    const radius=mobile?30:25.7;
    const breath=Math.sin(progress*Math.PI*2)**2;
    camera.position.set(Math.sin(theta)*radius,12.1+breath*1.4,Math.cos(theta)*radius);
    camera.lookAt(0,mobile?2.45:2.65,0);
    camera.fov=mobile?43:35;camera.updateProjectionMatrix();
    const nearZ=Math.cos(theta);
    roofPanels.forEach(p=>{p.mesh.material.opacity=THREE.MathUtils.lerp(.96,.065,THREE.MathUtils.smoothstep(p.side*nearZ,-.15,.25));});
    occluders.forEach(m=>{m.material.opacity=THREE.MathUtils.lerp(.09,1,THREE.MathUtils.smoothstep(nearZ,-.35,.15));m.material.depthWrite=m.material.opacity>.98;});
    if(dust) dust.rotation.y=progress*.12;
    renderer.render(scene,camera);
  }
  $('angle').textContent=`${Math.round(progress*360)}°`;
  $('orbit-point').style.transform=`rotate(${progress*360}deg)`;
  $('page-progress').style.width=`${progress*100}%`;
  $('nav-progress').style.width=`${progress*100}%`;
  updateChapter();
  if(Math.abs(progress-desired)>.00001)requestDraw();
}
try { setup(); } catch(error) {
  console.error('The gallery could not initialize:',error);
  $('fallback').hidden=false;$('loading').classList.add('loaded');updateScroll();
}
