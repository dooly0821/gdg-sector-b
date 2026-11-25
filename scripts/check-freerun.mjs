import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
const make=(extra={})=>({x:0,y:0,z:.55,yaw:0,vx:0,vy:0,vz:0,grounded:true,bodyHeight:1.7,steps:0,elapsed:0,carried:-1,...extra});
const rail=[-3,-.045,3,.045,0,1.04,'rail'],flat=()=>0,w=new Set(['KeyW']),idle=new Set(),d=new Set(['KeyD']),sprint=new Set(['KeyW','ShiftLeft']),hop=new Set(['KeyC','KeyD','Space']);
for(const hz of [60,120]){
 const dt=1/hz,s=make();move(s,idle,[rail],dt,true,flat);assert.ok(s.vault?.perch);
 for(let i=0;s.vault&&i<hz;i++)move(s,idle,[rail],dt,false,flat);assert.ok(s.grounded&&s.onRail&&Math.abs(s.y-1.04)<.005);
 for(let i=0;i<Math.floor(hz*.25);i++)move(s,d,[rail],dt,false,flat);assert.ok(s.grounded&&s.onRail&&s.x>.4);
 const prop=[s.x+.48,-.5,s.x+2,.5,0,1.48,'climb'];s.vx=0;s.vz=0;move(s,d,[rail,prop],dt,true,flat);
 for(let i=0;i<hz;i++){move(s,i<Math.floor(hz*.28)?d:idle,[rail,prop],dt,false,flat);if(s.grounded&&s.y>1.4)break;}assert.ok(s.grounded&&s.y>=1.4);
 const n=make();move(n,sprint,[rail],dt,true,flat);assert.ok(n.vault&&!n.vault.perch);
 for(let i=0;n.vault&&i<hz;i++)move(n,sprint,[rail],dt,false,flat);assert.ok(n.z<-.30);
 const blocked=make();move(blocked,w,[rail,[-3,-1,3,1,1.95,2.05]],dt,true,flat);assert.ok(!blocked.vault?.perch);
 const air=make({x:0,z:10,y:1,grounded:false,vz:-7,vy:1,hopBoosted:true});for(let i=0;i<Math.round(hz*.30);i++)move(air,hop,[],dt,false,flat);
 assert.ok(air.vx>4&&Math.hypot(air.vx,air.vz)<=P.bhopCap+.001);
 console.log('PASS freerun',hz,'Hz');
}
