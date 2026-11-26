import assert from 'node:assert/strict';
import {createScene,newShift,step} from '../dist/mission.js';
import {LOCKERS,lockerTarget,lockerEntry} from '../dist/lockers.js';
import {RUN_LANES} from '../dist/layout.js';
import {mapMarkup,mapMarkers} from '../dist/facility-map.js';
const [w]=createScene(),overlap=(b,x0,z0,x1,z1,h=1.7)=>b[0]<x1&&b[2]>x0&&b[1]<z1&&b[3]>z0&&b[4]<h&&b[5]>.04;
for(const l of LOCKERS){
 const [x,z]=lockerEntry(l);assert.equal(lockerTarget(Object.assign(newShift(),{x,z:z-.65,yaw:Math.PI}),w.blocks)?.id,l.id,'locker 접근 '+l.id);
 assert.ok(!w.blocks.some(b=>overlap(b,x-.27,z-.35,x+.27,z+.25)),'locker entry clearance '+l.id);
}
let total=0;
for(const {zone,a,b,width} of RUN_LANES){
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]);let clear=0;
 for(let t=.5;t<len-.5;t+=.5){const x=a[0]+(b[0]-a[0])*t/len,z=a[1]+(b[1]-a[1])*t/len;if(!w.blocks.some(q=>overlap(q,x-.35,z-.35,x+.35,z+.35)))clear++;}
 assert.ok(clear>=Math.floor((len-1)/.5)*.85,'run lane '+zone+' '+a);
 total+=len;
}
const s=newShift(()=>.42),markup=mapMarkup(w.blocks,s,[{id:'p',name:'<test>',x:2,z:5,yaw:0}],null);
assert.ok(markup.includes('viewBox="0 0 306 516"')&&markup.includes('&lt;test&gt;')&&!markup.includes('<test>'));
assert.equal((mapMarkers(s).match(/<title>B-/g)||[]).length,30);s.states[0]='DELIVERED';assert.equal((mapMarkers(s).match(/<title>B-/g)||[]).length,29);
assert.ok(w.parts.some(p=>p.m.name==='building-roof-sheet'&&p.pos[1]>12.5));assert.ok(w.blocks.some(b=>b[6]==='shelf'&&b[5]>=8.72));
console.log('PASS full map, locker clearance, surveyed lanes',Math.round(total),'m, elevated roof and shelves');
