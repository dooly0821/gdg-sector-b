import assert from 'node:assert/strict';
import {renderPosition,shiftPrevious,mouseDelta,blockGameplayShortcut,frameBudget} from '../dist/frame-pacing.js';
import {move} from '../dist/movement.js';
const flat=()=>0;
for(const hz of [60,120]){
 const tick=1/hz,s={x:0,y:0,z:10,yaw:0,vx:0,vy:0,vz:-7,bodyHeight:1.7,grounded:true,elapsed:0,steps:0,carried:-1};let accum=0,prev=null,first=true,render=null,maxDelta=0;
 for(let i=0;i<180;i++){const raw=[1/144,1/60,1/90,1/120][i%4],b=frameBudget(raw,accum,tick);for(let j=0;j<b.steps;j++){prev=[s.x,s.y,s.z];move(s,new Set(),[],tick,first,flat);first=false;}accum=b.remainder;const p=renderPosition(s,prev,accum/tick);if(render)maxDelta=Math.max(maxDelta,Math.hypot(...p.map((v,k)=>v-render[k])));render=p;assert(!s.vault);}
 assert(maxDelta<.25,'interpolated motion at '+hz);
 assert(frameBudget(5,0,tick).steps<=8);
}
assert.deepEqual(renderPosition({x:5,y:1,z:0},[0,0,0],.5),[5,1,0]);
assert.deepEqual(shiftPrevious([1,2,3],[4,5,6],[5,5,5]),[2,2,2]);
assert(Math.abs(mouseDelta(10,1)-.021)<1e-12);assert(Math.abs(mouseDelta(1200,2))<=.6);assert.equal(mouseDelta(NaN,1),0);
assert(blockGameplayShortcut({code:'KeyW',ctrlKey:true}));assert(blockGameplayShortcut({code:'Tab'}));assert(!blockGameplayShortcut({code:'Space'}));assert(!blockGameplayShortcut({code:'KeyC'}));
console.log('PASS: fixed-step interpolation at 60/120 Hz, bounded catch-up, mouse spike and shortcut guards');
