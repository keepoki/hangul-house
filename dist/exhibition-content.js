export const chapters = [
  {context:'한글 건축관',title:'한글의 선으로<br>공간을 짓다.',body:'ㄱ은 기둥과 처마로, ㅅ은 지붕으로.<br>익숙한 글자가 건축이 되는 전시입니다.',note:'아래로 스크롤해 여섯 공간을 만나보세요.',glyph:'ㅁ',name:'한글로 지은 집',material:'석재 · 참나무 · 짙은 돌'},
  {context:'돌의 방 · 석회암',title:'꺾인 선이<br>공간을 받치다.',body:'ㄱ의 가로선은 처마가 되고,<br>세로선은 그 아래의 공간을 받칩니다.',note:'돌의 무게와 선의 방향을 함께 감상하세요.',glyph:'ㄱ',name:'시작의 모양',material:'따뜻한 석회암'},
  {context:'물의 뜰 · 청동',title:'비워 둔 곳에<br>풍경이 담기다.',body:'ㅇ의 가운데를 비우자 창이 생깁니다.<br>둥근 틈 너머로 물과 빛이 이어집니다.',note:'형태뿐 아니라 그 안의 여백도 작품입니다.',glyph:'ㅇ',name:'여백의 형태',material:'청동과 고요한 수면'},
  {context:'나무의 뜰 · 참나무',title:'경계가 생기고,<br>입구가 열리다.',body:'ㅁ의 네 방향이 하나의 방을 만듭니다.<br>가운데를 열면 누구나 드나드는 입구가 됩니다.',note:'닫힌 글자가 열린 공간으로 바뀝니다.',glyph:'ㅁ',name:'마음의 방',material:'오일 마감 참나무'},
  {context:'빛의 방 · 황동',title:'선과 원 사이,<br>빛이 머물다.',body:'ㅎ의 짧은 선과 둥근 형태를 나누어 봅니다.<br>틈마다 다른 방향의 빛이 닿습니다.',note:'가까이에서 황동의 표면과 그림자를 살펴보세요.',glyph:'ㅎ',name:'빛의 숨',material:'결을 살린 황동'},
  {context:'초록의 정원 · 녹청',title:'한 획에서<br>길이 뻗어가다.',body:'ㅏ의 곧은 선은 기둥이 되고,<br>옆으로 뻗은 선은 정원으로 향하는 길이 됩니다.',note:'식물의 유연한 선과 금속의 곧은 선을 비교해보세요.',glyph:'ㅏ',name:'열린 방향',material:'녹청색 금속과 식재'},
  {context:'고요의 방 · 도자기',title:'두 선이 만나<br>지붕이 되다.',body:'서로 기대는 ㅅ의 두 선.<br>기울어진 획 아래에 사람이 머물 자리가 생깁니다.',note:'지붕과 글자가 공유하는 형태를 발견해보세요.',glyph:'ㅅ',name:'서로를 향한 선',material:'아이보리 도자기와 자갈'},
  {context:'한글 작업실',title:'이제,<br> 당신의 집.',body:'입구가 된 ㅁ, 지붕이 된 ㅅ, 창이 된 ㅇ.<br> 세 조각을 직접 옮겨 집 한 채를 지어보세요.',note:'나무·돌·황동의 가상 무게와 충돌을 체험합니다.',glyph:'ㅁ',name:'당신이 만드는 집',material:'한글 조각으로 짓는 작은 건축'}
];

export function updateTourNavigation(document,index){
  for(const button of document.querySelectorAll('[data-stop]')){
    const active=Number(button.dataset.stop)===index;
    button.classList.toggle('active',active);
    if(!active){button.removeAttribute('aria-current');continue;}
    button.setAttribute('aria-current','step');
    const nav=button.parentElement;
    if(!nav||nav.scrollWidth<=nav.clientWidth)continue;
    const viewportLeft=nav.getBoundingClientRect().left+nav.clientLeft;
    const viewportRight=viewportLeft+nav.clientWidth;
    const {left,right}=button.getBoundingClientRect();
    if(left<viewportLeft||right>viewportRight)nav.scrollLeft+=(left+right-viewportLeft-viewportRight)/2;
  }
}
