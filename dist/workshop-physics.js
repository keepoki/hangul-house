import * as CANNON from './assets/cannon-es.js';

export const pieces = [
  {char:'ㅁ',name:'입구',material:'나무',mass:1.4,color:'#c89e69',start:[-3.5,4.5],target:[-1.35,1.5],width:2.9,height:2.7},
  {char:'ㅅ',name:'지붕',material:'돌',mass:2.8,color:'#d6c9ae',start:[.1,6],target:[-1.35,3.55],width:3.7,height:2.2},
  {char:'ㅇ',name:'창',material:'황동',mass:3.4,color:'#b99155',start:[3.5,4.3],target:[1.65,1.24],width:2.16,height:2.16}
];

export function createWorkshopWorld({gravity=true,assembly=false,onChange=()=>{}}={}) {
  const world=new CANNON.World({gravity:new CANNON.Vec3(0,gravity?-9.82:0,0),allowSleep:true});
  world.solver.iterations=16;world.defaultContactMaterial.friction=.58;world.defaultContactMaterial.restitution=.16;
  const floor=new CANNON.Body({mass:0,shape:new CANNON.Plane()});floor.quaternion.setFromEuler(-Math.PI/2,0,0);floor.position.y=.12;world.addBody(floor);
  for(const x of [-5.6,5.6]){const wall=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(.2,5,1))});wall.position.set(x,4,0);world.addBody(wall);}
  function addBar(body,width,height,x=0,y=0,angle=0){
    const q=new CANNON.Quaternion();q.setFromEuler(0,0,angle);
    body.addShape(new CANNON.Box(new CANNON.Vec3(width/2,height/2,.2)),new CANNON.Vec3(x,y,0),q);
  }
  const bodies=pieces.map((piece,index)=>{
    const body=new CANNON.Body({mass:piece.mass,linearDamping:.22,angularDamping:.65,allowSleep:true,sleepTimeLimit:.65,sleepSpeedLimit:.12});
    body.linearFactor.set(1,1,0);body.angularFactor.set(0,0,1);body.userData={index,placed:false};
    if(index===0){addBar(body,2.9,.35,0,1.175);addBar(body,2.9,.35,0,-1.175);addBar(body,.35,2,-1.275,0);addBar(body,.35,2,1.275,0);}
    if(index===1){const length=Math.hypot(1.7,1.6),angle=Math.atan2(1.6,1.7);addBar(body,length,.32,-.85,.2,angle);addBar(body,length,.32,.85,.2,-angle);}
    if(index===2)for(let n=0;n<16;n++){const a=n*Math.PI/8;addBar(body,.385,.32,Math.cos(a)*.91,Math.sin(a)*.91,a+Math.PI/2);}
    world.addBody(body);return body;
  });
  const mouse=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,collisionFilterGroup:0,collisionFilterMask:0});world.addBody(mouse);
  let constraint=null,dragging=-1,selected=0;
  function stage(index,available){
    const body=bodies[index];
    body.type=CANNON.Body.DYNAMIC;body.mass=pieces[index].mass;body.updateMassProperties();
    body.position.set(...(assembly?[3.15,2.1]:pieces[index].start),0);
    body.quaternion.setFromEuler(0,0,gravity&&!assembly?(index-1)*.06:0);
    body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();
    body.userData.placed=false;body.aabbNeedsUpdate=true;body.collisionFilterMask=available?-1:0;
    if(available)body.wakeUp();else body.sleep();
  }
  function reset(){
    endDrag(false);
    selected=0;
    bodies.forEach((_,index)=>stage(index,!assembly||index===0));
    onChange();
  }
  function place(index=selected){
    const body=bodies[index];if(!body||body.userData.placed||(assembly&&index!==selected))return false;
    if(dragging===index)endDrag(false);
    body.position.set(...pieces[index].target,0);body.quaternion.set(0,0,0,1);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.type=CANNON.Body.STATIC;body.mass=0;body.updateMassProperties();body.aabbNeedsUpdate=true;body.userData.placed=true;body.sleep();
    const next=bodies.findIndex(b=>!b.userData.placed);
    selected=next<0?index:next;
    if(assembly){
      if(next>=0)stage(next,true);
    }else bodies.filter(b=>!b.userData.placed).forEach(b=>b.wakeUp());
    onChange();return true;
  }
  function select(index){if(!assembly&&index>=0&&index<bodies.length){selected=index;onChange();}}
  function undo(){
    const previous=bodies.findLastIndex(body=>body.userData.placed);
    if(!assembly||previous<0)return false;
    endDrag(false);
    if(!bodies[selected].userData.placed)stage(selected,false);
    selected=previous;
    stage(previous,true);
    onChange();return true;
  }
  function beginDrag(index,x,y){
    if(constraint||!bodies[index]||bodies[index].userData.placed||(assembly&&index!==selected))return false;
    selected=index;dragging=index;const body=bodies[index];body.wakeUp();mouse.position.set(x,y,0);mouse.velocity.setZero();
    const local=body.pointToLocalFrame(mouse.position);constraint=new CANNON.PointToPointConstraint(body,local,mouse,new CANNON.Vec3(),1800);constraint.collideConnected=false;world.addConstraint(constraint);onChange();return true;
  }
  function dragTo(x,y){if(!constraint)return;mouse.position.set(Math.max(-5.1,Math.min(5.1,x)),Math.max(.3,Math.min(7.4,y)),0);mouse.velocity.setZero();bodies[dragging].wakeUp();}
  function isNearTarget(index,{x,y}){
    const [targetX,targetY]=pieces[index].target;
    return Math.hypot(x-targetX,y-targetY)<.95;
  }
  function endDrag(snap=true,position){
    if(!constraint)return false;
    const index=dragging;
    world.removeConstraint(constraint);constraint=null;dragging=-1;
    if(snap&&isNearTarget(index,position??bodies[index].position))return place(index);
    if(assembly)stage(index,true);
    onChange();return false;
  }
  function setGravity(enabled){gravity=!!enabled;world.gravity.y=gravity?-9.82:0;bodies.filter(b=>!b.userData.placed&&b.collisionFilterMask).forEach(b=>{if(assembly)stage(b.userData.index,true);else{if(!gravity){b.velocity.setZero();b.angularVelocity.setZero();}b.wakeUp();}});onChange();}
  function step(dt){world.step(1/90,Math.max(0,Math.min(dt,1/15)),6);}
  function moving(){return !!constraint||bodies.some(b=>b.type===CANNON.Body.DYNAMIC&&b.sleepState!==CANNON.Body.SLEEPING);}
  reset();
  return {world,bodies,pieces,reset,place,select,undo,beginDrag,dragTo,isNearTarget,endDrag,setGravity,step,moving,get selected(){return selected;},get dragging(){return dragging;},get complete(){return bodies.every(b=>b.userData.placed);},get count(){return bodies.filter(b=>b.userData.placed).length;}};
}
