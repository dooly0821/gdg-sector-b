import assert from 'node:assert/strict';
import {createScene,newShift,step} from '../dist/mission.js';
import {move} from '../dist/movement.js';
import {ventsFor,panelsFor,powerTarget,toggleZone,zonePower,emitSignal,signalReady,signalForActor} from '../dist/facility-actions.js';
import {indexBlocks,freeAt} from '../dist/haunt-navigation.js';
import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
const w=new Set(['KeyW']),dt=1/60;
for(const hz of [60,120]){const d=1/hz;const s=Object.assign(newShift(),{x:0,z:10,vz:-7,yaw:0});move(s,new Set(['KeyC']),[],d,false,()=>0);assert(!s.slideTime);
 Object.assign(s,{vz:-7,grounded:true,slideRequested:true});const z=s.z;move(s,w,[],d,false,()=>0);assert(s.slideTime>.79&&Math.abs(s.slideCooldown-1.2)<1e-8);assert(Math.abs(s.z-z)<.15);let max=0;for(let i=0;i<hz;i++){move(s,w,[],d,false,()=>0);max=Math.max(max,Math.abs(s.vz));}assert(!s.slideTime&&max<=13.4);s.slideRequested=true;move(s,w,[],d,false,()=>0);assert(!s.slideTime);}
// 0.4 seconds recovery after the uninterrupted 0.8 second slide.
for(const hz of [60,120]){const dt=1/hz,run=new Set(['KeyW','ShiftLeft']),s=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-7,slideRequested:true});move(s,run,[],dt,false,()=>0);for(let i=1;i<Math.round(1.2*hz);i++){s.slideRequested=true;move(s,run,[],dt,false,()=>0);assert(s.slideTime<.8-1e-8,'no early restart');}s.slideRequested=true;move(s,run,[],dt,false,()=>0);if(!s.slideTime){s.slideRequested=true;move(s,run,[],dt,false,()=>0);}assert(s.slideTime>.79,'restart after 0.4s recovery');}
// Check real momentum throughout the slide, not just its timer.
for(const hz of [60,120]){
 const d=1/hz,run=new Set(['KeyW','ShiftLeft']);
 for(const entry of [7,10,13.4]){
  const q=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-entry,slideRequested:true});
  const start=q.z;
  for(let i=0;i<Math.floor(.8*hz);i++){move(q,run,[],d,false,()=>0);assert(Math.abs(Math.hypot(q.vx,q.vz)-entry)<.00001,'forward slide momentum '+entry+' '+hz);}
  assert(Math.abs(start-q.z-entry*.8)<.03,'no forced position');
  const v=Math.hypot(q.vx,q.vz);move(q,run,[],d,false,()=>0);assert(Math.hypot(q.vx,q.vz)>=v*.985,'smooth slide exit');
 }
 const q=Object.assign(newShift(),{x:0,z:1,yaw:0,vz:-13.4,slideRequested:true});
 const wall=[[-2,-.2,2,.2,0,3]];
 for(let i=0;i<Math.floor(.8*hz);i++){move(q,run,wall,d,false,()=>0);assert(q.z>=.454,'slide wall collision');}
 assert(Math.abs(q.vz)<.001,'no restored velocity through wall');
 const j=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-10,slideRequested:true});
 move(j,run,[],d,false,()=>0);move(j,run,[],d,true,()=>0);assert(!j.grounded&&j.slideTime>.75&&Math.hypot(j.vx,j.vz)>=9.99,'slide jump momentum and active state');
}
// Airborne activation, simultaneous input, landing continuity, wall safety and vertical parity.
for(const hz of [60,120]){
 const d=1/hz,run=new Set(['KeyW','ShiftLeft']),flat=()=>0;
 for(const entry of [7,10,13.4]){
  const q=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-entry});
  const control={...q};
  move(q,run,[],d,true,flat);move(control,run,[],d,true,flat);
  for(let i=0;i<Math.round(.2*hz);i++){move(q,run,[],d,false,flat);move(control,run,[],d,false,flat);}
  q.slideRequested=true;move(q,run,[],d,false,flat);move(control,run,[],d,false,flat);
  assert(!q.grounded&&q.slideTime>.79,'activate V in midair');
  let landed=false;
  for(let i=0;i<Math.round(.8*hz)-1;i++){
   assert(Math.abs(q.y-control.y)<1e-8&&Math.abs(q.vy-control.vy)<1e-8,'vertical physics unchanged');
   assert(Math.abs(Math.hypot(q.vx,q.vz)-entry)<1e-7,'air slide preserves momentum');
   q.slideRequested=true;
   move(q,run,[],d,false,flat);move(control,run,[],d,false,flat);
   if(q.grounded&&q.slideTime>0)landed=true;
  }
  assert(landed,'air slide continues on landing');
 }
 const both=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-7,slideRequested:true}),normal=Object.assign(newShift(),{x:0,z:10,yaw:0,vz:-7});
 move(both,run,[],d,true,flat);move(normal,run,[],d,true,flat);
 assert(both.slideTime>.79&&!both.grounded&&both.vy===normal.vy&&both.y===normal.y,'simultaneous jump and V');
 const slow=Object.assign(newShift(),{x:0,z:10,y:1,vy:0,vz:-2,grounded:false,slideRequested:true});
 move(slow,run,[],d,false,flat);assert(!slow.slideTime,'no free acceleration from slow air slide');
 const wall=[[-2,-.2,2,.2,0,3]],hit=Object.assign(newShift(),{x:0,z:1,y:1,vy:0,vz:-10,grounded:false,yaw:0,slideRequested:true});
 for(let i=0;i<Math.round(.4*hz);i++){move(hit,run,wall,d,false,flat);assert(hit.z>=.454,'air slide wall collision');}
}
for(const level of ['normal','hard']){const [world]=createScene(level);for(const v of ventsFor(level)){const s=Object.assign(newShift(undefined,level),{x:-13.8,z:v.z,yaw:Math.PI/2});for(let i=0;i<110;i++)step(s,new Set(['KeyW','KeyC']),world.blocks,dt);assert(s.x<-15.5,'crouch vent '+v.z+' '+s.x);const q=Object.assign(newShift(undefined,level),{x:-13.8,z:v.z,yaw:Math.PI/2});for(let i=0;i<60;i++)step(q,w,world.blocks,dt);assert(q.x>-15,'standing blocked '+v.z);}
 for(const p of panelsFor(level)){const s=Object.assign(newShift(undefined,level),{x:p.x+(p.x>-15?1:-1),z:p.z,yaw:p.x>-15?Math.PI/2:-Math.PI/2,pitch:-.2});assert.equal(powerTarget(s,world.blocks)?.id,p.id,'panel '+p.id);toggleZone(s,p);assert.equal(zonePower(s,s.x,s.z),.16);toggleZone(s,p);assert.equal(zonePower(s,s.x,s.z),1);}}
