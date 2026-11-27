import {acknowledgeWarnings,warningList} from '../dist/threat-warning.js';
import assert from 'node:assert/strict';
import {createScene,newShift} from '../dist/mission.js';
import {SPAWN_BALANCE,hiddenSpawn,updateHaunt} from '../dist/haunt.js';
const [w]=createScene(),dt=1/60,rng=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
let count=0;
for(const [x,z] of [[1.7,15],[-8,-5],[-30,12],[-35,-3],[0,38],[-30,40],[-30,57],[-30,70],[0,57],[0,73]])for(let seed=1;seed<=12;seed++){
 const s=Object.assign(newShift(rng(seed)),{x,z,y:0,bodyHeight:1.7,elapsed:20,hauntDirector:{delay:0,bag:[]}});
 updateHaunt(s,w.blocks,[0,0,-1],dt,rng(seed+37));
 if(!s.haunt.length)continue;
 const a=s.haunt[0],d=Math.hypot(a.x-x,a.z-z);
 assert.ok(d>=SPAWN_BALANCE.minDistance&&d<=SPAWN_BALANCE.maxDistance);
 assert.ok(hiddenSpawn(s,a.x,a.z,a.kind,s.navBlocks,a.surfaceY??0));
 assert.equal(a.speed,0);assert.ok(a.spawnGrace>2.4);assert.ok(s.hauntSounds.some(q=>q.spawnWarning));count++;
}
assert.ok(count>=60);
assert.ok(!hiddenSpawn(Object.assign(newShift(),{x:0,z:0,y:0}),0,20,1,[]));
const close=Object.assign(newShift(),{x:0,z:1,bodyHeight:1.7,hauntDirector:{delay:1e6,bag:[]}});
close.haunt=[{kind:1,x:0,z:0,yaw:0,phase:0,age:0,life:50,speed:0,timer:.3,state:'patrol',spawnGrace:2.5,path:[[0,0],[0,5]],pathIndex:1,direction:1,aggression:0}];
const empty=[];
for(let i=0;i<145;i++){close.elapsed+=dt;assert.ok(!updateHaunt(close,empty,[0,0,-1],dt,()=>.42));assert.ok(!close.failed);assert.equal(close.haunt[0].speed,0);acknowledgeWarnings(close,warningList(close).map(w=>w.id),close.elapsed);}
let caught=null;for(let i=0;i<400&&!caught;i++){close.elapsed+=dt;caught=updateHaunt(close,empty,[0,0,-1],dt,()=>.42);acknowledgeWarnings(close,warningList(close).map(w=>w.id),close.elapsed);}assert.equal(caught,'함귀');
const first=Object.assign(newShift(),{elapsed:0,horrorEvent:{type:'pickup',time:0}});updateHaunt(first,w.blocks,[0,0,-1],dt,()=>.42);assert.ok(first.hauntDirector.delay>=7.9);
const crowded=Object.assign(newShift(),{elapsed:30,x:0,z:0,hauntDirector:{delay:0,bag:[0]},haunt:[{kind:1,x:0,z:5,age:2,life:50,pursuit:true,state:'alert',speed:0,timer:0,path:[[0,5]],pathIndex:0,direction:1,phase:0,yaw:0,aggression:1}]});updateHaunt(crowded,empty,[0,0,1],dt,()=>.42);assert.equal(crowded.haunt.length,1);
console.log('PASS: hidden spawn distance, warning grace, no overlapping pursuit spawns and post-grace capture',count);
