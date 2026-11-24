// All scene coordinates are metres. Geometry is shared by every asset factory.
export const vadd=(a,b)=>a.map((n,i)=>n+b[i]);
export const vsub=(a,b)=>a.map((n,i)=>n-b[i]);
export const vmul=(a,s)=>a.map(n=>n*s);
export const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=a=>vmul(a,1/(Math.hypot(...a)||1));
export function basis(rx,ry,rz){
 const a=Math.cos(rx),b=Math.sin(rx),c=Math.cos(ry),d=Math.sin(ry),e=Math.cos(rz),f=Math.sin(rz);
 return [[e*c,f*c,-d],[e*d*b-f*a,f*d*b+e*a,c*b],[e*d*a+f*b,f*d*a-e*b,c*a]];
}
export class World {
 constructor(){this.parts=[];this.materials=new Map();this.blocks=[];this.lights=[];this.shadows=[];}
 mat(name,color,type='metal',emission=0,uvScale=1){
  if(!this.materials.has(name))this.materials.set(name,{name,color,type,emission,uvScale});
  return this.materials.get(name);
 }
 imageMat(name,url){let m=this.mat(name,'#ffffff','image');m.url=url;return m;}
 shape(shape,x,y,z,sx,sy,sz,m,rx=0,ry=0,rz=0){
  this.parts.push({shape,pos:[x,y,z],axes:basis(rx,ry,rz).map((v,i)=>vmul(v,[sx,sy,sz][i])),m});
 }
 box(...a){this.shape('box',...a);}
 cyl(...a){this.shape('cylinder',...a);}
 ball(...a){this.shape('sphere',...a);}
 face(x,y,z,sx,sy,m,rx=0,ry=0,rz=0){this.shape('face',x,y,z,sx,sy,1,m,rx,ry,rz);}
 beam(a,b,width,depth,m){
  const u=unit(vsub(b,a)),right=unit(cross(u,Math.abs(u[2])>.98?[1,0,0]:[0,0,1]));
  this.parts.push({shape:'box',pos:vmul(vadd(a,b),.5),axes:[vmul(right,width),vsub(b,a),vmul(cross(right,u),depth)],m});
 }
 block(...a){this.blocks.push(a);}
 lamp(x,y,z){this.lights.push([x,y,z]);}
 shadow(x,z,width,depth,y=.005){this.shadows.push([x,z,width,depth,y]);}
 sign(x,y,z,w,h,label,bg,fg,ry=0){
  const m=this.mat('sign '+label+bg,'#ffffff','sign');Object.assign(m,{label,bg,fg,aspect:w/h});
  this.face(x,y,z,w,h,m,0,ry,0);
 }
}
export function cameraView(pos,forward){
 const back=vmul(unit(forward),-1),right=unit(cross([0,1,0],back)),up=cross(back,right);
 return new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(pos,right),-dot(pos,up),-dot(pos,back),1]);
}
export function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
}
export function multiply(a,b){let c=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[4*j+i]+=a[4*k+i]*b[4*j+k];return c;}
