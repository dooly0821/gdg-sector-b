import {MESH_DATA} from "./viewmodel-mesh-data.js";
export const customShapes=Object.keys(MESH_DATA);
const cache=new Map();
export function registerGeometry(shape,vertices){cache.set(shape,vertices);}
export function geometry(shape){
 if(cache.has(shape))return cache.get(shape);
 if(MESH_DATA[shape]){if(!cache.has(shape)){const raw=atob(MESH_DATA[shape]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const packed=new Int16Array(bytes.buffer),out=new Float32Array(packed.length);for(let i=0;i<packed.length;i++)out[i]=packed[i]/(i%8<3?20000:i%8<6?32767:1000);cache.set(shape,out);}return cache.get(shape);}

 let v=[];const vert=(p,n,u)=>v.push(...p,...n,...u);
 function quad(a,b,c,d,n){vert(a,n,[0,0]);vert(b,n,[1,0]);vert(c,n,[1,1]);vert(a,n,[0,0]);vert(c,n,[1,1]);vert(d,n,[0,1]);}
 const h=.5;
 if(shape==='box'||shape==='face'){
  const z=shape==='face'?0:h;
  quad([-h,-h,z],[h,-h,z],[h,h,z],[-h,h,z],[0,0,1]);
  if(shape==='box'){
   quad([h,-h,-h],[-h,-h,-h],[-h,h,-h],[h,h,-h],[0,0,-1]);
   quad([h,-h,h],[h,-h,-h],[h,h,-h],[h,h,h],[1,0,0]);
   quad([-h,-h,-h],[-h,-h,h],[-h,h,h],[-h,h,-h],[-1,0,0]);
   quad([-h,h,h],[h,h,h],[h,h,-h],[-h,h,-h],[0,1,0]);
   quad([-h,-h,-h],[h,-h,-h],[h,-h,h],[-h,-h,h],[0,-1,0]);
  }
 }else if(shape==='forearm'){
  // Loft the wrist and forearm along a continuous profile, with a fuller
  // outer forearm and a narrower, flattened transition into the palm.
  const rings=[[-.5,.76],[-.43,.98],[-.22,1.0],[.03,.93],[.25,.76],[.43,.64],[.5,.57]];
  const segments=20;
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
   const at=(k,r)=>{const a=k/segments*2*Math.PI,[y,rad]=rings[r],prev=rings[Math.max(0,r-1)],next=rings[Math.min(rings.length-1,r+1)],slope=(next[1]-prev[1])/(next[0]-prev[0]);
    const x=Math.cos(a),z=Math.sin(a),n=[x,-slope*.25,z],length=Math.hypot(...n);vert([x*rad,y,z*rad],n.map(v=>v/length),[k/segments,y+.5]);};
   at(i,j);at(i,j+1);at(i+1,j);at(i+1,j);at(i,j+1);at(i+1,j+1);
  }
 }else if(shape==='sphere'){
  const nx=18,ny=12;
  const s=(i,j)=>{let a=i/nx*Math.PI*2,b=(j/ny-.5)*Math.PI,p=[Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)];vert(p,p,[i/nx,j/ny]);};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){s(i,j);s(i,j+1);s(i+1,j);s(i+1,j);s(i,j+1);s(i+1,j+1);}
 }else{
  const count=20;
  for(let i=0;i<count;i++){let a=i/count*2*Math.PI,b=(i+1)/count*2*Math.PI;
   const side=(t,y,u)=>{let n=[Math.cos(t),0,Math.sin(t)];vert([n[0],y,n[2]],n,[u,y+.5]);};
   side(a,-h,0);side(a,h,0);side(b,-h,1);side(b,-h,1);side(a,h,0);side(b,h,1);
   for(let q of [-1,1]){let n=[0,q,0];vert([0,q*h,0],n,[.5,.5]);for(let t of (q===1?[b,a]:[a,b])){let x=Math.cos(t),z=Math.sin(t);vert([x,q*h,z],n,[x*.5+.5,z*.5+.5]);}}
  }
 }
 return new Float32Array(v);
}
