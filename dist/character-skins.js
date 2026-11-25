// Runtime for the five GDG authored GLBs. Existing procedural actors remain a per-model fallback.
import {basis,multiply} from './world.js';
export const SKIN_NAMES=['ghost','boxhead','imp','wraith','player'];
const count=15,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const trs=(p,angles)=>new Float32Array([...basis(...angles).flatMap(a=>[...a,0]),...p,1]);
export function skinMatrices(rig,angles){
 const out=[],flat=new Float32Array(count*16);
 for(let i=0;i<count;i++){
  const parent=rig.parents[i],p=rig.pivots[i];
  const m=multiply(trs(p,angles[i]??[0,0,0]),trs(p.map(x=>-x),[0,0,0]));
  out[i]=parent<0?m:multiply(out[parent],m);
  flat.set(out[i],16*i);
 }
 return flat;
}
export function playerAngles(state){
 const a=Array.from({length:count},()=>[0,0,0]),speed=clamp((state.speed??0)/7,0,1),t=(state.steps??0)*4.9,s=Math.sin(t),c=Math.cos(t),stride=s*speed*.43,crouch=clamp((1.7-(state.bodyHeight??1.7))/.64,0,1);
 a[0]=[.065*speed+.10*crouch,0,.04*s*speed];a[1]=[-.04*crouch,0,-.04*s*speed];
 a[4]=[stride-.25*crouch,0,.025];a[5]=[-stride-.25*crouch,0,-.025];a[8][0]=.42*Math.max(0,-s)*speed+.38*crouch;a[9][0]=.42*Math.max(0,s)*speed+.38*crouch;
 a[13][0]=-a[8][0]*.55;a[14][0]=-a[9][0]*.55;
 a[2][0]=-stride*.64;a[3][0]=stride*.64;a[6][0]=-.12-.08*c*speed;a[7][0]=-.12+.08*c*speed;
 if(state.carried>=0){a[2]=[-.50,0,-.08];a[3]=[-.50,0,.08];a[6][0]=-.58;a[7][0]=-.58;}
 if(state.vault){a[0][0]=.20;a[2][0]=-.70;a[3][0]=-.70;a[6][0]=-.35;a[7][0]=-.35;a[4][0]=-.30;a[5][0]=.25;a[8][0]=.55;a[9][0]=.28;}
 for(let i=2;i<count;i++)for(let k=0;k<3;k++)a[i][k]*=.58;
 a[0][0]*=.70;
 return a;
}
export function creatureAngles(kind,input){
 const a=Array.from({length:count},(_,i)=>(input[i]??[0,0,0]).map(x=>Number.isFinite(x)?x:0));
 const float=kind===0||kind===3,strength=[.58,.46,.32,.59][kind]??.46;
 for(let i=0;i<count;i++)for(let k=0;k<3;k++)a[i][k]=clamp(a[i][k]*strength,-.85,.85);
 a[1][2]=clamp(a[1][2],-.33,.33);a[0][0]=clamp(a[0][0],-.26,.36);
 if(float){for(const i of [4,5,8,9,13,14])a[i]=[0,0,0];a[12][2]*=1.15;}
 else {a[13][0]=-a[8][0]*.55;a[14][0]=-a[9][0]*.55;}
 return a;
}
export function decodeGLB(data){
 const d=new DataView(data);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==data.byteLength)throw Error('Invalid GLB');
 let j,bin;
 for(let o=12;o+8<=data.byteLength;){const n=d.getUint32(o,true),kind=d.getUint32(o+4,true);o+=8;if(o+n>data.byteLength)throw Error('Truncated GLB');if(kind===0x4e4f534a)j=JSON.parse(new TextDecoder().decode(new Uint8Array(data,o,n)));else if(kind===0x004e4942)bin=o;o+=n;}
 if(!j||bin===undefined)throw Error('Missing GLB sections');
 const rig=j.extras?.gdgRig,p=j.meshes?.[0]?.primitives?.[0];
 if(!p||rig?.parents?.length!==count||rig.pivots?.length!==count||j.skins?.[0]?.joints?.length!==count)throw Error('Unexpected GDG character rig');
 const read=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type],T={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];if(!T||!n||v.byteStride||a.sparse)throw Error('Unsupported accessor');return new T(data,bin+(v.byteOffset??0)+(a.byteOffset??0),a.count*n);};
 const attrs=p.attributes,positions=read(attrs.POSITION),normals=read(attrs.NORMAL),uv=read(attrs.TEXCOORD_0),joints=read(attrs.JOINTS_0),weights=read(attrs.WEIGHTS_0),indices=read(p.indices);
 if(positions.length/3!==weights.length/4||weights.length!==joints.length||normals.length!==positions.length||uv.length/2!==positions.length/3||indices.length%3)throw Error('Incompatible mesh arrays');
 const image=index=>{if(index==null)return null;const tex=j.textures[index],im=j.images[tex.source],v=j.bufferViews[im.bufferView];return new Blob([new Uint8Array(data,bin+(v.byteOffset??0),v.byteLength)],{type:im.mimeType});};
 const m=j.materials[p.material];
 return {rig,positions,normals,uv,joints,weights,indices,base:image(m.pbrMetallicRoughness.baseColorTexture.index),emit:image(m.emissiveTexture?.index)};
}
function footSamples(asset){
 if(!asset.rig.footed)return [];
 const {positions,joints,weights}=asset,cells=new Map();
 for(let i=0;i<positions.length/3;i++){
  const p=Array.from(positions.subarray(i*3,i*3+3));
  if(p[1]>.065)continue;
  const k=[Math.floor(p[0]*16),Math.floor(p[2]*16)].join(':');if(cells.has(k)&&cells.get(k).p[1]<=p[1])continue;
  cells.set(k,{p,j:Array.from(joints.subarray(i*4,i*4+4)),w:Array.from(weights.subarray(i*4,i*4+4))});
 }
 return [...cells.values()];
}
function groundRoot(matrix,bones,samples,floor){
 if(!samples.length||!Number.isFinite(floor))return matrix;
 let lo=Infinity;
 for(const {p,j,w} of samples){let height=0;for(let k=0;k<4;k++){if(!w[k])continue;const o=j[k]*16;
  const x=bones[o]*p[0]+bones[o+4]*p[1]+bones[o+8]*p[2]+bones[o+12],y=bones[o+1]*p[0]+bones[o+5]*p[1]+bones[o+9]*p[2]+bones[o+13],z=bones[o+2]*p[0]+bones[o+6]*p[1]+bones[o+10]*p[2]+bones[o+14];
  height+=w[k]*(matrix[1]*x+matrix[5]*y+matrix[9]*z);
 }lo=Math.min(lo,height);
 }
 const root=new Float32Array(matrix);
 root[13]=floor-clamp(lo,-.28,.28);return root;
}
async function texture(gl,blob,limit){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 if(!blob){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));}
 else{
  const bitmap=await createImageBitmap(blob);
  const scale=Math.min(1,limit/Math.max(bitmap.width,bitmap.height));let img=bitmap;
  if(scale<1){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);img=canvas;}
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);bitmap.close();
 }
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);return tex;
}
async function upload(gl,asset){
 const vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);
 function attribute(i,data,size,type){const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,type,false,0,0);}
 attribute(0,asset.positions,3,gl.FLOAT);attribute(1,asset.normals,3,gl.FLOAT);attribute(2,asset.uv,2,gl.FLOAT);attribute(9,asset.joints,4,asset.joints instanceof Uint8Array?gl.UNSIGNED_BYTE:gl.UNSIGNED_SHORT);attribute(10,asset.weights,4,gl.FLOAT);
 const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,asset.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);
 // Separate the player lower body for the local first-person view. Do not render
 // the head or duplicated arms, which would intersect the existing viewmodel.
 const leg=[];
 if(asset.rig.footed){
  for(let i=0;i<asset.indices.length;i+=3){
   const tri=asset.indices.subarray(i,i+3);
   if([...tri].every(v=>{
    if(asset.positions[v*3+1]>.76)return false;
    let w=0;for(let k=0;k<4;k++)if([4,5,8,9,13,14].includes(asset.joints[v*4+k]))w+=asset.weights[v*4+k];return w>.30;
   }))leg.push(...tri);
  }
 }
 const legBuffer=gl.createBuffer();buffers.push(legBuffer);gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,legBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,asset.indices instanceof Uint32Array?new Uint32Array(leg):new Uint16Array(leg),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bindVertexArray(null);
 const base=await texture(gl,asset.base,2048),emit=await texture(gl,asset.emit,1536);
 return {vao,buffers,ib,legBuffer,legLength:leg.length,base,emit,rig:asset.rig,feet:footSamples(asset),length:asset.indices.length,type:asset.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT};
}
export class CharacterSkins{
 constructor(gl){this.gl=gl;this.models=new Map();this.failures=[];}
 async load(progress=()=>{}){
  for(const [i,name] of SKIN_NAMES.entries()){
   try{
    const r=await fetch(new URL('./assets/characters/'+name+'.glb',import.meta.url));
    if(!r.ok)throw Error('HTTP '+r.status);
    const asset=decodeGLB(await r.arrayBuffer());this.models.set(name,await upload(this.gl,asset));
   }catch(err){this.failures.push({name,error:String(err)});console.warn('GDG skin fallback',name,err);}
   progress((i+1)/SKIN_NAMES.length,'캐릭터 모델 및 리깅 준비 중');
   await new Promise(resolve=>requestAnimationFrame(resolve));
  }
 }
 has(name){return this.models.has(name);}
 draw(u,skin,opacity,clay){
  const model=this.models.get(skin.name);if(!model)return false;
  const gl=this.gl,bones=skinMatrices(model.rig,skin.name==='player'?playerAngles(skin.state):creatureAngles(skin.kind,skin.angles)),root=groundRoot(skin.root,bones,model.feet,skin.floor);
  gl.uniform1i(u.skinActive,1);gl.uniformMatrix4fv(u.skinBones,false,bones);gl.uniformMatrix4fv(u.objectMatrix,false,root);
  gl.uniform1i(u.worldObject,1);gl.uniform1f(u.character,1);gl.uniform1f(u.clay,clay?1:0);gl.uniform1f(u.actorOpacity,opacity??1);gl.uniform1f(u.flexAmount,0);
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,model.base);gl.uniform1i(u.skinBase,3);gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,model.emit);gl.uniform1i(u.skinEmission,4);
  gl.bindVertexArray(model.vao);gl.vertexAttrib3f(3,0,0,0);gl.vertexAttrib3f(4,1,0,0);gl.vertexAttrib3f(5,0,1,0);gl.vertexAttrib3f(6,0,0,1);gl.vertexAttrib4f(7,1,1,1,0);gl.vertexAttrib4f(8,0,.15,1,2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,skin.lowerOnly?model.legBuffer:model.ib);
  gl.drawElements(gl.TRIANGLES,skin.lowerOnly?model.legLength:model.length,model.type,0);
  gl.uniform1i(u.skinActive,0);gl.activeTexture(gl.TEXTURE0);return true;
 }
}
