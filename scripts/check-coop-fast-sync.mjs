import assert from 'node:assert/strict';
import {createSyncEngine} from '../server/room-sync.js';
import {sampleTiming,pollDelay,recordCoopPrediction,applyCoopSnapshot} from '../dist/multiplayer.js';
let now=1000,stored=JSON.stringify({lastTick:0,shared:{},n:0,ack:{}}),reads=0,writes=0,conflicts=0,locked=false,forceConflict=false;
const error=(m,status)=>Object.assign(new Error(m),{status});
const engine=createSyncEngine({read:async()=>{reads++;return stored},compare:async(_,previous,next)=>{
 writes++;if(locked){locked=false;return [0,stored]}
 if(forceConflict){forceConflict=false;const a=JSON.parse(stored);a.n++;stored=JSON.stringify(a);}
 if(previous!==stored){conflicts++;return [2,stored];}
 stored=next;return [1];
},operate:(r,b,t)=>{if(!r.ack[b.token]||b.seq>r.ack[b.token]){r.n++;r.ack[b.token]=b.seq;}r.lastTick=t;return {n:r.n};},serialize:JSON.stringify,error,clock:()=>now++,sleep:async ms=>{now+=ms},random:()=>.5});
const ctx={};
await engine.sync('r',ctx,{token:'a',seq:1});
await engine.sync('r',ctx,{token:'a',seq:2});assert.equal(reads,1);assert.equal(writes,2);
forceConflict=true;await engine.sync('r',ctx,{token:'b',seq:1});assert.equal(JSON.parse(stored).n,4);assert.equal(conflicts,1);
locked=true;await engine.sync('r',ctx,{token:'b',seq:1});assert.equal(JSON.parse(stored).n,4);
await Promise.all(Array.from({length:4},(_,i)=>engine.sync('r',ctx,{token:'p'+i,seq:1})));assert.equal(JSON.parse(stored).n,8);
assert.equal(Object.keys(JSON.parse(stored).ack).length,6);
assert.equal(sampleTiming({serverReceived:1000,serverTime:1040,serverSent:1080},0,140).sample,70);
assert.equal(sampleTiming({},0,140).sample,70);
assert.ok(pollDelay({rtt:149,players:4,random:0})<=20);
const s={x:0,y:0,z:0,vx:0,vz:0,grounded:true,bodyHeight:1.7,steps:0,carried:-1,elapsed:0};
recordCoopPrediction(s,100);s.y=1;s.grounded=true;recordCoopPrediction(s,300);
applyCoopSnapshot(s,{self:{...s,y:0},players:[{id:'a'}],you:'a',elapsed:.1,netSample:100,netReceived:350,netRtt:250,haunt:[]});
assert.equal(s.y,1,'delayed ground packet must not pull a new rail landing down');
console.log('PASS warm one-RTT sync, CAS conflict replay, lease safety, command idempotency, four serialized inputs and time-aligned prediction');
