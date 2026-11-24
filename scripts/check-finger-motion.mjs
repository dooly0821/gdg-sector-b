import assert from 'node:assert/strict';
import {MESH_DATA,FINGER_FLEX} from '../dist/viewmodel-mesh-data.js';
// Same two serial joints as the WebGL and fallback vertex paths.
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function bend(p,f,amount){p=p.slice();for(const joint of [.006,.046]){const rel=p.map((v,i)=>v-f.pivot[i]-f.forward[i]*joint),z=dot(rel,f.forward),y=dot(rel,f.normal),w=dot(rel,f.width),a=amount*(joint===.006?.55:.45)*smooth(z/.018)*(1+.2*Math.max(-1,Math.min(1,w/.05))),c=Math.cos(a),s=Math.sin(a);p=p.map((v,i)=>v+f.forward[i]*(z*c+y*s-z)+f.normal[i]*(y*c-z*s-y));}return p;}
let n=0;
for(const pose of ['emptyL','emptyR']){const f=FINGER_FLEX[pose];for(const [name,data] of Object.entries(MESH_DATA)){if(!name.startsWith(`vm_${pose}_glove`))continue;const b=Buffer.from(data,'base64');for(let i=0;i<b.length;i+=16*13){const p=[0,2,4].map(k=>b.readInt16LE(i+k)/20000);let prev;for(let j=0;j<=60;j++){const q=bend(p,f,-.104+j*.004);assert.ok(q.every(Number.isFinite));if(dot(p.map((v,i)=>v-f.pivot[i]),f.forward)<=.006)assert.deepEqual(q,p,'palm stays fixed');if(prev)assert.ok(Math.hypot(...q.map((v,i)=>v-prev[i]))<.001,'continuous joint motion');prev=q;n++;}}}}
console.log(`PASS: ${n} joint samples: fixed palm, finite continuous two-joint motion`);
