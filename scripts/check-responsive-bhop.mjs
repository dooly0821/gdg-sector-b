import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {newShift} from '../dist/mission.js';
import {advanceCoopPrediction} from '../dist/multiplayer.js';
import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
const flat=()=>0,make=extra=>Object.assign(newShift(),{x:0,y:1,z:10,yaw:0,vx:0,vz:-10,vy:0,grounded:false,...extra}),speed=s=>Math.hypot(s.vx,s.vz),angle=(s,x,z)=>Math.acos(Math.max(-1,Math.min(1,(s.vx*x+s.vz*z)/speed(s))));
for(const hz of [60,120]){
 const dt=1/hz,hold=new Set(['KeyW','KeyC','Space']);
 for(const entry of [7,10,13.4])for(const turn of [Math.PI/2,-Math.PI/2,Math.PI]){
  const s=make({vz:-entry,yaw:turn});const target=[-Math.sin(turn),-Math.cos(turn)];
  move(s,hold,[],dt,false,flat);assert(angle(s,...target)<Math.abs(turn)-.05,'first tick turns');
  for(let i=1;i<Math.ceil((Math.abs(turn)/P.hopTurn+.02)*hz);i++)move(s,hold,[],dt,false,flat);
  assert(angle(s,...target)<.015,'fast aligned turn '+turn+' '+hz);
  assert(Math.abs(speed(s)-entry)<1e-7,'turn keeps speed without boosting');
 }
 const side=make();for(let i=0;i<Math.ceil(.1*hz);i++)move(side,new Set(['KeyD','KeyC']),[],dt,false,flat);
 assert(angle(side,1,0)<.015&&Math.abs(speed(side)-10)<1e-7);
 const released=make({hopBoosted:true,yaw:Math.PI/2});for(let i=0;i<Math.ceil(.1*hz);i++)move(released,new Set(['KeyW']),[],dt,false,flat);assert(angle(released,-1,0)<.015&&Math.abs(speed(released)-10)<1e-7);
 const s=make({netGrounded:false,netCorrection:[0,2],hopTurnGrace:.2});const z=s.z;advanceCoopPrediction(s,[],[],dt,1000);assert(s.z-z<=.3*dt+1e-7,'turn correction capped');
 console.log('PASS 90/180-degree bhop turn, air steering, retained momentum and reduced turn correction '+hz+'Hz');
}
for(const count of [2,3,4]){
 let t=100000;const {room,player}=createRoom('TURN'+count,t),tokens=[player.token];for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);
 operateRoom(room,{op:'start',token:tokens[0],level:'normal'},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 for(const p of Object.values(room.players)){Object.assign(p.state,{x:0,z:10,y:1,grounded:false,vx:0,vz:-10,vy:0});}
 for(const token of tokens)operateRoom(room,{op:'sync',token,inputSeq:1,input:{keys:['KeyW','KeyC'],yaw:Math.PI/2,pitch:0}},t);
 t+=100;tickRoom(room,t);
 for(const p of Object.values(room.players)){const s=snapshot(room,p).self;assert(angle(s,-1,0)<.02&&Math.abs(speed(s)-10)<1e-6,'server turn '+count);}
 console.log('PASS authoritative bhop direction change '+count+' players');
}
