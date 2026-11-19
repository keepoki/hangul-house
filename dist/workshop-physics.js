import * as CANNON from './assets/cannon-es.js';

export const pieces = [
  {char:'ㅁ',name:'입구',material:'나무',mass:1.4,color:'#c89e69',start:[-3.5,4.5],target:[-1.35,1.5],width:2.9,height:2.7},
  {char:'ㅅ',name:'지붕',material:'돌',mass:2.8,color:'#d6c9ae',start:[.1,6],target:[-1.35,3.55],width:3.7,height:2.2},
  {char:'ㅇ',name:'창',material:'황동',mass:3.4,color:'#b99155',start:[3.5,4.3],target:[1.65,1.24],width:2.16,height:2.16}
];

export function createWorkshopWorld({gravity=true,onChange=()=>{}}={}) {
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
  function reset(){endDrag(false);bodies.forEach((body,i)=>{body.type=CANNON.Body.DYNAMIC;body.mass=pieces[i].mass;body.updateMassProperties();body.position.set(...pieces[i].start,0);body.quaternion.setFromEuler(0,0,gravity?(i-1)*.06:0);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.userData.placed=false;body.aabbNeedsUpdate=true;body.wakeUp();});selected=0;onChange();}
  function place(index=selected){
    const body=bodies[index];if(!body||body.userData.placed)return false;
    if(dragging===index)endDrag(false);
    body.position.set(...pieces[index].target,0);body.quaternion.set(0,0,0,1);body.velocity.setZero();body.angularVelocity.setZero();body.force.setZero();body.torque.setZero();body.type=CANNON.Body.STATIC;body.mass=0;body.updateMassProperties();body.aabbNeedsUpdate=true;body.userData.placed=true;body.sleep();
    selected=bodies.findIndex(b=>!b.userData.placed);if(selected<0)selected=index;
    bodies.filter(b=>!b.userData.placed).forEach(b=>b.wakeUp());onChange();return true;
  }
  function select(index){if(index>=0&&index<bodies.length){selected=index;onChange();}}
  function beginDrag(index,x,y){
    if(constraint||!bodies[index]||bodies[index].userData.placed)return false;
    selected=index;dragging=index;const body=bodies[index];body.wakeUp();mouse.position.set(x,y,0);mouse.velocity.setZero();
    const local=body.pointToLocalFrame(mouse.position);constraint=new CANNON.PointToPointConstraint(body,local,mouse,new CANNON.Vec3(),1800);constraint.collideConnected=false;world.addConstraint(constraint);onChange();return true;
  }
  function dragTo(x,y){if(!constraint)return;mouse.position.set(Math.max(-5.1,Math.min(5.1,x)),Math.max(.3,Math.min(7.4,y)),0);mouse.velocity.setZero();bodies[dragging].wakeUp();}
  function endDrag(snap=true){
    if(!constraint)return;const index=dragging;world.removeConstraint(constraint);constraint=null;dragging=-1;
    const body=bodies[index],target=pieces[index].target;
    if(snap&&Math.hypot(body.position.x-target[0],body.position.y-target[1])<.95)place(index);
    onChange();
  }
  function setGravity(enabled){gravity=!!enabled;world.gravity.y=gravity?-9.82:0;bodies.filter(b=>!b.userData.placed).forEach(b=>{if(!gravity){b.velocity.setZero();b.angularVelocity.setZero();}b.wakeUp();});onChange();}
  function step(dt){world.step(1/90,Math.max(0,Math.min(dt,1/15)),6);}
  function moving(){return !!constraint||bodies.some(b=>b.type===CANNON.Body.DYNAMIC&&b.sleepState!==CANNON.Body.SLEEPING);}
  reset();
  return {world,bodies,pieces,reset,place,select,beginDrag,dragTo,endDrag,setGravity,step,moving,get selected(){return selected;},get dragging(){return dragging;},get complete(){return bodies.every(b=>b.userData.placed);},get count(){return bodies.filter(b=>b.userData.placed).length;}};
}
