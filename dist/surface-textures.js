// Pure procedural texture generation, shared by the gallery and its background worker.
export function createSurfacePixels(kind,base,seed,n){
  const {PI,sin,pow,sqrt,floor,abs}=Math;
  const clamp=(v,b=0,t=1)=>Math.max(b,Math.min(t,v));
  function hash(x,y,s=1){let v=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,1274126177);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;}
  function noise(x,y,s){const i=floor(x),j=floor(y),a=x-i,b=y-j,u=a*a*(3-2*a),v=b*b*(3-2*b),p=hash(i,j,s),q=hash(i+1,j,s),r=hash(i,j+1,s),z=hash(i+1,j+1,s);return (p+(q-p)*u)*(1-v)+(r+(z-r)*u)*v;}
  function fbm(x,y,s){return .53*noise(x,y,s)+.25*noise(x*2.07,y*2.07,s+12)+.14*noise(x*4.13,y*4.13,s+37)+.08*noise(x*8.19,y*8.19,s+53);}
  const heights=new Float32Array(n*n),albedo=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4),normal=new Uint8Array(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const u=x/n,v=y/n,i=y*n+x,k=4*i;let h,shade,roughness;
    const a=fbm(u*7,v*7,seed),fine=hash(x,y,seed+101)-.5;
    if(kind==='wood'){
      const drift=.025*fbm(u*5,v*3,seed+31),knot=.055*Math.exp(-((u-.6)**2*48+(v-.62)**2*110));
      const grain=u+drift+knot*sin(v*19),waves=sin(grain*PI*75+.9*noise(u*8,v*3,seed));
      const pores=pow(noise(u*220,v*9,seed+5),5),band=sin(grain*PI*16);
      h=.5+waves*.06+pores*.07+fine*.025;shade=1+band*.065+waves*.035+pores*.14+(a-.5)*.12+fine*.035;roughness=.53+.13*a+.05*waves;
    }else{
      const mote=fbm(u*31,v*31,seed+11),vein=pow(1-abs(sin((u*2.2+v*2.2+fbm(u*4,v*4,seed+9)*1.5)*PI)),14),pore=pow(noise(u*100,v*100,seed+22),9),strength=kind==='gravel'?1.7:kind==='basalt'?1.3:1;
      h=.5+(mote-.5)*.24*strength-pore*.28+fine*.075*strength;shade=1+(a-.5)*.23*strength+(mote-.5)*.15-pore*.4+fine*.07*strength+(kind==='limestone'?vein*.052:0);roughness=(kind==='floor'?.6:.76)+(.5-mote)*.2-pore*.07;
    }
    heights[i]=h;for(let c=0;c<3;c++){albedo[k+c]=clamp(base[c]*shade,0,255);rough[k+c]=clamp(roughness*255,0,255);}albedo[k+3]=rough[k+3]=255;
  }
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const k=4*(y*n+x),dx=(heights[y*n+(x+1)%n]-heights[y*n+(x+n-1)%n])*(kind==='gravel'?1.8:.95),dy=(heights[((y+1)%n)*n+x]-heights[((y+n-1)%n)*n+x])*(kind==='gravel'?1.8:.95),l=sqrt(1+dx*dx+dy*dy);
    normal[k]=127.5*(1-dx/l);normal[k+1]=127.5*(1-dy/l);normal[k+2]=127.5*(1+1/l);normal[k+3]=255;
  }
  return {albedo,rough,normal,n};
}
