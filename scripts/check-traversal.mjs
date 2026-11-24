import assert from 'node:assert/strict';
import {newShift,createScene,step} from '../dist/mission.js';
import {updateHaunt} from '../dist/haunt.js';
const [{blocks}]=createScene(),dt=1/120,duck=new Set(['ControlLeft']),go=new Set(['ControlLeft','KeyW']);
const s=Object.assign(newShift(),{x:-21,z:7,yaw:Math.PI/2});
for(let i=0;i<25;i++)step(s,duck,blocks,dt);
for(const height of [.45,.96,2.355]){
 step(s,go,blocks,dt,true);assert.ok(s.vault);
 if(height>2)assert.ok(s.vault.high);
 for(let i=0;!s.grounded&&i<150;i++)step(s,go,blocks,dt);
 assert.ok(s.grounded&&Math.abs(s.y-height)<.01);
}
const none=new Set();
for(let i=0;i<60;i++)step(s,none,blocks,dt);
assert.ok(s.bodyHeight<1.5,'upper tier blocks standing');
s.yaw=-Math.PI/2;
for(let i=0;i<190;i++)step(s,new Set(['KeyW']),blocks,dt);
assert.equal(s.bodyHeight,1.70);assert.equal(s.y,0);
const haunt=Object.assign(newShift(),{x:-25,y:.855,z:7,bodyHeight:1.06});
const ghost={kind:1,x:-25,z:7.5,yaw:Math.PI,phase:0,age:2,life:40,speed:0,timer:.5,state:'charge',chargeTarget:[-25,7],path:[[-25,7]],pathIndex:0,direction:1,aggression:1};
haunt.haunt=[ghost];
assert.equal(updateHaunt(haunt,[...blocks,[-26,7.22,-24,7.26,0,3]],[0,0,1],dt),null,'no attack through shelving');
console.log('PASS actual C-01 crates, upper tier climb, blocked stand, descent, occluded attack');
const pallet=Object.assign(newShift(),{x:9.19,z:-14.72,yaw:Math.PI});
const forwardKeys=new Set(['KeyW']);
for(let i=0;i<50;i++)step(pallet,forwardKeys,blocks,dt);
step(pallet,forwardKeys,blocks,dt,true);
assert.equal(pallet.vault?.landing,1.0295,'mantle from contact with the protruding pallet board');

// Crouch behind the actual C-01 shelf load, then peek sideways into view.
for(const [x,hidden] of [[-25.6,true],[-24.25,false]]){
 const player=Object.assign(newShift(),{x,y:.855,z:7.24,bodyHeight:1.06,showTraversal:true});
 const watcher={...ghost,x:-25.6,z:4,state:'patrol',lastKnown:null};
 player.haunt=[watcher];
 updateHaunt(player,blocks,[0,0,1],dt);
 assert.equal(watcher.rays.every(ray=>!ray.open),hidden,'C-01 shelf sight lines');
}
