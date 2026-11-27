import {acknowledgeWarnings,warningList} from '../dist/threat-warning.js';
import assert from 'node:assert/strict';
import {createScene,newShift,step} from '../dist/mission.js';
import {LOCKERS,lockerTarget,useLocker,closedLocker,insideLocker,buildLockerDoor,lockerEntry} from '../dist/lockers.js';
import {updateHaunt} from '../dist/haunt.js';
import {traceBox} from '../dist/contact.js';
const [w]=createScene(),dt=1/60,results=[];
for(const l of LOCKERS)for(const kind of (l.id===1?[0,1,2,3]:[1])){
 const s=Object.assign(newShift(),{x:l.x,z:l.z-2.03,y:0,yaw:Math.PI,pitch:0,bodyHeight:1.7,hauntDirector:{delay:1e6,bag:[]}});
 assert.equal(lockerTarget(s,w.blocks)?.id,l.id);assert.equal(useLocker(s,l),'opening');
 const run=new Set(['KeyW']),idle=new Set();
 for(let i=0;i<35;i++)step(s,idle,w.blocks,dt);
 assert.equal(s.lockers[l.id].open,1);
 for(let i=0;i<65&&!insideLocker(s,l);i++)step(s,run,w.blocks,dt);
 assert.ok(insideLocker(s,l),'enter '+l.id);assert.equal(useLocker(s,l),'closing');
 for(let i=0;i<35;i++)step(s,idle,w.blocks,dt);
 assert.ok(closedLocker(s));s.yaw=0;
 s.haunt=[{kind,x:l.x,z:l.z-2.05,yaw:0,phase:0,age:2,life:100,speed:0,timer:0,state:'alert',pursuit:true,path:[[l.x,l.z-3],[l.x,l.z-13]],pathIndex:0,direction:1,aggression:1}];
 let waited=0,away=0,far=0,closest=Infinity,minX=Infinity,maxX=-Infinity;for(let i=0;i<2400;i++){s.elapsed+=dt;assert.ok(!updateHaunt(s,w.blocks,[0,0,-1],dt,()=>.42),'no hidden capture');acknowledgeWarnings(s,warningList(s).map(w=>w.id),s.elapsed);const a=s.haunt[0];if(a.state==='lockerWait'){waited+=dt;minX=Math.min(minX,a.x);maxX=Math.max(maxX,a.x);}if(a.state==='lockerAway')away+=dt;far=Math.max(far,Math.hypot(a.x-l.x,a.z-l.z));closest=Math.min(closest,Math.hypot(a.x-lockerEntry(l)[0],a.z-lockerEntry(l)[1]));if(away>1)break;}
 assert.ok(waited>=4.4&&far>10&&away>.9&&closest<.7,'search/leave '+l.id);
 assert.ok(maxX-minX>.2,'paces '+l.id);
 assert.equal(useLocker(s,l),'opening');
 for(let i=0;i<35;i++)step(s,idle,w.blocks,dt);
 assert.equal(s.lockers[l.id].open,1);
 for(let i=0;i<65&&s.z>l.z-1.1;i++)step(s,run,w.blocks,dt);
 assert.ok(s.z<l.z-1.08&&!insideLocker(s,l),'exit '+l.id);
 results.push({id:l.id,kind,waited:+waited.toFixed(2),far:+far.toFixed(1),pace:+(maxX-minX).toFixed(2)});
}
const door=buildLockerDoor(),rayA=[.535,1.58,.4],rayB=[.535,1.58,-.4];
for(const p of door.parts.filter(p=>p.shape==='box')){const half=p.axes.map((_,i)=>p.axes.reduce((sum,a)=>sum+Math.abs(a[i])*.5,0));assert.ok(traceBox(rayA,rayB,[p.pos[0]-half[0],p.pos[2]-half[2],p.pos[0]+half[0],p.pos[2]+half[2],p.pos[1]-half[1],p.pos[1]+half[1]])>=1,'slit has physical visibility');}
console.log('PASS: locker entry/exit, pacing, search and departure, visible slit',results);
