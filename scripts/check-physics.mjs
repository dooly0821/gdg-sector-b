import assert from 'node:assert/strict';
import {createScene,newShift,step,surface} from '../dist/mission.js';
import {PHYSICS as P} from '../dist/movement.js';
const dt=1/P.hz,none=new Set(),w=new Set(['KeyW']);
let s=newShift();s.yaw=0;for(let i=0;i<120;i++)step(s,w,[],dt);assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-P.walk)<.01);
const speed=Math.hypot(s.vx,s.vz);step(s,none,[],dt,true);assert.ok(!s.grounded);assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-speed)<1e-6);
let apex=s.y,buffered=false,hopped=false;for(let i=0;i<180;i++){const request=!buffered&&s.vy<0&&s.y<.15;if(request)buffered=true;const was=s.grounded;step(s,none,[],dt,request);apex=Math.max(apex,s.y);if(buffered&&was&&!s.grounded){hopped=true;break;}}assert.ok(apex>.94&&apex<1.01);assert.ok(hopped,'buffered bunny hop');
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
const sprint=new Set(['KeyW','ShiftLeft']);
const annex={x:-34,y:.86,z:6.3,yaw:Math.PI};
const deck={x:11.9,y:3.6,z:-18,yaw:Math.PI/2,vx:-P.walk};
const ramp={x:12.35,y:surface(12.35,11.45,3),z:11.45,yaw:Math.PI/2,vx:-P.walk};

function crossing(name,position,passed,{keys=w,landing,props=blocks}={}){
 const s=Object.assign(newShift(),position);
 step(s,keys,props,dt,true);
 assert.ok(s.vault,name+' starts');
 const plan=s.vault;
 assert.ok(Math.hypot(s.x-position.x,s.z-position.z)>0,name+' moves while rising');
 assert.ok(s.y>position.y,name+' starts rising immediately');
 let lastY=s.y,fell=false;
 for(let i=0;s.vault;i++){
  assert.ok(i<75,name+' finishes in bounded time');
  const old=[s.x,s.y,s.z];
  step(s,keys,props,dt);
  assert.ok(Math.hypot(s.x-old[0],s.y-old[1],s.z-old[2])<.16,name+' has no discontinuity');
 }
 assert.ok(passed(s),name+' clears the far edge');
 assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-plan.exitSpeed)<1e-8,name+' keeps release momentum');
 if(landing!==undefined){
  for(let i=0;!s.grounded&&i<200;i++){
   const vy=s.vy;
   step(s,none,props,dt);
   if(i===0&&landing<position.y)assert.ok(s.vy<vy,name+' continues accelerating at release');
   if(s.vy<0&&s.y<lastY)fell=true;
   lastY=s.y;
  }
  assert.ok(s.grounded,name+' lands');
  assert.ok(Math.abs(s.y-landing)<.01,name+' lands at '+landing+' (got '+s.y+')');
  if(landing<position.y)assert.ok(fell,name+' falls under gravity');
 }
 assert.equal(s.flashlight,position.flashlight??false);
 assert.equal(s.carried,position.carried??-1);
 console.log('PASS vault:',name);
}
crossing('C-01 rail head-on',annex,s=>s.z>7.46,{landing:0});
crossing('rail at contact', {...annex,z:6.859},s=>s.z>7.46,{landing:0});
crossing('diagonal sprint',{...annex,z:6.4,yaw:Math.PI*1.25,vx:4.8,vz:4.8},s=>s.z>7.46&&s.x>-33,{keys:sprint,landing:0});
crossing('warehouse upper rail',deck,s=>s.x<10.78,{landing:0});
crossing('warehouse ramp rail',ramp,s=>s.x<11.35,{landing:0});
crossing('ascending diagonal on ramp',{...ramp,yaw:Math.PI/4,vx:-3,vz:-3},s=>s.x<11.35&&s.z<11,{landing:0});
crossing('low cargo',{x:-21,y:0,z:11.38,yaw:0,vz:-P.walk},s=>s.z<10.28,{landing:.72});
crossing('warehouse pallet top',{x:9.19,y:0,z:-14.72,yaw:Math.PI},s=>s.z>-14,{landing:1.0295});
crossing('flashlight',{...annex,flashlight:true,flashAmount:1},s=>s.z>7.46);
crossing('one-hand box and flashlight',{...annex,carried:0,flashlight:true,flashAmount:1},s=>s.z>7.46);

const fixture={x:0,y:0,z:1,yaw:0};
const rail=[-2,-.04,2,.04,0,1.22,'rail'];
function blocked(name,position,props,minZ){
 const s=Object.assign(newShift(),position);
 step(s,w,props,dt,true);
 assert.ok(!s.vault,name+' refuses to vault');
 for(let i=0;i<180;i++)step(s,w,props,dt);
 assert.ok(s.z>=minZ,name+' never crosses');
 assert.ok(s.grounded&&s.y===0,name+' returns to the floor');
 console.log('PASS vault rejection:',name);
}
blocked('solid wall',fixture,[[-2,-.04,2,.04,0,2.5]],.29);
blocked('high marked obstacle',{...fixture,z:.75},[[...rail.slice(0,5),1.35,'rail']],.29);
blocked('blocked landing', {...fixture,z:.75},[rail,[-2,-2.1,2,-.31,0,2.7]],.29);
blocked('blocked headroom',{...fixture,z:.75},[rail,[-2,-.8,2,.30,1.96,2.10]],.29);
blocked('outside idle reach',fixture,[rail],.29);
crossing('extended reach at sprint speed',{...fixture,vz:-P.sprint},s=>s.z<-.32,{keys:sprint,props:[rail],landing:0});

const meshTop=p=>p.pos[1]+p.axes.reduce((sum,a)=>sum+Math.abs(a[1])/2,0);
for(const [railBlock,part] of [
 [blocks.find(b=>b[0]===-38&&b[6]==='rail'),world.parts.find(p=>p.m.name==='annex-safety'&&p.pos[0]===-34&&p.pos[1]===1.85)],
 [blocks.find(b=>b[4]===3.60&&b[6]==='rail'),world.parts.find(p=>p.m.name==='building-safety-rail'&&p.pos[0]===11.075&&p.pos[1]===4.60)],
 [blocks.find(b=>b[7]),world.parts.find(p=>p.m.name==='building-safety-rail'&&p.pos[0]===11.66&&p.pos[1]>2.8&&p.pos[1]<2.9)]
]){
 assert.ok(Math.abs(railBlock[5]-meshTop(part))<1e-8,'rail collider fits visible top');
}
await import('./check-mission.mjs');
