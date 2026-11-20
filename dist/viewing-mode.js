import {initInterface} from './interface.js';
import {createImageTour} from './image-tour.js';

const viewingStorageKey='hangul-house:viewing-mode';
const validMode=value=>['auto','3d','images'].includes(value)?value:'auto';

export function startViewing({document=globalThis.document,window=globalThis.window,storage,loadGallery=()=>import('./gallery.js'),imageFactory=createImageTour,interfaceFactory=initInterface,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let preference='auto';
  try{storage??=window.localStorage;preference=validMode(storage.getItem(viewingStorageKey));}catch{}
  const images=imageFactory({document,window});
  let current=images,gallery=null,pending=null,selection=0,suspended=false,initializationTimer;
  const ui=interfaceFactory({onModeChange:choose,onRetry:()=>choose(preference)});
  function status(message,notify=false){ui.setViewingState({preference,active:current===images?'images':'3d',status:message,notice:notify?message:''});}
  function activate(controller,view,message,notify=false){
    const progress=current.getProgress?.()??0;current.pause();current=controller;
    // Switch layout before deriving the new document scroll range.
    if(!ui.wantsText()){
      document.documentElement.dataset.view=view;
      controller.resume?.();controller.seek?.(progress);
    }
    ui.attach(controller,{view});status(message,notify);
  }
  function showImages(message,notify=false){activate(images,'images',message,notify);}
  function performanceFallback(){
    if(preference==='auto'){suspended=true;showImages('이미지 관람 · 더 편안한 관람을 위해 전환했습니다.',true);gallery?.dispose?.();gallery=null;}
    else status('3D 관람 · 기기에 맞춰 화면 품질을 조절하고 있습니다.');
  }
  async function acquireGallery(){
    if(gallery)return gallery;
    if(pending)return pending;
    pending=(async()=>{
      const module=await loadGallery();
      if(suspended||preference==='images'||ui.wantsText())return null;
      const controller=await module.initGallery({
        shouldContinue:()=>!suspended&&preference!=='images'&&!ui.wantsText(),
        onProgress:(value,phase)=>{const bar=document.getElementById('loading-progress');bar.value=value;},
        onQualityChange:()=>{if(current===gallery)status('3D 관람 · 기기에 맞춰 화면 품질을 조절했습니다.');},
        onFallback:performanceFallback
      });
      if(controller)gallery=controller;
      return controller;
    })();
    try{return await pending;}finally{pending=null;}
  }
  async function choose(mode,{save=true}={}){
    preference=validMode(mode);const token=++selection;suspended=false;clearTimer(initializationTimer);
    if(save)try{storage?.setItem(viewingStorageKey,preference);}catch{}
    if(preference==='images'){showImages('이미지 관람 · 고화질 전시 이미지로 둘러봅니다.');return;}
    status('이미지로 먼저 관람할 수 있습니다. 3D 관람을 준비하고 있습니다.');
    if(preference==='auto')initializationTimer=setTimer(()=>{if(token===selection&&pending){suspended=true;showImages('이미지 관람 · 3D 준비가 오래 걸려 이미지로 안내합니다.',true);}},20000);
    try{
      const controller=await acquireGallery();
      if(token!==selection||suspended||preference==='images')return;
      clearTimer(initializationTimer);
      if(controller)activate(controller,'3d','3D 관람 · 기기 성능에 맞춰 자동으로 조절합니다.');
    }catch(error){
      if(token!==selection)return;clearTimer(initializationTimer);gallery=null;suspended=true;
      showImages('이미지 관람 · 이 환경에서는 3D를 열지 못했습니다. 관람 방식에서 다시 선택할 수 있습니다.',true);
    }
  }
  document.documentElement.dataset.view='images';document.documentElement.dataset.state='ready';
  images.resume();ui.attach(images,{view:'images'});
  window.addEventListener('museum:failure',()=>{
    gallery?.dispose?.();gallery=null;suspended=true;clearTimer(initializationTimer);
    showImages('이미지 관람 · 3D 연결이 중단되어 같은 공간의 이미지로 전환했습니다.',true);
  });
  const ready=choose(preference,{save:false});
  return {choose,ready,get preference(){return preference;}};
}
