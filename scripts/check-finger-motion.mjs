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
    if(axial<root-.0001&&dot(vsub(p,finger.pivot),finger.width)>finger.digitWidths[0]-.009)assert.ok(Math.hypot(...vsub(next,p))<1e-8,'palm stays fixed');
    if(prev)assert.ok(Math.hypot(...vsub(next,prev))<.003,'no joint snapping');
    prev=next;samples++;
   }
  }
 }
 assert.ok(new Set(relaxedFingerAmounts(.5,.4,0)).size===4);
}
console.log(`PASS: ${samples} continuous three-joint samples, independent finger timing and fixed palm`);

// Integrate each posed triangle about the wrist. Translation of a closed
// surface leaves its signed volume unchanged, so this also catches bad seams.
for(const pose of ['emptyL','emptyR']){
 const f=FINGER_FLEX[pose];
 const vertices=[];
 for(const [name,packed] of Object.entries(MESH_DATA)){
  if(!name.startsWith('vm_'+pose+'_glove_'))continue;
  const b=Buffer.from(packed,'base64');
  for(let i=0;i<b.length;i+=16)vertices.push([0,2,4].map(k=>b.readInt16LE(i+k)/20000));
 }
 const volume=amount=>{
  const deform=prepareFingerBend({...f,amount,fingerAmounts:[.74,.92,1.01,1.12]});
  let sum=0;
  for(let i=0;i<vertices.length;i+=3){
   const [a,b,c]=vertices.slice(i,i+3).map(p=>vsub(deform?deform(p):p,f.pivot));
   sum+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  }
  return Math.abs(sum)/6;
 };
 const open=volume(0);
 for(const amount of [.33,.65,.98,1.3,1.7,2.1]){
  const ratio=volume(amount)/open;
  assert.ok(Math.abs(1-ratio)<.05,'glove volume lost during flexion '+ratio);
  console.log(pose,amount,(100*ratio).toFixed(2)+'% of rest volume');
 }
 const tip=vertices.reduce((best,p)=>dot(vsub(p,best),f.width)<0?p:best);
 assert.ok(Math.hypot(...vsub(prepareFingerBend({...f,amount:1.3})(tip),tip))>.025,'opposable thumb participates in closure');
}
