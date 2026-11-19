import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/assets/three.module.js';
import {createEnvironment,createReflectingPool} from '../dist/environment.js';
import {createSurfacePixels} from '../dist/surface-textures.js';

test('lightweight architecture uses color maps and only three close-detail normal maps',()=>{
  const {materials}=createEnvironment(THREE,{mobile:true});
  for(const material of Object.values(materials)){
    assert.ok(material.map.isDataTexture);assert.ok(material.isMeshPhongMaterial||material.isMeshLambertMaterial);assert.ok(!material.roughnessMap);
    assert.equal(material.map.image.width,128);
    assert.ok(new Set(material.map.image.data.slice(0,1000)).size>12);
    if(material.normalMap)assert.ok(new Set(material.normalMap.image.data.slice(0,1000)).size>3);
  }
  assert.equal(Object.values(materials).filter(m=>m.normalMap).length,3);
});
test('landscaping uses branching geometry and instanced leaf and pebble detail',()=>{
  const environment=createEnvironment(THREE,{mobile:true}),scene=new THREE.Scene();
  const tree=environment.tree(scene,3,-1,43);environment.grasses(scene,0,0,2,4,3);environment.pebbles(scene,23);
  assert.ok(tree.children.filter(m=>m.geometry?.type==='CylinderGeometry').length>20);
  const leaves=tree.children.find(m=>m.userData.environmentDetail==='leaves');
  assert.ok(leaves.isInstancedMesh&&leaves.count===700);
  assert.equal(leaves.geometry.index.count/3,16);
  assert.equal(scene.children.find(m=>m.userData.environmentDetail==='pebbles').count,224);
  assert.ok(scene.children.find(m=>m.userData.environmentDetail==='grass').isInstancedMesh);
});
test('startup maps are small and the worker upgrades the existing shared textures',()=>{
  let worker,notifications=0,disposed=0;
  const environment=createEnvironment(THREE,{mobile:false,progressive:true,onSurfaceReady:()=>notifications++});
  const original=environment.materials.limestone.map,cloned=environment.materials.limestone.clone();
  assert.equal(original.image.width,32);assert.equal(original.image.data.byteLength,4096);original.addEventListener('dispose',()=>disposed++);
  environment.hydrate({workerFactory:()=>worker={postMessage(data){this.tasks=data.tasks;},terminate(){this.terminated=true;}}});
  assert.equal(worker.tasks.length,8);
  for(const task of worker.tasks)worker.onmessage({data:{id:task.id,...createSurfacePixels(task.kind,task.base,task.seed,task.n,task.withNormal)}});
  assert.equal(original.image.width,256);assert.equal(cloned.map,original);assert.equal(notifications,8);assert.equal(disposed,1);assert.equal(worker.terminated,true);
  assert.equal(environment.materials.gravel.map.image.width,128);assert.ok(!environment.materials.gravel.normalMap);
});
test('worker failure falls back to individually scheduled texture upgrades',()=>{
  const env=createEnvironment(THREE,{mobile:true,progressive:true}),tasks=[];let worker;
  env.hydrate({workerFactory:()=>worker={postMessage(){},terminate(){}},schedule:callback=>tasks.push(callback)});
  worker.onerror();assert.equal(tasks.length,1);
  for(let i=0;i<8;i++){assert.equal(tasks.length,1);tasks.shift()();}
  assert.equal(tasks.length,0);assert.equal(env.materials.limestone.map.image.width,128);assert.equal(env.materials.soil.map.image.width,128);
});
test('compact gallery textures are final-size and never start a background reallocation',()=>{
  let updates=0;const env=createEnvironment(THREE,{compact:true,onSurfaceReady:()=>updates++});
  assert.equal(env.materials.limestone.map.image.width,128);assert.equal(env.materials.hall.map.image.width,64);
  const maps=Object.values(env.materials).flatMap(m=>[m.map,m.normalMap].filter(Boolean));
  const bytes=maps.reduce((n,map)=>n+map.image.data.byteLength,0);assert.ok(bytes<500000);
  env.hydrate({workerFactory:()=>{throw new Error('No worker should start');},schedule:()=>{throw new Error('No fallback should start');}});
  assert.equal(updates,0);
});
test('mobile water still ripples without a mirror target or a second scene render',()=>{
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);const camera=new THREE.PerspectiveCamera();
  const pool=createReflectingPool(THREE,group,scene,{isWebGLRenderer:true,render(){throw new Error('Must not render another pass');}},11,9,true,false);
  assert.equal(pool.capable,false);assert.equal(pool.animated,true);assert.ok(!pool.pool.material.defines.MIRROR);
  pool.update(camera,1,false,false,1000);assert.equal(pool.pool.material.uniforms.time.value,1);
});
test('the reflection pass mirrors the real camera and restores render state',()=>{
  const scene=new THREE.Scene(),group=new THREE.Group();group.position.set(0,.2,8);scene.add(group);
  const camera=new THREE.PerspectiveCamera(35,1.3,.1,150);camera.position.set(3,4,18);camera.lookAt(0,2,8);camera.updateMatrixWorld(true);
  let current=null,rendered=null,reflectionVisible=true,pool,passes=0,fail=false;
  const renderer={isWebGLRenderer:true,shadowMap:{autoUpdate:true},xr:{enabled:true},state:{buffers:{depth:{setMask(){}}}},getRenderTarget:()=>current,setRenderTarget:v=>current=v,clear(){},render(s,c){passes++;if(fail)throw new Error('Reflection target unavailable');rendered=c.position.clone();reflectionVisible=pool.visible;assert.ok(c.projectionMatrix.elements.every(Number.isFinite));}};
  const result=createReflectingPool(THREE,group,scene,renderer,11,9,true);pool=result.pool;
  result.update(camera,1,false,false,1000);
  assert.ok(rendered);assert.ok(Math.abs(rendered.y-(2*(.2+.267)-4))<.001);
  assert.equal(reflectionVisible,false);assert.equal(pool.visible,true);assert.equal(current,null);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.xr.enabled,true);assert.equal(pool.material.uniforms.ready.value,1);
  assert.ok(pool.material.uniforms.reflectionMatrix.value.elements.every(Number.isFinite));
  result.update(camera,1.2,false,false,1200);assert.equal(passes,1,'A stationary camera reuses its reflection');assert.equal(pool.material.uniforms.time.value,1.2);
  result.update(camera,2,true,true,2000);assert.equal(pool.material.uniforms.time.value,0);
  assert.equal(pool.material.uniforms.light.value,1.4);
  assert.equal(passes,2);
  fail=true;camera.position.x+=1;result.update(camera,3,false,false,3000);
  assert.equal(result.capable,false);assert.equal(pool.material.uniforms.ready.value,0);assert.equal(pool.visible,true);assert.equal(current,null);assert.equal(renderer.shadowMap.autoUpdate,true);
  result.update(camera,4,false,false,4000);assert.equal(passes,3,'Failed reflection is not retried every frame');
});
