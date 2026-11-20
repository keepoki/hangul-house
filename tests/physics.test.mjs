import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkshopWorld,pieces} from '../dist/workshop-physics.js';
test('the workshop uses compound rigid bodies, gravity and real floor contacts',()=>{
  const model=createWorkshopWorld();let contacts=0;model.bodies.forEach(b=>b.addEventListener('collide',()=>contacts++));
  const initial=model.bodies.map(b=>b.position.y);
  for(let i=0;i<900;i++)model.step(1/90);
  assert.ok(contacts>0,'The physics solver must generate collision contacts');
  model.bodies.forEach((b,i)=>{assert.ok(b.position.y<initial[i]);assert.ok(b.position.y>-.1,'Bodies must remain above the floor');assert.ok(Math.abs(b.position.z)<1e-6);assert.ok(Number.isFinite(b.position.x));});
  assert.deepEqual(model.bodies.map(b=>b.shapes.length),[4,2,16]);assert.ok(model.world.gravity.y<0);
});
test('pointer constraints can be cancelled and started again without leaving a stuck body',()=>{
  const model=createWorkshopWorld({gravity:false}),body=model.bodies[0];
  assert.equal(model.beginDrag(0,body.position.x,body.position.y),true);
  assert.equal(model.beginDrag(1,0,0),false);
  model.dragTo(-2,3);for(let i=0;i<40;i++)model.step(1/90);
  assert.ok(Math.abs(body.position.x+2)<.25);
  model.endDrag(false);assert.equal(model.dragging,-1);assert.equal(model.world.constraints.length,0);
  assert.equal(model.beginDrag(0,body.position.x,body.position.y),true);model.endDrag(false);
});
test('all three placements complete a house and reset restores a fresh physical scene',()=>{
  const model=createWorkshopWorld();
  for(let i=0;i<3;i++){assert.equal(model.place(i),true);assert.deepEqual(model.bodies[i].position.toArray(),[...pieces[i].target,0]);}
  assert.equal(model.complete,true);assert.equal(model.count,3);assert.equal(model.place(0),false);
  model.reset();assert.equal(model.complete,false);assert.equal(model.count,0);assert.equal(model.world.constraints.length,0);
  model.bodies.forEach((body,i)=>assert.equal(body.mass,pieces[i].mass));
});
test('a piece released close to its outline snaps into the intended architectural position',()=>{
  const model=createWorkshopWorld({gravity:false}),b=model.bodies[2];
  b.position.set(pieces[2].target[0]+.2,pieces[2].target[1]+.2,0);
  model.beginDrag(2,b.position.x,b.position.y);model.endDrag();
  assert.equal(b.userData.placed,true);assert.equal(model.count,1);assert.equal(model.world.constraints.length,0);
});
test('motion reduction can disable gravity without losing selection and placement',()=>{
  const model=createWorkshopWorld({gravity:false});const positions=model.bodies.map(b=>b.position.clone());
  for(let i=0;i<120;i++)model.step(1/90);
  model.bodies.forEach((b,i)=>assert.ok(b.position.distanceTo(positions[i])<.01));
  model.select(1);model.place();assert.equal(model.bodies[1].userData.placed,true);
  model.setGravity(true);assert.ok(model.world.gravity.y<0);model.setGravity(false);assert.equal(model.world.gravity.y,0);
});
test('the gravity demonstration produces real support contacts without placing pieces',()=>{
  const model=createWorkshopWorld({gravity:false,assembly:true});
  for(let index=0;index<pieces.length;index++){
    assert.equal(model.beginDrop(),true);
    assert.equal(model.dropState,'falling');
    const body=model.bodies[index],start=body.position.y;
    assert.equal(model.beginDrop(),false);
    for(let i=0;i<165;i++)model.step(1/90);
    assert.equal(model.dropState,'contact');
    assert.ok(body.position.y<start-.5);
    assert.ok(body.position.y>1.2);
    assert.equal(model.count,index);
    assert.equal(model.place(),true);
    assert.equal(model.dropState,'idle');
    assert.equal(model.world.gravity.y,0);
  }
  assert.equal(model.beginDrop(),false);
});
test('resetting an interrupted demonstration restores the selected gravity and stage',()=>{
  const model=createWorkshopWorld({gravity:false,assembly:true});
  const initial=model.bodies[0].position.toArray();
  model.beginDrop();
  model.reset();
  assert.equal(model.dropState,'idle');
  assert.equal(model.world.gravity.y,0);
  assert.deepEqual(model.bodies[0].position.toArray(),initial);
});
