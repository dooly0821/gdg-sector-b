import {acknowledgeWarnings,warningList} from '../dist/threat-warning.js';
import assert from 'node:assert/strict';
import {indexBlocks,freeAt,segmentFree,navigate,recover} from '../dist/haunt-navigation.js';
import {createScene,newShift} from '../dist/mission.js';
import {worldBounds} from '../dist/movement.js';
import {updateHaunt} from '../dist/haunt.js';
const body={r:.34,y:0,h:1.8},dt=1/60;
function route(name,blocks,start,target){
 const nav=indexBlocks(blocks),actor={x:start[0],z:start[1],stuck:0};
 let ticks=0;
 for(;ticks<1800;ticks++){
  if(Math.hypot(actor.x-target[0],actor.z-target[1])<.4)break;
  if(recover(actor,nav,body,target,dt))continue;
  const aim=navigate(actor,target,nav,body,dt,24);let moved=false;
  if(aim){const d=Math.hypot(aim[0]-actor.x,aim[1]-actor.z),p=[actor.x+(aim[0]-actor.x)*Math.min(1,.085/Math.max(.0001,d)),actor.z+(aim[1]-actor.z)*Math.min(1,.085/Math.max(.0001,d))];if(segmentFree(nav,[actor.x,actor.z],p,body,0)){actor.x=p[0];actor.z=p[1];moved=true;}}
  actor.stuck=moved?0:actor.stuck+dt;
  assert.ok(freeAt(nav,actor.x,actor.z,body),name+' collision');
 }
 assert.ok(ticks<1800,name+' reaches destination');
}
route('wall',[[-3,2,3,2.4,0,3]],[0,0],[0,8]);
route('U trap',[[-2,-2,-1.5,4,0,3],[1.5,-2,2,4,0,3],[-2,3.5,2,4,0,3]],[0,0],[0,8]);
route('post overlap',[[-.25,-.25,.25,.25,0,2]],[.2,0],[0,5]);
const [w]=createScene(),blocks=w.blocks.concat(worldBounds),nav=indexBlocks(blocks);
const nearest=p=>{for(let d=0;d<3.5;d+=.25)for(let k=0;k<16;k++){const q=[p[0]+Math.cos(k*Math.PI/8)*d,p[1]+Math.sin(k*Math.PI/8)*d];if(freeAt(nav,...q,body,.05))return q;}throw Error('no free test position');};
for(const [name,a,b] of [['B-C',[-12,10],[-21,17]],['D02-D03',[-10,33],[-20,40]],['C02-D04',[-20,60],[-10,72]],['B rack',[-6,5],[-6,-7]]])route(name,blocks,nearest(a),nearest(b));
const s=Object.assign(newShift(),{x:0,z:7,bodyHeight:1.7});s.hauntDirector={delay:1e6,bag:[]};s.haunt=[{kind:1,x:0,z:0,yaw:0,phase:0,age:2,life:40,speed:0,timer:0,state:'search',pursuit:true,lastKnown:[0,7],path:[[0,0],[0,8]],pathIndex:0,direction:1,aggression:1}];let caught=null;for(let t=0;t<1200&&!caught;t++){s.elapsed+=dt;caught=updateHaunt(s,[[-3,2,3,2.4,0,3]],[0,0,1],dt,()=>.42);acknowledgeWarnings(s,warningList(s).map(w=>w.id),s.elapsed);}
assert.equal(caught,'함귀');assert.ok(s.failed);
console.log('PASS: wall, U trap, overlap recovery, four warehouse paths and pursuit capture');
