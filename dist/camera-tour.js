// Scroll is the playhead of a continuous dolly tour, with a slow viewing arc at each work.
export const tourStops = [0, .13, .26, .39, .52, .66, .79, 1];
export const tourGlyphs = ['ㄱ', 'ㅇ', 'ㅁ', 'ㅎ', 'ㅏ', 'ㅅ'];
const chapterStarts = [0, .07, .205, .335, .465, .60, .73, .90];
const poses = [
  [0,    [-14,11.9,23],    [0,2.65,0],        35,0],
  [.035, [-11.7,8.3,16.4], [-2,2.4,1],        35,0],
  [.085, [-6.1,3.9,9],     [-5.2,2.25,1.65],  33,.7],
  [.105, [-5.75,3.12,7.25],[-5.2,2.25,1.65],  32,1],
  [.155, [-4.8,2.95,7],    [-5.2,2.25,1.65],  32,1],
  [.19,  [-3.8,7.5,11.5],  [-2.7,2.4,.5],     35,0],
  [.235, [-2.8,3.2,7],     [-1.9,2.42,.9],    32,1],
  [.285, [-1,3.05,6.9],    [-1.9,2.42,.9],    32,1],
  [.325, [2.2,7.3,11],     [1.3,2.35,1.2],    35,0],
  [.365, [1.1,3.1,7.2],    [2,2.2,1.5],       32,1],
  [.415, [2.9,3.1,7],      [2,2.2,1.5],       32,1],
  [.455, [9.8,6.9,8.2],    [4.4,2.3,.8],      35,0],
  [.495, [7.2,3.4,6.3],    [5.45,2.28,.45],   32,1],
  [.545, [8.3,3.25,5.7],   [5.45,2.28,.45],   32,1],
  [.59,  [12.3,7,-4.4],    [2.9,2.3,-.8],     35,0],
  [.635, [.9,3.2,-7.6],    [.1,2.2,-2],       32,1],
  [.685, [-.7,3.05,-7.6],  [.1,2.2,-2],       32,1],
  [.725, [-5.5,7,-10.8],   [-3,2.3,-1.8],     35,0],
  [.765, [-3.6,3.1,-7.6],  [-4,2.04,-1.9],    32,1],
  [.815, [-5,3,-7.4],      [-4,2.04,-1.9],    32,1],
  [.875, [-14.5,7.3,-4],   [-2.5,2.5,-.2],    35,0],
  [.935, [-23,11.9,6],     [0,2.65,0],        35,0],
  [1,    [-14,11.9,23],    [0,2.65,0],        35,0]
];
const mix = (a,b,t) => a+(b-a)*t;
const smootherstep = t => t*t*t*(t*(t*6-15)+10);
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
  const t=smootherstep(Math.min(1,Math.max(0,(p-a[0])/(b[0]-a[0]))));
  const position=a[1].map((v,j)=>mix(v,b[1][j],t));
  const target=a[2].map((v,j)=>mix(v,b[2][j],t));
  const focus=mix(a[4],b[4],t);
  const distanceScale=(mobile?mix(1.12,1.03,focus):1)/Math.min(1.8,Math.max(.75,zoom));
  for(let j=0;j<3;j++)position[j]=target[j]+(position[j]-target[j])*distanceScale;
  return {position,target,fov:mix(a[3],b[3],t)+(mobile?7:0),focus,chapter:chapterAt(raw)};
}
