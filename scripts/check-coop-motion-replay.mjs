import assert from 'node:assert/strict';
import {createRoom,operateRoom,snapshot,serializeRoom} from '../server/room-core.js';
import {createScene,step,canUse,pickupTargetByIndex} from '../dist/mission.js';
import {packMotion,MOTION_VERSION} from '../dist/motion-input.js';
import {CoopClient,applyCoopSnapshot,advanceCoopPrediction} from '../dist/multiplayer.js';
const [world]=createScene('normal'),dt=1/60,empty=new Set();
function fixture(count){
 let t=100000;const {room,player}=createRoom('REPLAY',t),tokens=[player.token];
 for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);
 operateRoom(room,{op:'start',token:tokens[0],level:'normal'},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];room.shared.cargo[0]={id:'REPLAY-BOX',area:'test',pos:[3,0,17]};room.shared.states.fill('CARRIED');room.shared.states[0]='AVAILABLE';
 const players=Object.values(room.players),locals=[],clients=[];
 for(let i=0;i<count;i++){
  const p=players[i];Object.assign(p.state,{x:3+i*2,y:0,z:20,yaw:0,pitch:-.75,bodyHeight:1.7,grounded:true,vx:0,vy:0,vz:0,carried:-1});
  const c=new CoopClient();c.enableMotion=true;const snap=snapshot(room,p);snap.netReceived=t;snap.netSample=t;snap.netRtt=120;c.accept({snapshot:snap});const local={...p.state};applyCoopSnapshot(local,snap,true);locals.push(local);clients.push(c);
 }
 return {room,players,tokens,locals,clients,t};
}
for(const count of [2,3,4]){
 const {room,players,tokens,locals,clients}=fixture(count);let now=100000,seq=0,useSent=false;
 // 200–350ms batched input arrives after the local worker has walked to the box.
 // Server replays precisely those input ticks, not the previous packet's keys.
 for(let frame=1;frame<=120;frame++){
  for(let i=0;i<count;i++){
   const s=locals[i],c=clients[i],keys=i===0&&frame<=35?new Set(['KeyW']):i>0&&frame<=25?new Set(['KeyA']):empty;
   s.yaw=0;s.pitch=-.75;step(s,keys,world.blocks,dt);c.recordMotion(s,keys,false,false,now+frame*dt*1000);
   if(i===0&&!useSent&&canUse(s,pickupTargetByIndex(s,0),world.blocks)){
    c.queue.push({seq:++c.seq,type:'use',cargoIndex:0,motionTick:c.motionSeq,yaw:s.yaw,pitch:s.pitch});useSent=true;
   }
  }
  if(frame%15!==0)continue;
  now+=250;
  for(let i=0;i<count;i++){
   const c=clients[i],s=locals[i];const body={op:'sync',token:tokens[i],inputSeq:++seq,input:{keys:[],yaw:s.yaw,pitch:s.pitch},motion:{version:MOTION_VERSION,epoch:c.motionEpoch,frames:c.motionFrames.map(a=>a.frame)},commands:c.queue};
   const r=operateRoom(room,body,now);r.snapshot.netReceived=now+125;r.snapshot.netSample=now;r.snapshot.netRtt=250;c.accept(r);
   assert.equal(r.snapshot.motionAck,frame);assert(Math.hypot(r.snapshot.self.x-s.x,r.snapshot.self.z-s.z)<.001,'position agreement '+count+'/'+frame+'/'+i+' '+JSON.stringify([r.snapshot.self.x,r.snapshot.self.z,s.x,s.z]));
   applyCoopSnapshot(s,r.snapshot);assert(Math.hypot(...s.netCorrection)<.001,'no artificial drag');
   const dup=operateRoom(room,body,now);assert.equal(dup.snapshot.motionAck,frame);
  }
 }
 assert(useSent&&room.shared.states[0]==='CARRIED'&&players[0].state.carried===0,'E command at recorded motion tick picks exact cargo');
 assert.equal(players.filter(p=>p.state.carried===0).length,1);
 assert(!serializeRoom(room).includes('placementWorkers'));
 console.log('PASS '+count+' players: 250ms input batching, exact movement agreement, E pickup, no artificial correction, duplicate packet idempotence');
}
const {room,players,tokens}=fixture(2);const p=players[0],base=p.state.z;
const frames=Array.from({length:48},(_,i)=>packMotion(i+1,new Set(['KeyW']),0,0,false,false));
const r=operateRoom(room,{op:'sync',token:tokens[0],inputSeq:1,input:{keys:['KeyW'],yaw:0,pitch:0},motion:{version:1,epoch:1,frames}},100000);
assert.equal(r.snapshot.motionAck,24,'initial credit bounds catch-up');
assert(base-p.state.z<2,'cannot claim arbitrary position or unlimited ticks');
const before=p.state.z;
const bad=operateRoom(room,{op:'sync',token:tokens[0],inputSeq:2,input:{keys:[],yaw:0,pitch:0},motion:{version:1,epoch:1,frames:[[999,1,0,0,0]]}},100250);
assert.equal(bad.snapshot.motionAck,24);assert.equal(p.state.z,before);
console.log('PASS motion stream credit, gaps and position authority');
