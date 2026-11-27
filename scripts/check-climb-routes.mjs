import {acknowledgeWarnings,warningList} from '../dist/threat-warning.js';
import assert from 'node:assert/strict';
import {createScene,newShift,step} from '../dist/mission.js';
import {CLIMB_ROUTES} from '../dist/dressing.js';
import {updateHaunt} from '../dist/haunt.js';
const [w]=createScene(),dt=1/60;
for(const r of CLIMB_ROUTES){
 const s=Object.assign(newShift(),{x:r.x,z:r.z-3.28,y:0,yaw:Math.PI,pitch:0,bodyHeight:1.7});
 for(let i=0;i<100&&s.z<r.z+1.4;i++)step(s,new Set(['KeyW']),w.blocks,dt);
 assert.ok(s.y>=1.4,'walkable stairs '+r.zone);
}
for(const r of [...CLIMB_ROUTES,...[-32,-2].map(x=>({zone:'ESCAPE'+x,top:3,nodes:[[x,0,58.7],[x,3,68]]}))]){
 const top=r.nodes.at(-1),start=r.nodes[0],s=Object.assign(newShift(),{x:top[0],y:top[1],z:top[2],grounded:true,bodyHeight:1.7,hauntDirector:{delay:1e6,bag:[]}});
 s.haunt=[{kind:2,x:start[0],z:start[2],yaw:0,phase:0,age:3,life:100,speed:0,timer:0,state:'alert',pursuit:true,path:[[start[0],start[2]]],pathIndex:0,direction:1,aggression:1}];
 let max=0,hit=null,t=0;for(;t<1800&&!hit;t++){s.elapsed+=dt;hit=updateHaunt(s,w.blocks,[0,0,1],dt,()=>.42);acknowledgeWarnings(s,warningList(s).map(w=>w.id),s.elapsed);max=Math.max(max,s.haunt[0].surfaceY??0);}
 assert.ok(max>=r.top-.01,'creature climbs '+r.zone);assert.equal(hit,'적재귀');assert.ok(t*dt>4,'slow approach');
}
console.log('PASS: six walkable stairways, eight climbable creature routes');
