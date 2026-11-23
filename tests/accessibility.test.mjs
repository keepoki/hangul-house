import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const base=new URL('../dist/',import.meta.url),css=await readFile(new URL('style.css',base),'utf8'),html=await readFile(new URL('index.html',base),'utf8');
function luminance(hex){const c=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
test('readable UI color tokens meet normal-text contrast on both background surfaces',()=>{
  const tokens=Object.fromEntries([...css.matchAll(/--([a-z-]+):(#\w{6})/g)].map(m=>[m[1],m[2]]));
  for(const foreground of ['paper','muted','subtle','gold'])for(const background of ['bg','surface']){
    const a=luminance(tokens[foreground]),b=luminance(tokens[background]);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,foreground+' on '+background);
  }
});
test('mobile help remains available and all functional text is at least 12px',()=>{
  assert.ok(html.includes('<details class="help-menu"'));assert.ok(!css.includes('.header-nav{display:none'));
  for(const match of css.matchAll(/font-size:\s*(\d+)px/g))assert.ok(Number(match[1])>=12);
  assert.ok(css.includes('min-width:44px'));
  assert.match(css,/#stage\s*\{[^}]*touch-action:\s*pan-y/);
});
test('all fonts, libraries, illustrations and licenses are self-hosted',async()=>{
  for(const file of ['assets/gowun-batang.ttf','assets/FONT-LICENSE.txt','assets/THREE-LICENSE.txt','assets/MOTION-LICENSE.txt','assets/motion-mini.js','assets/house-plan.svg'])await access(new URL(file,base));
  assert.equal(/https?:\/\//.test(html),false);
  assert.equal([...html.matchAll(/<a[^>]+href="([^"#][^"]*)"/g)].length,0,'The visitor must stay on one page');
  for(const file of ['THREE-LICENSE.txt','MOTION-LICENSE.txt'])assert.ok((await readFile(new URL('assets/'+file,base),'utf8')).includes('Permission is hereby granted'));
  assert.ok((await readFile(new URL('assets/FONT-LICENSE.txt',base),'utf8')).includes('SIL OPEN FONT LICENSE'));
});
test('the notes lead with the finished house and six continuously readable room descriptions',()=>{
  const notes=html.slice(html.indexOf('id="text-tour"'),html.indexOf('id="credits"'));
  assert.match(notes, /class="notes-transition"[\s\S]*assets\/gallery\/finale\.jpg[\s\S]*id="text-tour-title"/);
  assert.equal([...notes.matchAll(/class="text-room"/g)].length,6);
  assert.equal([...notes.matchAll(/data-note-stop="[1-6]"/g)].length,6);
  assert.doesNotMatch(notes,/<details|사진 속 .*살펴보기/);
});
test('the completed house leads directly into the notes without a workshop',()=>{
  assert.match(html, /<button[^>]*data-stop="7"[^>]*>완성<\/button>/);
  assert.match(html, /<div class="scroll-track" id="journey"[^>]*><\/div>\s*<\/div>\s*<section class="text-tour" id="text-tour"/);
  assert.doesNotMatch(html, /data-open-workshop|workshop-dialog|한글 작업실|직접 짓기/);
});
