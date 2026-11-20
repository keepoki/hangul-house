const roomIds=['home','room-stone','room-water','room-wood','room-light','room-garden','room-quiet','text-tour'];
const navigationStops=[0,.13,.26,.39,.52,.66,.79,1];

const structureParts={
  whole:['한글 건축관','석재의 꺾인 선과 참나무의 네 획이 한 채의 집을 이룹니다.'],
  giyeok:['ㄱ · 기둥과 처마','가로획이 앞으로 뻗어 처마를 만들고, 세로획이 그 아래 공간을 받칩니다.'],
  mieum:['ㅁ · 입구','참나무 네 획이 사각 틀을 짭니다. 가운데 남은 공간이 드나드는 입구입니다.'],
  siot:['ㅅ · 지붕','두 획이 위에서 만나고 양옆으로 기울어지며, 그 아래에 머물 공간을 만듭니다.'],
  ieung:['ㅇ · 창','둥근 석재 틀의 중심을 비워, 바깥 풍경을 담는 창을 만듭니다.']
};

function wireStructureExplorer(document,{pause,resume}){
  const $=id=>document.getElementById(id);
  const explorer=$('structure-dialog'),figure=$('structure-figure'),reset=$('structure-reset');
  const choices=[...document.querySelectorAll('[data-structure-part]')];
  let opener;
  function select(part){
    const [title,description]=structureParts[part];
    figure.dataset.selection=part;
    for(const choice of choices)choice.setAttribute('aria-pressed',String(choice.dataset.structurePart===part));
    $('structure-part-title').textContent=title;
    $('structure-part-description').textContent=description;
    reset.setAttribute('aria-disabled',String(part==='whole'));
  }
  for(const choice of choices){
    choice.addEventListener('click',()=>{
      const part=choice.dataset.structurePart;
      select(figure.dataset.selection===part?'whole':part);
    });
  }
  for(const button of document.querySelectorAll('[data-open-structure]')){
    button.hidden=false;
    button.addEventListener('click',()=>{
      if(explorer.open)return;
      opener=button;
      select('whole');
      explorer.showModal();
      pause();
      $('structure-title').focus({preventScroll:true});
    });
  }
  reset.addEventListener('click',()=>{if(figure.dataset.selection!=='whole')select('whole');});
  $('structure-close').addEventListener('click',()=>explorer.close());
  explorer.addEventListener('close',()=>{
    resume();
    opener?.focus({preventScroll:true});
  });
  return explorer;
}

