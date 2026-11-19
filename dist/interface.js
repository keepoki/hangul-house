const roomIds=['home','room-stone','room-water','room-wood','room-light','room-garden','room-quiet','text-tour'];
const navigationStops=[0,.13,.26,.39,.52,.66,.79,1];

export function initInterface(){
  const $=id=>document.getElementById(id),root=document.documentElement,help=$('help-menu'),dialog=$('workshop-dialog');
  let controller=null,textMode=false,savedScroll=0,workshop=null,workshopPromise=null,opener=null,previousOverflow='';
  function showText(target='text-tour'){
    if(root.dataset.view==='3d')savedScroll=scrollY;
    textMode=true;root.dataset.view='static';controller?.pause?.();help.open=false;$('resume-gallery').hidden=false;
    requestAnimationFrame(()=>{const section=$(target);section?.scrollIntoView({behavior:'instant',block:'start'});if(section){section.tabIndex=-1;section.focus({preventScroll:true});}});
  }
  function go(index){
    help.open=false;
    if(controller&&root.dataset.view==='3d')controller.goTo(navigationStops[index]);
    else showText(roomIds[index]);
  }
  document.querySelectorAll('[data-stop]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.stop))));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.goto)===0?0:1)));
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();go(0);});
  document.querySelectorAll('[data-show-text]').forEach(b=>b.addEventListener('click',()=>showText()));
  document.querySelectorAll('[data-credits]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();showText('credits');}));
  document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();showText();});
  document.querySelector('.failure-actions a').addEventListener('click',e=>{e.preventDefault();showText();});
  $('resume-gallery').addEventListener('click',()=>{if(!controller){location.reload();return;}textMode=false;root.dataset.view='3d';scrollTo({top:savedScroll,behavior:'instant'});controller.resume?.();controller.refresh();});
  $('zoom-in').addEventListener('click',()=>controller?.changeZoom(.15));
  $('zoom-out').addEventListener('click',()=>controller?.changeZoom(-.15));
  $('zoom-reset').addEventListener('click',()=>controller?.setZoom(1));
  $('light-toggle').addEventListener('click',()=>controller?.toggleLighting());
  $('next-stop').addEventListener('click',()=>controller?.next());
  $('retry-gallery').addEventListener('click',()=>location.reload());
  addEventListener('keydown',e=>{
    if(e.key==='Escape')help.open=false;
    if(!controller||root.dataset.view!=='3d'||dialog.open||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;
    if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')controller.setZoom(1);else controller.changeZoom(e.key==='-'?-.15:.15);}
  });
  document.addEventListener('click',e=>{if(help.open&&!help.contains(e.target))help.open=false;});
  async function openWorkshop(source){
    opener=source;help.open=false;if(!dialog.open){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();controller?.pause?.();}
    $('retry-workshop').hidden=true;
    if(workshop){workshop.open();return;}
    $('workshop-loading').hidden=false;$('workshop-loading').textContent='글자 조각을 준비하고 있습니다.';
    try{
      workshopPromise??=import('./workshop.js');
      const module=await workshopPromise;
      if(!workshop)workshop=module.createWorkshop();
      if(dialog.open)workshop.open();
    }catch(error){workshopPromise=null;$('workshop-loading').textContent='작업실을 불러오지 못했습니다. 다시 열기를 눌러주세요.';$('retry-workshop').hidden=false;$('workshop-status').textContent='전시 관람은 계속 이용할 수 있습니다.';console.warn('Workshop unavailable',error);}
  }
  document.querySelectorAll('[data-open-workshop]').forEach(b=>{b.hidden=false;b.addEventListener('click',()=>openWorkshop(b));});
  $('story-action').hidden=true;
  $('retry-workshop').addEventListener('click',()=>openWorkshop(opener));
  $('workshop-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{workshop?.pause();document.body.style.overflow=previousOverflow;if(root.dataset.view==='3d')controller?.resume?.();opener?.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  $('load-licenses').addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;button.textContent='라이선스를 불러오는 중';
    try{const files=[['Three.js','THREE-LICENSE.txt'],['Cannon-es','CANNON-LICENSE.txt'],['고운바탕','FONT-LICENSE.txt']];const texts=await Promise.all(files.map(async([name,file])=>{const response=await fetch('./assets/'+file);if(!response.ok)throw new Error();return name+'\n\n'+await response.text();}));const pre=document.createElement('pre');pre.textContent=texts.join('\n\n────────────────\n\n');$('license-notices').replaceChildren(pre);}catch{button.disabled=false;button.textContent='라이선스 다시 불러오기';}
  });
  const timeout=setTimeout(()=>{if(root.dataset.state==='loading'){$('load-status').textContent='3D 준비가 늦어지고 있습니다. 아래 설명부터 읽어보세요.';$('failure-actions').hidden=false;}},12000);
  function fail(error){clearTimeout(timeout);controller=null;root.dataset.view='static';root.dataset.state='error';$('load-status').textContent='3D 전시를 열지 못했습니다. 아래 설명은 계속 읽을 수 있습니다.';$('failure-actions').hidden=false;['zoom-in','zoom-out','zoom-reset','light-toggle'].forEach(id=>$(id).disabled=true);console.warn('3D gallery unavailable',error);}
  addEventListener('museum:failure',e=>fail(e.detail));
  return {wantsText:()=>textMode,fail,attach(value){clearTimeout(timeout);controller=value;root.dataset.state='ready';$('failure-actions').hidden=true;['zoom-in','zoom-out','zoom-reset','light-toggle'].forEach(id=>$(id).disabled=false);if(textMode)root.dataset.view='static';else root.dataset.view='3d';if(textMode||dialog.open)controller.pause?.();controller.refresh();}};
}
