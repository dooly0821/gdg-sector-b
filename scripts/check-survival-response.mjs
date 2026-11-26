import assert from 'node:assert/strict';
import {newShift,step,canUse,handlingTarget,createScene} from '../dist/mission.js';
import {updateHaunt} from '../dist/haunt.js';
import {PHYSICS} from '../dist/movement.js';

const dt=1/120,run=new Set(['KeyW','ShiftLeft']);
const hop=Object.assign(newShift(),{x:0,z:8,yaw:0});
for(let i=0;i<120;i++)step(hop,run,[],dt);
assert.ok(Math.abs(Math.hypot(hop.vx,hop.vz)-7)<.01);
let peak=0;
for(let i=0;i<330;i++){
 step(hop,new Set(['KeyW','ShiftLeft','KeyC','Space']),[],dt,i===0);
 peak=Math.max(peak,Math.hypot(hop.vx,hop.vz));
}
assert.ok(peak>7.5&&peak<=PHYSICS.bhopCap+.001,'crouch-hop gains bounded momentum');
const [{blocks}]=createScene();
const shelf=Object.assign(newShift(),{x:-.35,y:0,z:.26,yaw:Math.PI/2});
step(shelf,new Set(['KeyW']),blocks,dt,true);
assert.ok(!shelf.vault&&shelf.vy>6);
let maxShelf=shelf.y;for(let i=0;i<150;i++){step(shelf,new Set(['KeyW','KeyC']),blocks,dt);maxShelf=Math.max(maxShelf,shelf.y);assert(!shelf.vault);}
assert.ok(maxShelf>1.1&&maxShelf<=1.21,'physical shelf jump');
const s=Object.assign(newShift(),{x:0,y:0,z:0,yaw:0,pitch:-.6,bodyHeight:1.7,
 cargo:[{id:'B-01',area:'test',pos:[.1,.6,-1.2]},{id:'B-02',area:'test',pos:[.7,.6,-1]}],states:['AVAILABLE','AVAILABLE']});
const target={...s.cargo[0],index:0};
assert.equal(handlingTarget(s,[])?.index,0);
assert.ok(canUse(s,target,[]));
assert.ok(!canUse(s,target,[[-1,-.8,1,-.7,0,3]]));
s.yaw=.55;assert.ok(canUse(s,target,[],true));
function ghost(kind,z){
 const s=Object.assign(newShift(),{x:0,z,bodyHeight:1.7});
 s.hauntDirector={delay:1e6,bag:[]};s.haunt=[{kind,x:0,z:0,yaw:0,phase:0,age:2,life:40,speed:0,timer:.5,state:'alert',chargeTarget:[0,z],path:[[0,0]],pathIndex:0,direction:1,aggression:1}];return s;
}
for(let kind=0;kind<4;kind++)for(const wall of [false,true]){
 const s=ghost(kind,1.5);let result=null;
 for(let i=0;i<600&&!result;i++){s.elapsed+=dt;result=updateHaunt(s,wall?[[-8,.65,8,.75,0,3]]:[],[0,0,-1],dt,()=>.42);}
 assert.equal(Boolean(result),!wall);
 assert.equal(Boolean(s.failed),!wall);
 assert.ok(!s.encounterHit,'no capture delay');
}
const q=ghost(1,8);
updateHaunt(q,[],[0,0,-1],dt,()=>.42);
assert.ok(q.haunt[0].pursuit);
const wall=[[-8,3,8,3.3,0,4]];
for(let i=0;i<180;i++){q.elapsed+=dt;updateHaunt(q,wall,[0,0,-1],dt,()=>.42);}
assert.ok(q.haunt[0].pursuit&&q.haunt[0].speed>2);
q.z=49;
for(let i=0;i<480;i++){q.elapsed+=dt;updateHaunt(q,wall,[0,0,-1],dt,()=>.42);}
assert.ok(!q.haunt[0]?.pursuit);
console.log('PASS: bounded crouch-hop, free shelf jump, cargo aim/occlusion, immediate capture and persistent pursuit');
