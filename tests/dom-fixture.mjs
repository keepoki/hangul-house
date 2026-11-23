export function fixture(){
  class Element extends EventTarget{
    constructor(id){super();this.id=id;this.style={};this.dataset={};this.attrs={};this.hidden=true;this.disabled=false;this.open=false;this.textContent='';this.innerHTML='';this.focused=false;this.tagName='BUTTON';this.classList={add(){},remove(){},toggle(){}};}
    setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}
    focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}
    contains(other){return other===this;}
    showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
    getBoundingClientRect(){return{left:0,top:0,right:600,bottom:400,width:600,height:400};}
    replaceChildren(child){this.child=child;}
  }
  const elements=new Map();function $(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);}
  const groups={
    '[data-stop]':Array.from({length:8},(_,i)=>{const e=$('stop-'+i);e.dataset.stop=String(i);return e;}),
    '[data-note-stop]':Array.from({length:6},(_,i)=>{const note=$('note-stop-'+(i+1));note.dataset.noteStop=String(i+1);return note;}),
    '[data-goto]':[0,.13].map((p,i)=>{const e=$('goto-'+i);e.dataset.goto=String(p);return e;}),
    '[data-open-structure]':[$('structure-action'),$('text-structure')],
    '[data-structure-part]':['giyeok','mieum','siot','ieung'].map(part=>{const button=$('part-'+part);button.dataset.structurePart=part;return button;}),
    '[data-show-text]':[$('show-text')],
    '[data-credits]':[$('show-credits')],
    '[name="viewing-mode"]':['auto','3d','images'].map(value=>{const e=$('mode-'+value);e.value=value;e.checked=value==='auto';return e;}),
    '[data-viewing-choice]':[$('retry-3d')]
  };
  $('retry-3d').dataset.viewingChoice='3d';
  const document=new EventTarget();Object.assign(document,{getElementById:$,querySelector:s=>$(s),querySelectorAll:s=>groups[s]??[],body:$('body'),documentElement:{dataset:{view:'static',state:'loading'}},createElement:tag=>new Element(tag),hidden:false});
  const window=new EventTarget(),timers=new Map();let sequence=0,reloads=0,lastScroll;
  const time=fn=>{timers.set(++sequence,fn);return sequence;},clear=id=>timers.delete(id);
  const location={reload(){reloads++;}};
  function fire(element,type,properties={}){const event=new Event(type,{cancelable:true,bubbles:true});Object.assign(event,properties);element.dispatchEvent(event);return event;}
  return{$,document,window,groups,timers,time,clear,location,fire,get reloads(){return reloads;},scrollTo:v=>lastScroll=v,get lastScroll(){return lastScroll;}};
}
