import {prepareFingerBend} from './hand-motion.js';
// Perspective-correct, depth-buffered CPU rasterizer for systems without WebGL 2.
// It consumes exactly the same scene instances, carton UVs, camera and mission.
import {geometry} from './geometry.js';
import {cameraView,perspective,multiply,unit,dot,cross} from './world.js';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),toRGB=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);
function sourceSign(m){const c=document.createElement('canvas');c.width=512;c.height=Math.max(64,Math.round(512/m.aspect));const g=c.getContext('2d');g.fillStyle=m.bg;g.fillRect(0,0,512,c.height);g.strokeStyle=m.fg;g.lineWidth=2;g.strokeRect(5,5,502,c.height-10);g.font='bold '+Math.floor(c.height*.62)+'px Arial';g.fillStyle=m.fg;g.textAlign='center';g.textBaseline='middle';g.fillText(m.label,256,c.height*.52,470);return c;}
async function tex(key,m){
 let im;if(m?.type==='sign')im=sourceSign(m);else if(key!=='plain'){im=new Image();im.src=m?.url||'assets/mat-'+key+'.webp';await im.decode();}
 const levels=[],c=document.createElement('canvas'),g=c.getContext('2d',{willReadFrequently:true});
 for(let n=m?.name==='building-slab'?2048:key==='concrete'||m?.url?512:256;n>=1;n>>=1){c.width=c.height=n;if(im){g.translate(0,n);g.scale(1,-1);g.drawImage(im,0,0,n,n);}else{g.fillStyle='#fff';g.fillRect(0,0,n,n);}levels.push({n,p:new Uint32Array(g.getImageData(0,0,n,n).data.buffer)});}
 return levels;
}
const MESH={};for(let k of ['box','face','sphere','cylinder','forearm'])MESH[k]=geometry(k);
// Smaller curved meshes for the portable renderer use the same proportions.
function curveMesh(shape,lon,lat){let out=[];const p=(x,y)=>{let a=x/lon*2*Math.PI,b=(y/lat-.5)*Math.PI,px=Math.cos(a)*Math.cos(b),py=Math.sin(b),pz=Math.sin(a)*Math.cos(b);out.push(px,py,pz,px,py,pz,x/lon,y/lat);};if(shape==='sphere')for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){p(x,y);p(x,y+1);p(x+1,y);p(x+1,y);p(x,y+1);p(x+1,y+1);}return out;}
MESH.sphere=curveMesh('sphere',12,8);
const VERT=10; // position, normal, uv, material-light multiplier and reserved
function shadowField(parts){
 const n=9,W=320,H=440,values=new Float32Array(W*H);values.fill(-10);
 for(const o of parts){if(o.shape==='face'||o.pos[1]>6.1||o.m.emission>.05||/slab|wall|roof|traffic|joint/.test(o.m.name))continue;
  let rad=[0,1,2].map(j=>o.axes.reduce((s,a,i)=>s+Math.abs(a[j])*((o.shape==='sphere'||o.shape==='cylinder'&&i!==1)?1:.5),0));
  let t=o.pos[1]+rad[1],cx=o.pos[0]-.24*t,cz=o.pos[2]+.18*t;
  if(rad[0]<.07||rad[2]<.07)continue;
  let x0=clamp(Math.floor((cx-rad[0]+17)*n),0,W-1),x1=clamp(Math.ceil((cx+rad[0]+17)*n),0,W-1),z0=clamp(Math.floor((cz-rad[2]+24)*n),0,H-1),z1=clamp(Math.ceil((cz+rad[2]+24)*n),0,H-1);
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){let i=z*W+x;if(values[i]<t)values[i]=t;}
 }
 return (x,y,z)=>{let sx=Math.floor((x-.24*y+17)*n),sz=Math.floor((z+.18*y+24)*n),a=0;for(let j=-2;j<=2;j+=2)for(let i=-2;i<=2;i+=2)a+=Number((values[(sz+j)*W+sx+i]||0)>y+.16);return 1-a/9;};
}
function vertexLight(P,n,m,lights,shadow,hand){
 const [x,y,z]=P,v=shadow(x,y,z),k=(n[1]+1)*.5;
 if(hand){let d=Math.max(0,dot(n,[-.53,.75,.39])),r=Math.max(0,dot(n,[.8,.25,-.4]));const h=unit(unit(P.map(v=>-v)).map((v,i)=>v+[-.53,.75,.39][i])),spec=/vm_(metal|rim)/.test(m.name)?Math.pow(Math.max(0,dot(n,h)),18)*2:0;return [.48+.74*d+.15*r+m.emission+spec,.49+.65*d+.17*r+m.emission+spec,.55+.51*d+.24*r+m.emission+spec];}
 let L=[.065+.135*k,.075+.155*k,.10+.19*k],di=Math.max(0,dot(n,[.37,.87,-.30]))*(.24+.76*v);
 L[0]+=.085*di;L[1]+=.105*di;L[2]+=.145*di;
 for(const [lx,ly,lz,red=0] of lights){let dx=lx-x,dy=ly-y,dz=lz-z,ds=dx*dx+dy*dy+dz*dz,inv=1/Math.sqrt(ds+.01),cone=clamp((dy*inv+.04)/.85,0,1);
  let f=(red?32:14)/(ds+7)*cone*cone*(3-2*cone)*(.13+.87*Math.max(0,(dx*n[0]+dy*n[1]+dz*n[2])*inv))*(.29+.71*v);
  L[0]+=f;L[1]+=(red?.075:.72)*f;L[2]+=(red?.035:.44)*f;
 }return L.map(a=>a+m.emission);
}
function meshPart(o,texs,lights,shadow,hand,idx){
 const {pos,axes,m,shape}=o,sc=axes.map(a=>Math.hypot(...a)),kind=m.type,cart=kind==='carton',fit=cart||kind==='image'||kind==='sign';
 let color=toRGB(m.color);if(cart)color=color.map(v=>.84+.16*v);
 let texture=texs.get(cart?'carton'+idx%6:kind==='image'?m.url:kind==='sign'?m.name:kind)||texs.get('plain'),topMat=cart?texs.get('cartontop'+idx%6):texture;
 const vec=[],tris=[],tids=[],map=new Map();const uvScale=m.uvScale*({concrete:.27,metal:.65,wood:1.3,cardboard:1.2,paint:.75,cloth:5}[kind]??1);
 function vertex(p,n,uv){
  const key=p.map(v=>v.toFixed(5)).join('/')+n.map(v=>v.toFixed(3)).join('/')+uv.map(v=>v.toFixed(4)).join('/');if(map.has(key))return map.get(key);
  const P=pos.map((v,i)=>v+axes.reduce((s,a,j)=>s+a[i]*p[j],0)),N=unit([0,1,2].map(i=>axes.reduce((s,a,j)=>s+a[i]*n[j]/(sc[j]*sc[j]),0)));
  const uvsize=Math.abs(n[1])>.7?[sc[0],sc[2]]:Math.abs(n[0])>.7?[sc[2],sc[1]]:sc;
  const st=fit?uv:uv.map((v,j)=>v*uvsize[j]*uvScale+(j?pos[0]*.31+pos[1]*.62+pos[2]*.14:pos[0]*.13+pos[1]*.23+pos[2]*.72));
  const lit=vertexLight(P,N,m,lights,shadow,hand),i=vec.length/8;vec.push(...P,...st,...color.map((v,j)=>v*lit[j]));map.set(key,i);return i;
 }
 const mesh=MESH[shape]??(MESH[shape]=geometry(shape)),get=(i,j)=>Array.from(mesh.slice(i*8+j,i*8+j+(j===6?2:3)));
 if((shape==='box'||shape==='face')&&Math.max(...sc)>4){
  for(let f=0;f<mesh.length/48;f++){let b=f*6,A=get(b,0),B=get(b+1,0),D=get(b+5,0),norm=get(b,3);
   let dx=B.map((v,i)=>v-A[i]),dy=D.map((v,i)=>v-A[i]);
   const nx=clamp(Math.ceil(Math.hypot(...dx.map((v,i)=>v*sc[i]))/1.15),1,48),ny=clamp(Math.ceil(Math.hypot(...dy.map((v,i)=>v*sc[i]))/1.15),1,48);
   const grid=[];for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){let u=x/nx,v=y/ny;grid.push(vertex(A.map((a,i)=>a+u*dx[i]+v*dy[i]),norm,[u,v]));}
   for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let a=y*(nx+1)+x;tris.push(grid[a],grid[a+1],grid[a+nx+2],grid[a],grid[a+nx+2],grid[a+nx+1]);tids.push(0,0);}
  }
 }else for(let i=0;i<mesh.length/8;i++){tris.push(vertex(get(i,0),get(i,3),get(i,6)));if(i%3===0)tids.push(cart&&mesh[i*8+4]>.75?1:0);}
 return {p:new Float32Array(vec),tri:new Uint32Array(tris),ti:new Uint8Array(tids),tex:[texture,topMat],c:o.meshBounds?.center??pos,r:o.meshBounds?.radius??Math.hypot(...sc)*(shape==='box'?.5:1),buf:new Float32Array(vec.length),shape};
}
function mixv(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t);}
export class SoftwareRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('This browser cannot open a drawing surface. Please use desktop Chrome.');this.quality='BALANCED';}
 async prepare(worlds,progress=()=>{}){
  let wanted=new Map();for(let s of ['plain','concrete','paint','metal','wood','rubber','cardboard','skin','cloth'])wanted.set(s,null);
  for(let i=0;i<6;i++){wanted.set('carton'+i,null);wanted.set('cartontop'+i,null);}
  for(let w of worlds)for(let m of w.materials.values())if(m.type==='image'||m.type==='sign')wanted.set(m.url||m.name,m);
  let decoded=0,built=0;const total=worlds.reduce((sum,w)=>sum+w.parts.length,0);
  const textures=new Map(await Promise.all([...wanted].map(async ([k,m])=>{
   const result=await tex(k,m);progress(.40*++decoded/wanted.size,'재질과 표지 읽는 중');return [k,result];
  })));
  this.lights=worlds[0].lights;const shadow=shadowField(worlds[0].parts);let n=0;this.groups=[];
  for(let i=0;i<worlds.length;i++){const items=[];for(let j=0;j<worlds[i].parts.length;j++){let o=worlds[i].parts[j];items.push(meshPart(o,textures,worlds[0].lights,shadow,i>=2,o.m.type==='carton'?n++:0));built++;if(built%200===0){progress(.4+.56*built/total,"창고 메시 준비 중");await new Promise(resolve=>setTimeout(resolve,0));}}this.groups.push(items);}
 }
 setQuality(q){this.quality=q;}
 render(eye,forward,parcels,pose,scale){
  const c=this.canvas,base={HIGH:1100,BALANCED:760,PERFORMANCE:520}[this.quality],w=Math.max(80,Math.floor(Math.min(base,c.clientWidth)*scale)),h=Math.max(60,Math.round(w*c.clientHeight/c.clientWidth));
  if(c.width!==w||c.height!==h||!this.image){c.width=w;c.height=h;this.image=this.ctx.createImageData(w,h);this.pixels=new Uint32Array(this.image.data.buffer);this.zbuffer=new Float32Array(w*h);}
  this.f=h/(2*Math.tan(78*Math.PI/360));this.w=w;this.h=h;this.pixels.fill(0xff100b09);this.zbuffer.fill(0);
  const cam=cameraView(eye,forward);this.vp=multiply(perspective(78*Math.PI/180,w/h,.045,95),cam);
  const draw=(group,offset,view,arms,flex)=>{for(let mesh of this.groups[group])this.drawMesh(mesh,offset,view,arms,mesh.shape.includes("_glove_")?flex:null);};
  draw(0,[0,0,0],cam,false);for(let off of parcels)draw(1,off,cam,false);
  for(const actor of pose.actors??[])draw(actor.group,[0,0,0],multiply(cam,actor.matrix),false);
  if(pose.flight&&!pose.assembly)draw(1,[0,0,0],multiply(cam,pose.flight),false);
  this.glow(cam);if(pose.flashlight>0)this.torch(pose.flashlight,pose.torchOffset,pose.torchLocal);const local=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);for(const layer of pose.hands)draw(layer.group,layer.offset,layer.matrix??local,true,layer.flex);this.ctx.putImageData(this.image,0,0);
 }
 // Depth-based fallback spotlight: illuminate visible geometry, not a flat HUD overlay.
 torch(power,off=[0,0,0],local={position:[.325,-.283,-.887],direction:[-.045,-.025,-1]}){
  const w=this.w,h=this.h,F=this.f;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let i=y*w+x,iz=this.zbuffer[i];if(iz<=0)continue;
   const z=1/iz-.12,dx=(x-w*.5)/(F*iz)-(local.position[0]+off[0])*.3,dy=(h*.5-y)/(F*iz)-(local.position[1]+off[1])*.3,d=Math.hypot(dx,dy,z);if(z<=0)continue;
   const cone=clamp(((local.direction[0]*dx+local.direction[1]*dy-local.direction[2]*z)/Math.max(.001,d)-.87)/.105,0,1);const k=power*cone*cone*(3-2*cone)*Math.min(1.5,13/(d*d+2.5));if(k<.002)continue;
   let v=this.pixels[i],r=Math.min(255,(v&255)*(1+k)+12*k),g=Math.min(255,(v>>>8&255)*(1+k*.88)+10*k),b=Math.min(255,(v>>>16&255)*(1+k*.67)+7*k);this.pixels[i]=0xff000000|(b<<16)|(g<<8)|r;
  }
 }
 glow(V){
  const F=this.f,W=this.w,H=this.h;
  for(const [x,y,z,red=0] of this.lights){
   const d=-(V[2]*x+V[6]*y+V[10]*z+V[14]);if(d<.3)continue;
   const cx=W*.5+F*(V[0]*x+V[4]*y+V[8]*z+V[12])/d,cy=H*.5-F*(V[1]*x+V[5]*y+V[9]*z+V[13])/d;
   const radius=Math.min(W*.22,F*1.30/d),iz=1/(d-.12),size=radius*radius;
   for(let py=Math.max(0,Math.floor(cy-radius));py<=Math.min(H-1,cy+radius);py++)for(let px=Math.max(0,Math.floor(cx-radius));px<=Math.min(W-1,cx+radius);px++){
    let i=py*W+px;if(this.zbuffer[i]>iz)continue;let q=((px-cx)**2+(py-cy)**2)/size;if(q>=1)continue;
    let a=(1-q)**3*.16+Math.exp(-14*q)*.20,v=this.pixels[i],r=Math.min(255,(v&255)+a*245),g=Math.min(255,(v>>>8&255)+a*(red?20:179)),b=Math.min(255,(v>>>16&255)+a*(red?12:99));
    this.pixels[i]=0xff000000|(b<<16)|(g<<8)|r;
   }
  }
 }
 drawMesh(m,off,V,arms,flex){
  let ox=dot(off,[V[0],V[4],V[8]])+V[12],oy=dot(off,[V[1],V[5],V[9]])+V[13],oz=dot(off,[V[2],V[6],V[10]])+V[14];
  const [a,b,c]=m.c,d=-(V[2]*a+V[6]*b+V[10]*c+oz),xx=V[0]*a+V[4]*b+V[8]*c+ox,yy=V[1]*a+V[5]*b+V[9]*c+oy;
  if(d+m.r<.055||Math.abs(xx)>Math.max(0,d)*this.w/(2*this.f)+m.r*2.3||Math.abs(yy)>Math.max(0,d)*this.h/(2*this.f)+m.r*1.7||m.r*this.f/Math.max(1,d)<.75)return;
  const p=m.p,s=m.buf,F=this.f,W=this.w*.5,H=this.h*.5;
  const bend=prepareFingerBend(flex);
  for(let i=0;i<p.length;i+=8){let x=p[i],y=p[i+1],z=p[i+2];if(bend)[x,y,z]=bend([x,y,z]);const Z=-(V[2]*x+V[6]*y+V[10]*z+oz);
   s[i]=(V[0]*x+V[4]*y+V[8]*z+ox);s[i+1]=(V[1]*x+V[5]*y+V[9]*z+oy);s[i+2]=Z;
   const iz=1/Math.max(.045,Z);s[i+3]=W+F*s[i]*iz;s[i+4]=H-F*s[i+1]*iz;s[i+5]=iz;
  }
  for(let j=0;j<m.tri.length;j+=3){let ia=m.tri[j]*8,ib=m.tri[j+1]*8,ic=m.tri[j+2]*8;
   const za=s[ia+2],zb=s[ib+2],zc=s[ic+2];if(za<.045&&zb<.045&&zc<.045)continue;
   const tx=m.tex[m.ti[j/3]];
   if(Math.min(za,zb,zc)<.045){
    const verts=[ia,ib,ic].map(i=>[s[i],s[i+1],s[i+2],p[i+3],p[i+4],p[i+5],p[i+6],p[i+7]]);
    let poly=[];for(let k=0;k<3;k++){let a=verts[k],b=verts[(k+1)%3];if(a[2]>=.045)poly.push(a);if((a[2]>=.045)!==(b[2]>=.045))poly.push(mixv(a,b,(.045-a[2])/(b[2]-a[2])));}
    for(let k=1;k<poly.length-1;k++){const pp=[poly[0],poly[k],poly[k+1]].flat(),ss=new Float32Array(24);for(let i=0;i<24;i+=8){let q=1/pp[i+2];ss[i+3]=W+pp[i]*F*q;ss[i+4]=H-pp[i+1]*F*q;ss[i+5]=q;}this.triangle(ss,pp,0,8,16,tx,arms);}
   }else this.triangle(s,p,ia,ib,ic,tx,arms);
  }
 }
 triangle(s,p,a,b,c,tex,arms){
  const ax=s[a+3],ay=s[a+4],bx=s[b+3],by=s[b+4],cx=s[c+3],cy=s[c+4],area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  if(area>-.025)return;const W=this.w,H=this.h,x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(W-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(H-1,Math.floor(Math.max(ay,by,cy)-.5));if(x0>x1||y0>y1)return;
  const ibx=(cy-ay)/area,iby=(ax-cx)/area,icx=(ay-by)/area,icy=(bx-ax)/area,iz0=s[a+5],iz1=s[b+5],iz2=s[c+5];
  const u0=p[a+3],u1=p[b+3],u2=p[c+3],v0=p[a+4],v1=p[b+4],v2=p[c+4];
  const density=Math.max(Math.abs((u1-u0)*ibx+(u2-u0)*icx),Math.abs((v1-v0)*ibx+(v2-v0)*icx),Math.abs((u1-u0)*iby+(u2-u0)*icy),Math.abs((v1-v0)*iby+(v2-v0)*icy));
  const t=tex[clamp(Math.floor(Math.log2(Math.max(1,density*tex[0].n))+.1),0,tex.length-1)],n=t.n,mask=n-1,im=t.p;
  const zbuf=this.zbuffer,img=this.pixels;
  const ur=u0*iz0*n,vr=v0*iz0*n,ub=u1*iz1*n-ur,uc=u2*iz2*n-ur,vb=v1*iz1*n-vr,vc=v2*iz2*n-vr;
  const r0=p[a+5],g0=p[a+6],b0=p[a+7],rb=p[b+5]-r0,rc=p[c+5]-r0,gb=p[b+6]-g0,gc=p[c+6]-g0,bb=p[b+7]-b0,bc=p[c+7]-b0;
  let fog=arms?0:Math.min(.39,1-Math.exp(-.03/(iz0+iz1+iz2))),clear=1-fog;
  for(let y=y0;y<=y1;y++){let wb=(x0+.5-ax)*ibx+(y+.5-ay)*iby,wc=(x0+.5-ax)*icx+(y+.5-ay)*icy;
   for(let x=x0,idx=y*W+x0;x<=x1;x++,idx++,wb+=ibx,wc+=icx){if(wb<-.00004||wc<-.00004||wb+wc>1.00004)continue;let iz=iz0+wb*(iz1-iz0)+wc*(iz2-iz0);if(iz<=zbuf[idx])continue;
    let z=1/iz,uvx=Math.floor((ur+ub*wb+uc*wc)*z)&mask,uvy=Math.floor((vr+vb*wb+vc*wc)*z)&mask,px=im[uvy*n+uvx];if((px>>>24)<100)continue;
    let r=Math.min(255,(px&255)*(r0+rb*wb+rc*wc)*clear+9*fog),g=Math.min(255,((px>>>8)&255)*(g0+gb*wb+gc*wc)*clear+11*fog),bl=Math.min(255,((px>>>16)&255)*(b0+bb*wb+bc*wc)*clear+15*fog);
    img[idx]=0xff000000|((bl|0)<<16)|((g|0)<<8)|(r|0);zbuf[idx]=iz;
   }
  }
 }
 project(pt){const v=this.vp,p=[...pt,1],c=[0,1,2,3].map(i=>p.reduce((s,x,j)=>s+x*v[j*4+i],0));return c[3]>.05?[c[0]/c[3],c[1]/c[3]]:null;}
}
