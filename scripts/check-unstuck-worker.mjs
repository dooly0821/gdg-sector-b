import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {newShift} from '../dist/mission.js';
const flat=()=>0,make=extra=>Object.assign(newShift(),{x:0,y:0,z:10,yaw:0,...extra}),idle=new Set(),w=new Set(['KeyW']),back=new Set(['KeyS']);
const overlap=(s,b)=>s.y<b[5]-.012&&s.y+(s.bodyHeight??P.height)>b[4]+.012&&Math.hypot(s.x-Math.max(b[0],Math.min(b[2],s.x)),s.z-Math.max(b[1],Math.min(b[3],s.z)))<P.radius-.002;
for(const hz of [60,120]){
 const dt=1/hz;
 // Opposing contact normals: the old algorithm could neither decrease
 // both penetrations nor move parallel along the pinch.
 const pinch=[[-1,9,-.20,11,0,3],[.20,9,1,11,0,3]];
 for(const [keys,sign] of [[w,-1],[back,1],[idle,0]]){
  const s=make();let escaped=false;
  for(let i=0;i<hz*3;i++){const x=s.x,z=s.z;move(s,keys,pinch,dt,false,flat);assert(Math.hypot(s.x-x,s.z-z)<=P.bhopCap*dt+.019);if(!pinch.some(b=>overlap(s,b))){escaped=true;break;}}
  assert(escaped,'opposed normals escape '+hz);if(sign)assert((s.z-10)*sign>.9,'input chooses escape direction');
 }
 // Local minimum: both existing solids have opposite penetration gradient;
 // route around the end without crossing a third, initially clear barrier.
 const trap=[[-1,8,-.17,12,0,3],[.17,8,1,12,0,3]],barrier=[-.15,11.1,.15,11.3,0,3],s=make();
 let escaped=false;for(let i=0;i<hz*4;i++){const x=s.x,z=s.z;move(s,idle,[...trap,barrier],dt,false,flat);assert(!overlap(s,barrier),'cannot enter new solid');assert(Math.hypot(s.x-x,s.z-z)<=3*dt+1e-6);if(!trap.some(b=>overlap(s,b))){escaped=true;break;}}
 assert(escaped,'route finds open end of narrow pinch '+JSON.stringify({x:s.x,y:s.y,z:s.z,route:s.escapeRoute,stall:s.escapeStall}));
 const low=[[-.4,9.5,.4,10.5,0,.7]],j=make();
 for(let i=0;i<hz*2;i++){move(j,w,low,dt,i===0,flat);if(!low.some(b=>overlap(j,b)))break;}
 assert(!low.some(b=>overlap(j,b)),'jump or move out of low crate');
 console.log('PASS trapped worker opposing contacts, input-directed escape, blocked exit, jump '+hz+'Hz');
}
