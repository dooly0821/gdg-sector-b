import assert from 'node:assert/strict';
import {createSyncEngine} from '../server/room-sync.js';
import {appendRemote,remoteAt} from '../dist/net-smoothing.js';
import {indexBlocks,queryBlocks} from '../dist/haunt-navigation.js';
import {newShift,parcelBlocks} from '../dist/mission.js';
import {hauntLayers} from '../dist/haunt.js';
let stored=JSON.stringify({shared:{},lastTick:0,n:0,seen:{}}),writes=0,tick=1000;
const engine=createSyncEngine({read:async()=>stored,compare:async(_,before,after)=>{writes++;if(before!==stored)return [2,stored];stored=after;return [1]},operate:(r,b,t)=>{if(b.token==='bad')throw Object.assign(new Error('invalid'),{status:401});if(!r.seen[b.token]){r.n++;r.seen[b.token]=true;}r.lastTick=t;return {n:r.n,seen:r.seen}},serialize:JSON.stringify,error:(m,status)=>Object.assign(new Error(m),{status}),clock:()=>tick++});
const jobs=await Promise.allSettled(['a','b','bad','c'].map(token=>engine.sync('r',{}, {token})));
assert.equal(jobs[2].status,'rejected');assert.equal(JSON.parse(stored).n,3);assert.equal(writes,1);assert.deepEqual(jobs[0].value.seen,{a:true});assert.equal(jobs[3].value.n,3);
let track=null;
for(let i=0;i<6;i++){const t=i*150,arrival=t+80+[0,30,-15,55,-20,10][i];track=appendRemote(track,{x:t*.007,z:0,y:0,yaw:0,vx:7,vz:0,grounded:true,steps:t*.007},t,arrival,10000+t);}
let prior=0;
for(let t=track.delay;t<850;t+=1000/60){const p=remoteAt(track,t,true);assert.ok(Number.isFinite(p.x)&&p.x>=prior-1e-6);assert.ok(p.x-prior<.14);prior=p.x;}
const priorTime=track.renderTime;track.delay+=25;remoteAt(track,850,true);assert.ok(track.renderTime>=priorTime,'adaptive delay must not rewind motion');
const last=track.samples.at(-1).pose;assert.ok(remoteAt(track,9999,true).x<=last.x+1.051);
const staticBlocks=[[0,0,2,2,0,2]],dynamic=[[1,1,3,3,0,1]],index=indexBlocks(staticBlocks),merged=indexBlocks(dynamic,index);
assert.equal(queryBlocks(index,0,0,4,4).length,1);assert.equal(queryBlocks(merged,0,0,4,4).length,2);
const s=newShift(()=>.42);const a=parcelBlocks(s);assert.equal(parcelBlocks(s),a);s.states[0]='CARRIED';assert.equal(parcelBlocks(s).length,a.length-1);s.states[0]='AVAILABLE';s.parked={0:[1,0,1]};assert.ok(parcelBlocks(s).some(b=>Math.abs((b[0]+b[2])/2-1)<.001));
const ghost={x:0,z:0,yaw:0,kind:0,phase:1,age:1,speed:3,aggression:.3,state:'chase'};
const gs={x:0,z:0,haunt:[ghost]},full=hauntLayers(gs),fast=hauntLayers(gs,()=>true);assert.ok(full.length>1);assert.equal(fast.length,1);assert.deepEqual(fast[0].skin,full[0].skin);
console.log('PASS batch CAS, per-request snapshots, jitter interpolation, static navigation cache, cargo cache invalidation and GLB-only actor layers');
