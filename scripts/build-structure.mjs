import {readFile,writeFile} from 'node:fs/promises';
import * as THREE from '../dist/assets/three.module.js';
import {buildHangulBuilding} from '../dist/hangul-building.js';

// Project the exhibition model once, so the browser only has to draw SVG.
const finishes={limestone:[194,184,158],timber:[165,114,70],charcoal:[65,59,49],glass:[113,122,108],strip:[216,183,127],floor:[121,111,89],base:[86,76,60]};
const materials=Object.fromEntries(Object.keys(finishes).map(name=>[name,new THREE.MeshBasicMaterial({name})]));
const names=new Map([['ㄱ','giyeok'],['ㅁ','mieum'],['ㅅ','siot'],['ㅇ','ieung']]);
const support=new THREE.Group();
const house=buildHangulBuilding(THREE,support,materials);

function plinthBox(w,h,d,x,y,z,finish){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials[finish]);
  mesh.position.set(x,y,z);
  support.add(mesh);
}
plinthBox(18.2,.46,10.7,0,-.24,0,'base');
plinthBox(17.7,.4,10.2,0,.2,0,'limestone');
plinthBox(17.25,.08,9.7,0,.44,0,'floor');
for(let i=0;i<3;i++){
  plinthBox(8,.12,1,.3,.32-i*.12,5.35+i*.55,'limestone');
  plinthBox(7.9,.018,.025,.3,.37-i*.12,5.85+i*.55,'strip');
}
support.updateMatrixWorld(true);

const azimuth=.54,elevation=.48,scale=30;
const right=new THREE.Vector3(Math.cos(azimuth),0,Math.sin(azimuth));
const eye=new THREE.Vector3(-Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
const up=eye.clone().cross(right);
const light=new THREE.Vector3(-.55,1,.8).normalize();
const faces=[];
const number=n=>Number(n.toFixed(2));
const format=points=>points.map((p,i)=>`${i===0?'M':'L'}${number(353+p.dot(right)*scale)} ${number(324-p.dot(up)*scale)}`).join('')+'Z';

function face(mesh,part,vertices,holes=[],round=false){
  const project=ring=>ring.map(([x,y,z])=>new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld));
  const points=project(vertices);
  const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[1])).normalize();
  if(normal.dot(eye)<=.002)return;
  const finish=mesh.material.name;
  const brightness=.62+.38*Math.max(0,normal.dot(light));
  const fill='rgb('+finishes[finish].map(channel=>Math.round(channel*brightness)).join(' ')+')';
  faces.push({part,depth:points.reduce((sum,p)=>sum+p.dot(eye),0)/points.length,
    path:format(points)+holes.map(ring=>format(project(ring))).join(''),fill,
    round,glass:finish==='glass'});
}

function extrude(mesh,part,outline,holes,near,far){
  const caps=(ring,z)=>ring.map(p=>[p.x,p.y,z]);
  face(mesh,part,caps(outline,far),holes.map(ring=>caps(ring,far)));
  face(mesh,part,caps([...outline].reverse(),near),holes.map(ring=>caps(ring,near)));
  for(const ring of [outline,...holes]){
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      face(mesh,part,[[a.x,a.y,near],[b.x,b.y,near],[b.x,b.y,far],[a.x,a.y,far]],[],ring.length>12);
    }
  }
}

function contour(points,clockwise){
  const ring=points.filter((point,i)=>i===0||point.distanceToSquared(points[i-1])>1e-10);
  if(ring[0].distanceToSquared(ring.at(-1))<1e-10)ring.pop();
  return THREE.ShapeUtils.isClockWise(ring)===clockwise?ring:ring.reverse();
}

support.traverse(mesh=>{
  if(!mesh.isMesh)return;
  // The timber soffits live next to the roof group in the 3D scene.
  const isSoffit=mesh.parent===house&&mesh.material===materials.timber&&mesh.rotation.z!==0;
  const part=isSoffit?'siot':names.get(mesh.parent.userData.structuralGlyph);
  const {type,parameters}=mesh.geometry;
  if(type==='BoxGeometry'){
    const {width:w,height:h,depth:d}=parameters;
    const outline=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>new THREE.Vector2(x,y));
    extrude(mesh,part,outline,[],-d/2,d/2);
  }else if(type==='ExtrudeGeometry'){
    const {shape,holes}=parameters.shapes.extractPoints(36);
    const half=parameters.options.depth/2;
    extrude(mesh,part,contour(shape,false),holes.map(points=>contour(points,true)),-half,half);
  }
});
// Depth order is measured along the camera axis. Ground belongs beneath every group.
faces.sort((a,b)=>a.depth-b.depth);
const pathTag=(face,part=false)=>`<path d="${face.path}" fill="${face.fill}"${part&&face.part?` data-house-part="${face.part}"`:''}${face.glass?' opacity=".22"':''}${face.round?` stroke="${face.fill}" stroke-width=".6"`:' stroke="#28241c" stroke-opacity=".35" stroke-width=".7"'} fill-rule="evenodd"/>`;
const svg=[
  '<svg class="structure-model" viewBox="0 -12 706 502" role="img" aria-labelledby="house-model-title house-model-description">',
  '  <title id="house-model-title">한글 건축관 조립 모형</title>',
  '  <desc id="house-model-description">석재 처마와 기둥, 참나무 입구, 두 획으로 된 지붕과 둥근 창을 비스듬히 내려다본 모습.</desc>',
  '  <defs><filter id="house-model-shadow" x="-25%" y="-60%" width="150%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>',
  '  <ellipse cx="356" cy="355" rx="270" ry="55" fill="#000" opacity=".51" filter="url(#house-model-shadow)"/>',
  '  <g class="structure-assembled">',...faces.map(face=>'    '+pathTag(face,true)),'  </g>',
  ...[...names.values()].flatMap(part=>[
    `  <g class="structure-lifted" data-lifted-part="${part}" aria-hidden="true">`,
    ...faces.filter(face=>face.part===part).map(face=>'    '+pathTag(face)),
    '  </g>'
  ]),
  '</svg>'
].map(line=>'      '+line).join('\n');

const page=new URL('../dist/index.html',import.meta.url);
const html=await readFile(page,'utf8');
const target=/(<!-- house-structure-svg:start -->)\s*[\s\S]*?(?= {6}<!-- house-structure-svg:end -->)/;
if(!target.test(html))throw new Error('Structure SVG placeholder is missing');
if(house.children.filter(child=>names.has(child.userData.structuralGlyph)).length!==names.size)throw new Error('A structural glyph is missing from the pavilion');
const updated=html.replace(target,(_,start)=>`${start}\n${svg}\n`);
if(process.argv.includes('--check')){
  if(updated!==html)throw new Error('Run node scripts/build-structure.mjs to refresh the structure SVG');
}else{
  await writeFile(page,updated);
  console.log(`Projected the pavilion as ${faces.length} visible SVG faces`);
}
