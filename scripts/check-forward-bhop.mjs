import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {newShift} from '../dist/mission.js';
import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
const flat=()=>0,make=extra=>Object.assign(newShift(),{x:0,y:0,z:10,yaw:0,vx:0,vz:-7,...extra}),speed=s=>Math.hypot(s.vx,s.vz);
for(const hz of [60,120]){
 const dt=1/hz;
 const cases=[
  [['KeyW','KeyC','Space','ShiftLeft'],7.88],
  [['KeyW','KeyC','Space'],7.88],
  [['KeyA','KeyC','Space'],7],
  [['KeyD','KeyC','Space'],7],
  [['KeyA','KeyD','KeyC','Space'],7],
  [['KeyW','KeyA','KeyD','KeyC','Space'],7],
  [['KeyW','KeyD','KeyC','Space'],7],
  [['KeyW','KeyA','KeyC','Space'],7],
  [['KeyS','KeyC','Space'],null],
  [['KeyW','KeyS','KeyC','Space'],7]
 ];
 for(const [keys,expected] of cases){
  const s=make();move(s,new Set(keys),[],dt,true,flat);
  if(expected===null){assert(speed(s)<7&&speed(s)>0,'opposite direction brakes without a boost');}else assert(Math.abs(speed(s)-expected)<1e-7,keys+' '+hz+' '+speed(s));
 }
 const wrong=make({vx:7,vz:0});move(wrong,new Set(['KeyW','KeyC','Space']),[],dt,true,flat);assert(Math.abs(speed(wrong)-7)<1e-7,'sideways entry cannot boost');
 const s=make();move(s,new Set(['KeyW']),[],dt,true,flat);
 for(let i=0;i<Math.floor(hz*.5);i++){
  const keys=i%4===0?['KeyA','KeyC','Space']:i%4===1?['KeyD','KeyC','Space']:i%4===2?['KeyW','KeyA','KeyD','Space']:['KeyW','KeyC','Space'];
  move(s,new Set(keys),[],dt,false,flat);assert(!s.grounded);assert(speed(s)<=7+1e-7,'no late midair boost');
 }
 const neutral=make({y:1,grounded:false,vy:1});
 for(let i=0;i<Math.floor(hz*.2);i++)move(neutral,new Set(['KeyA','KeyD','KeyC','Space']),[],dt,false,flat);
 assert.equal(neutral.vx,0);assert.equal(neutral.vz,-7);
 const steer=make({y:1,grounded:false,vy:1});for(let i=0;i<Math.floor(hz*.2);i++)move(steer,new Set(['KeyD','KeyC']),[],dt,false,flat);
 assert(steer.vx>2&&Math.abs(speed(steer)-7)<1e-7,'steering remains responsive');
 const chain=make({z:18});let peak=0;
 for(let i=0;i<4*hz;i++){move(chain,new Set(['KeyW','KeyC','Space','ShiftLeft']),[],dt,i===0,flat);peak=Math.max(peak,speed(chain));}
 assert(peak>10&&peak<=P.bhopCap+1e-7,'forward chain retains acceleration');
 console.log('PASS forward-only bhop, opposing-key neutrality, air steering and no midair boost '+hz+' Hz');
}
for(const count of [2,3,4]){
 let t=100000;const {room,player}=createRoom('BHOP'+count,t),tokens=[player.token];
 for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);
 operateRoom(room,{op:'start',token:tokens[0],level:'normal'},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 const players=Object.values(room.players);
 for(const p of players){Object.assign(p.state,{yaw:0,vx:0,vz:-7});}
 for(const [i,token] of tokens.entries())operateRoom(room,{op:'sync',token,inputSeq:1,input:{keys:i===0?['KeyW','KeyC','Space']:i===1?['KeyA','KeyD','KeyC','Space']:i===2?['KeyW','KeyA','KeyD','KeyC','Space']:['KeyD','KeyC','Space'],yaw:0,pitch:0},commands:[{seq:1,type:'jump'}]},t);
 t+=50;tickRoom(room,t);
 for(const [i,p] of players.entries()){const s=snapshot(room,p).self;assert(!s.grounded);assert(Math.abs(speed(s)-(i===0?7.88:7))<1e-6,'server speed '+count+'/'+i);}
 console.log('PASS authoritative forward bhop '+count+' players');
}
