import assert from 'node:assert/strict';
import {createRoom,operateRoom,tickRoom,REVIVE_SECONDS} from '../server/room-core.js';
import {DOCKS,nextTarget,createScene} from '../dist/mission.js';
const start=100000;const {room,player:a}=createRoom('REVIVE',start,'WorkerA');
const joined=operateRoom(room,{op:'join',nickname:'WorkerB'},start);const b=Object.values(room.players).find(p=>p.token===joined.token);
operateRoom(room,{op:'start',token:a.token},start);for(const p of [a,b])operateRoom(room,{op:'ready',token:p.token},start);
room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];
Object.assign(a.state,{x:1.7,z:15,y:0});Object.assign(b.state,{x:.7,z:15,y:0,failed:true});
a.input.keys=['KeyE'];for(let i=1;i<=90;i++){a.lastSeen=b.lastSeen=a.lastInputAt=start+i*34;tickRoom(room,start+i*34);}
assert.equal(b.state.failed,false);assert(room.events.some(e=>e.type==='revive'));assert.equal(REVIVE_SECONDS,3);
assert.equal(DOCKS.length,3);for(const [i,[x,y,z]] of DOCKS.entries()){assert.equal(nextTarget({x,y,z,carried:0}).bay,i);}
assert(createScene()[0].blocks.length>0);console.log('revive and dispatch smoke checks passed');
