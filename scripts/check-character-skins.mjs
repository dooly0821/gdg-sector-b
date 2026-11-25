import assert from 'node:assert/strict';
import {skinMatrices,playerAngles,creatureAngles,decodeGLB,SKIN_NAMES} from '../dist/character-skins.js';
import fs from 'node:fs';
const rig={pivots:Array.from({length:15},(_,i)=>[.01*i,.04*i,0]),parents:[-1,0,0,0,0,0,2,3,4,5,6,7,0,8,9]};
const rest=skinMatrices(rig,Array.from({length:15},()=>[0,0,0]));assert.ok(rest.every((x,i)=>Math.abs(x-(i%16%5===0?1:0))<1e-5));
for(let i=0;i<100;i++){let a=playerAngles({speed:7,steps:i*.1,bodyHeight:1.7,carried:i%2?-1:0});assert.ok(skinMatrices(rig,a).every(Number.isFinite));for(let k=0;k<4;k++)assert.ok(skinMatrices(rig,creatureAngles(k,a)).every(Number.isFinite));}
for(const name of SKIN_NAMES){const path=new URL('../dist/assets/characters/'+name+'.glb',import.meta.url);if(!fs.existsSync(path)){console.log('asset not uploaded:',name);continue;}const b=fs.readFileSync(path);const a=decodeGLB(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));assert.ok(a.indices.every(i=>i<a.positions.length/3));assert.ok(a.weights.every(Number.isFinite));assert.ok(a.joints.every(i=>i<15));for(let i=0;i<a.weights.length;i+=4)assert.ok(Math.abs(a.weights[i]+a.weights[i+1]+a.weights[i+2]+a.weights[i+3]-1)<1e-5);console.log(name,a.indices.length/3,'triangles, rig validated');}
console.log('PASS character skin matrix and asset checks');