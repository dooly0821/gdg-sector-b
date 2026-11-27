import assert from 'node:assert/strict';
import {createRoom,operateRoom,tickRoom,REVIVE_SECONDS} from '../server/room-core.js';
import {DOCKS,nextTarget,createScene,randomCargo,canUse} from '../dist/mission.js';
const start=100000;const {room,player:a}=createRoom('REVIVE',start,'WorkerA');
const joined=operateRoom(room,{op:'join',nickname:'WorkerB'},start);const b=Object.values(room.players).find(p=>p.token===joined.token);
operateRoom(room,{op:'start',token:a.token},start);for(const p of [a,b])operateRoom(room,{op:'ready',token:p.token},start);
room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];
Object.assign(a.state,{x:1.7,z:15,y:0});Object.assign(b.state,{x:.7,z:15,y:0,failed:true});
let now=start;function advance(n,held){a.input.keys=held?['KeyE']:[];for(let i=0;i<n;i++){now+=34;a.lastSeen=b.lastSeen=a.lastInputAt=now;tickRoom(room,now);}}
advance(45,true);assert.equal(b.state.failed,true);advance(1,false);assert.equal(a.reviveProgress,0);advance(70,true);assert.equal(b.state.failed,true);advance(6,true);
assert.equal(b.state.failed,false);assert(room.events.some(e=>e.type==='revive'));assert.equal(REVIVE_SECONDS,1.7);
assert.equal(DOCKS.length,3);for(const [i,[x,y,z]] of DOCKS.entries()){assert.equal(nextTarget({x,y,z,carried:0}).bay,i);}
const blocks=createScene()[0].blocks;
for(const [i,[x,y,z]] of DOCKS.entries()){
 const t=nextTarget({x,y,z,carried:0}); 
 const approaches=[[x,z+1.65,0],[x,z-1.65,Math.PI],[x+1.9,z,Math.PI/2],[x-1.9,z,-Math.PI/2]];
 assert(approaches.some(([px,pz,yaw])=>!blocks.some(b=>b[0]<px+.27&&b[2]>px-.27&&b[1]<pz+.27&&b[3]>pz-.27&&b[4]<1.7&&b[5]>.04)&&canUse({x:px,y:0,z:pz,yaw,pitch:-.45,bodyHeight:1.7,grounded:true,carried:0},t,blocks)), 'dispatch bay '+i+' reachable');
}
for(const n of [30,40,50,70])for(let j=0;j<4;j++){const cargo=randomCargo(Math.random,n);assert.equal(cargo.length,n);for(const {pos:[x,y,z]} of cargo)for(const [dx,dy,dz] of DOCKS.slice(1))assert(Math.abs(x-dx)>=2.06||Math.abs(z-dz)>=1.59||y>=2,'cargo overlap');}console.log('revive and dispatch smoke checks passed');
