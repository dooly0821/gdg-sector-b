import assert from 'node:assert/strict';
import {newShift,createScene,nextTarget,CONFIG,forward,baySlot,DOCK} from '../dist/mission.js';
import {choreography,beginHandling,advanceHandling,toggleFlashlight,updateViewmodel} from '../dist/handling.js';
import {SOCKETS} from '../dist/viewmodel.js';
const w=createScene()[0],s=newShift();
function aim(pos){s.yaw=Math.atan2(s.x-pos[0],s.z-pos[2]);s.pitch=Math.atan2(pos[1]+.24-s.y-CONFIG.eye,Math.hypot(s.x-pos[0],s.z-pos[2]));}
const eye=()=>[s.x,s.y+CONFIG.eye,s.z];
const pose=()=>choreography(s,eye(),true,true,false,.9);
function point(M,p){return [0,1,2].map(i=>M[i]*p[0]+M[i+4]*p[1]+M[i+8]*p[2]+M[i+12]);}
function verifyAction(){for(let i=0;i<=120;i++){
 s.handAction.time=s.handAction.duration*i/120;
 const p=pose();assert.ok(p.hands.every(a=>a.offset.every(Number.isFinite)&&(!a.matrix||a.matrix.every(Number.isFinite))));
 if(p.assembly){const layers=p.hands.filter(a=>[4,5,6].includes(a.group));assert.equal(layers.length,3);assert.ok(layers.every(a=>a.matrix===layers[0].matrix));}
 for(const hand of p.hands.filter(a=>a.group===4||a.group===5)){const i=hand.group-4;const sleeve=p.hands.find(a=>a.group===8+i),socket=SOCKETS[i?'carryR':'carryL'].wrist;const hp=point(hand.matrix,socket.map((v,j)=>v+hand.offset[j])),sp=point(sleeve.matrix,socket);assert.ok(Math.hypot(...hp.map((v,j)=>v-sp[j]))<1e-5);}
 }}
assert.equal(beginHandling(s,nextTarget(s),w.blocks),false,'too far to physically reach');
s.x=1.12;s.z=13.72;aim(nextTarget(s).pos);assert.ok(beginHandling(s,nextTarget(s),w.blocks));verifyAction();assert.equal(advanceHandling(s,w.blocks,1),'picked');
let p=pose();const offsets=p.hands.filter(a=>[4,5,6,8,9].includes(a.group)).map(a=>a.offset);assert.equal(offsets.length,5);assert.ok(offsets.every(a=>a===offsets[0]));
s.x=DOCK[0];s.z=DOCK[2]+1.08;s.pitch=-.65;s.yaw=0;assert.ok(beginHandling(s,nextTarget(s),w.blocks));verifyAction();assert.equal(advanceHandling(s,w.blocks,1),'delivered');
assert.ok(toggleFlashlight(s));for(let i=0;i<40;i++)updateViewmodel(s,1/120);assert.equal(s.flashAmount,1);assert.ok(toggleFlashlight(s));for(let i=0;i<40;i++)updateViewmodel(s,1/120);assert.equal(s.flashAmount,0);
console.log('PASS: 242 sampled pickup/placement phases, shared cargo transform, wrist-sleeve attachment, reach constraint, exact Q endpoints.');
