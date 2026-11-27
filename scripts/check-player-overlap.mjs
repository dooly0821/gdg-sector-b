import assert from 'node:assert/strict';
import {move,PHYSICS as P,nudgeCoopPosition} from '../dist/movement.js';
import {newShift} from '../dist/mission.js';
import {applyCoopSnapshot,recordCoopPrediction,advanceCoopPrediction} from '../dist/multiplayer.js';
const flat=()=>0,none=new Set(),run=new Set(['KeyW','ShiftLeft']),make=extra=>Object.assign(newShift(),{x:0,y:0,z:10,yaw:0,...extra});
for(const hz of [60,120]){
 const dt=1/hz;
 for(const [name,b,spawn] of [
 ['deep shelf',[-2,8,2,12,0,3],{x:0,z:10}],
 ['shallow corner',[-.5,9,.5,10,0,2],{x:.6,z:10.05}],
 ['moving crate',[-.4,9.6,.4,10.4,0,.8],{x:0,z:10}],
 ['thin wall',[-.08,8,.08,12,0,3],{x:0,z:10}]
 ]){
  const s=make({...spawn,vz:-13.4});let escaped=false;
  for(let i=0;i<hz*2;i++){const old=[s.x,s.y,s.z];move(s,none,[],dt,false,flat,[b]);assert(Math.hypot(s.x-old[0],s.z-old[2])<=3*dt+1e-6,name+' bounded overlap escape');assert.equal(s.y,old[1]);if(!s.collisionRecovery){escaped=true;break;}}
  assert(escaped,name+' local recovery completes');
 }
 const s=make({z:11,vz:-13.4,slideRequested:true});const wall=[-5,9.9,5,10,0,3];
 for(let i=0;i<hz;i++){const old=s.z;move(s,run,[wall],dt,i===0,flat);assert(s.z>=10+P.radius-.003);assert(Math.abs(s.z-old)<=P.bhopCap*dt+.019);}
 console.log('PASS bounded player overlap, shelf/corner/crate/wall, slide jump wall '+hz+'Hz');
}
const wall=[[-.15,7,.15,13,-1,5]],s=make({x:1,z:10,netGrounded:true,netCorrection:[-5,0]});
for(let i=0;i<300;i++)advanceCoopPrediction(s,wall,[],1/60,i*1000/60);
assert(s.x>=.15+P.radius-.001);
for(const floor of [0,3.6]){
 const s=make({x:1,y:floor,z:10,netGrounded:true,netBlockedSince:1000,netDivergenceSince:1000,netFloorSince:1000});
 for(let i=0;i<20;i++){const t=5000+i*200;recordCoopPrediction(s,t);applyCoopSnapshot(s,{self:{...s,x:-5,y:floor?0:3.6},players:[{id:'a'}],you:'a',netSample:t,netReceived:t+80,netRtt:160,simLagMs:0,haunt:[]});const before=s.x;advanceCoopPrediction(s,wall,[],1/60,t+80);assert(s.x>=.15+P.radius-.001&&Math.abs(s.x-before)<=2.8/60+.0001);assert.equal(s.y,floor);assert.equal(s.netHardCorrections??0,0);}
 assert(s.netRecoveryNeeded,'persistent mismatch is reported instead of warp');
}
console.log('PASS no forced position warp across solid wall or between floors');
