// Authored surface tools for the warehouse creatures. All coordinates are metres.
// A mesh batch shares one material and one joint, so fine detail does not cost a draw per part.
import {cross,dot,unit,vadd,vsub,vmul} from './world.js';

const between=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const sample=(points,t)=>{
 const k=Math.min(points.length-2,Math.floor(t)),u=t-k;
 const [a,b,c,d]=[-1,0,1,2].map(i=>points[Math.max(0,Math.min(points.length-1,k+i))]);
 return b.map((v,i)=>.5*(2*v+(-a[i]+c[i])*u+(2*a[i]-5*v+4*c[i]-d[i])*u*u+(-a[i]+3*v-3*c[i]+d[i])*u*u*u));
};
const identity=[[1,0,0],[0,1,0],[0,0,1]];
export class Sculpt {
 constructor(){this.batches=new Map();}
 vertex(material,p,n,uv){
  if(!this.batches.has(material))this.batches.set(material,[]);
  this.batches.get(material).push(...p,...n,...uv);
 }
 tri(material,a,b,c,uv=[[0,0],[1,0],[1,1]]){
  const n=unit(cross(vsub(b,a),vsub(c,a)));
  for(const [i,p] of [a,b,c].entries())this.vertex(material,p,n,uv[i]);
 }
 quad(m,a,b,c,d,uv=[[0,0],[1,0],[1,1],[0,1]]){
  this.tri(m,a,b,c,[uv[0],uv[1],uv[2]]);this.tri(m,a,c,d,[uv[0],uv[2],uv[3]]);
 }
 // Variable radial sections interpolated along the centre line. Offset folds are sculpted in the surface.
 sweep(m,sections,{sides=16,steps=4,fold=.05,axis=[0,0,1]}={}){
  const rows=(sections.length-1)*steps,end=sections.length-1;
  // Transport the cross-section along the centreline. Re-selecting a world
  // axis at each ring can twist the cross-section around a curved fingertip.
  let previous;
  const rings=Array.from({length:rows+1},(_,j)=>{
   const t=j/steps,p=sample(sections,t);
   const tangent=unit(vsub(sample(sections,Math.min(end,t+.01)).slice(0,3),sample(sections,Math.max(0,t-.01)).slice(0,3)));
   const u=previous?unit(vsub(previous,vmul(tangent,dot(previous,tangent)))):
    unit(cross(tangent,Math.abs(dot(tangent,axis))>.98?[0,1,0]:axis));
   const v=cross(tangent,u);previous=u;
   return Array.from({length:sides},(_,i)=>{
    const a=i/sides*Math.PI*2,wave=1+fold*(Math.sin(a*5+t*1.6)+.44*Math.cos(a*9-t*2.2));
    return vadd(p.slice(0,3),vadd(vmul(u,Math.cos(a)*Math.max(.0003,p[3])*wave),vmul(v,Math.sin(a)*Math.max(.0003,p[4])*wave)));
   });
  });
  const grid=rings.map((ring,j)=>Array.from({length:sides+1},(_,i)=>{
   const k=i%sides,du=vsub(ring[(k+1)%sides],ring[(k+sides-1)%sides]);
   const dv=vsub(rings[Math.min(rows,j+1)][k],rings[Math.max(0,j-1)][k]);
   return [ring[k],unit(cross(du,dv)),[i/sides*2,j/rows*2]];
  }));
  for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
   for(const v of [grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j][i],grid[j+1][i+1],grid[j+1][i]])this.vertex(m,...v);
  }
 }
 // Curved and torn two-sided card, canvas, or tape. UVs follow the fibre direction along the strip.
 strip(m,left,right,{edge=m,thickness=.004}={}){
  for(let i=0;i<left.length-1;i++){
   const a=left[i],b=right[i],c=right[i+1],d=left[i+1];
   const delta=[0,0,thickness],A=vsub(a,delta),B=vsub(b,delta),C=vsub(c,delta),D=vsub(d,delta);
   const t=i/(left.length-1),u=(i+1)/(left.length-1);
   this.quad(m,a,b,c,d,[[0,t],[1,t],[1,u],[0,u]]);
   this.quad(m,B,A,D,C,[[1,t],[0,t],[0,u],[1,u]]);
   this.quad(edge,A,a,d,D);this.quad(edge,b,B,C,c);
   if(i===0)this.quad(edge,A,B,b,a);
   if(i===left.length-2)this.quad(edge,d,c,C,D);
  }
 }
 panel(m,outline,{edge=m,thickness=.018}={}){
  const center=outline.reduce((sum,p)=>vadd(sum,vmul(p,1/outline.length)),[0,0,0]);
  const n=unit(cross(vsub(outline[1],outline[0]),vsub(outline[2],outline[1])));
  const back=vmul(n,-thickness);
  const u=unit(vsub(outline[1],outline[0])),v=unit(cross(n,u));
  const span=[u,v].map(axis=>Math.max(...outline.map(p=>Math.abs(dot(vsub(p,center),axis))))||1);
  const uv=p=>[u,v].map((axis,i)=>.5+.49*dot(vsub(p,center),axis)/span[i]);
  for(let i=0;i<outline.length;i++){
   const a=outline[i],b=outline[(i+1)%outline.length],c=vadd(a,back),d=vadd(b,back);
   this.tri(m,center,a,b,[uv(center),uv(a),uv(b)]);
   this.tri(m,vadd(center,back),d,c,[uv(center),uv(b),uv(a)]);
   this.quad(edge,a,c,d,b);
  }
 }
 ellipsoid(m,[x,y,z],[rx,ry,rz],fold=.035){
  const sections=Array.from({length:9},(_,i)=>{
   const a=(i/8-.5)*Math.PI,k=Math.cos(a);
   return [x,y+Math.sin(a)*ry,z,k*rx,k*rz];
  });
  this.sweep(m,sections,{steps:2,fold});
 }
 ring(m,c,r1,r2,tube,{axis=[0,0,1],segments=28}={}){
  const u=unit(cross(axis,Math.abs(axis[1])>.9?[0,0,1]:[0,1,0])),v=cross(axis,u);
  const at=(i,j)=>{
   const a=i/segments*Math.PI*2,b=j/8*Math.PI*2;
   const n=vadd(vmul(u,Math.cos(a)*Math.cos(b)),vadd(vmul(v,Math.sin(a)*Math.cos(b)),vmul(axis,Math.sin(b))));
   const p=vadd(c,vadd(vmul(u,Math.cos(a)*r1),vmul(v,Math.sin(a)*r2)));
   return [vadd(p,vmul(n,tube)),n,[i/segments*3,j/8]];
  };
  for(let i=0;i<segments;i++)for(let j=0;j<8;j++){
   for(const k of [at(i,j),at(i+1,j),at(i+1,j+1),at(i,j),at(i+1,j+1),at(i,j+1)])this.vertex(m,...k);
  }
 }
 layers(prefix,register){
  return [...this.batches].map(([m,vertices],i)=>{
   const shape=prefix+'_'+i;
   register(shape,new Float32Array(vertices));
   const min=[Infinity,Infinity,Infinity],max=min.map(v=>-v);
   for(let j=0;j<vertices.length;j+=8)for(let k=0;k<3;k++){
    min[k]=Math.min(min[k],vertices[j+k]);max[k]=Math.max(max[k],vertices[j+k]);
   }
   return {shape,pos:[0,0,0],axes:identity,m,meshBounds:{center:between(min,max,.5),radius:Math.hypot(...vsub(max,min))*.5}};
  });
 }
}
