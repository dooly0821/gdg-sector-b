// First-person GLB viewmodels. Original gameplay choreography remains authoritative.
import {multiply} from './world.js';
const names=['empty','flashlight','boxcarry'];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const mix=(a,b,t)=>a+(b-a)*t;
const mat=(p=[0,0,0],q=[0,0,0,1],s=1)=>{
 const [x,y,z,w]=q,n=2/(x*x+y*y+z*z+w*w||1);
 return new Float32Array([(1-n*(y*y+z*z))*s,n*(x*y+z*w)*s,n*(x*z-y*w)*s,0,n*(x*y-z*w)*s,(1-n*(x*x+z*z))*s,n*(y*z+x*w)*s,0,n*(x*z+y*w)*s,n*(y*z-x*w)*s,(1-n*(x*x+y*y))*s,0,...p,1]);
};
const lerpQ=(a,b,t)=>{const sign=a.reduce((n,v,i)=>n+v*b[i],0)<0?-1:1;const q=a.map((v,i)=>mix(v,b[i]*sign,t)),len=Math.hypot(...q)||1;return q.map(v=>v/len)};
export function decodeFP(data){
 const d=new DataView(data);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==data.byteLength)throw Error('Invalid FP GLB');
 let j,bin;
 for(let o=12;o+8<=data.byteLength;){const size=d.getUint32(o,true),type=d.getUint32(o+4,true);o+=8;if(o+size>data.byteLength)throw Error('Truncated GLB');if(type===0x4e4f534a)j=JSON.parse(new TextDecoder().decode(new Uint8Array(data,o,size)));if(type===0x004e4942)bin=o;o+=size;}
 if(!j||bin===undefined)throw Error('Missing GLB sections');
 const read=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],c={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],T={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];if(!c||!T||v.byteStride||a.sparse)throw Error('Unsupported FP accessor');return {data:new T(data,bin+(v.byteOffset??0)+(a.byteOffset??0),a.count*c),c};};
 const img=i=>{if(i==null)return null;const image=j.images[j.textures[i].source],v=j.bufferViews[image.bufferView];return new Blob([new Uint8Array(data,bin+(v.byteOffset??0),v.byteLength)],{type:image.mimeType});};
 const materials=j.materials.map(m=>({base:img(m.pbrMetallicRoughness?.baseColorTexture?.index),mr:img(m.pbrMetallicRoughness?.metallicRoughnessTexture?.index),rough:m.pbrMetallicRoughness?.roughnessFactor??1,metal:m.pbrMetallicRoughness?.metallicFactor??1}));
 const meshes=j.meshes.map(m=>m.primitives.map(p=>{const a=p.attributes,positions=read(a.POSITION).data,normals=read(a.NORMAL).data,uv=read(a.TEXCOORD_0).data,indices=read(p.indices).data;if(indices.length%3||normals.length!==positions.length||uv.length/2!==positions.length/3||!indices.every(i=>i<positions.length/3))throw Error('Invalid FP mesh');return {positions,normals,uv,indices,material:p.material};}));
 const clips=new Map((j.animations??[]).map(a=>{const tracks=a.channels.map(c=>{const s=a.samplers[c.sampler],time=read(s.input).data,value=read(s.output);if(!['LINEAR',undefined].includes(s.interpolation))throw Error('Unsupported interpolation');return {node:c.target.node,path:c.target.path,time,value:value.data,c:value.c};});return [a.name,{tracks,duration:Math.max(...tracks.map(t=>t.time[t.time.length-1]))}]}));
 return {materials,meshes,nodes:j.nodes,roots:j.scenes[j.scene??0].nodes,clips};
}
function sample(track,t){
 const {time,value,c,path}=track;let k=0;while(k<time.length-2&&time[k+1]<t)k++;
 const f=clamp((t-time[k])/(time[k+1]-time[k]||1)),a=Array.from(value.subarray(k*c,k*c+c)),b=Array.from(value.subarray((k+1)*c,(k+2)*c));
 return path==='rotation'?lerpQ(a,b,f):a.map((v,i)=>mix(v,b[i],f));
}
export function nodePoses(model,clipName,seconds,loop=true){
 const pose=model.nodes.map(n=>({translation:n.translation??[0,0,0],rotation:n.rotation??[0,0,0,1]})),clip=model.clips.get(clipName);
 if(clip){const t=loop?((seconds%clip.duration)+clip.duration)%clip.duration:clamp(seconds,0,clip.duration);for(const track of clip.tracks)pose[track.node][track.path]=sample(track,t);}
 return pose;
}
export function blendPoses(a,b,t){return a.map((p,i)=>({translation:p.translation.map((v,k)=>mix(v,b[i].translation[k],t)),rotation:lerpQ(p.rotation,b[i].rotation,t)}))}
async function tex(gl,blob,defaultColor){
 const t=gl.createTexture();let bmp=null;
 if(blob)bmp=await createImageBitmap(blob);
 gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
 if(bmp){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bmp);bmp.close();}
 else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(defaultColor));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.generateMipmap(gl.TEXTURE_2D);return t;
}
async function upload(gl,model){
 const materials=[];for(const m of model.materials)materials.push({...m,base:await tex(gl,m.base,[255,255,255,255]),mr:await tex(gl,m.mr,[255,255,255,255])});
 const meshes=model.meshes.map(mesh=>mesh.map(p=>{
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const buffers=[];for(const [i,v,size] of [[0,p.positions,3],[1,p.normals,3],[2,p.uv,2]]){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,0,0);}
  const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,p.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
  return {vao,buffers,count:p.indices.length,type:p.indices instanceof Uint32Array?gl.UNSIGNED_INT:p.indices instanceof Uint8Array?gl.UNSIGNED_BYTE:gl.UNSIGNED_SHORT,material:materials[p.material]};
 }));
 return {...model,materials,meshes};
}
// Source viewmodel faces camera +Z; game's camera also looks along -Z.
// Scale to the existing .446 m carried carton and align its centre to ANCHOR.
const SIZE=.446/.75;
const ROOT=mat([0,-.584+.135*SIZE,-.864+.365*SIZE],[0,0,0,1],SIZE);
const shifted=(m,p)=>multiply(mat(p),m);
export function fpPlan(pose){
 const f=pose.fp;if(!f)return null;
 // Exact contact and vault reach remain with the existing IK path until new
 // assets have finger articulation; simultaneous tool+parcel has no authored model.
 if(f.vault||f.holding&&f.flash>.001)return null;
 if(f.action&&!pose.assembly)return null;
 if(f.action&&pose.assembly){const l=pose.hands.find(h=>h.group===6);if(!l?.matrix)return null;return {name:'boxcarry',matrix:multiply(l.matrix,ROOT),contact:true};}
 if(f.holding){const l=pose.hands.find(h=>h.group===6);return {name:'boxcarry',matrix:shifted(ROOT,l?.offset??[0,0,0]),contact:false};}
 if(f.flash>=.5){return {name:'flashlight',matrix:shifted(ROOT,[f.bob[0],f.bob[1]-.12*(1-smooth((f.flash-.5)/.5)),f.bob[2]]),contact:false};}
 return {name:'empty',matrix:shifted(ROOT,[f.bob[0],f.bob[1]-.05*smooth(f.flash/.5),f.bob[2]]),contact:false};
}
export class FPModels{
 constructor(gl){this.gl=gl;this.models=new Map();this.errors=[];}
 async load(progress=()=>{}){
  for(const [i,name] of names.entries()){
   try{const r=await fetch(new URL('./assets/characters/fp/'+name+'.glb',import.meta.url));if(!r.ok)throw Error('HTTP '+r.status);this.models.set(name,await upload(this.gl,decodeFP(await r.arrayBuffer())));}
   catch(e){this.errors.push({name,error:String(e)});console.warn('GDG FP fallback',name,e);}
   progress((i+1)/names.length,'1인칭 손 모델 준비 중');
  }
 }
 draw(u,pose){
  const plan=fpPlan(pose);if(!plan)return false;const model=this.models.get(plan.name);if(!model)return false;
  const gl=this.gl,f=pose.fp,t=f.t,speed=f.speed,walk=smooth(speed/.8),run=smooth((speed-4.5)/2.5);
  let nodes=nodePoses(model,null,0);
  if(plan.name==='empty')nodes=blendPoses(nodePoses(model,'Empty_Idle',t),blendPoses(nodePoses(model,'Empty_Walk',t),nodePoses(model,'Empty_Run',t),run),walk*.8);
  if(plan.name==='boxcarry'&&!plan.contact)nodes=blendPoses(nodePoses(model,'Carry_Idle',t),nodePoses(model,'Carry_Walk',t),walk*.65);
  // World contact is handled by the existing flight matrix, not duplicated clip motion.
  gl.uniform1i(u.fpActive,1);gl.uniform1i(u.skinActive,0);gl.uniform1i(u.worldObject,1);gl.uniform1f(u.flexAmount,0);gl.uniform1f(u.character,0);gl.uniform1f(u.clay,0);gl.uniform1f(u.actorOpacity,1);gl.uniform3f(u.offset,0,0,0);
  const visit=(i,parent)=>{const n=model.nodes[i],p=nodes[i],m=multiply(parent,mat(p.translation,p.rotation));if(n.mesh!==undefined){gl.uniformMatrix4fv(u.objectMatrix,false,m);for(const b of model.meshes[n.mesh]){const a=b.material;gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,a.base);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,a.mr);gl.uniform2f(u.fpFactors,a.rough,a.metal);gl.bindVertexArray(b.vao);gl.vertexAttrib3f(3,0,0,0);gl.vertexAttrib3f(4,1,0,0);gl.vertexAttrib3f(5,0,1,0);gl.vertexAttrib3f(6,0,0,1);gl.vertexAttrib4f(7,1,1,1,0);gl.vertexAttrib4f(8,0,.2,1,2);gl.drawElements(gl.TRIANGLES,b.count,b.type,0);}}
   for(const child of n.children??[])visit(child,m);};
  for(const root of model.roots)visit(root,plan.matrix);
  gl.uniform1i(u.fpActive,0);gl.uniform1i(u.worldObject,0);gl.activeTexture(gl.TEXTURE0);return true;
 }
}
