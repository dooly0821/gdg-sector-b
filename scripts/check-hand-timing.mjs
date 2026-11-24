import assert from 'node:assert/strict';
import {newShift,createScene,nextTarget,CONFIG,DOCK} from '../dist/mission.js';
import {HAND_TIMING,beginHandling,advanceHandling,toggleFlashlight,updateViewmodel,choreography} from '../dist/handling.js';
const [world]=createScene();
for (const hz of [30,60,120,144]) {
 const dt=1/hz,s=newShift();
 for (const [goal,limit] of [[1,HAND_TIMING.equip],[0,HAND_TIMING.stow]]) {
  assert.ok(toggleFlashlight(s));let t=0;while(s.flashAmount!==goal&&t<1){updateViewmodel(s,dt);t+=dt;}
  assert.equal(s.flashAmount,goal);assert.ok(t>=limit-1e-8&&t<=limit+dt+1e-8);
 }
 s.x=1.12;s.z=13.72;s.yaw=Math.atan2(s.x-.8,s.z-12.75);s.pitch=-.48;
 for(const [expected,limit] of [['picked',HAND_TIMING.pickup],['delivered',HAND_TIMING.place]]){
  if(expected==='delivered'){s.x=DOCK[0];s.z=DOCK[2]+1.08;s.pitch=-.65;s.yaw=0;}
  assert.ok(beginHandling(s,nextTarget(s),world.blocks));let t=0,result=null;
  while(!result&&t<2){const p=choreography(s,[s.x,s.y+CONFIG.eye,s.z],true,false,false,t);assert.ok(p.hands.every(a=>a.offset.every(Number.isFinite)));result=advanceHandling(s,world.blocks,dt);t+=dt;}
  assert.equal(result,expected);assert.ok(t>=limit-1e-8&&t<=limit+dt+1e-8);
 }
 console.log(`PASS: ${hz} Hz equip/stow/pickup/place timing`);
}

// The same camera input curve must produce the same lag at all refresh rates.
const stops=[];
for(const hz of [30,60,120,144]){
 const s=newShift();updateViewmodel(s,0);
 for(let n=0;n<hz;n++){s.yaw+=Math.PI/hz;updateViewmodel(s,1/hz);}
 stops.push(s.handYawLag);
 assert.ok(s.handYawLag<-.02&&s.handYawLag>=-.028);
 for(let n=0;n<hz;n++)updateViewmodel(s,1/hz);
 assert.ok(Math.abs(s.handYawLag)<1e-7);
}
assert.ok(Math.max(...stops)-Math.min(...stops)<1e-6);
