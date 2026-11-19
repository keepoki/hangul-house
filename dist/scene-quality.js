// Batch repeated architectural blocks without changing their dimensions, UVs, or materials.
export function batchStaticBoxes(THREE,parent){
  const groups=new Map();
  for(const object of parent.children){
    if(!object.isMesh||object.isInstancedMesh||object.geometry.type!=='BoxGeometry'||Array.isArray(object.material)||object.material.transparent)continue;
    const key=object.material.uuid+':'+object.castShadow+':'+object.receiveShadow;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(object);
  }
  const transform=new THREE.Object3D();
  for(const objects of groups.values()){
    if(objects.length<3)continue;
    const first=objects[0],batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),first.material,objects.length);
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.userData.architectureBatch=true;
    objects.forEach((o,i)=>{
      const {width,height,depth}=o.geometry.parameters;
      transform.position.copy(o.position);transform.quaternion.copy(o.quaternion);transform.scale.copy(o.scale).multiply(new THREE.Vector3(width,height,depth));transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);
      parent.remove(o);o.geometry.dispose();
    });
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();parent.add(batch);
  }
}

// Low-density distant silhouettes retain the same seed and distribution as the close view.
export function detailCount(full,distance,kind){
  const near=kind==='pebbles'?14:17,far=kind==='pebbles'?27:34,min=kind==='leaves'?.32:kind==='grass'?.28:.18;
  if(distance<=near)return full;
  const t=Math.max(0,Math.min(1,(distance-near)/(far-near))),ease=t*t*(3-2*t);
  return Math.min(full,Math.max(1,Math.round(full*(1-(1-min)*ease)/16)*16));
}

export function visibleInScene(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;}

// Raycaster itself does not consider ancestors' visibility or opacity.
export function pickVisibleArtwork(THREE,raycaster,sculptures,blockers){
  const eligible=sculptures.filter(o=>visibleInScene(o)&&o.children.some(c=>c.material?.opacity>=.92));
  const hit=raycaster.intersectObjects(eligible,true).find(h=>visibleInScene(h.object)&&h.object.material?.opacity>=.92);
  if(!hit)return undefined;
  const oldFar=raycaster.far;raycaster.far=Math.max(raycaster.near,hit.distance-.015);
  try{
    const blocked=raycaster.intersectObjects(blockers.filter(o=>visibleInScene(o)&&o.material?.opacity>=.92),false).length>0;
    if(blocked)return undefined;
  }finally{raycaster.far=oldFar;}
  let selected=hit.object;while(selected&&!selected.userData.artGlyph)selected=selected.parent;
  return selected?.userData.artGlyph;
}
