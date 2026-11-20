import {initInterface} from './interface.js';
import {createImageTour} from './image-tour.js';

const viewingStorageKey='hangul-house:viewing-mode';
const validMode=value=>['auto','3d','images'].includes(value)?value:'auto';
const loadingMessages={
  scene:'한글 건축관을 세우는 중',
  materials:'석재, 나무와 금속의 질감을 준비하는 중',
  shader:'조명과 반사를 준비하는 중',
  warmup:'전시실의 빛과 그림자를 미리 준비하는 중',
  frame:'전시관의 첫 장면을 준비하는 중',
  images:'전시 이미지를 준비하는 중',
  ready:'관람 준비가 끝났습니다.'
};

export function startViewing({document=globalThis.document,window=globalThis.window,storage,loadGallery=()=>import('./gallery.js'),imageFactory=createImageTour,interfaceFactory=initInterface,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let preference='auto';
  try{storage??=window.localStorage;preference=validMode(storage.getItem(viewingStorageKey));}catch{}
  const images=imageFactory({document,window});
  const root=document.documentElement;
  const experience=document.getElementById('experience');
  let current=images,gallery=null,pending=null,selection=0,suspended=false,initializationTimer;
  const ui=interfaceFactory({onModeChange:choose,onRetry:()=>choose(preference)});
  function status(message,notify=false){ui.setViewingState({preference,active:current===images?'images':'3d',status:message,notice:notify?message:''});}
  function loadingStep(value,phase){
    document.getElementById('loading-progress').value=value;
    document.getElementById('loading-phase').textContent=loadingMessages[phase];
  }
  function activate(controller,view,message,notify=false){
    if(root.dataset.state==='loading')loadingStep(100,'ready');
    root.dataset.state='ready';
    experience.inert=false;
    const progress=current.getProgress?.()??0;current.pause();current=controller;
    // Switch layout before deriving the new document scroll range.
    if(!ui.wantsText()){
      document.documentElement.dataset.view=view;
      controller.resume?.();controller.seek?.(progress);
    }
    ui.attach(controller,{view});status(message,notify);
  }
  function showImages(message,notify=false){activate(images,'images',message,notify);}
  async function showArrivalImages(token,message,notify=false){
    if(root.dataset.view==='loading'&&images.prepare){
      loadingStep(96,'images');
      let timeout;
      try{
        await Promise.race([images.prepare(),new Promise(resolve=>{timeout=setTimer(resolve,5000);})]);
      }catch{}finally{clearTimer(timeout);}
    }
    if(token===selection)showImages(message,notify);
  }
  function handleGalleryFailure(message){
    gallery?.dispose?.();gallery=null;suspended=true;clearTimer(initializationTimer);
    if(root.dataset.view==='loading')return showArrivalImages(selection,message,true);
    showImages(message,true);
  }
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
        onProgress:(value,phase)=>{if(root.dataset.view==='loading'&&!suspended&&preference!=='images')loadingStep(value,phase);},
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
    if(preference==='images')return showArrivalImages(token,'이미지 관람 · 고화질 전시 이미지로 둘러봅니다.');
    status('3D 관람을 준비하고 있습니다.');
    if(preference==='auto'||root.dataset.view==='loading')initializationTimer=setTimer(()=>{
      if(token!==selection||!pending)return;
      suspended=true;
      return showArrivalImages(token,'이미지 관람 · 3D 준비가 오래 걸려 이미지로 안내합니다.',true);
    },20000);
    try{
      const controller=await acquireGallery();
      if(token!==selection||suspended||preference==='images')return;
      clearTimer(initializationTimer);
      if(controller)activate(controller,'3d','3D 관람 · 기기 성능에 맞춰 자동으로 조절합니다.');
      else if(ui.wantsText())showImages('이미지 관람 · 고화질 전시 이미지로 둘러봅니다.');
    }catch(error){
      if(token!==selection||suspended)return;
      return handleGalleryFailure('이미지 관람 · 이 환경에서는 3D를 열지 못했습니다. 관람 방식에서 다시 선택할 수 있습니다.');
    }
  }
  root.dataset.view='loading';
  root.dataset.state='loading';
  experience.inert=true;
  window.addEventListener('museum:failure',()=>{
    handleGalleryFailure('이미지 관람 · 3D 연결이 중단되어 같은 공간의 이미지로 전환했습니다.');
  });
  const ready=choose(preference,{save:false});
  return {choose,ready,get preference(){return preference;}};
}
