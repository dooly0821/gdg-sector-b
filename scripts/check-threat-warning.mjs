import assert from 'node:assert/strict';
import {newShift} from '../dist/mission.js';
import {updateHaunt} from '../dist/haunt.js';
import {updateThreatWarnings,warningList,warningLabel,acknowledgeWarnings,warnedForCapture,REACTION_SECONDS} from '../dist/threat-warning.js';
import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
const actor=(kind,x=0,z=0)=>({kind,x,z,yaw:0,phase:0,age:2,life:100,speed:0,timer:.5,state:'alert',pursuit:true,chargeTarget:[0,1.5],path:[[0,0]],pathIndex:0,direction:1,aggression:1});
const dt=1/60,empty=[],forward=[0,0,-1];
for(const level of ['easy','normal','hard','hell'])for(let kind=0;kind<4;kind++){
 const s=Object.assign(newShift(undefined,level),{x:0,z:1.5,yaw:Math.PI,bodyHeight:1.7,hauntDirector:{delay:1e6,bag:[]},haunt:[actor(kind)]});
 for(let i=0;i<100;i++){s.elapsed+=dt;assert(!updateHaunt(s,empty,forward,dt,()=>.42));assert(!s.failed);}
 const warnings=warningList(s);assert(warnings.length===1);assert(!warnedForCapture(s,s.haunt[0],s.elapsed));
 acknowledgeWarnings(s,['bogus'],s.elapsed);assert(!warnedForCapture(s,s.haunt[0],s.elapsed));
 const received=s.elapsed;acknowledgeWarnings(s,warnings.map(w=>w.id),received);
 let hit=null;for(let i=0;i<600&&!hit;i++){s.elapsed+=dt;hit=updateHaunt(s,empty,forward,dt,()=>.42);if(s.elapsed-received<REACTION_SECONDS)assert(!hit&&!s.failed,'no surprise capture');}
 assert(hit&&s.failed,'ordinary capture still possible '+level+' '+kind);
}
const p={x:0,y:0,z:0,yaw:0},q={x:0,y:0,z:25,yaw:0},root={elapsed:0},a=actor(1,0,5);
updateThreatWarnings(root,[p,q],[a]);assert.equal(warningList(p).length,1);assert.equal(warningList(q).length,0);
assert.equal(warningLabel(p,warningList(p)[0]).arrow,'↓');p.yaw=Math.PI;assert.equal(warningLabel(p,warningList(p)[0]).arrow,'↑');
const old=warningList(p)[0].id;acknowledgeWarnings(p,[old],0);root.elapsed=2;assert(warnedForCapture(p,a,2));
a.z=20;updateThreatWarnings(root,[p,q],[a]);assert(!warningList(p).length);a.z=5;updateThreatWarnings(root,[p,q],[a]);assert.notEqual(warningList(p)[0].id,old);acknowledgeWarnings(p,[old],2);assert(!warnedForCapture(p,a,4));
for(const count of [2,3,4]){
 let t=100000;const {room,player}=createRoom('WARN'+count,t),tokens=[player.token];for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);
 operateRoom(room,{op:'start',token:tokens[0],level:'hard'},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 const ps=Object.values(room.players);for(const [i,b] of ps.entries())Object.assign(b.state,{x:i? -30:0,z:i?40:34,y:0,bodyHeight:1.7});
 room.shared.hauntDirector.delay=1e6;room.shared.haunt=[actor(1,0,35.5)];t+=50;tickRoom(room,t);
 const w=warningList(ps[0].state)[0];assert(w);assert(ps.slice(1).every(b=>!warningList(b.state).length));
 assert.equal(Object.values(snapshot(room,ps[0]).self.threatWarnings)[0].id,w.id);
 operateRoom(room,{op:'sync',token:tokens[1],inputSeq:1,input:{keys:[],warningAck:[w.id]}},t);assert.equal(w.ackAt,null);
 operateRoom(room,{op:'sync',token:tokens[0],inputSeq:1,input:{keys:[],warningAck:[w.id]}},t);assert(Number.isFinite(ps[0].state.threatWarnings[room.shared.haunt[0].warningId].ackAt));assert(!warnedForCapture(ps[0].state,room.shared.haunt[0],room.shared.elapsed));
}
console.log('PASS directional warnings, all four ghosts/difficulties, rendered-ack reaction window, re-entry, per-player 2/3/4 server acknowledgment');
