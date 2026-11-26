import assert from 'node:assert/strict';
import {cargoGlowCode,glowPalette,glowDistanceFactor,isParcelNode} from '../dist/cargo-glow.js';
import {parcelPositions,newShift,parcelBlocks} from '../dist/mission.js';
import {Renderer} from '../dist/renderer.js';
assert.deepEqual(['noisy','heavy','urgent','cursed',undefined,'__proto__'].map(cargoGlowCode),[1,2,3,4,0,0]);
for(const t of [0,.3,3,60,1200]){
 const g=glowPalette(t);assert.equal(g[0][3],0);
 for(const v of g.slice(1))assert.ok(v[3]>.14&&v[3]<.29);
}
assert.equal(glowDistanceFactor(0),1);assert.equal(glowDistanceFactor(18**2),1);assert.equal(glowDistanceFactor(24**2),0);assert.ok(glowDistanceFactor(21**2)<1);
assert.ok(isParcelNode('Parcel')&&isParcelNode('Cargo_Mesh'));assert.ok(!isParcelNode('RightArm')&&!isParcelNode('GDG_FP_Flashlight_Skin_V2')&&!isParcelNode('BoxCarry_Combined'));
const s=newShift(()=>.42);s.cargo[0].special='urgent';delete s.cargo[1].special;s.states[2]='DELIVERED';s.deliveryOrder=[2];s.parked={0:[3,0,4]};
const normal=parcelPositions(s),visual=parcelPositions(s,-1,true);
assert.deepEqual(normal,visual.map(p=>p.slice(0,3)));assert.deepEqual(visual[0],[3,0,4,3]);assert.equal(visual[1].length,3);assert.equal(visual[2].length,3);assert.equal(parcelPositions(s,0,true).length,visual.length-1);
assert.ok(parcelBlocks(s).every(p=>p.length===7));
// Exercise the actual render method against a recording WebGL stub. Existing draw count must not change.
globalThis.devicePixelRatio=1;
const frame=(items,cargoGlow=0,props=[])=>{
 const draws=[];let active=0;
 const gl=new Proxy({uniform4f:(loc,r,g,b,a)=>{if(loc==='cargoGlow')active=a;}},{get:(obj,k)=>obj[k]??(()=>{})});
 const groups=Array.from({length:11},(_,i)=>[{id:i,center:[0,0,-5],radius:1}]);
 const mock={gl,canvas:{clientWidth:800,clientHeight:600,width:800,height:600},quality:'BALANCED',size:1024,lights:[],groups,loc:{main:{cargoGlow:'cargoGlow'}},draw:b=>draws.push({group:b.id,active}),setFlex:()=>{}};
 const matrix=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4,1]);
 Renderer.prototype.render.call(mock,[0,1,0],[0,0,-1],items,{clock:1,cargoGlow,actors:props.map(p=>({group:p.prop?1:8,root:[0,0,-4],matrix,prop:p.prop,cargoGlow:p.cargoGlow})),hands:[{group:6,offset:[0,0,0]},{group:4,offset:[0,0,0]}]},1);
 return {draws,active};
};
const ordinary=frame([[0,0,-5],[0,0,-30],[100,0,-5]]);
const special=frame([[0,0,-5,1],[0,0,-30,4],[100,0,-5,3]],2,[{prop:true,cargoGlow:4},{prop:false,cargoGlow:4}]);
assert.equal(ordinary.draws.length,5);assert.equal(special.draws.length,ordinary.draws.length+2);
assert.equal(special.draws[0].active,0);assert.ok(special.draws[1].active>0);assert.equal(special.draws[2].active,0);
assert.ok(special.draws[3].active>0);assert.equal(special.draws[4].active,0);assert.ok(special.draws[5].active>0);assert.equal(special.draws[6].active,0);assert.equal(special.active,0);
console.log('PASS: cargo-only glow, range cutoff, delivery/drop state, unchanged draw count, safe uniform resets');
