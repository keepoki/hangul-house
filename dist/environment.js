import {createSurfacePixels} from './surface-textures.js';

// Individual, weathered stones rather than copies of a faceted icosahedron. The continuous
// 3D noise field gives each stone its own silhouette, and welded normals remove triangle seams.
export function createNaturalRockGeometry(THREE,seed,detail=8){
  const geometry=new THREE.IcosahedronGeometry(1,detail),positions=geometry.getAttribute('position'),colors=new Float32Array(positions.count*3),keys=[];
  const hash=(x,y,z)=>{let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(z,1442695041)+Math.imul(seed,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
  const mix=(a,b,t)=>a+(b-a)*t,fade=t=>t*t*(3-2*t);
  function noise(x,y,z){const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),a=fade(x-i),b=fade(y-j),c=fade(z-k);
    return mix(mix(mix(hash(i,j,k),hash(i+1,j,k),a),mix(hash(i,j+1,k),hash(i+1,j+1,k),a),b),mix(mix(hash(i,j,k+1),hash(i+1,j,k+1),a),mix(hash(i,j+1,k+1),hash(i+1,j+1,k+1),a),b),c);}
  const shift=(seed%37)*.73;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    keys.push([x,y,z].map(v=>Math.round(v*10000)).join(','));
    const coarse=noise(x*1.7+shift,y*1.9+4,z*1.7+13),medium=noise(x*4.8-9,y*4.8+shift,z*4.8+2),fine=noise(x*12+5,y*12-2,z*12+shift);
    const strata=Math.pow(1-Math.abs(Math.sin((x*.72+y*1.6+z*.39+coarse*.68)*Math.PI*2.7)),7);
    const radial=.89+(coarse-.5)*.49+(medium-.5)*.22+(fine-.5)*.055-strata*.026;
    let py=y*radial+(coarse-.5)*.11+.095*x;
    if(py<-.58)py=-.58+(py+.58)*.32;else if(py>.76)py=.76+(py-.76)*.68;
    positions.setXYZ(i,x*radial+.12*y+.022*medium,py,z*radial-.085*y+.035*coarse);
    const wet=THREE.MathUtils.smoothstep(y,-.48,.12),light=.67+.20*coarse+.14*medium+.05*fine-.055*strata;
    colors[i*3]=light*(.70+.30*wet);colors[i*3+1]=light*(.72+.28*wet)*.985;colors[i*3+2]=light*(.75+.25*wet)*.93;
  }
  // Each polyhedron face owns its vertices. Accumulate area-weighted normals at coincident
  // positions so the stone has smooth shading, without erasing its irregular silhouette.
  const sums=new Map(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
  for(let i=0;i<positions.count;i+=3){a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);normal.subVectors(b,a).cross(c.sub(a));
    for(let j=0;j<3;j++){const key=keys[i+j];if(!sums.has(key))sums.set(key,new THREE.Vector3());sums.get(key).add(normal);}}
  const normals=new Float32Array(positions.count*3);
  for(let i=0;i<positions.count;i++){normal.copy(sums.get(keys[i])).normalize();if(normal.lengthSq()<.5)normal.fromBufferAttribute(positions,i).normalize();normals.set(normal.toArray(),i*3);}
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeBoundingSphere();geometry.computeBoundingBox();
  return geometry;
}
// Procedural architectural materials and landscaping. All geometry and maps are authored locally.
export function createEnvironment(THREE, {mobile=false,progressive=false,compact=false,premium=false,onSurfaceReady=()=>{}}={}) {
  const {PI,sin,cos,pow,sqrt,floor,abs}=Math;
  function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function hash(x,y,seed=1){let n=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(seed,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
  const pending=new Map();let hydrationPromise;
  function texture(bytes,w,h,srgb=false){const t=new THREE.DataTexture(bytes,w,h);t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=premium?4:2;t.needsUpdate=true;return t;}
  function surface(kind,base,seed=7,withNormal=true){
    const n=premium?(mobile||['gravel','basalt'].includes(kind)?256:512):compact?(withNormal&&!mobile?128:64):(withNormal&&!mobile?256:128),initial=progressive?32:n;
    const {albedo,normal,rough}=createSurfacePixels(kind,base,seed,initial,withNormal,premium);
    const map=texture(albedo,initial,initial,true),normalMap=normal?texture(normal,initial,initial):null,roughnessMap=rough?texture(rough,initial,initial):null;
    for(const t of [map,normalMap,roughnessMap].filter(Boolean))t.repeat.set(kind==='wood'?3:kind==='floor'?12:4,kind==='wood'?1:kind==='floor'?12:4);
    if(progressive){const id=pending.size;pending.set(id,{id,kind,base,seed,n,withNormal,withRoughness:premium,maps:[map,normalMap,roughnessMap]});}
    return{map,normalMap,roughnessMap};
  }
  function hydrate({workerFactory,schedule=(callback)=>setTimeout(callback,0)}={}){
    if(!pending.size)return Promise.resolve();if(hydrationPromise)return hydrationPromise;
    let complete;hydrationPromise=new Promise(resolve=>complete=resolve);let fallbackStarted=false;
    function apply(result){const task=pending.get(result.id);if(!task)return;pending.delete(result.id);
      [result.albedo,result.normal,result.rough].forEach((data,i)=>{const map=task.maps[i];if(!map||!data)return;map.dispose();map.image={data,width:result.n,height:result.n};map.needsUpdate=true;});onSurfaceReady();if(!pending.size)complete();}
    // Older browsers and standalone HTML still upgrade one material at a time after the first frame.
    function fallback(){if(!pending.size)return;const task=pending.values().next().value;
      schedule(()=>{apply({id:task.id,...createSurfacePixels(task.kind,task.base,task.seed,task.n,task.withNormal,task.withRoughness)});fallback();});}
    function startFallback(){if(fallbackStarted)return;fallbackStarted=true;fallback();}
    if(!workerFactory){startFallback();return hydrationPromise;}
    let worker;
    try{worker=workerFactory();worker.onmessage=({data})=>{apply(data);if(!pending.size)worker.terminate();};worker.onerror=()=>{worker.terminate();startFallback();};
      worker.postMessage({tasks:[...pending.values()].map(({id,kind,base,seed,n,withNormal,withRoughness})=>({id,kind,base,seed,n,withNormal,withRoughness}))});}
    catch{worker?.terminate();startFallback();}
    return hydrationPromise;
  }
  function architecturalMaterial(type,color,base,roughness=.65,metalness=0,seed=7){
    const detailed=premium||seed===17||seed===43||seed===61;
    const maps=surface(type,base,seed,detailed);
    if(premium)return new THREE.MeshStandardMaterial({color,roughness,metalness,...maps,normalScale:new THREE.Vector2(.62,.62),envMapIntensity:.47});
    return detailed?new THREE.MeshPhongMaterial({color,map:maps.map,normalMap:maps.normalMap,normalScale:new THREE.Vector2(.48,.48),specular:'#262626',shininess:14}):new THREE.MeshLambertMaterial({color,map:maps.map});
  }
  const materials={
    limestone:architecturalMaterial('limestone','#f1e5cf',[225,218,202],.8,0,17),
    dark:architecturalMaterial('basalt','#767978',[83,86,83],.85,.02,43),
    floor:architecturalMaterial('floor','#d6cfbc',[156,151,138],.75,.02,11),
    timber:architecturalMaterial('wood','#e4b77d',[177,139,91],.75,0,61),
    hall:architecturalMaterial('limestone','#a3a294',[149,149,140],.96,0,3),
    gravel:architecturalMaterial('gravel','#b7ad97',[159,151,131],.98,0,73),
    bark:architecturalMaterial('wood','#aa8a65',[90,75,54],.97,0,47),
    soil:architecturalMaterial('gravel','#6b6251',[85,80,60],1,0,21)
  };
  if(premium){materials.rock=architecturalMaterial('riverstone','#dedbd0',[143,143,135],.78,.02,137);materials.rock.vertexColors=true;materials.rock.normalScale.set(1.18,1.18);materials.rock.envMapIntensity=.58;}
  function stoneGeometry(detail){const geo=new THREE.IcosahedronGeometry(1,detail),p=geo.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=.9+.14*sin(x*7+y*3+z*8)+.065*cos(z*15-x*11);p.setXYZ(i,x*d,y*d,z*d);}geo.computeVertexNormals();return geo;}
  const rockGeo=stoneGeometry(premium?2:1),pebbleGeo=stoneGeometry(premium?1:0);
  const leafGeo=new THREE.BufferGeometry(),lp=[],li=[];
  // Each leaf has a curved midrib, tapered blade and subtly curled margins.
  const leafSegments=premium?7:4;
  for(let i=0;i<=leafSegments;i++){const t=i/leafSegments,w=.27*pow(sin(PI*t),.8);for(const u of [-1,0,1])lp.push(u*w,t,.11*sin(PI*t)-abs(u)*w*.35);}
  for(let i=0;i<leafSegments;i++)for(let j=0;j<2;j++){const a=i*3+j,b=a+3;li.push(a,b,a+1,b,b+1,a+1);}leafGeo.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));leafGeo.setIndex(li);leafGeo.computeVertexNormals();
  const leafMat=premium?new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.72,side:THREE.DoubleSide,envMapIntensity:.22}):new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide});
  const grassGeo=new THREE.BufferGeometry(),gp=[],gi=[];
  const grassSegments=premium?5:3;
  for(let i=0;i<=grassSegments;i++){let t=i/grassSegments,w=.07*(1-t*.95);gp.push(-w,t,.3*t*t,w,t,.3*t*t+.014);if(i<grassSegments){let k=i*2;gi.push(k,k+2,k+1,k+1,k+2,k+3);}}grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));grassGeo.setIndex(gi);grassGeo.computeVertexNormals();
  const grassMat=premium?new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92,side:THREE.DoubleSide}):new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide});
  const pebbleMat=materials.gravel.clone();pebbleMat.color.set('#d2c4a9');
  function add(parent,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function solid(parent,w,h,d,mat,x,y,z){return add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  function instances(parent,geo,mat,count,fill,seed,kind){const m=new THREE.InstancedMesh(geo,mat,count),rng=random(seed);m.userData.environmentDetail=kind;m.userData.fullDetailCount=count;m.castShadow=false;m.receiveShadow=true;
    for(let i=0;i<count;i++){dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);fill(dummy,rng,i,color);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,color);}
    m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere();parent.add(m);return m;
  }
  function branch(parent,a,b,r0,r1){const v=new THREE.Vector3().subVectors(b,a),m=add(parent,new THREE.CylinderGeometry(r1,r0,v.length(),premium?9:6),materials.bark,0,0,0);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m;}
  function tree(parent,x,z,seed=3,size=1){
    const tree=new THREE.Group();tree.position.set(x,.2,z);tree.scale.setScalar(size);tree.userData.environmentDetail='botanical-tree';parent.add(tree);const rng=random(seed),V=(x,y,z)=>new THREE.Vector3(x,y,z),ends=[];
    const roots=V(0,0,0),knuckle=V(.1,1.35,.08),fork=V(.22,2.55,-.12);branch(tree,roots,knuckle,.18,.13);branch(tree,knuckle,fork,.13,.086);
    for(let i=0;i<7;i++){
      const a=i*PI*2/7+rng()*.5,spread=.65+rng()*.55,h=2.35+rng()*1.25,from=i<4?V(.12,1.7+i*.15,0):fork;
      const mid=V(cos(a)*spread*.55,h-.25,sin(a)*spread*.55),tip=V(cos(a)*spread,h+.35,sin(a)*spread);branch(tree,from,mid,.074,.036);branch(tree,mid,tip,.035,.016);
      for(let j=0;j<4;j++){
        const q=a+(j-1.5)*.57,twig=V(tip.x+cos(q)*(.4+rng()*.44),tip.y+(rng()-.25)*.63,tip.z+sin(q)*(.4+rng()*.44));branch(tree,mid.clone().lerp(tip,.45+j*.1),twig,.018,.009);ends.push(twig);
      }
    }
    const total=premium?(mobile?1550:3100):(mobile?700:1400);
    instances(tree,leafGeo,leafMat,total,(o,r,i,c)=>{
      const e=ends[i%ends.length],theta=r()*2*PI,rad=sqrt(r())*(.48+r()*.24),height=(r()-.5)*.62;
      o.position.set(e.x+cos(theta)*rad,e.y+height,e.z+sin(theta)*rad);o.rotation.set((r()-.5)*PI,(r()-.5)*PI*2,(r()-.5)*PI);const s=premium?.16+r()*.18:.21+r()*.20;o.scale.set(s*(.8+r()*.5),s,s);c.setHSL(.24+r()*.085,.24+r()*.23,.19+r()*.14);
    },seed+20,'leaves');return tree;
  }
  function grasses(parent,x,z,w,d,seed){const count=premium?(mobile?280:580):(mobile?144:288),clusters=Math.ceil(count/(premium?13:8));instances(parent,grassGeo,grassMat,count,(o,r,i,c)=>{const tu=i%clusters,clusterX=hash(tu,0,seed)-.5,clusterZ=hash(tu,1,seed)-.5;const angle=r()*2*PI,rad=r()*.22;o.position.set(x+clusterX*(w-.5)+cos(angle)*rad,.19,z+clusterZ*(d-.55)+sin(angle)*rad);o.rotation.set(0,r()*2*PI,(r()-.5)*.7);const size=.24+r()*.61;o.scale.set(.9+r()*.7,size,size);c.setHSL(.17+r()*.13,.22+r()*.3,.19+r()*.18);},seed,'grass');}
  function rock(parent,x,z,size,seed,y=.22,shape='low'){
    const rng=random(seed),detail=size>.75?(mobile?7:10):size>.38?(mobile?5:7):4,geo=premium?createNaturalRockGeometry(THREE,seed,detail):rockGeo;
    const height=shape==='upright'?1.15:shape==='boulder'?.83:.52;
    const m=add(parent,geo,premium?materials.rock:materials.dark,x,y+size*(shape==='upright'?.35:.25),z);
    m.rotation.set((rng()-.5)*.28,rng()*PI*2,(rng()-.5)*.32);m.scale.set(size*(1.05+rng()*.34),size*(height+rng()*.15),size*(.78+rng()*.32));
    m.name='Weathered riverstone '+seed;m.userData.environmentDetail='natural-stone';m.userData.stoneSeed=seed;return m;
  }
  function pebbles(parent,seed){instances(parent,pebbleGeo,pebbleMat,premium?(mobile?550:1050):(mobile?224:448),(o,r,i,c)=>{let x=(r()-.5)*10.4,z=(r()-.5)*9.5;if(abs(x)<2.7&&abs(z)<1.8)x=(x<0?-1:1)*3.2;if(z>1.65&&abs(x)<1.95)x=x<0?-2.15:2.15;o.position.set(x,.16,z);o.rotation.set(r()*.8,r()*2*PI,r()*.6);const s=.035+r()*.085;o.scale.set(s*1.5,s*.6,s);c.setHSL(.09+r()*.04,.08+r()*.09,.36+r()*.31);},seed,'pebbles');}
  function timberDeck(parent,mat){
    for(let i=0;i<28;i++){const x=-5.4+i*.4;const pl=solid(parent,.392,.1,9.8,mat,x,.16,0);pl.userData.environmentDetail='deck-board';}
    for(const x of [-4.8,4.8])for(const z of [-4.15,3.75])solid(parent,.24,5.45,.24,mat,x,2.84,z);
    for(const z of [-4.15,3.75])solid(parent,10.15,.34,.26,mat,0,5.55,z);
    for(let x=-4.7;x<=4.7;x+=.46)solid(parent,.16,.23,8.25,mat,x,5.74,-.16);
    for(let x=-4.7;x<=4.7;x+=.28)solid(parent,.12,4.65,.16,mat,x,2.7,-4.18);
    for(const x of [-3.82,3.82]){solid(parent,1.15,.15,2.3,mat,x,.52,-2.75);solid(parent,.84,.4,1.98,materials.dark,x,.30,-2.75);}
  }
  return{materials,tree,grasses,rock,pebbles,timberDeck,hydrate};
}

