import assert from 'node:assert/strict';
import {indexBlocks,freeAt,segmentFree,navigate,recover,trappedTooLong} from '../dist/haunt-navigation.js';
import {updateHaunt} from '../dist/haunt.js';
import {newShift} from '../dist/mission.js';
const dt=1/60,body={r:.34,y:0,h:1.8};
for(const stateless of [false,true]){
 const nav=indexBlocks([[-2,-2,-1.5,4,0,3],[1.5,-2,2,4,0,3],[-2,3.5,2,4,0,3]]),a={x:0,z:0,stuck:0},target=[0,8];let t=0;
 for(;t<1800;t++){if(Math.hypot(a.x-target[0],a.z-target[1])<.4)break;if(stateless)a.navJob=null;
  if(recover(a,nav,body,target,dt))continue;
  const aim=navigate(a,target,nav,body,dt,stateless?160:24);let moved=false;
  if(aim){const d=Math.hypot(aim[0]-a.x,aim[1]-a.z),p=[a.x+(aim[0]-a.x)*Math.min(1,.085/Math.max(.0001,d)),a.z+(aim[1]-a.z)*Math.min(1,.085/Math.max(.0001,d))];if(segmentFree(nav,[a.x,a.z],p,body,0)){a.x=p[0];a.z=p[1];moved=true;}}
  a.stuck=moved?0:a.stuck+dt;assert(freeAt(nav,a.x,a.z,body));
 }
 assert(t<1800,'U trap escape '+stateless);
}
for(let kind=0;kind<4;kind++){const s=Object.assign(newShift(),{x:0,z:8,hauntDirector:{delay:1e6,bag:[]},haunt:[{kind,x:0,z:0,yaw:0,phase:0,age:2,life:100,speed:0,timer:0,state:'search',pursuit:true,lastKnown:[0,8],path:[[0,0],[0,8]],pathIndex:0,direction:1,aggression:1}]});
 const a=s.haunt[0],walls=[[-3,2,3,2.4,0,3]];let max=0;for(let i=0;i<600&&a.state!=='disappear';i++){s.elapsed+=dt;updateHaunt(s,walls,[0,0,-1],dt,()=>.42);max=Math.max(max,Math.hypot(a.x,a.z));if(s.failed)break;}assert(max>2,'actor moves around obstacle '+kind);}
const a={x:0,z:0};let expired=false;for(let i=0;i<500;i++){a.x=Math.sin(i*.2)*.1;expired=trappedTooLong(a,true,dt);}assert(expired);assert(!trappedTooLong(a,false,dt));a.x=2;assert(!trappedTooLong(a,true,dt));
console.log('PASS four ghosts, U trap including stateless sync, oscillation watchdog and intentional idle');
