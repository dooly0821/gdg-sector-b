import assert from 'node:assert/strict';
import {randomCargo,createScene,newShift,parcelPositions} from '../dist/mission.js';
import {cargoQuota,missionTotal,effectiveDifficulty} from '../dist/difficulty.js';
import {teamDifficulty} from '../dist/haunt.js';
import {createRoom,operateRoom,snapshot,tickRoom,serializeRoom} from '../server/room-core.js';
import {COOP_POOLS} from '../dist/coop-cargo.js';
import {RUN_LANES} from '../dist/layout.js';
import {LOCKERS} from '../dist/lockers.js';
const [w]=createScene(),blocks=w.blocks;
for(const pool of COOP_POOLS)for(const {pos:[x,y,z]} of pool){
 assert.ok(!blocks.some(b=>b[0]<x+.79&&b[2]>x-.79&&b[1]<z+.79&&b[3]>z-.79&&b[4]<1.85&&b[5]>.035),'floor clearance '+x+','+z);
 assert.ok(!LOCKERS.some(l=>Math.abs(l.x-x)<1.65&&z>l.z-3&&z<l.z+1.25),'locker approach');
 assert.ok(!RUN_LANES.some(({a,b,width})=>x>Math.min(a[0],b[0])-width/2-.5&&x<Math.max(a[0],b[0])+width/2+.5&&z>Math.min(a[1],b[1])-width/2-.5&&z<Math.max(a[1],b[1])+width/2+.5),'run lane');
}
for(const n of [2,3,4]){
 const t=100000,{room,player}=createRoom('TEST'+n,t),players=[player];
 for(let i=1;i<n;i++){const r=operateRoom(room,{op:'join'},t+i);players.push(Object.values(room.players).find(p=>p.token===r.token));}
 assert.throws(()=>operateRoom(room,{op:'difficulty',token:players[1].token,level:'hard'},t+5),e=>e.status===403);
 operateRoom(room,{op:'difficulty',token:player.token,level:'hard'},t+6);
 assert.equal(snapshot(room,player).quota,cargoQuota(n));
 assert.equal(snapshot(room,player).difficulty.level,n===4?'hell':'hard');
 operateRoom(room,{op:'start',token:player.token},t+10);
 const q=room.shared;assert.equal(q.states.length,cargoQuota(n));assert.equal(q.cargo.length,q.states.length);assert.equal(new Set(q.cargo.map(p=>p.pos.join(','))).size,q.cargo.length);
 assert.equal(new Set(q.cargo.map(p=>p.id)).size,q.cargo.length);
 for(let i=0;i<n;i++)operateRoom(room,{op:'ready',token:players[i].token},t+11+i);
 assert.equal(room.phase,'playing');
 assert.throws(()=>operateRoom(room,{op:'difficulty',token:player.token,level:'easy'},t+20),e=>e.status===409);
 q.hauntDirector.delay=1e6;q.states.fill('DELIVERED');q.states[q.states.length-1]='AVAILABLE';q.deliveryOrder=Array.from({length:q.states.length-1},(_,i)=>i);
 assert.ok(parcelPositions(q).length<=25);
 players[1].state.failed=true;tickRoom(room,t+60);assert.equal(room.phase,'playing');assert.equal(snapshot(room,player).quota,cargoQuota(n));assert.equal(snapshot(room,player).difficulty.level,n===4?'hell':'hard');
 q.states.fill('DELIVERED');tickRoom(room,t+90);assert.equal(room.phase,'complete');assert.equal(JSON.parse(serializeRoom(room)).shared.states.length,cargoQuota(n));
}
for(const l of ['easy','normal','hard','hell']){const s=newShift(()=>.42,l);assert.equal(s.difficultyLevel,l);assert.equal(missionTotal(s),30);}
assert.ok(teamDifficulty(1,'easy').speed<teamDifficulty(1,'normal').speed);assert.ok(teamDifficulty(1,'hard').speed<teamDifficulty(1,'hell').speed);
assert.equal(teamDifficulty(4,'easy').level,'hell');assert.equal(teamDifficulty(1,'hell',4).level,'hell');
for(const total of [40,50,70])for(let i=0;i<12;i++){const c=randomCargo(Math.random,total,'hell');assert.equal(c.length,total);assert.equal(new Set(c.map(p=>p.pos.join(','))).size,total);}
console.log('PASS: 30/40/50/70 cargo, floor positions, authority, fixed quota, difficulty locks, dispatch capacity, completion');
