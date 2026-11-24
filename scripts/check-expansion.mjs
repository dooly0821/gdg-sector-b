import assert from 'node:assert/strict';
import {
 createScene,newShift,step,handlingTarget,nextTarget,parcelPositions,deliveryCount,CONFIG,DOCK
} from '../dist/mission.js';
import {beginHandling,advanceHandling,choreography,rigs} from '../dist/handling.js';
import {TORCH_LOCAL} from '../dist/viewmodel.js';
import {hauntLayers,updateHaunt} from '../dist/haunt.js';

const worlds=createScene(),{blocks}=worlds[0],dt=1/120;
const w=new Set(['KeyW']);
const near=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6;
const carried=()=>{
 const s=newShift();
 s.states[0]='CARRIED';s.carried=0;
 return s;
};
const eye=s=>[s.x,s.y+CONFIG.eye,s.z];
const pose=s=>choreography(s,eye(s),true,false,false,.1);
function point(matrix,p,translation=1){
 return [0,1,2].map(i=>matrix[i]*p[0]+matrix[i+4]*p[1]+matrix[i+8]*p[2]+matrix[i+12]*translation);
}
for(const s of [newShift(),carried()]){
 s.flashAmount=1;
 const p=pose(s),torch=p.hands.find(({group})=>group===7);
 assert.ok(near(point(torch.matrix,TORCH_LOCAL.direction,0),[0,0,-1]));
 assert.ok(near(point(torch.matrix,TORCH_LOCAL.position),p.torchLocal.position.map((v,i)=>v+p.torchOffset[i])));
}
for(const hz of [30,60,120]){
 const s=carried();Object.assign(s,{x:-17,z:14,yaw:Math.PI/2,flashAmount:0});
 const drop=handlingTarget(s,blocks);
 assert.ok(drop?.drop);
 assert.ok(beginHandling(s,drop,blocks));
 for(let i=0;i<hz;i++){
  if(!s.handAction)break;
  const p=pose(s);
  assert.ok(p.flight);
  advanceHandling(s,blocks,1/hz);
 }
 assert.equal(s.carried,-1);
 assert.equal(deliveryCount(s),0);
 assert.deepEqual(parcelPositions(s)[0],drop.pos);
 const target=nextTarget(s);
 assert.deepEqual(target.pos,drop.pos);
 s.pitch=Math.atan2(.24-CONFIG.eye,Math.hypot(s.x-target.pos[0],s.z-target.pos[2]));
 assert.ok(beginHandling(s,target,blocks),'pickup from floor');
 assert.equal(advanceHandling(s,blocks,1),'picked');
 Object.assign(s,{x:DOCK[0],z:DOCK[2]+1.08,yaw:0,pitch:-.65});
 assert.ok(handlingTarget(s,blocks).dock,'dispatch takes precedence');
 assert.ok(beginHandling(s,handlingTarget(s,blocks),blocks));
 assert.equal(advanceHandling(s,blocks,1),'delivered');
}
const blocked=carried();
Object.assign(blocked,{x:-42.35,z:14,yaw:Math.PI/2});
assert.equal(handlingTarget(blocked,blocks),null,'no placement through the exterior wall');

const walk=newShift();
Object.assign(walk,{x:-13,z:14,yaw:Math.PI/2});
for(let i=0;i<200;i++)step(walk,w,blocks,dt);
assert.ok(walk.x<-18,'walk from Sector B through the west opening');
walk.yaw=-Math.PI/2;
for(let i=0;i<220;i++)step(walk,w,blocks,dt);
assert.ok(walk.x>-15,'return from C-01');

function jumpOver(start,isRail,realBlocks){
 const s=Object.assign(newShift(),start);
 step(s,w,realBlocks,dt,true);
 assert.ok(s.vault);
 let prev=s.y;
 for(let i=0;i<120&&s.vault;i++){
  step(s,w,realBlocks,dt);
  assert.ok(s.y>=prev&&s.y-prev<.08,'continuous elevation');
  prev=s.y;
 }
 assert.equal(s.vault,null);
 if(isRail)assert.ok(s.x<10.8,'lands on the far side of the catwalk rail');
 else{
  for(let i=0;i<12;i++)step(s,new Set(),realBlocks,dt);
  assert.ok(s.grounded&&Math.abs(s.y-.72)<.02,'lands on the crate top');
 }
}
jumpOver({x:11.38,y:3.6,z:5.1,yaw:Math.PI/2},true,blocks);
jumpOver({x:-21,y:0,z:10.90,yaw:0},false,blocks);
const under=Object.assign(newShift(),{x:-21,z:10.90,yaw:0});
step(under,w,[...blocks,[-22,9,-20,12,1.92,2.2]],dt,true);
assert.ok(!under.vault,'overhead collision rejects the vault');

const shift=Object.assign(carried(),{x:-20.5,z:14,flashAmount:1});
updateHaunt(shift,blocks,[-1,0,0],dt);
assert.equal(shift.haunt[0].state,'retreat','forward torch repels the flicker');
shift.haunt[0].state='alert';shift.haunt[0].timer=1;
shift.flashAmount=0;
assert.equal(updateHaunt(shift,blocks,[-1,0,0],dt),'녹령');
assert.equal(shift.carried,0,'encounter preserves carried box');
assert.ok(shift.x>-17);
const batches=rigs(worlds),actors=hauntLayers(shift);
assert.ok(actors.length>=18);
for(const layer of actors){
 assert.ok(batches[layer.group]);
 assert.ok(layer.matrix.every(Number.isFinite));
}
console.log('PASS: forward beam, 3 drop/retrieve/delivery rates, blocked placement, two-way annex, rail/crate vaults, overhead rejection, ghost reaction and encounter recovery');
