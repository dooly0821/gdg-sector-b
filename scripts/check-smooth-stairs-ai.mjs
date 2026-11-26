import assert from 'node:assert/strict';
import {createScene,newShift,step} from '../dist/mission.js';
import {movementBlocks} from '../dist/movement.js';
import {CLIMB_ROUTES} from '../dist/dressing.js';
import {HUNT_PROFILE,observePlayer,pursueVisible,rememberSweep,sweepVisited,hidingScore,clearObservation} from '../dist/haunt-tactics.js';
import {indexBlocks} from '../dist/haunt-navigation.js';
const [{blocks}]=createScene(),ramps=movementBlocks(blocks).filter(b=>b[6]==='stair-ramp');assert.equal(ramps.length,8);assert.equal(movementBlocks(blocks),movementBlocks(blocks));
for(const hz of [60,120]){
 const dt=1/hz,w=new Set(['KeyW']);
 for(const r of CLIMB_ROUTES){
  const s=Object.assign(newShift(),{x:r.x,z:r.z-3.45,y:0,yaw:Math.PI,bodyHeight:1.7});
  let peak=0,maxDelta=0;
  for(let i=0;i<hz*2&&s.z<r.z+1.4;i++){const y=s.y;step(s,w,blocks,dt);peak=Math.max(peak,s.y);maxDelta=Math.max(maxDelta,Math.abs(s.y-y));assert(!s.vault);}
  assert(peak>=1.43&&s.z>r.z+.8,'ascend '+r.zone);assert(maxDelta<.09,'smooth rise '+r.zone+' '+maxDelta);
  s.yaw=0;s.vx=s.vz=0;maxDelta=0;for(let i=0;i<hz*2&&s.z>r.z-3.45;i++){const y=s.y;step(s,w,blocks,dt);maxDelta=Math.max(maxDelta,Math.abs(s.y-y));}
  assert(s.y<.06&&s.z<r.z-3.2,'descend '+r.zone);assert(maxDelta<.10,'smooth descent '+r.zone+' '+maxDelta);
 }
 for(const [x,yaw] of [[-27.6,Math.PI/2],[-40.4,-Math.PI/2]]){
  const s=Object.assign(newShift(),{x,z:6,y:0,yaw,bodyHeight:1.7});let maxDelta=0;
  for(let i=0;i<hz&&s.y<.85;i++){const y=s.y;step(s,w,blocks,dt);maxDelta=Math.max(maxDelta,Math.abs(s.y-y));}
  assert(s.y>=.84,'inspection stairs '+x);assert(maxDelta<.1,'inspection smooth '+x+' '+maxDelta);
 }
 console.log('PASS smooth stair ascent/descent '+hz+' Hz');
}
const nav=indexBlocks([]),body={r:.35,y:0,h:1.7};
for(let kind=0;kind<4;kind++){const a={kind,x:0,z:0,lastKnown:[0,8]};const p={x:0,z:8,y:0,vx:12,vz:0};observePlayer(a,p);const aim=pursueVisible(a,p,nav,body,1/60);assert(aim[0]>1&&aim[0]<=HUNT_PROFILE[kind].reach+.001);rememberSweep(a,[2,8]);assert(sweepVisited(a,[2.4,8]));assert(!sweepVisited(a,[4,8]));assert(hidingScore(a,[2,8])<hidingScore(a,[-2,8]));clearObservation(a);assert(!sweepVisited(a,[2,8]));}
console.log('PASS four AI profiles: momentum lead, search memory, likely hiding direction');
