import assert from 'node:assert/strict';
import {createScene,newShift,step,surface} from '../dist/mission.js';
import {PHYSICS as P,jumpHeightFor} from '../dist/movement.js';
const dt=1/P.hz,none=new Set(),w=new Set(['KeyW']);
let s=newShift();s.yaw=0;for(let i=0;i<120;i++)step(s,w,[],dt);assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-P.walk)<.01);
const speed=Math.hypot(s.vx,s.vz);step(s,none,[],dt,true);assert.ok(!s.grounded);assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-speed)<1e-6);
let apex=s.y,buffered=false,hopped=false;for(let i=0;i<240;i++){const request=!buffered&&s.vy<0&&s.y<.15;if(request)buffered=true;const was=s.grounded;step(s,none,[],dt,request);apex=Math.max(apex,s.y);if(buffered&&was&&!s.grounded){hopped=true;break;}}assert.ok(apex>1.18&&apex<1.22);assert.ok(hopped,'buffered bunny hop');
s=newShift();s.x=12.5;s.z=15.1;s.yaw=0;for(let i=0;i<300;i++)step(s,w,[],dt);assert.ok(s.y>3.59,'ramp to upper deck');s.yaw=Math.PI;for(let i=0;i<400;i++)step(s,w,[],dt);assert.ok(s.y<.01,'ramp descent');
s=newShift();s.x=0;s.z=2;s.yaw=0;for(let i=0;i<180;i++)step(s,w,[[-2,-.5,2,.5,0,2]],dt);assert.ok(s.z>=.5+P.radius-.002,'wall collision');
const strafe=Object.assign(newShift(),{yaw:0,grounded:false,y:1,vz:-P.walk});
step(strafe,new Set(['KeyD']),[],dt);
assert.ok(strafe.vx>0&&strafe.vz===-P.walk,'air strafing adds lateral velocity');
const slide=Object.assign(newShift(),{x:0,z:.755,yaw:0,vx:2,vz:-P.walk});
step(slide,new Set(['KeyW','KeyD']),[[-2,-.5,2,.5,0,2]],dt);
assert.ok(slide.x>0&&Math.abs(slide.vz)<.001&&slide.z>=.754,'wall collision preserves lateral sliding');
assert.equal(surface(13,-4,3.6),3.6);console.log('PASS: walk speed, airborne momentum, jump apex, buffered bunny hop, upper ramp round trip, air strafe and collision sliding');

const [world]=createScene(),{blocks}=world;
// Free physical jumps replace scripted vault paths. Verify real collision
// fixtures, rail tops, momentum and camera steering without a vault state.
for(const hz of [60,120]){
 const dt=1/hz,go=new Set(['KeyW']),idle=new Set(),rail=[-2,-.045,2,.045,0,1.04,'rail'];
 const make=(extra={})=>Object.assign(newShift(),{x:0,y:0,z:.62,yaw:0,...extra});
 let s=make();let crossed=false;
 for(const [held,height] of [[idle,P.jumpHeight],[new Set(['KeyC']),P.crouchJumpHeight]]){
  const q=make({z:3});let peak=0;for(let i=0;i<hz;i++){step(q,held,[],dt,i===0);peak=Math.max(peak,q.y);assert(!q.vault);}
  assert(Math.abs(peak-height)<.003,'jump apex '+height+' at '+hz+' Hz: '+peak);
 }
 for(const duck of [false,true])for(const speed of [7,10.2,13.4]){
  const q=make({z:10,vx:speed});let peak=0;const held=new Set(duck?['KeyC']:[]);
  for(let i=0;i<hz;i++){step(q,held,[],dt,i===0);peak=Math.max(peak,q.y);assert(!q.vault);}
  const expected=(duck?1:1.2)+.35*(speed-7)/6.4;
  assert(Math.abs(peak-expected)<.003,'momentum apex '+speed+' '+duck+' '+hz+'Hz: '+peak);assert(Math.abs(jumpHeightFor(speed,duck)-expected)<1e-9);
 }
 assert.equal(jumpHeightFor(0,true),1);assert.equal(jumpHeightFor(100,true),1.35);
 for(let i=0;i<hz*2;i++){step(s,go,[rail],dt,i===0);assert(!s.vault);if(s.z<-.32)crossed=true;}
 assert(crossed,'physical rail crossing '+hz);
 s=make({z:0,y:1.04});step(s,idle,[rail],dt,true);assert(s.vy>6&&s.y>1.04&&!s.vault,'jump from rail');
 s=make({z:0,y:2.0,grounded:false,vy:-2});
 for(let i=0;i<hz;i++){step(s,idle,[rail],dt);if(s.grounded)break;}
 assert(s.onRail&&Math.abs(s.y-1.04)<.01,'physical rail landing');
 s=make({z:.75});
 const wall=[-2,-.04,2,.04,0,3.5];
 for(let i=0;i<hz*2;i++){step(s,go,[wall],dt,i===0);assert(s.z>=.29,'solid wall crossing');}
 s=make();const ceiling=[-2,-2,2,2,2.1,2.3];
 for(let i=0;i<hz;i++){step(s,idle,[ceiling],dt,i===0);assert(s.y+s.bodyHeight<=2.11,'ceiling penetration');}
 s=make({z:2,carried:0,flashlight:true,flashAmount:1,vz:-4.5});
 step(s,idle,[],dt,true);assert(s.vz===-4.5&&s.carried===0&&s.flashlight&&!s.vault);
 console.log('PASS free jump collision at '+hz+' Hz');
}
const meshTop=p=>p.pos[1]+p.axes.reduce((sum,a)=>sum+Math.abs(a[1])/2,0);
for(const [railBlock,part] of [
 [blocks.find(b=>b[0]===-38&&b[6]==='rail'),world.parts.find(p=>p.m.name==='annex-safety'&&p.pos[0]===-34&&p.pos[1]===1.85)],
 [blocks.find(b=>b[4]===3.60&&b[6]==='rail'),world.parts.find(p=>p.m.name==='building-safety-rail'&&p.pos[0]===11.075&&p.pos[1]===4.60)],
 [blocks.find(b=>b[7]),world.parts.find(p=>p.m.name==='building-safety-rail'&&p.pos[0]===11.66&&p.pos[1]>2.8&&p.pos[1]<2.9)]
]){
 assert.ok(Math.abs(railBlock[5]-meshTop(part))<1e-8,'rail collider fits visible top');
}
await import('./check-mission.mjs');
