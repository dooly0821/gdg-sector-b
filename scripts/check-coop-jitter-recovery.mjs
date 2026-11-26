import assert from 'node:assert/strict';
import {createSyncEngine} from '../server/room-sync.js';
import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
import {applyCoopSnapshot,recordCoopPrediction,advanceCoopPrediction,sampleTiming} from '../dist/multiplayer.js';
import {appendRemote,remoteAt} from '../dist/net-smoothing.js';
// Exact-state CAS owns the simulation cache. A conflicting attempt must never leak mutations.
let now=1000,stored=JSON.stringify({shared:{},lastTick:0,n:0}),conflict=false,observations=[];
const err=(m,status)=>Object.assign(new Error(m),{status});
const engine=createSyncEngine({read:async()=>stored,compare:async(_,before,next)=>{
 if(conflict){conflict=false;const fresh=JSON.parse(stored);fresh.n+=10;stored=JSON.stringify(fresh);return [2,stored];}
 if(before!==stored)return [2,stored];stored=next;return [1];
},operate:(r,b,t)=>{observations.push([r.shared.stateless,!!r.shared.navIndex]);r.shared.navIndex??=new Map();r.n++;r.lastTick=t;return {n:r.n}},serialize:r=>JSON.stringify(r,(k,v)=>k==='navIndex'?undefined:v),error:err,clock:()=>now++,sleep:async()=>{}});
await engine.sync('r',{},{});await engine.sync('r',{},{});assert.deepEqual(observations.slice(0,2),[[true,false],[false,true]]);
conflict=true;const recovered=await engine.sync('r',{},{});assert.equal(recovered.n,13);assert.deepEqual(observations.at(-1),[true,false]);assert.equal(JSON.parse(stored).n,13);
const {room,player}=createRoom('JIT234',1000);
const players=[player];for(let i=1;i<4;i++){const a=operateRoom(room,{op:'join'},1000+i);players.push(Object.values(room.players).find(p=>p.token===a.token));}
operateRoom(room,{op:'start',token:player.token,level:'normal'},1010);for(const p of players)operateRoom(room,{op:'ready',token:p.token},1020);
room.shared.hauntDirector.delay=1e6;
tickRoom(room,1620);assert.ok(room.shared.elapsed>.38&&room.shared.elapsed<.41);assert.ok(snapshot(room,player).simLagMs>=190);
tickRoom(room,1720);assert.ok(room.shared.elapsed>.68&&room.shared.elapsed<.71);assert.ok(snapshot(room,player).simLagMs<18);
assert.equal(sampleTiming({serverReceived:1000,serverSent:1080,serverTime:1040,simLagMs:100},0,140).sample,-30);
// 5m transient disagreement during a running frame: no immediate snap; collision-safe correction remains bounded.
const s={x:5,y:0,z:0,vx:7,vz:0,vy:0,grounded:true,bodyHeight:1.7,steps:0,carried:-1,elapsed:0};
recordCoopPrediction(s,1000);applyCoopSnapshot(s,{self:{...s,x:0},players:[{id:'a'}],you:'a',elapsed:0,netSample:1000,netReceived:1200,netRtt:400,haunt:[]});
assert.equal(s.x,5);assert.ok(s.netCorrection[0]<0);
const x=s.x;advanceCoopPrediction(s,[],[],1/60,1217);assert.ok(x-s.x<=7*.18/60+.00001);
let track=null;for(const [t,arrival] of [[0,80],[150,240],[300,390],[450,800],[600,860]])track=appendRemote(track,{x:t*.007,z:0,y:0,vx:7,vz:0,grounded:true,steps:0},t,arrival,10000+t);
assert.ok(track.delay>170);const last=track.samples.at(-1).pose;assert.ok(remoteAt(track,9000,true).x<=last.x+1.961);
console.log('PASS: warm simulation reuse, CAS conflict isolation, 4-player bounded time debt, delayed position correction, jitter buffer');
