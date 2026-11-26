import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {createScene,newShift,step} from '../dist/mission.js';
const flat=()=>0,idle=new Set(),w=new Set(['KeyW']),d=new Set(['KeyD']),sprint=new Set(['KeyW','ShiftLeft']),hop=new Set(['KeyC','KeyD','Space']);
const make=(extra={})=>({x:0,y:0,z:.55,yaw:0,vx:0,vy:0,vz:0,grounded:true,bodyHeight:1.7,steps:0,elapsed:0,carried:-1,...extra});
const rail=[-3,-.045,3,.045,0,1.04,'rail'],[{blocks}]=createScene();
for(const hz of [60,120]){
 const dt=1/hz;
 const s=make({z:0,y:2,grounded:false,vy:-2});
 for(let i=0;i<hz&&!s.grounded;i++)move(s,idle,[rail],dt,false,flat);
 assert(s.onRail&&Math.abs(s.y-1.04)<.005);
 for(let i=0;i<Math.floor(hz*.25);i++)move(s,d,[rail],dt,false,flat);
 assert(s.onRail&&s.x>.4);
 move(s,d,[rail],dt,true,flat);assert(!s.grounded&&!s.vault&&s.vy>6);
 const air=make({x:0,z:10,y:1,grounded:false,vz:-7,vy:1,hopBoosted:true});for(let i=0;i<Math.round(hz*.30);i++)move(air,hop,[],dt,false,flat);
 assert(air.vx>4&&Math.hypot(air.vx,air.vz)<=P.bhopCap+.001);
 const a=make({x:0,z:15,cargo:[{special:'heavy'}],carried:0}),b=make({x:0,z:15});
 for(let i=0;i<hz;i++){move(a,sprint,[],dt,false,flat);move(b,sprint,[],dt,false,flat);}
 assert(Math.abs(Math.hypot(a.vx,a.vz)-5.95)<.02);assert(Math.abs(Math.hypot(b.vx,b.vz)-7)<.02);
 // Real upper catwalk and annex rail: approach and jump with direction input.
 for(const start of [{x:11.9,y:3.6,z:-18,yaw:Math.PI/2},{x:-34,y:.86,z:6.3,yaw:Math.PI}]){
  const q=Object.assign(newShift(),start);let max=q.y;
  for(let i=0;i<hz;i++){step(q,w,blocks,dt,i===0);max=Math.max(max,q.y);assert(!q.vault);}
  assert(max>start.y+1.1,'real rail clearance '+start.x);
 }
 console.log('PASS freerun, rail landing, actual map jump, heavy freight '+hz+' Hz');
}
