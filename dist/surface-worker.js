import {createSurfacePixels} from './surface-textures.js';

// Transfers the finished maps rather than copying multi-megabyte arrays on the main thread.
self.onmessage=({data:{tasks}})=>{
  for(const task of tasks){
    const result=createSurfacePixels(task.kind,task.base,task.seed,task.n,task.withNormal,task.withRoughness);
    self.postMessage({id:task.id,...result},[result.albedo.buffer,...(result.normal?[result.normal.buffer]:[]),...(result.rough?[result.rough.buffer]:[])]);
  }
};
