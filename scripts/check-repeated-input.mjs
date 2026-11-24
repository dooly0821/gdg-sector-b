import assert from 'node:assert/strict';
import {newShift,createScene,handlingTarget} from '../dist/mission.js';
import {choreography,advanceHandling,beginHandling,toggleFlashlight,updateViewmodel} from '../dist/handling.js';
const [{blocks}]=createScene();
for(const hz of [30,60,120,144]){
 const s=Object.assign(newShift(),{x:-18,z:14,yaw:Math.PI/2,pitch:-.9,carried:0});s.states[0]='CARRIED';
 for(let i=0;i<20;i++){
  toggleFlashlight(s);
  for(let n=0;n<Math.ceil(.12*hz);n++)updateViewmodel(s,1/hz);
 }
 for(let n=0;n<hz;n++)updateViewmodel(s,1/hz);
 assert.equal(s.flashAmount,0);
 for(let i=0;i<20;i++){
  const target=handlingTarget(s,blocks),placing=s.carried>=0;
  assert.ok(beginHandling(s,target,blocks));assert.ok(!beginHandling(s,target,blocks));
  let transitions=0;
  while(s.handAction){
   const old=s.carried;
   advanceHandling(s,blocks,1/hz);
   const pose=choreography(s,[s.x,1.58,s.z],true,false,false,i);
   for(const layer of pose.hands)assert.ok(!layer.matrix||layer.matrix.every(Number.isFinite));
   if(s.carried!==old)transitions++;
  }
  assert.equal(transitions,1);
  assert.equal(s.carried,placing?-1:0);
 }
 console.log('PASS',hz,'Hz, 20 Q reversals and 20 E actions with one ownership event each');
}
