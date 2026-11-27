import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {newShift,canUse,handlingTarget} from '../dist/mission.js';
import {beginHandling,advanceHandling} from '../dist/handling.js';
import {findReviveTarget,REVIVE_SECONDS} from '../dist/revive.js';
const flat=()=>0;
for(const hz of [60,120]){
 const s=Object.assign(newShift(),{x:0,z:10,y:0,yaw:0,vz:-7});
 let peak=0;for(let i=0;i<hz*4;i++){move(s,new Set(['KeyW','KeyC','Space','ShiftLeft']),[],1/hz,i===0,flat);peak=Math.max(peak,Math.hypot(s.vx,s.vz));}
 assert(peak>10&&peak<=P.bhopCap+.001,'faster bounded bhop');
 const q=Object.assign(newShift(),{x:0,y:0,z:.65,yaw:0,vz:-3});
 const b=[[-.7,-1,.7,.15,0,1.02,'climb']];let max=0;
 for(let i=0;i<hz*2;i++){move(q,new Set(['KeyW']),b,1/hz,i===0,flat);assert(!q.vault);max=Math.max(max,q.y);}
 assert(max>1.18&&q.z<-.9,'physical obstacle jump');
}
const s=Object.assign(newShift(),{x:0,y:.38,z:0,yaw:0,pitch:-.35,grounded:false,vz:-6,cargo:[{id:'B-01',area:'test',pos:[0,.6,-1.65]}],states:['AVAILABLE']});
const t=handlingTarget(s,[]);assert(canUse(s,t,[]));assert(!canUse(s,t,[[-1,-.8,1,-.7,0,3]]));assert(beginHandling(s,t,[]));for(let i=0;i<30;i++)advanceHandling(s,[],1/60);assert.equal(s.carried,0);
const down={id:'down',failed:true,x:2.55,y:0,z:0},me={id:'me',x:0,y:0,z:0};assert.equal(REVIVE_SECONDS,1.7);assert.equal(findReviveTarget(me,[down],[],me.id).id,'down');assert.equal(findReviveTarget(me,[down],[[1,-1,1.1,1,0,3]],me.id),null);
console.log('PASS: accelerated bhop at both tick rates, airborne pickup and physical obstacle jump, wider revive with wall safety');