const s=Object.assign(newShift(),{x:0,z:12,yaw:0,pitch:0,flashlight:true,elapsed:5});const wall=[[-2,5,2,5.2,0,3]];const sig=emitSignal(s,s,wall);assert(sig&&sig.z>5.2);assert.equal(signalReady(s),12);assert.equal(emitSignal(s,s,wall),null);const nav=indexBlocks(wall);for(let kind=0;kind<4;kind++)assert(signalForActor(s,{kind,x:0,z:10},nav,freeAt,{r:.32,y:0,h:1.6}));s.elapsed=7.1;assert(!signalForActor(s,{kind:0,x:0,z:10},nav,freeAt,{r:.32,y:0,h:1.6}));
for(const count of [2,3,4]){let t=100000;const {room,player}=createRoom('SLIDE'+count,t),tokens=[player.token];for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);operateRoom(room,{op:'start',token:tokens[0],level:'hard'},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 for(const p of Object.values(room.players)){p.state.vz=-7;p.state.yaw=0;p.input.yaw=0;p.input.keys=['KeyW'];p.state.slideRequested=true;}t+=100;tickRoom(room,t);assert(Object.values(room.players).every(p=>p.state.slideTime>0));assert(snapshot(room,player).self.slideTime>0);assert(Object.values(room.players).every(p=>Math.hypot(p.state.vx,p.state.vz)>=6.99));}
// Drive actual sequenced server commands (not just direct state mutations).
for(const level of ['easy','normal','hard','hell'])for(const count of [2,3,4]){
 let t=200000;const {room,player}=createRoom('AIRQA'+count,t),tokens=[player.token];
 for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},t).token);
 operateRoom(room,{op:'start',token:tokens[0],level},t);for(const token of tokens)operateRoom(room,{op:'ready',token},t);
 for(const p of Object.values(room.players)){p.state.vz=-7;p.state.yaw=0;}
 const sync=(seq,type)=>{for(const token of tokens)operateRoom(room,{op:'sync',token,inputSeq:seq,input:{keys:['KeyW','ShiftLeft'],yaw:0,pitch:0},commands:[{seq,type}]},t);};
 sync(1,'jump');t+=50;tickRoom(room,t);
 assert(Object.values(room.players).every(p=>!p.state.grounded&&p.state.y>0),'server jump '+level+count);
 sync(2,'slide');t+=50;tickRoom(room,t);
 assert(Object.values(room.players).every(p=>!p.state.grounded&&p.state.slideTime>.7&&p.state.slideCooldown>1.1),'server air slide '+level+count);
 for(const token of tokens){const p=Object.values(room.players).find(p=>p.token===token);assert(snapshot(room,p).self.slideTime>.7);}
}
console.log('PASS V slide, midair and landing momentum at 60/120Hz, all 4 difficulties and 2/3/4-player authoritative input, vents, zone controls and signal');
