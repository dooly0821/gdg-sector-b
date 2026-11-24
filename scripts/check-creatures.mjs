import assert from 'node:assert/strict';
import {createScene,newShift} from '../dist/mission.js';
import {buildHauntRigs,hauntLayers,updateHaunt,ACTOR_START} from '../dist/haunt.js';
import {geometry} from '../dist/geometry.js';
import {CREATURE_JOINTS} from '../dist/creature-models.js';

const [world]=createScene();
const rng=seed=>()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
const types=new Set(),zones=new Set(),delays=new Set();
function simulate(seed,spot=0){
 const [px,pz]=[[-17,14],[-32,13],[-22,.35],[-38,4]][spot];
 const random=rng(seed),s=Object.assign(newShift(),{x:px,z:pz});
 let appeared;
 for(let frame=0;frame<480;frame++){
  updateHaunt(s,world.blocks,[-1,0,0],1/120,random);
  assert.ok(s.haunt.length<=2);
  if(s.haunt.length){appeared={...s.haunt[0],frame};break;}
 }
 if(appeared){
  const {x,z,kind,route,frame}=appeared;
  assert.ok(Math.hypot(x-px,z-pz)>6);
  types.add(kind);zones.add(route);delays.add(frame);
  assert.equal(hauntLayers(s).filter(p=>p.group===ACTOR_START+kind*CREATURE_JOINTS[kind].length).length<=1,true);
  return [kind,route,frame];
 }
}
const seedCheck=simulate(489);
assert.ok(seedCheck);
assert.deepEqual(simulate(489),seedCheck);
for(let i=0;i<110;i++)simulate(i*193+35,i%4);
assert.equal(types.size,4);
assert.ok(zones.size>=3);
assert.ok(delays.size>10);
const layers=buildHauntRigs();
let triangles=0;
for(const [i,joints] of CREATURE_JOINTS.entries()){
 const groups=layers.slice(i*joints.length,(i+1)*joints.length);
 assert.ok(groups[0].parts.length>0&&groups[1].parts.length>0);
 let count=0;
 for(const part of groups.flatMap(g=>g.parts)){
  const verts=geometry(part.shape);
  assert.equal(verts.length%24,0);
  assert.ok(verts.every(Number.isFinite));
  assert.ok(part.meshBounds.radius>0);
  count+=verts.length/24;
 }
 assert.ok(count>3500);
 triangles+=count;
 console.log(`Creature ${i+1}: ${count} triangles, ${joints.length} joint transforms`);
}
console.log(`PASS: ${triangles} triangles, varied types/routes/times, deterministic seeded replay, encounter cap`);
