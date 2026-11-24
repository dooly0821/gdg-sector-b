import assert from 'node:assert/strict';
import {MESH_DATA,FINGER_FLEX} from '../dist/viewmodel-mesh-data.js';
import {prepareFingerBend,relaxedFingerAmounts} from '../dist/hand-motion.js';
import {dot,vsub} from '../dist/world.js';

let samples=0;
for(const pose of ['emptyL','emptyR']){
 const finger=FINGER_FLEX[pose],root=Math.min(...finger.knuckles);
 const bends=Array.from({length:31},(_,i)=>prepareFingerBend({
  ...finger,amount:-.14+i*.011,fingerAmounts:relaxedFingerAmounts(i*.033,i*.039,pose==='emptyL'?0:1)
 }));
 for(const [name,data] of Object.entries(MESH_DATA)){
  if(!name.startsWith(`vm_${pose}_glove`))continue;
  const b=Buffer.from(data,'base64');
  for(let i=0;i<b.length;i+=16*13){
   const p=[0,2,4].map(k=>b.readInt16LE(i+k)/20000),axial=dot(vsub(p,finger.pivot),finger.forward);
   let prev;
   for(const bend of bends){
    const next=bend(p);
    assert.ok(next.every(Number.isFinite));
    if(axial<root-.0001)assert.ok(Math.hypot(...vsub(next,p))<1e-8,'palm stays fixed');
    if(prev)assert.ok(Math.hypot(...vsub(next,prev))<.003,'no joint snapping');
    prev=next;samples++;
   }
  }
 }
 assert.ok(new Set(relaxedFingerAmounts(.5,.4,0)).size===4);
}
console.log(`PASS: ${samples} continuous three-joint samples, independent finger timing and fixed palm`);
