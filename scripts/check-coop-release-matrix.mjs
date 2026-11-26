import assert from 'node:assert/strict';
import {createRoom,operateRoom,snapshot,serializeRoom} from '../server/room-core.js';
import {createSyncEngine} from '../server/room-sync.js';
import {applyCoopSnapshot,recordCoopPrediction,advanceCoopPrediction,CoopClient,retryLeave,retryableAction} from '../dist/multiplayer.js';
import {roomConnectionTimeout} from '../dist/public-servers.js';
for(const count of [2,3,4]){
 let now=100000;const {room,player}=createRoom('MAT234',now);const tokens=[player.token];
 for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},now).token);
 operateRoom(room,{op:'start',token:tokens[0]},now);
 for(const token of tokens)operateRoom(room,{op:'ready',token},now);
 room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];
 let stored=serializeRoom(room),conflicts=0;
 const engine=createSyncEngine({read:async()=>stored,compare:async(_,before,next)=>{if(before!==stored){conflicts++;return [2,stored];}stored=next;return [1]},operate:operateRoom,serialize:serializeRoom,error:(m,status)=>Object.assign(new Error(m),{status}),clock:()=>now,sleep:async()=>{},random:()=>.5});
 const input={keys:[],yaw:0,pitch:0};
 for(let i=1;i<=32;i++){now+=[85,135,95,350,120,80,520,140][i%8];const result=await Promise.all(tokens.map(token=>engine.sync('r',{}, {op:'sync',token,input,inputSeq:i,commands:i===1?[{seq:1,type:'torch'}]:[]})));
  assert(result.every(x=>x.snapshot.phase==='playing'&&x.snapshot.players.length===count&&x.snapshot.inputAck===i));
 }
 let state=JSON.parse(stored);assert(Object.values(state.players).every(p=>p.state.flashlight===true));
 // Late input must never overwrite the newest control state.
 now+=25;await engine.sync('r',{}, {op:'sync',token:tokens[0],input:{keys:['KeyW'],yaw:1,pitch:0},inputSeq:31});
 state=JSON.parse(stored);assert.equal(state.players[player.id].lastInputSeq,32);assert.deepEqual(state.players[player.id].input.keys,[]);
 // Keep the absent player reserved while the other workers remain connected.
 for(let i=0;i<80;i++){now+=500;await Promise.all(tokens.slice(1).map((token,j)=>engine.sync('r',{}, {op:'sync',token,input,inputSeq:33+i})));}
 assert.equal(Object.keys(JSON.parse(stored).players).length,count);
 now+=50;const recovered=await engine.sync('r',{}, {op:'sync',token:tokens[0],input,inputSeq:33,commands:[{seq:1,type:'torch'}]});
 assert.equal(recovered.snapshot.phase,'playing');assert.equal(recovered.snapshot.players.length,count);assert.equal(recovered.snapshot.self.flashlight,true);
 // Running player must not hard snap during delayed and mismatched floor packets.
 const s={x:15,y:1,z:0,bodyHeight:1.7,grounded:true,vx:13,vz:0,vy:0,steps:0,elapsed:0};
 for(let i=0;i<6;i++){const t=1000+i*500;recordCoopPrediction(s,t);applyCoopSnapshot(s,{self:{...s,x:0,y:0},players:[{id:'a'}],you:'a',netSample:t,netReceived:t+500,netRtt:900,simLagMs:250,haunt:[]});assert.equal(s.x,15);assert.equal(s.y,1);}
 s.netGrounded=true;s.netCorrection=[-3,0];const x=s.x;advanceCoopPrediction(s,[],[],1/60,5000);assert(x-s.x<=13*.08/60+.00001);
 const c=new CoopClient();c.accept({snapshot:{room:'r',serverTime:10,inputAck:4,players:[],ack:0}});c.accept({snapshot:{room:'r',serverTime:11,inputAck:3,players:[],ack:0}});assert.equal(c.snapshot.inputAck,4);
 console.log('PASS '+count+' players: irregular sync, shared state, stale inputs, 40s reconnect, high-speed rollback guard');
}
assert.equal(roomConnectionTimeout('playing'),90000);

// Live QA reproduced a ghost membership after a simultaneous leave. Also
// never drag the local worker towards a high-latency, stale position sample.
let attempts=0;assert(await retryLeave(async(op,{room,token})=>{assert.equal(room,'GDGS24');assert.equal(token,'qa');if(++attempts<3)throw Object.assign(Error('locked'),{status:423});},'GDGS24','qa',async()=>{}));assert.equal(attempts,3);
assert(await retryLeave(async()=>{throw Object.assign(Error('already left'),{status:401});},'GDGS24','qa',async()=>{}));
assert(!retryableAction({status:409}));assert(retryableAction({status:423}));
const delayed={x:10,y:0,z:0,vx:7,vz:0,grounded:true,bodyHeight:1.7,steps:0,elapsed:0};
recordCoopPrediction(delayed,1000);applyCoopSnapshot(delayed,{self:{...delayed,x:1},players:[{id:'a'}],you:'a',netSample:1000,netReceived:1500,netRtt:900,simLagMs:250,haunt:[]});assert.deepEqual(delayed.netCorrection,[0,0]);
console.log('PASS live recovery: contended leave retries, terminal lifecycle failures, stale soft-correction suppression');

// A long running disagreement must not cause a snap just as a worker stops.
const drift={x:10,y:0,z:0,vx:7,vz:0,grounded:true,bodyHeight:1.7,steps:0,elapsed:0};
const incoming=(t)=>({self:{...drift,x:0,vx:drift.vx},players:[{id:'a'}],you:'a',netSample:t,netReceived:t+90,netRtt:180,simLagMs:12,haunt:[]});
for(let i=0;i<8;i++){recordCoopPrediction(drift,1000+i*300);applyCoopSnapshot(drift,incoming(1000+i*300));}
drift.vx=0;recordCoopPrediction(drift,3500);applyCoopSnapshot(drift,incoming(3500));assert.equal(drift.x,10);assert.equal(drift.netHardCorrections??0,0);
// Clear floor: progressively close the distance, even after the old snap deadline.
for(let i=0;i<360;i++){const t=3600+i*1000/60;if(i%12===0){recordCoopPrediction(drift,t);applyCoopSnapshot(drift,incoming(t));}advanceCoopPrediction(drift,[],[],1/60,t);}
assert(drift.x<.3&&drift.x>=0);assert.equal(drift.netHardCorrections??0,0);
// Preserve authoritative recovery when truly blocked behind incompatible geometry.
const blocked={...drift,x:8,vx:0,netHistory:[],netAppliedX:0,netAppliedZ:0,netDivergenceSince:1000,netBlockedSince:1000};recordCoopPrediction(blocked,4100);applyCoopSnapshot(blocked,{self:{...blocked,x:0},players:[{id:'a'}],you:'a',netSample:4100,netReceived:4200,netRtt:200,simLagMs:8,haunt:[]});assert.equal(blocked.x,0);assert.equal(blocked.netHardCorrections,1);
console.log('PASS stationary recovery: no pre-armed snap, gradual collision-safe convergence, blocked fallback');

const {readFileSync}=await import('node:fs');assert.match(readFileSync(new URL('../dist/style.css',import.meta.url),'utf8'),/#reticle\{[^}]*pointer-events:none/);console.log('PASS reticle does not intercept mouse capture');
