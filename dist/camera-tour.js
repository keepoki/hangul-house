import { exhibitionSites } from './exhibition-layout.js';
// A continuous journey through six separate galleries around the architectural exhibit.
export const tourStops = [0, .13, .26, .39, .52, .66, .79, 1];
export const tourGlyphs = exhibitionSites.map(site=>site.char);
const chapterStarts = [0, .07, .205, .335, .465, .60, .73, .90];
function detail(time,index,side,distance=10.2) {
  const site=exhibitionSites[index],s=Math.sin(site.rot),c=Math.cos(site.rot);
  // The water gallery has a slightly higher and wider view so the mirrored surface and rock
  // islands are visible together with the complete bronze ring, rather than cropping the pool.
  const water=site.theme==='water',d=distance*(water?1.1:1);
  return [time,[site.x+s*d+c*side,site.center+(water?2.85:1.3),site.z+c*d-s*side],[site.x,site.center-(water?1.30:0),site.z],water?38:32,1];
}
const poses = [
  [0,    [-19,13.5,29], [0,2.8,0], 36,0],
  [.035, [-16,10.5,23], [0,2.8,0], 36,0],
  [.075, [-22,10,25],   [-17,2.6,12],36,.2],
  detail(.105,0,-.8), detail(.155,0,.8,9.7),
  [.19,  [-9,11,31],    [-5,2.8,18],36,0],
  detail(.235,1,-.9), detail(.285,1,.9,9.9),
  [.325, [11.5,11.2,28],[13,2.6,13],36,0],
  detail(.365,2,-.9), detail(.415,2,.9,9.7),
  [.455, [29,11.2,8],   [19,2.6,3],36,0],
  detail(.495,3,-.9), detail(.545,3,.9,9.7),
  [.59,  [23,11,-26],   [8,2.8,-18],36,0],
  detail(.635,4,-.8), detail(.685,4,.8,9.7),
  [.725, [-14,11,-27],  [-16,2.5,-15],36,0],
  detail(.765,5,-.8), detail(.815,5,.8,9.7),
  [.875, [-29,13,0],    [0,2.8,0],36,0],
  [.935, [-22,10.2,25], [0,3.05,0],36,0],
  [1,    [0,4.45,28],   [0,3.15,0],34,0]
];
const mix = (a,b,t) => a+(b-a)*t;
const smootherstep = t => t*t*t*(t*(t*6-15)+10);
function flow(i,t,key){
  const a=poses[i],b=poses[i+1],dt=b[0]-a[0];
  function tangent(k,axis){
    if(k===0||k===poses.length-1)return 0;
    const previous=poses[k-1],next=poses[k+1],linger=poses[k][4]===1?.16:.75;
    return (next[key][axis]-previous[key][axis])/(next[0]-previous[0])*dt*linger;
  }
  return a[key].map((v,j)=>(2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*tangent(i,j)+(-2*t*t*t+3*t*t)*b[key][j]+(t*t*t-t*t)*tangent(i+1,j));
}
export function chapterAt(progress) {
  let chapter=0;
  for(let i=1;i<chapterStarts.length;i++)if(progress>=chapterStarts[i])chapter=i;
  return chapter;
}
export function sampleTour(progress, {mobile=false, reducedMotion=false, zoom=1}={}) {
  const raw=Math.min(1,Math.max(0,progress));
  const p=reducedMotion?tourStops[chapterAt(raw)]:raw;
  let i=0;
  while(i<poses.length-2&&p>poses[i+1][0])i++;
  const a=poses[i],b=poses[i+1];
  const rawT=Math.min(1,Math.max(0,(p-a[0])/(b[0]-a[0]))),t=smootherstep(rawT);
  const position=flow(i,rawT,1);
  const target=flow(i,rawT,2);
  const focus=mix(a[4],b[4],t);
  const distanceScale=(mobile?mix(.9,1.03,focus):1)/Math.min(1.8,Math.max(.75,zoom));
  for(let j=0;j<3;j++)position[j]=target[j]+(position[j]-target[j])*distanceScale;
  return {position,target,fov:mix(a[3],b[3],t)+(mobile?7*focus:0),focus,chapter:chapterAt(raw)};
}

// Fit the actual artwork bounds into the camera's usable viewport, before manual zoom.
// The authored camera direction stays unchanged, so a narrow viewport cannot crop the opening.
export function fitTourPose(pose,bounds,aspect,zoom=1,weight=1){
  if(!bounds||!Number.isFinite(aspect)||aspect<=0)return pose;
  const offset=pose.position.map((v,i)=>v-pose.target[i]),distance=Math.hypot(...offset);
  if(distance<.0001)return pose;
  const dir=offset.map(v=>v/distance),horizontal=Math.hypot(dir[0],dir[2]);
  if(horizontal<.0001)return pose;
  const right=[dir[2]/horizontal,0,-dir[0]/horizontal];
  const up=[dir[1]*right[2],dir[2]*right[0]-dir[0]*right[2],-dir[1]*right[0]];
  const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),tan=Math.tan(pose.fov*Math.PI/360)*.92;
  let required=0;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const v=[x-pose.target[0],y-pose.target[1],z-pose.target[2]],depth=dot(v,dir);
    required=Math.max(required,depth+Math.abs(dot(v,right))/(tan*aspect),depth+Math.abs(dot(v,up))/tan);
  }
  const base=distance*zoom,fit=distance+Math.max(0,required-base)*Math.max(0,Math.min(1,weight))/zoom;
  return {...pose,position:pose.target.map((v,i)=>v+dir[i]*fit)};
}
