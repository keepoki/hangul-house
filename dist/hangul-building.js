// A pavilion assembled from architectural Hangul strokes, inspired by the supplied reference.
export function buildHangulBuilding(THREE, parent, materials) {
  const {limestone,timber,charcoal,glass,strip}=materials;
  const building=new THREE.Group();building.name='The Hangul House';building.userData.hangulBuilding=true;parent.add(building);
  function part(geometry,material,x=0,y=0,z=0,root=building) {
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }
  function block(w,h,d,material,x,y,z,root=building){return part(new THREE.BoxGeometry(w,h,d),material,x,y,z,root);}
  function letter(char){const g=new THREE.Group();g.userData.structuralGlyph=char;g.name=char+' architectural structure';building.add(g);return g;}
  function profile(points,depth,material,z,root) {
    const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:2,steps:1});
    geometry.translate(0,0,-depth/2);return part(geometry,material,0,0,z,root);
  }
  const giyeok=letter('ㄱ');
  profile([[-7.9,5.25],[-3.45,5.25],[-3.45,.5],[-4.25,.5],[-4.25,4.45],[-7.9,4.45]],.88,limestone,3.6,giyeok);
  const digeut=letter('ㄷ');
  profile([[-7.75,3.95],[-4.6,3.95],[-4.6,3.25],[-7.03,3.25],[-7.03,1.2],[-4.6,1.2],[-4.6,.5],[-7.75,.5]],.78,charcoal,4.18,digeut);
  const mieum=letter('ㅁ');
  block(6.1,.7,.95,timber,.3,4.35,4.02,mieum);
  block(.68,3.55,.95,timber,-2.41,2.28,4.02,mieum);
  block(.68,3.55,.95,timber,3.01,2.28,4.02,mieum);
  block(6.1,.22,.95,timber,.3,.61,4.02,mieum);
  const ieung=letter('ㅇ');
  const circle=new THREE.Shape();circle.absarc(0,0,1.98,0,Math.PI*2,false);
  const opening=new THREE.Path();opening.absarc(0,0,1.25,0,Math.PI*2,true);circle.holes.push(opening);
  const ring=new THREE.ExtrudeGeometry(circle,{depth:.88,bevelEnabled:true,bevelSize:.045,bevelThickness:.04,bevelSegments:2,curveSegments:32,steps:1});ring.translate(0,0,-.44);
  part(ring,limestone,5.85,2.52,3.65,ieung);
  const siot=letter('ㅅ');
  profile([[-3.9,4.55],[.5,7.55],[4.9,4.55],[4.35,4.0],[.5,6.6],[-3.35,4.0]],7.65,limestone,.18,siot);
  // Wood-lined soffits follow the stone roof's two sloping strokes.
  for(const [x1,y1,x2,y2] of [[-3.4,4.25,.5,6.85],[.5,6.85,4.4,4.25]]){
    const m=block(Math.hypot(x2-x1,y2-y1),.1,7.2,timber,(x1+x2)/2,(y1+y2)/2,.15);m.rotation.z=Math.atan2(y2-y1,x2-x1);
  }
  const nieun=letter('ㄴ');
  block(.72,4.15,.72,timber,-7.5,2.57,-3.5,nieun);
  block(.72,.48,7.8,timber,-7.5,.75,.02,nieun);
  block(4.7,.6,1.05,timber,5.35,4.5,.1);
  block(.58,3.7,.58,timber,7.4,2.35,-3.4);
  block(.58,3.7,.58,timber,7.4,2.35,3.4);
  block(.58,.55,7.5,timber,7.4,4.5,0);
  block(6.2,.55,.68,timber,.3,4.32,-3.45);
  for(const x of [-2.5,3.1])block(.5,3.55,.65,timber,x,2.28,-3.45);
  block(4.4,.52,7.2,limestone,-5.65,4.56,-.05);
  // Quiet glazing lets the continuous sequence of portals read through the pavilion.
  block(5.1,3.1,.025,glass,.3,2.23,-3.4);
  block(.025,3.15,6.8,glass,7.42,2.2,0);
  for(const z of [-3.35,3.42])block(5.1,.025,.025,strip,.3,4.03,z);
  block(13.8,.025,.035,strip,-.1,.55,4.6);
  const warm=new THREE.PointLight('#ffd4a2',100,16,2);warm.position.set(.2,3.35,.2);building.add(warm);
  return building;
}