export function initInterface({onModeChange=()=>{},onRetry=()=>location.reload()}={}){
  const $=id=>document.getElementById(id),root=document.documentElement,help=$('help-menu'),dialog=$('workshop-dialog');
  const modes=$('viewing-menu'),resumeButton=$('resume-gallery');
  let controller=null,textMode=root.dataset.readFirst==='true',savedScroll=0,workshop=null,workshopPromise=null,opener=null,previousOverflow='';
  let visualView='3d';
  const isVisual=()=>root.dataset.view==='3d'||root.dataset.view==='images';
  const structure=wireStructureExplorer(document,{
    pause:()=>controller?.pause?.(),
    resume:()=>{if(isVisual())controller?.resume?.();}
  });
  function showText(target='text-tour'){
    if(isVisual())savedScroll=scrollY;
    textMode=true;root.dataset.view='static';$('experience').inert=false;controller?.pause?.();help.open=false;resumeButton.hidden=false;
    requestAnimationFrame(()=>{const section=$(target);section?.scrollIntoView({behavior:'instant',block:'start'});if(section){section.tabIndex=-1;section.focus({preventScroll:true});}});
  }
  function go(index){
    help.open=false;
    if(controller&&isVisual())controller.goTo(navigationStops[index]);
    else showText(roomIds[index]);
  }
  document.querySelectorAll('[data-stop]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.stop))));
  document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.goto)===0?0:1)));
  $('story-start').addEventListener('click',()=>{
    go(1);
    if(isVisual())document.querySelectorAll('[data-stop]')[1]?.focus({preventScroll:true});
  });
  document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();go(0);});
  document.querySelectorAll('[data-show-text]').forEach(b=>b.addEventListener('click',()=>showText()));
  document.querySelectorAll('[data-credits]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();showText('credits');}));
  document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();showText();});
  document.querySelector('.failure-actions a').addEventListener('click',e=>{e.preventDefault();showText();});
  resumeButton.addEventListener('click',()=>{textMode=false;if(!controller){onRetry();return;}root.dataset.view=visualView;scrollTo({top:savedScroll,behavior:'instant'});controller.resume?.();controller.refresh();});
  function closeViewingMenu(){
    modes.open=false;
    modes.querySelector('summary')?.focus({preventScroll:true});
  }
  document.querySelectorAll('[name="viewing-mode"]').forEach(input=>input.addEventListener('change',()=>{if(!input.checked)return;textMode=false;closeViewingMenu();onModeChange(input.value);}));
  document.querySelectorAll('[data-viewing-choice]').forEach(button=>button.addEventListener('click',()=>{textMode=false;onModeChange(button.dataset.viewingChoice);}));
  $('zoom-in').addEventListener('click',()=>controller?.changeZoom(.15));
  $('zoom-out').addEventListener('click',()=>controller?.changeZoom(-.15));
  $('zoom-reset').addEventListener('click',()=>controller?.setZoom(1));
  $('light-toggle').addEventListener('click',()=>controller?.toggleLighting());
  $('next-stop').addEventListener('click',()=>controller?.next());
  $('retry-gallery').addEventListener('click',()=>onRetry());
  addEventListener('keydown',e=>{
    if(e.key==='Escape'){help.open=false;if(modes.open)closeViewingMenu();}
    if(!controller||!isVisual()||dialog.open||structure.open||e.ctrlKey||e.metaKey||e.altKey||e.target?.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;
    if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')controller.setZoom(1);else controller.changeZoom(e.key==='-'?-.15:.15);}
  });
  document.addEventListener('click',e=>{if(help.open&&!help.contains(e.target))help.open=false;if(modes.open&&!modes.contains(e.target))modes.open=false;});
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
  dialog.addEventListener('close',()=>{workshop?.pause();document.body.style.overflow=previousOverflow;if(isVisual())controller?.resume?.();opener?.focus({preventScroll:true});});
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
  $('load-licenses').addEventListener('click',async e=>{
    const button=e.currentTarget;button.disabled=true;button.textContent='라이선스를 불러오는 중';
    try{const files=[['Three.js','THREE-LICENSE.txt'],['Cannon-es','CANNON-LICENSE.txt'],['고운바탕','FONT-LICENSE.txt']];const texts=await Promise.all(files.map(async([name,file])=>{const response=await fetch('./assets/'+file);if(!response.ok)throw new Error();return name+'\n\n'+await response.text();}));const pre=document.createElement('pre');pre.textContent=texts.join('\n\n────────────────\n\n');$('license-notices').replaceChildren(pre);}catch{button.disabled=false;button.textContent='라이선스 다시 불러오기';}
  });
  const timeout=setTimeout(()=>{if(root.dataset.state==='loading'){$('load-status').textContent='3D 준비가 늦어지고 있습니다. 아래 설명부터 읽어보세요.';$('loading-phase').textContent='준비가 길어지고 있습니다. 글로 먼저 관람할 수 있습니다.';$('failure-actions').hidden=false;}},12000);
  function fail(error){clearTimeout(timeout);controller=null;resumeButton.textContent='전시 관람으로 돌아가기';root.dataset.view='static';root.dataset.state='error';$('experience').inert=false;$('load-status').textContent='3D 전시를 열지 못했습니다. 아래 설명은 계속 읽을 수 있습니다.';$('failure-actions').hidden=false;['zoom-in','zoom-out','zoom-reset','light-toggle'].forEach(id=>$(id).disabled=true);console.warn('3D gallery unavailable',error);}
  return {wantsText:()=>textMode,fail,
    setViewingState({preference,active,status,notice=''}){document.querySelectorAll('[name="viewing-mode"]').forEach(input=>input.checked=input.value===preference);$('viewing-current').textContent=active==='3d'?'3D':'이미지';$('viewing-status').textContent=status;$('viewing-announcement').textContent=notice;},
    attach(value,{view='3d'}={}){
      clearTimeout(timeout);controller=value;visualView=view;root.dataset.state='ready';$('experience').inert=false;$('failure-actions').hidden=true;
      resumeButton.textContent=view==='images'?'이미지 관람으로 돌아가기':'3D 관람으로 돌아가기';
      ['zoom-in','zoom-out','zoom-reset','light-toggle'].forEach(id=>$(id).disabled=false);
      root.dataset.view=textMode?'static':view;
      if(textMode)resumeButton.hidden=false;
      if(textMode||dialog.open||structure.open)controller.pause?.();
      controller.refresh();
    }
  };
}
