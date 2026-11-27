import assert from 'node:assert/strict';
import {move,PHYSICS as P} from '../dist/movement.js';
import {newShift,cargoWorkerClear,createScene,step} from '../dist/mission.js';
const flat=()=>0,make=extra=>Object.assign(newShift(),{x:0,y:0,z:10,yaw:0,...extra});
const gap=(s,b)=>Math.hypot(s.x-Math.max(b[0],Math.min(b[2],s.x)),s.z-Math.max(b[1],Math.min(b[3],s.z)));
for(const hz of [60,120]){
 const dt=1/hz;
 const wall=[.4,4,.6,14,0,3],s=make({x:.14,vx:3,vz:-5}),diagonal=new Set(['KeyW','KeyD','ShiftLeft']);
 for(let i=0;i<hz/2;i++){const old=s.z;move(s,diagonal,[wall],dt,false,flat);assert(gap(s,wall)>=P.radius-.002);assert(s.z<old,'wall tangent continues every tick');assert(!s.collisionRecovery);}
 assert(s.z<7.9&&s.vz< -3.5);
 const corner=[.4,7,2,9,0,2],c=make({x:.25,z:9.45,vx:3,vz:-5});
 for(let i=0;i<hz*.75;i++){const x=c.x,z=c.z;move(c,diagonal,[corner],dt,false,flat);assert(gap(c,corner)>=P.radius-.002);assert(Math.hypot(c.x-x,c.z-z)<=P.bhopCap*dt+.018);assert(!c.collisionRecovery);}
 assert(c.x>1.5||c.z<8,'can move along corner');
 const corridor=[[-1,5,-.30,15,0,3],[.30,5,1,15,0,3]],n=make({x:.02,z:13});
 for(let i=0;i<hz;i++){move(n,new Set(['KeyW','ShiftLeft']),corridor,dt,false,flat);assert(corridor.every(b=>gap(n,b)>=P.radius-.002));assert(!n.collisionRecovery);}
 assert(n.z<7.2,'narrow passage remains traversable');
 const rail=[-2,9.95,2,10.05,0,1.04,'rail'],r=make({z:10.7,yaw:0});
 for(let i=0;i<2*hz;i++)move(r,new Set(['KeyW']),[rail],dt,i===0,flat);
 assert(r.z<9,'jump over rail');
 const player=make({x:0,z:10}),other=make({x:1,z:10});player.placementWorkers=[other];
 assert(!cargoWorkerClear(player,[1,0,10]));assert(!cargoWorkerClear(player,[0,0,10]));assert(cargoWorkerClear(player,[1,2,10]));assert(cargoWorkerClear(player,[2.5,0,10]));
 console.log('PASS wall tangent, rounded corner, narrow aisle, rail jump, worker-safe cargo '+hz+'Hz');
}
