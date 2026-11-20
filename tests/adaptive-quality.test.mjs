import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceGovernor} from '../dist/adaptive-quality.js';

test('healthy rendering retains the premium pixel budget',()=>{
  const changes=[],g=createPerformanceGovernor({onChange:p=>changes.push(p.name)});
  for(let i=0;i<600;i++)g.sample(16.7);
  assert.equal(g.profile.name,'high');assert.deepEqual(changes,[]);
});
test('sustained slow rendering reduces pixel and reflection budgets before requesting images',()=>{
  const changes=[];let fallback=0;
  const g=createPerformanceGovernor({onChange:p=>changes.push(p),onFallback:()=>fallback++});
  for(let i=0;i<100;i++)g.sample(100);
  assert.deepEqual(changes.map(p=>p.name),['balanced','efficient']);
  assert.ok(changes[1].maxPixels<changes[0].maxPixels);
  assert.ok(changes[1].reflectionSize<changes[0].reflectionSize);
  assert.equal(fallback,1);
});
test('one slow frame and a resumed hidden-tab interval do not degrade the scene',()=>{
  const g=createPerformanceGovernor();
  for(let i=0;i<100;i++)g.sample(16);g.sample(300);g.sample(60000);
  g.reset();for(let i=0;i<100;i++)g.sample(16);
  assert.equal(g.profile.name,'high');
});
test('reset discards an incomplete slow window instead of downgrading after an idle pause',()=>{
  const g=createPerformanceGovernor();
  for(let i=0;i<10;i++)g.sample(100);g.reset();
  for(let i=0;i<120;i++)g.sample(16);
  assert.equal(g.profile.name,'high');
});
