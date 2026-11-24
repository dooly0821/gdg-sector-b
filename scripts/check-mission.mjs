import assert from 'node:assert/strict';
import {createScene,newShift,PARCELS,DOCK,CONFIG,canUse,deliveryCount,parcelPositions,baySlot} from '../dist/mission.js';
import {beginHandling,advanceHandling,toggleFlashlight,updateViewmodel} from '../dist/handling.js';
const [world]=createScene();
function approach(s,target,height){
 const radius=target.dock?1.08:1.02;
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/24){
  s.x=target.pos[0]+Math.sin(angle)*radius;s.z=target.pos[2]+Math.cos(angle)*radius;s.y=height;
  if(world.blocks.some(([x1,z1,x2,z2,y1,y2])=>height<y2-.01&&height+CONFIG.height>y1+.01&&s.x>x1-.26&&s.x<x2+.26&&s.z>z1-.26&&s.z<z2+.26))continue;
  s.yaw=Math.atan2(s.x-target.pos[0],s.z-target.pos[2]);s.pitch=Math.atan2(target.pos[1]+(target.dock?.55:.24)-height-CONFIG.eye,radius);
  if(canUse(s,target,world.blocks))return;
 }
 assert.fail(`no reachable approach: ${target.id}`);
}
for(const hz of [30,60,120]){
 const s=newShift();
 for(let i=0;i<PARCELS.length;i++){
  const target={...PARCELS[i],index:i};approach(s,target,i===3?3.6:0);
  assert.ok(beginHandling(s,target,world.blocks));assert.equal(beginHandling(s,target,world.blocks),false);
  let result;for(let t=0;t<hz&&!result;t++)result=advanceHandling(s,world.blocks,1/hz);
  assert.equal(result,'picked');assert.equal(s.carried,i);
  assert.ok(toggleFlashlight(s));for(let t=0;t<hz;t++)updateViewmodel(s,1/hz);assert.equal(s.flashAmount,1);
  const dock={id:'BAY 02',pos:DOCK,dock:true};approach(s,dock,0);assert.ok(beginHandling(s,dock,world.blocks));
  result=null;for(let t=0;t<hz&&!result;t++)result=advanceHandling(s,world.blocks,1/hz);
  assert.equal(result,'delivered');assert.equal(s.carried,-1);assert.equal(deliveryCount(s),i+1);
 }
 assert.deepEqual(parcelPositions(s),PARCELS.map((_,i)=>baySlot(i)));
 assert.equal(beginHandling(s,{...PARCELS[0],index:0},world.blocks),false);
 const c=newShift(),target={...PARCELS[0],index:0};approach(c,target,0);assert.ok(beginHandling(c,target,world.blocks));c.x=10;assert.equal(advanceHandling(c,world.blocks,1),'cancelled');assert.equal(c.states[0],'AVAILABLE');
 console.log(`PASS ${hz} Hz: all five pickup/delivery missions, collision-free approach, simultaneous light, slots, duplicate and cancellation guards`);
}
