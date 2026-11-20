import {chapters,updateTourNavigation} from './exhibition-content.js';
import {chapterAt,tourStops} from './camera-tour.js';

export const galleryStills=['house','stone','water','wood','light','garden','quiet','finale'];
const stillDescriptions=[
  'ㄱ 기둥과 처마, ㅅ 지붕, ㅁ 입구와 ㅇ 창으로 지은 한글 건축관.',
  '돌의 방. 석회암으로 만든 ㄱ 조형물과 자연석의 표면.',
  '물의 뜰. 청동 ㅇ 조형물, 정교한 자연석과 수면에 비친 반사.',
  '나무의 뜰. 참나무로 만든 ㅁ 조형물과 따뜻한 목재 공간.',
  '빛의 방. 황동 ㅎ 조형물의 곡면에 닿는 조명.',
  '초록의 정원. 식물 사이에 놓인 ㅏ 조형물.',
  '고요의 방. 서로 기대어 지붕을 이루는 ㅅ 조형물.',
  '한글 건축관의 정면. 네모난 ㅁ 입구와 ㅅ 지붕, 둥근 ㅇ 창이 한눈에 보입니다.'
];

export function createImageTour({document=globalThis.document,window=globalThis.window}={}){
  const $=id=>document.getElementById(id),root=document.documentElement,img=$('gallery-image'),source=$('gallery-image-mobile'),picture=$('gallery-picture');
  let active=false,progress=0,chapter=-1,zoom=1,bright=false;
  const status=$('image-status'),retry=$('retry-image');
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const trackHeight=()=>Math.max(1,(root.scrollHeight||window.innerHeight)-window.innerHeight);
  function imageLoading(){status.textContent='전시 이미지를 불러오는 중입니다.';retry.hidden=true;}
  function imageLoaded(){if(active){status.textContent='';retry.hidden=true;}}
  img.addEventListener('load',imageLoaded);
  function imageFailed(){if(active){status.textContent='이미지를 불러오지 못했습니다. 다시 불러오거나 전시 설명을 읽어보세요.';retry.hidden=false;}}
  img.addEventListener('error',imageFailed);
  retry.addEventListener('click',()=>{
    const portrait=window.matchMedia(source.media).matches;
    const element=portrait?source:img,attribute=portrait?'srcset':'src';
    const url=new URL(element[attribute],document.baseURI);
    const attempt=String(Date.now());
    if(url.protocol==='data:')url.hash=attempt;
    else url.searchParams.set('retry',attempt);
    imageLoading();
    element[attribute]=url.href;
  });
  function paint(){
    if(!active)return;
    const index=chapterAt(progress);if(index===chapter)return;chapter=index;
    const data=chapters[index],file=galleryStills[index];
    imageLoading();
    source.srcset=`./assets/gallery/${file}-mobile.jpg`;img.src=`./assets/gallery/${file}.jpg`;img.alt=stillDescriptions[index];
    if(img.complete&&img.naturalWidth)imageLoaded();
    else if(img.complete&&img.currentSrc)imageFailed();
    $('story-title').innerHTML=data.title;$('story-body').innerHTML=data.body;$('room-context').textContent=data.context;$('story-note').textContent=data.note;
    $('work-glyph').textContent=data.glyph;$('work-name').textContent=data.name;$('work-material').textContent=data.material;
    $('experience').classList.toggle('is-detail',index>0&&index<7);$('story-action').hidden=index!==7;
    $('structure-action').hidden=index!==0;
    $('story-start').hidden=index!==0;
    $('view-label').textContent=data.context;$('scroll-label').textContent=index===7?'처음부터 다시 관람':index===0?'아래로 스크롤해 관람':'다음 공간으로';
    updateTourNavigation(document,index);
  }
  function update(){if(!active||root.dataset.view!=='images')return;progress=clamp(window.scrollY/trackHeight(),0,1);$('tour-progress').textContent=Math.round(progress*100)+'%';paint();}
  function setZoom(value){zoom=clamp(value,.75,1.8);img.style.transform=`scale(${zoom})`;$('zoom-value').textContent=Math.round(zoom*100)+'%';$('zoom-in').disabled=zoom>=1.8;$('zoom-out').disabled=zoom<=.75;}
  function seek(value){progress=clamp(value,0,1);window.scrollTo({top:progress*trackHeight(),behavior:'instant'});paint();$('tour-progress').textContent=Math.round(progress*100)+'%';}
  window.addEventListener('scroll',update,{passive:true});
  window.addEventListener('resize',()=>{if(active){seek(progress);updateTourNavigation(document,chapter);}},{passive:true});
  return {
    prepare:()=>img.decode(),
    getProgress:()=>progress,seek,
    goTo(value){setZoom(1);seek(value);},setZoom,changeZoom(delta){setZoom(zoom+delta);},
    toggleLighting(){bright=!bright;img.style.filter=bright?'brightness(1.18)':'';$('light-toggle').setAttribute('aria-pressed',String(bright));},
    next(){this.goTo(progress>.985?0:(tourStops.find(stop=>stop>progress+.025)??1));},
    pause(){active=false;},resume(){active=true;picture.hidden=false;chapter=-1;paint();setZoom(zoom);},refresh(){update();}
  };
}