// View-dependent planar reflection plus multi-scale capillary normals and shallow-water color.
// A high-resolution reflection is updated at a bounded rate; the small waves animate independently.
export function createReflectingPool(THREE, parent, scene, renderer, width=11.1,depth=9.8,mobile=false,mirror=true){
  const fallback=new THREE.MeshPhongMaterial({color:'#38524a',specular:'#87a59c',shininess:36});
  const animated=renderer?.isWebGLRenderer===true;let capable=animated&&mirror;
  const resolution=Math.min(mobile?512:1024,renderer?.capabilities?.maxTextureSize??1024);
  const geometry=new THREE.PlaneGeometry(width,depth),target=capable?new THREE.WebGLRenderTarget(resolution,resolution,{type:renderer.extensions?.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,generateMipmaps:false}):null;
  const mirrorMatrix=new THREE.Matrix4(),reflectionCamera=new THREE.PerspectiveCamera(),plane=new THREE.Plane();
  const material=animated?new THREE.ShaderMaterial({transparent:false,depthWrite:true,defines:capable?{MIRROR:1}:{},uniforms:{reflection:{value:target?.texture??null},reflectionMatrix:{value:mirrorMatrix},time:{value:0},alpha:{value:1},light:{value:1},ready:{value:0}},
    vertexShader:`uniform mat4 reflectionMatrix; varying vec4 vReflection; varying vec3 vWorld; varying vec2 vPoolUV;
    void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;vPoolUV=uv;vReflection=reflectionMatrix*world;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform sampler2D reflection; uniform float time; uniform float alpha; uniform float light; uniform float ready; varying vec4 vReflection; varying vec3 vWorld; varying vec2 vPoolUV;
    void main(){
      vec2 p=vWorld.xz; float t=time*.72;
      // Broad wind waves, cross-ripples, and fine capillary waves. Their analytic derivatives
      // provide a continuous surface normal rather than painted-on animated stripe lines.
      vec2 d0=vec2(.91,.414),d1=vec2(-.49,.872),d2=vec2(.26,.966),d3=vec2(.78,-.626);
      float a0=dot(p,d0)*2.4+t*.52, a1=dot(p,d1)*4.7-t*.73;
      float a2=dot(p,d2)*9.1+t*1.14+sin(a0)*.42, a3=dot(p,d3)*18.0-t*1.6+sin(a1)*.3;
      vec2 slope=d0*cos(a0)*.024+d1*cos(a1)*.017+d2*cos(a2)*.008+d3*cos(a3)*.0035;
      vec3 N=normalize(vec3(-slope.x,1.,-slope.y)),V=normalize(cameraPosition-vWorld);
      float facing=clamp(dot(N,V),0.,1.),fresnel=.34+.66*pow(1.-facing,3.25);
      float shore=min(min(vPoolUV.x,1.-vPoolUV.x),min(vPoolUV.y,1.-vPoolUV.y));
      float depthFactor=smoothstep(.008,.15,shore);
      float poolGrain=.5+.5*sin(p.x*8.6+sin(p.y*4.4))*sin(p.y*7.3+sin(p.x*5.1));
      float caustic=pow(.5+.5*sin(a1*.94+sin(a2)*.8)*sin(a2*.7+cos(a0)),6.0);
      vec3 floorTint=mix(vec3(.067,.085,.077),vec3(.012,.034,.035),depthFactor);
      floorTint+=(1.-depthFactor)*(.008*poolGrain+.013*caustic)*vec3(.7,.95,.82);
      vec3 reflected=vec3(.102,.146,.145);
      #ifdef MIRROR
      vec2 projected=vReflection.xy/max(vReflection.w,.0001);
      float border=min(min(projected.x,1.-projected.x),min(projected.y,1.-projected.y));
      float valid=step(.0001,vReflection.w)*smoothstep(-.012,.022,border)*ready;
      vec2 uv=clamp(projected+slope*(.055+.044*(1.-facing)),vec2(.003),vec2(.997));
      reflected=mix(reflected,texture2D(reflection,uv).rgb*vec3(.94,.98,.97),valid);
      #endif
      float spec=pow(max(dot(N,normalize(V+normalize(vec3(-.24,.89,.37)))),0.),128.);
      float micro=pow(max(0.,cos(a2)*.52+cos(a3)*.48),10.)*.019;
      float edgeLine=exp(-shore*360.)*.014;
      vec3 outColor=mix(floorTint*light,reflected,fresnel)+spec*vec3(.24,.24,.20)+micro*vec3(.70,.83,.80)+edgeLine*vec3(.64,.77,.68);
      gl_FragColor=vec4(outColor,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }` }):fallback;
  const pool=new THREE.Mesh(geometry,material);pool.rotation.x=-Math.PI/2;pool.position.set(0,.267,0);pool.name='Reflecting pool';pool.userData.environmentDetail='reflecting-pool';pool.receiveShadow=false;pool.castShadow=false;parent.add(pool);
  let last=-Infinity,lastBright,lastAspect,lastFov,reflectionInterval=mobile?155:94;const previousPosition=new THREE.Vector3(),previousQuaternion=new THREE.Quaternion(),position=new THREE.Vector3(),look=new THREE.Vector3(),up=new THREE.Vector3(),clip=new THREE.Vector4(),q=new THREE.Vector4(),bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  function update(camera,seconds,bright,reduce,now,nearby=true,moving=false){
    if(!animated||!pool.visible||!parent.visible)return;
    const activeMaterial=pool.material;activeMaterial.uniforms.time.value=reduce?0:seconds;activeMaterial.uniforms.alpha.value=activeMaterial.opacity;activeMaterial.uniforms.light.value=bright?1.4:1;
    if(!capable)return;
    // Keep the last valid image outside the water room; refresh at a capped rate during the tour.
    if(!nearby)return;
    if(activeMaterial.uniforms.ready.value===1&&lastBright===bright&&lastAspect===camera.aspect&&lastFov===camera.fov&&previousPosition.distanceToSquared(camera.position)<.000025&&Math.abs(previousQuaternion.dot(camera.quaternion))>.999999)return;
    if(now-last<(moving?reflectionInterval:80)&&!reduce)return;last=now;
    pool.getWorldPosition(position);const y=position.y;
    if(camera.position.y<=y+.02)return;
    camera.getWorldDirection(look);look.add(camera.position);
    reflectionCamera.copy(camera,false);reflectionCamera.position.set(camera.position.x,2*y-camera.position.y,camera.position.z);look.y=2*y-look.y;
    up.set(0,-1,0);reflectionCamera.up.copy(up);reflectionCamera.lookAt(look);reflectionCamera.updateMatrixWorld(true);reflectionCamera.projectionMatrix.copy(camera.projectionMatrix);
    mirrorMatrix.copy(bias).multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
    // Oblique near plane excludes geometry beneath the surface.
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),position);plane.applyMatrix4(reflectionCamera.matrixWorldInverse);
    clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);const p=reflectionCamera.projectionMatrix.elements;
    q.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);clip.multiplyScalar(2/clip.dot(q));p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.002;p[14]=clip.w;
    const previous=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate,enabled=renderer.xr?.enabled;pool.visible=false;
    try{if(renderer.xr)renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.setRenderTarget(target);renderer.state.buffers.depth.setMask(true);renderer.clear();renderer.render(scene,reflectionCamera);}
    catch{capable=false;activeMaterial.uniforms.ready.value=0;return;}
    finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadow;if(renderer.xr)renderer.xr.enabled=enabled;pool.visible=true;}
    previousPosition.copy(camera.position);previousQuaternion.copy(camera.quaternion);lastBright=bright;lastAspect=camera.aspect;lastFov=camera.fov;
    activeMaterial.uniforms.ready.value=1;
  }
  return{pool,update,animated,get capable(){return capable;},
    setQuality(profile){const size=Math.min(resolution,profile.reflectionSize);if(target&&target.width!==size){target.setSize(size,size);material.uniforms.ready.value=0;}reflectionInterval=Math.max(mobile?155:94,profile.reflectionInterval);},
    dispose(){target?.dispose();}
  };
}
