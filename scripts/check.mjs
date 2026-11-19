import { readdir,readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const root=new URL('../',import.meta.url);
for(const file of await readdir(new URL('dist/',root))){
  if(!file.endsWith('.js'))continue;
  const result=spawnSync(process.execPath,['--check',new URL('dist/'+file,root).pathname.replace(/^\/([A-Z]:)/,'$1')],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error(result.stderr);
}
const html=await readFile(new URL('dist/index.html',root),'utf8');
const inline=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!inline)throw new Error('Missing resilient bootstrap');
const checked=spawnSync(process.execPath,['--input-type=module','--check'],{input:inline,encoding:'utf8',windowsHide:true});
if(checked.status!==0)throw new Error(checked.stderr);
console.log('Application modules and inline bootstrap syntax passed');
