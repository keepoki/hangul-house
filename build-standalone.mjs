import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
const base=new URL('./dist/',import.meta.url);
const files=['index.html','style.css','assets/three.module.js','assets/cannon-es.js','exhibition-layout.js','hangul-building.js','exhibition-content.js','camera-tour.js','environment.js','scene-quality.js','workshop-physics.js','workshop.js','interface.js','gallery.js'];
const data=Object.fromEntries(await Promise.all(files.map(async name=>[name,await readFile(new URL(name,base),'utf8')])));
function vendor(name,text){
 const found=text.match(/export\s*\{([^}]+)\}\s*;?\s*$/);
 if(!found)throw new Error('Missing vendor exports: '+name);
 const entries=found[1].split(',').map(s=>s.trim()).filter(Boolean).map(s=>{const p=s.split(/\s+as\s+/);return p.length===2?p[1]+':'+p[0]:p[0];});
 return 'const '+name+'=(()=>{'+text.slice(0,found.index)+'\nreturn {'+entries.join(',')+'};})();\n';
}
const inline=text=>text.replace(/^import[^;]+;\s*/gm,'').replace(/^export\s+/gm,'');
const licenses={};
for(const file of ['THREE-LICENSE.txt','CANNON-LICENSE.txt','FONT-LICENSE.txt'])licenses[file]=await readFile(new URL('assets/'+file,base),'utf8');
const app=['exhibition-layout.js','hangul-building.js','exhibition-content.js','camera-tour.js','environment.js','scene-quality.js'].map(file=>inline(data[file])).join('\n')+'\nconst stops=tourStops;\n'+['workshop-physics.js','workshop.js','interface.js','gallery.js'].map(file=>inline(data[file])).join('\n');
const body=app.replace("import('./workshop.js')","Promise.resolve({createWorkshop})").replace("fetch('./assets/'+file)","Promise.resolve({ok:true,text:async()=>inlineLicenses[file]})");
let html=data['index.html'],css=data['style.css'];
const original=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!original)throw new Error('Missing inline application bootstrap');
const bootstrap=original.replace("import('./interface.js')","Promise.resolve({initInterface})").replace("import('./gallery.js')","Promise.resolve({initGallery})");
const script=(vendor('THREE',data['assets/three.module.js'])+vendor('CANNON',data['assets/cannon-es.js'])+'const inlineLicenses='+JSON.stringify(licenses)+';\n'+body+'\n'+bootstrap).replace(/<\/script/gi,'<\\/script');
new Script(script,{filename:'hangul-house.html'});
const font='data:font/ttf;base64,'+(await readFile(new URL('assets/gowun-batang.ttf',base))).toString('base64');
const poster='data:image/svg+xml;base64,'+(await readFile(new URL('assets/house-plan.svg',base))).toString('base64');
css=css.replace('./assets/gowun-batang.ttf',font);
html=html.replace(/<link rel="icon"[^>]+>/,'').replace(/<link rel="stylesheet"[^>]+>/,()=>'<style>'+css+'</style>').replace('./assets/gowun-batang.ttf',font).replace('./assets/house-plan.svg',poster).replace(/<script type="module">[\s\S]*?<\/script>/,()=>'<script>'+script+'</script>');
await writeFile(new URL('./hangul-house.html',import.meta.url),html);
console.log('Created self-contained exhibition, physics workshop and license notices');
