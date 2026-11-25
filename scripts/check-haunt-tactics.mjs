import assert from 'node:assert/strict';
import {indexBlocks} from '../dist/haunt-navigation.js';
import {HUNT_PROFILE,observePlayer,predictedPoint,pursueVisible,lostTrail,searchExpired,alreadyChecked,clearObservation} from '../dist/haunt-tactics.js';
import {move,PHYSICS} from '../dist/movement.js';
const body={r:.35,y:0,h:1.8},open=indexBlocks([]),player={x:0,z:8,y:0,vx:7,vz:0};
for(let kind=0;kind<4;kind++){
 const a={kind,x:0,z:0};observePlayer(a,player);const q=pursueVisible(a,player,open,body,1/60);assert.ok(q[0]>0&&q[0]<=HUNT_PROFILE[kind].reach+.0001);assert.equal(q[1],8);
 const wall=indexBlocks([[.4,6,.6,10,0,3]]);assert.equal(predictedPoint(a,wall,body,.55,3.1),null);
 const remembered=lostTrail(a,open,body);assert.ok(remembered[0]>0);assert.deepEqual(lostTrail(a,open,body),remembered);
 a.lost=20;assert.ok(searchExpired(a,{count:4,escape:29,memory:5.3},10));a.lost=1;assert.ok(!searchExpired(a,{count:1,escape:23,memory:3.2},40));
 a.checked=[[1,2]];assert.ok(alreadyChecked(a,[1,2]));clearObservation(a);assert.equal(a.observedPoint,null);
}
for(const hz of [60,120]){
 const dt=1/hz,s={x:0,y:0,z:17,yaw:0,vx:0,vy:0,vz:0,grounded:true,bodyHeight:1.7,steps:0,elapsed:0,carried:-1},surface=()=>0;
 const run=new Set(['KeyW','ShiftLeft']),hop=new Set(['KeyW','ShiftLeft','KeyC','Space']);
 for(let i=0;i<hz;i++)move(s,run,[],dt,false,surface);
 assert.ok(Math.abs(Math.hypot(s.vx,s.vz)-7)<.02);
 let peak=0;
 for(let i=0;i<Math.floor(hz*2.4);i++){move(s,hop,[],dt,i===0,surface);peak=Math.max(peak,Math.hypot(s.vx,s.vz));}
 assert.ok(peak>7.5&&peak<=PHYSICS.bhopCap+.001);console.log('Bhop',hz,'Hz peak',peak.toFixed(2));
}
console.log('PASS: four pursuit profiles, wall-safe lead, bounded search, persistent observation and bunny hop');
