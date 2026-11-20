// Rendering budgets change; the exhibition's geometry and materials stay intact.
export const qualityProfiles=Object.freeze([
  Object.freeze({name:'high',maxPixels:2200000,pixelRatio:1.5,reflectionSize:1024,reflectionInterval:94}),
  Object.freeze({name:'balanced',maxPixels:1300000,pixelRatio:1.15,reflectionSize:512,reflectionInterval:160}),
  Object.freeze({name:'efficient',maxPixels:760000,pixelRatio:1,reflectionSize:256,reflectionInterval:280})
]);

export function createPerformanceGovernor({onChange=()=>{},onFallback=()=>{}}={}){
  let tier=0,samples=[],elapsed=0,fellBack=false;
  function reset(){samples=[];elapsed=0;}
  return {
    get profile(){return qualityProfiles[tier];},reset,
    sample(frameMs){
      // Long suspensions are not evidence about graphics performance.
      if(!Number.isFinite(frameMs)||frameMs<=0||frameMs>1000){reset();return;}
      samples.push(frameMs);elapsed+=frameMs;
      if(elapsed<1600||samples.length<12)return;
      const sorted=[...samples].sort((a,b)=>a-b),slow=sorted[Math.floor(sorted.length*.75)];reset();
      if(slow>38&&tier<qualityProfiles.length-1){tier++;onChange(qualityProfiles[tier]);}
      else if(tier===qualityProfiles.length-1&&slow>80&&!fellBack){fellBack=true;onFallback();}
    }
  };
}
