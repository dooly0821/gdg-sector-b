import {glowPalette,glowDistanceFactor} from './cargo-glow.js';
import {FPModels} from './fp-models.js';
import {CharacterSkins} from './character-skins.js';
import {defaultFingers} from './hand-motion.js';
import {CORE} from './annex.js';
import {geometry} from './geometry.js';
import {cameraView,perspective,multiply,unit,dot,cross} from './world.js';
const vs=`#version 300 es
precision highp float;
layout(location=0) in vec3 p;layout(location=1) in vec3 n;layout(location=2) in vec2 uv;
layout(location=3) in vec3 origin;layout(location=4) in vec3 ax;layout(location=5) in vec3 ay;layout(location=6) in vec3 az;
layout(location=7) in vec4 colorTex;layout(location=8) in vec4 params;
layout(location=9) in vec4 skinJoints;layout(location=10) in vec4 skinWeights;
uniform bool skinActive;uniform mat4 skinBones[15];
uniform mat4 VP,lightVP,objectMatrix;uniform bool worldObject;uniform vec3 offset;uniform vec3 flexPivot,flexForward,flexNormal,flexWidth;uniform float flexAmount;uniform vec4 digitWidths,knuckles,digitLengths,fingerAmounts;
out vec3 P,N;out vec2 UV,tile;out vec4 C,Q,shadowPos;
float acrossHand(float w,vec4 a){
 for(int i=0;i<3;i++){
  if(w<=digitWidths[i+1])return mix(a[i],a[i+1],smoothstep(digitWidths[i],digitWidths[i+1],w));
 }
 return a.w;
}
void main(){
 mat3 m=mat3(ax,ay,az);vec3 pp=p,nn=n;
 if(skinActive){mat4 skin=skinBones[int(skinJoints.x)]*skinWeights.x+skinBones[int(skinJoints.y)]*skinWeights.y+skinBones[int(skinJoints.z)]*skinWeights.z+skinBones[int(skinJoints.w)]*skinWeights.w;pp=(skin*vec4(p,1.)).xyz;nn=normalize(mat3(skin)*n);}
 if(abs(flexAmount)>.00001){
  vec3 rel=pp-flexPivot;
  float w=dot(rel,flexWidth);
  float z=dot(rel,flexForward),y=dot(rel,flexNormal),z0=z,y0=y;
  float root=acrossHand(w,knuckles),length=acrossHand(w,digitLengths);
  float curl=flexAmount*acrossHand(w,fingerAmounts)*smoothstep(digitWidths.x-.026,digitWidths.x-.010,w);
  for(int j=2;j>=0;j--){
   float joint=root+length*(j==0?0.:j==1?.37:.68),localZ=z-joint;
   float angle=curl*(j==0?.42:j==1?.40:.18)*smoothstep(0.,.017,localZ);
   float c=cos(angle),s=sin(angle);
   z=joint+localZ*c+y*s;y=y*c-localZ*s;
   float nz=dot(nn,flexForward),ny=dot(nn,flexNormal);
   nn+=flexForward*(nz*c+ny*s-nz)+flexNormal*(ny*c-nz*s-ny);
  }
  float thumbMask=smoothstep(0.,.029,digitWidths.x-.009-w)*smoothstep(0.,.037,z0+.075);
  for(int j=0;j<2;j++){
   float joint=j==0?-.020:-.050,delta=z-joint;
   float a=flexAmount*(j==0?.24:.19)*thumbMask*smoothstep(0.,.018,delta);
   float c=cos(a),s=sin(a),nz=dot(nn,flexForward),ny=dot(nn,flexNormal);
   z=joint+delta*c+y*s;y=y*c-delta*s;
   nn+=flexForward*(nz*c+ny*s-nz)+flexNormal*(ny*c-nz*s-ny);
  }
  float angle=flexAmount*.88*thumbMask,c=cos(angle),s=sin(angle);
  float tw=w-digitWidths.x,th=y+.009;
  pp+=flexForward*(z-z0)+flexNormal*(y-y0+tw*s+th*(c-1.))+flexWidth*(tw*(c-1.)-th*s);
  float nw=dot(nn,flexWidth),nh=dot(nn,flexNormal);
  nn+=flexWidth*(nw*(c-1.)-nh*s)+flexNormal*(nw*s+nh*(c-1.));
 }
 P=origin+m*pp+offset;
 N=normalize(mat3(ax/dot(ax,ax),ay/dot(ay,ay),az/dot(az,az))*nn);
 if(worldObject){P=(objectMatrix*vec4(P,1.)).xyz;N=normalize(mat3(objectMatrix)*N);}
 vec3 scale=vec3(length(ax),length(ay),length(az));vec3 an=abs(n);
 vec2 sz=an.y>.7?scale.xz:an.x>.7?scale.zy:scale.xy;
 UV=uv;tile=uv*sz*params.z+vec2(dot(origin,vec3(.13,.23,.72)),dot(origin,vec3(.31,.62,.14)));
 C=colorTex;Q=params;if(params.w==1.0 && n.y>.75)C.w+=6.0;
 shadowPos=lightVP*vec4(P,1.);gl_Position=VP*vec4(P,1.);
}`;
const fs=`#version 300 es
precision highp float;precision highp sampler2DArray;
in vec3 P,N;in vec2 UV,tile;in vec4 C,Q,shadowPos;
uniform sampler2DArray atlas;uniform sampler2D shadowMap,floorTex,skinBase,skinEmission;uniform bool skinActive,fpActive;uniform vec2 fpFactors;uniform vec3 eye,lamps[8];uniform float lampRed[8];uniform float shadowStep,hand,clock,torchPower,clay,character,actorOpacity,gridPower,lowCostShadow;uniform vec3 torchPos,torchDir,core;uniform vec4 footprints[2],cargoGlow;
out vec4 outColor;
float visibility(vec3 n){
 if(hand>.5||shadowStep==0.)return 1.;vec3 s=shadowPos.xyz/shadowPos.w*.5+.5;
 if(any(lessThan(s,vec3(0.)))||any(greaterThan(s,vec3(1.))))return 1.;
 float bias=.0008+.0007*(1.-max(n.y,0.)),v=0.;
 if(lowCostShadow>.5){for(int x=0;x<2;x++)for(int y=0;y<2;y++)v+=float(s.z-bias<=texture(shadowMap,s.xy+(vec2(x,y)-.5)*shadowStep*1.65).r);return v*.25;}
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)v+=float(s.z-bias<=texture(shadowMap,s.xy+vec2(x,y)*shadowStep*1.25).r);
 return v/9.;
}
void main(){
 if(character>.5&&actorOpacity<1.){
  // Screen-door coverage keeps opaque joints depth-tested as a ghost fades.
  ivec2 px=ivec2(gl_FragCoord.xy)&3;
  const float threshold[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  if(actorOpacity<=(threshold[px.x+px.y*4]+.5)/16.)discard;
 }
 vec3 n=normalize(N);float e=Q.x;vec2 st=Q.w>0.?UV:tile;
 vec4 sampleC=(skinActive||fpActive)?texture(skinBase,UV):(Q.w==3.?texture(floorTex,UV):texture(atlas,vec3(st,C.w)));if(sampleC.a<.4)discard;
 if(Q.w==5.||(character>.5&&Q.w!=2.))sampleC.rgb=mix(vec3(.90),sampleC.rgb,.21);
 if(clay>.5){sampleC=vec4(1.);e=0.;}
 float grit=dot(sampleC.rgb,vec3(.299,.587,.114));
 if(Q.w==0.||Q.w==3.||(hand>.5&&Q.w==2.)){vec3 T=cross(dFdy(P),n),B=cross(n,dFdx(P));float det=dot(dFdx(P),T);if(abs(det)>.0000001)n=normalize(n-sign(det)*clamp((dFdx(grit)*T+dFdy(grit)*B)/abs(det),vec3(-.13),vec3(.13))*.27);}
 vec3 base=clay>.5?vec3(.79,.77,.735):sampleC.rgb*C.rgb;float edge=min(min(UV.x,1.-UV.x),min(UV.y,1.-UV.y));
 if(Q.w==1.)base*=.89+.11*smoothstep(.0,.038,edge);
 float shade=visibility(n);vec3 L=normalize(vec3(.35,.81,-.28));
 vec3 amb=mix(vec3(.065,.075,.10),vec3(.20,.23,.29),n.y*.5+.5);
 vec3 lit=(amb+vec3(.085,.105,.145)*max(dot(n,L),0.)*(.14+.86*shade))*mix(.23,1.,gridPower);
 if(hand<.5&&e>0.&&C.r<C.g*1.8)e*=gridPower;
 float sheen=0.,mist=0.;vec3 v=normalize(eye-P);
 if(hand>.5){vec3 key=normalize(vec3(-.55,.76,.45));lit=vec3(.48,.49,.55)+vec3(.74,.65,.51)*max(dot(n,key),0.)+vec3(.15,.17,.24)*max(dot(n,normalize(vec3(.8,.25,-.4))),0.);sheen=pow(max(dot(n,normalize(v+key)),0.),32.)*Q.y*.4;}
 else{
  for(int i=0;i<8;i++){
   vec3 d=lamps[i]-P;float ds=dot(d,d);vec3 l=d*inversesqrt(max(.01,ds));
   vec3 toLamp=lamps[i]-eye;float along=dot(toLamp,-v);float gap=length(toLamp+along*v);
   float supply=mix(gridPower,1.,lampRed[i]);
   if(along>0.&&along<distance(eye,P)+.14)mist+=supply*(.075*exp(-2.8*gap*gap)+.13*exp(-18.*gap*gap));
   float beam=smoothstep(-.05,.89,l.y);float red=lampRed[i];float pulse=1.-red*.12*(.5+.5*sin(clock*2.2+float(i)*1.7));float falloff=mix(14.,32.,red)/(ds+8.)*beam*pulse*supply;
   lit+=mix(vec3(1.,.72,.44),vec3(1.,.075,.035),red)*falloff*(.14+.86*max(dot(n,l),0.))*(.35+.65*shade);
   sheen+=pow(max(0.,dot(n,normalize(v+l))),mix(13.,29.,grit))*falloff*Q.y*.13;
  }
 }
 if(hand<.5&&torchPower>.001){
  vec3 delta=P-torchPos;float d=length(delta);vec3 ray=delta/max(d,.001);
  float spot=smoothstep(.87,.975,dot(ray,torchDir));
  float atten=25./(d*d+2.5);float diffuse=max(dot(n,-ray),0.);
  lit+=vec3(1.,.88,.67)*torchPower*spot*atten*(.08+.92*diffuse);
  sheen+=pow(max(dot(n,normalize(v-ray)),0.),25.)*spot*atten*Q.y*.2*torchPower;
 }
 if(hand<.5&&n.y>.65&&P.y<.25){
  for(int i=0;i<2;i++){
   vec4 foot=footprints[i];
   vec2 d=(P.xz-foot.xy)/max(foot.z,.05);
   lit*=1.-foot.w*exp(-dot(d,d)*1.85);
  }
 }
 if(hand<.5&&P.x< -15.2){
  vec3 vent=core-P;float d2=dot(vent,vent);
  float pulse=.85+.15*sin(clock*2.1);
  lit+=vec3(1.,.15,.10)*pulse*(9./(d2+3.))*(.3+.7*max(0.,dot(n,normalize(vent))));
  float blue=exp(-.045*pow(P.x+26.,2.))*smoothstep(-7.,2.,P.z);
  lit+=vec3(.055,.105,.19)*blue*max(n.y,0.);
 }
 if(hand<.5&&n.y>.65&&(Q.w==3.||Q.w==0.)){
  // Low-angle highlights follow worn tracks without replacing the floor texture.
  float tracks=pow(.5+.5*sin(P.x*3.6+sin(P.z*1.1)*.3),7.);
  sheen+=tracks*grit*pow(1.-max(dot(n,v),0.),4.)*.065;
 }
 if(fpActive){vec3 mr=texture(skinEmission,UV).rgb;float rough=clamp(mr.g*fpFactors.x,.14,1.);float metal=clamp(mr.b*fpFactors.y,0.,1.);vec3 key=normalize(vec3(-.55,.76,.45));sheen+=pow(max(dot(n,normalize(v+key)),0.),mix(72.,9.,rough))*(.10+.36*metal);lit*=mix(1.,.72,metal);}
 if(character>.5)sheen*=.4;
 if(clay>.5){
  vec3 key=normalize(vec3(-.48,.72,.50));
  float fill=.5+.5*dot(n,normalize(v+vec3(.15,.45,0.)));
  lit=vec3(.43,.44,.46)+vec3(.34)*fill+vec3(.54,.52,.49)*max(dot(n,key),0.)*(.29+.71*shade)+vec3(.10)*max(dot(n,normalize(vec3(.7,.16,-.55))),0.);
  sheen=0.;mist=0.;
 }
 vec3 col=base*lit+vec3(1.,.80,.55)*sheen+base*e;
 // Subtle surface-only aura, evaluated exclusively for marked cargo draws.
 // No extra sampling, blending, geometry or screen-space post-processing.
 if(cargoGlow.a>0.&&clay<.5){
  float seam=1.-smoothstep(0.,.12,edge),rim=1.-abs(dot(n,v));
  col+=cargoGlow.rgb*cargoGlow.a*(.11+.58*seam+.31*rim*rim);
 }
 if(skinActive&&clay<.5)col+=texture(skinEmission,UV).rgb*1.45;
 if(Q.w==4.&&clay<.5){
  float rim=pow(1.-abs(dot(n,v)),2.3);
  col+=vec3(.36,.74,.54)*rim*(.72+.08*sin(clock*1.8));
 }
 if(hand<.5){float dist=distance(eye,P);col=mix(col,vec3(.035,.042,.060)*mix(.45,1.,gridPower),1.-exp(-dist*(P.x< -15.2?.020:.011)));}
  // Leave low-light contrast intact while rolling off overlapping lamps and hot materials.
 vec3 hdr=max(vec3(0.),col+vec3(.60,.45,.34)*mist);
 vec3 highlight=max(hdr-.70,vec3(0.));
 float opacity=Q.w==4.&&clay<.5?mix(.67,.89,pow(1.-abs(dot(n,v)),1.5)):1.;
 outColor=vec4(min(hdr,.70)+.30*(1.-exp(-3.33*highlight)),opacity);
}`;
const depthFS='#version 300 es\nprecision highp float;void main(){}';
function compile(gl,vert,frag){const sh=(type,src)=>{let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};let p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vert));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,frag));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const rgb=s=>{if(s.length===4)s='#'+[...s.slice(1)].map(v=>v+v).join('');return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255);};
function signArt(m){const c=document.createElement('canvas');c.width=512;c.height=Math.max(64,Math.round(512/m.aspect));const g=c.getContext('2d');g.fillStyle=m.bg;g.fillRect(0,0,c.width,c.height);g.strokeStyle=m.fg;g.lineWidth=2;g.strokeRect(5,5,c.width-10,c.height-10);g.fillStyle=m.fg;g.textAlign='center';g.textBaseline='middle';g.font='bold '+Math.floor(c.height*.63)+'px Arial';g.fillText(m.label,256,c.height*.53,470);return c;}
async function bitmap(url){let im=new Image();im.src=url;await im.decode();return im;}
function glFlex(gl,u,flex){
 gl.uniform1f(u.flexAmount,flex?.amount??0);
 if(!flex)return;
 for(const [name,value] of [['flexPivot',flex.pivot],['flexForward',flex.forward],['flexNormal',flex.normal],['flexWidth',flex.width]])gl.uniform3fv(u[name],value);
 for(const name of Object.keys(defaultFingers))gl.uniform4fv(u[name],flex[name]??defaultFingers[name]);
 gl.uniform4fv(u.fingerAmounts,flex.fingerAmounts??[1,1,1,1]);
}
export class Renderer{
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});if(!this.gl)throw Error('WebGL 2 is unavailable. Enable graphics acceleration in desktop Chrome, then reload.');
  const gl=this.gl;this.program=compile(gl,vs,fs);this.depthProgram=compile(gl,vs,depthFS);
  this.loc={};for(let p of [this.program,this.depthProgram]){let u={};for(let k of ['VP','offset','lightVP','worldObject','objectMatrix','clock','core','clay','character','actorOpacity','atlas','shadowMap','floorTex','eye','lamps','lampRed[0]','shadowStep','hand','torchPower','torchPos','torchDir','flexPivot','flexForward','flexNormal','flexWidth','flexAmount','digitWidths','knuckles','digitLengths','fingerAmounts','footprints[0]','skinActive','skinBones[0]','skinBase','skinEmission','fpActive','fpFactors','gridPower','lowCostShadow','cargoGlow'])u[k]=gl.getUniformLocation(p,k);u.skinBones=u['skinBones[0]'];this.loc[p===this.program?'main':'depth']=u;}
  this.buffers={};
  const lv=cameraView([-8,88,25],[-10,-88,5]);const ortho=new Float32Array([1/50,0,0,0,0,1/70,0,0,0,0,-2/180,0,0,0,-1,1]);this.lightVP=multiply(ortho,lv);
 }
 meshBuffer(shape){
  if(!this.buffers[shape]){
   const gl=this.gl,vertices=geometry(shape),buffer=gl.createBuffer();
   // Share identical position/normal/UV tuples, preserving seams and hard edges.
   const count=vertices.length/8,lookup=new Map(),unique=new Float32Array(vertices.length);
   const words=new Uint16Array(vertices.buffer,vertices.byteOffset,vertices.length*2);
   const indices=new Uint32Array(count);
   for(let i=0;i<count;i++){
    const key=String.fromCharCode(...words.subarray(i*16,i*16+16));
    let index=lookup.get(key);
    if(index===undefined){
     index=lookup.size;lookup.set(key,index);
     unique.set(vertices.subarray(i*8,i*8+8),index*8);
    }
    indices[i]=index;
   }
   const short=lookup.size<=65536,indexBuffer=gl.createBuffer();
   gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,unique.subarray(0,lookup.size*8),gl.STATIC_DRAW);
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
   gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,short?new Uint16Array(indices):indices,gl.STATIC_DRAW);
   this.buffers[shape]={buffer,indexBuffer,verts:count,indexType:short?gl.UNSIGNED_SHORT:gl.UNSIGNED_INT};
  }
  return this.buffers[shape];
 }
 async prepare(worlds,progress=()=>{}){
  const gl=this.gl,slots=new Map();const paths=['plain',...Array.from({length:6},(_,i)=>'carton'+i),...Array.from({length:6},(_,i)=>'cartontop'+i),'concrete','paint','metal','wood','rubber','cloth','skin','cardboard'];
  for(const k of paths)slots.set(k,{index:slots.size,url:k==='plain'?null:'assets/mat-'+k+'.webp'});
  for(const world of worlds)for(const part of world.parts){const m=part.m;if(!m)throw Error('A material is missing');const key=m.type==='image'?m.url:m.type==='sign'?m.name:m.type;if(!slots.has(key)&&(m.type==='sign'||m.type==='image'))slots.set(key,{index:slots.size,url:m.url,sign:m.type==='sign'?m:null});}
  const dim=512;this.atlas=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.atlas);gl.texStorage3D(gl.TEXTURE_2D_ARRAY,10,gl.RGBA8,dim,dim,slots.size);
  const tmp=document.createElement('canvas');tmp.width=tmp.height=dim;const g=tmp.getContext('2d');
  let decoded=0;
  const sources=await Promise.all([...slots.values()].map(async s=>{
   const img=s.url?await bitmap(s.url):s.sign?signArt(s.sign):null;
   progress(.52*++decoded/slots.size,'재질과 표지 읽는 중');return img;
  }));
  for(const s of slots.values()){g.clearRect(0,0,dim,dim);if(sources[s.index]){g.save();g.translate(0,dim);g.scale(1,-1);g.drawImage(sources[s.index],0,0,dim,dim);g.restore();}else{g.fillStyle='white';g.fillRect(0,0,dim,dim);}gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,s.index,dim,dim,1,gl.RGBA,gl.UNSIGNED_BYTE,g.getImageData(0,0,dim,dim).data);}
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D_ARRAY,gl.TEXTURE_WRAP_T,gl.REPEAT);
  this.floorTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.floorTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sources[slots.get('assets/floor-deck.webp').index]);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  const an=gl.getExtension('EXT_texture_filter_anisotropic');if(an)gl.texParameterf(gl.TEXTURE_2D_ARRAY,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(4,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  progress(.61,'텍스처 업로드 완료');
  this.groups=[];
  for(let i=0;i<worlds.length;i++){
   this.groups.push(this.batch(worlds[i],slots,i===0));
   progress(.67+.16*(i+1)/worlds.length,'창고 메시 준비 중');
   await new Promise(r=>requestAnimationFrame(r));
  }
  this.lights=worlds[0].lights;
  this.skins=new CharacterSkins(gl);await this.skins.load((p,label)=>progress(.83+.09*p,label));
  this.fpModels=new FPModels(gl);await this.fpModels.load((p,label)=>progress(.92+.07*p,label));
  this.setQuality('BALANCED');
 }
 batch(world,slots,chunked){
  const gl=this.gl,batches=new Map();let num=0;
  for(const o of world.parts){
   const {shape,pos,axes,m}=o,staticShadow=pos[1]<6.1&&shape!=='face'&&m.emission<.01&&!m.name.includes('wall')&&!m.name.includes('slab');
   const cell=chunked?[Math.floor(pos[0]/10),Math.floor(pos[2]/10),staticShadow?1:0].join(':'):'one';
   const key=shape+cell;if(!batches.has(key))batches.set(key,{shape,staticShadow,translucent:!!m.rim,values:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
   const b=batches.get(key);for(let k=0;k<3;k++){const rad=axes.reduce((s,v,j)=>s+Math.abs(v[k])*(shape==='sphere'||shape==='cylinder'&&j!==1?1:.5),0);b.min[k]=Math.min(b.min[k],pos[k]-rad);b.max[k]=Math.max(b.max[k],pos[k]+rad);}
   const kind=m.type,cart=kind==='carton',fit=/^vm_/.test(m.name)&&kind==='image'&&!/metal|rim/.test(m.name)?5:m.rim?4:m.name==='building-slab'?3:cart?1:kind==='sign'||kind==='image'?2:0;
   let tex=cart?'carton'+(num++%6):kind==='image'?m.url:kind==='sign'?m.name:kind;let color=rgb(m.color);if(cart)color=color.map(v=>.83+.17*v);
   let uv=m.uvScale*({concrete:.27,metal:.65,wood:1.3,cardboard:1.2,paint:.75,cloth:5}[kind]??1);
   b.values.push(...pos,...axes.flat(),...color,slots.get(tex)?.index??0,m.emission,m.sheen??(kind==='metal'||/vm_(metal|rim)/.test(m.name)?1:kind==='paint'?.55:.1),uv,fit);
  }
  return [...batches.values()].map(b=>{let vao=gl.createVertexArray();gl.bindVertexArray(vao);const {buffer,indexBuffer,verts,indexType}=this.meshBuffer(b.shape);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
   for(const [i,size,off] of [[0,3,0],[1,3,12],[2,2,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,32,off);}
   let inst=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,inst);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.values),gl.STATIC_DRAW);
   for(const [i,size,off] of [[3,3,0],[4,3,3],[5,3,6],[6,3,9],[7,4,12],[8,4,16]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,80,4*off);gl.vertexAttribDivisor(i,1);}
   let center=b.min.map((v,i)=>(v+b.max[i])*.5);return {vao,verts,indexType,shape:b.shape,count:b.values.length/20,staticShadow:b.staticShadow,translucent:b.translucent,center,radius:Math.hypot(...b.max.map((v,i)=>v-center[i]))};});
 }
 setQuality(name){
  const gl=this.gl;this.quality=name;const sizes={HIGH:2048,BALANCED:1024,PERFORMANCE:512};this.size=sizes[name];
  if(this.depth)gl.deleteTexture(this.depth);if(this.fb)gl.deleteFramebuffer(this.fb);this.depth=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,this.size,this.size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);for(const k of [gl.TEXTURE_MAG_FILTER,gl.TEXTURE_MIN_FILTER])gl.texParameteri(gl.TEXTURE_2D,k,gl.NEAREST);for(const k of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE);
  this.fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,this.depth,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
  gl.viewport(0,0,this.size,this.size);gl.enable(gl.DEPTH_TEST);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(this.depthProgram);const u=this.loc.depth;gl.uniformMatrix4fv(u.VP,false,this.lightVP);gl.uniform3f(u.offset,0,0,0);for(const b of this.groups[0])if(b.staticShadow)this.draw(b);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 draw(b){const gl=this.gl;gl.bindVertexArray(b.vao);gl.drawElementsInstanced(gl.TRIANGLES,b.verts,b.indexType,0,b.count);}
 studioShadow(actors){
  const gl=this.gl,u=this.loc.depth;
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.fb);gl.viewport(0,0,this.size,this.size);
  gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.depthProgram);
  gl.uniformMatrix4fv(u.VP,false,this.lightVP);gl.uniform1i(u.worldObject,1);
  gl.uniform3f(u.offset,0,0,0);
  for(const actor of actors){
   gl.uniformMatrix4fv(u.objectMatrix,false,actor.matrix);
   for(const b of this.groups[actor.group]){this.setFlex(u,actor.flex,b);this.draw(b);}
  }
  gl.uniform1i(u.worldObject,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 setFlex(u,flex,batch){
  const enabled=flex&&batch.shape.includes('_glove_');
  glFlex(this.gl,u,enabled?flex:null);
 }
 render(eye,forward,items,pose,scale=1){
  const gl=this.gl,c=this.canvas;const ratio={HIGH:Math.min(devicePixelRatio,1.5),BALANCED:1,PERFORMANCE:.7}[this.quality]*scale;
  const width=Math.max(2,Math.round(c.clientWidth*ratio)),height=Math.max(2,Math.round(c.clientHeight*ratio));if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
  const aspect=width/height,proj=perspective(78*Math.PI/180,aspect,.045,95),vp=multiply(proj,cameraView(eye,forward));this.vp=vp;
  gl.viewport(0,0,width,height);gl.clearColor(.025,.032,.046,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.useProgram(this.program);
  const u=this.loc.main,glows=glowPalette(pose.clock??0);
  let lastGlow=-1,lastGlowStrength=-1;
  const setGlow=(code=0,dist2=0)=>{
   const c=glows[code]??glows[0],a=code?c[3]*glowDistanceFactor(dist2):0;
   if(!a)code=0;
   if(code===lastGlow&&a===lastGlowStrength)return;
   lastGlow=code;lastGlowStrength=a;
   gl.uniform4f(u.cargoGlow,c[0],c[1],c[2],a);
  };
  setGlow();
  gl.uniform1f(u.gridPower,pose.gridPower??1);gl.uniform1f(u.lowCostShadow,pose.lowCostShadow?1:0);gl.uniform1i(u.fpActive,0);gl.uniform1i(u.skinActive,0);gl.uniform1f(u.character,0);gl.uniform1f(u.clay,0);gl.uniformMatrix4fv(u.VP,false,vp);gl.uniformMatrix4fv(u.lightVP,false,this.lightVP);gl.uniform3fv(u.eye,eye);const right=unit(cross(forward,[0,1,0])),up=cross(right,forward),off=pose.torchOffset??[0,0,0];
  // A viewmodel can overlap nearby geometry; the light origin stays near the eye
  // to avoid placing a light source on the far side of a wall.
  const local=pose.torchLocal?.position??[.325,-.283,-.887],dir=pose.torchLocal?.direction??[-.045,-.025,-1];
  const torch=eye.map((v,i)=>v+right[i]*(local[0]+off[0])+up[i]*(local[1]+off[1])-forward[i]*(local[2]+off[2]));
  gl.uniform3fv(u.torchPos,torch);gl.uniform3fv(u.torchDir,unit(forward.map((v,i)=>v*(-dir[2])+right[i]*dir[0]+up[i]*dir[1])));gl.uniform1f(u.torchPower,pose.flashlight||0);const lampScore=l=>Math.hypot(l[0]-eye[0],l[2]-eye[2])+(1-(pose.gridPower??1))*(l[3]?0:16);const lights=this.lights.map(l=>({l,score:lampScore(l)})).sort((a,b)=>a.score-b.score).slice(0,8).map(v=>v.l);
  while(lights.length<8)lights.push([0,10000,0,0]);
  gl.uniform3fv(u.lamps,new Float32Array(lights.flatMap(l=>l.slice(0,3))));gl.uniform1fv(u['lampRed[0]'],new Float32Array(lights.map(l=>l[3]??0)));
  const footprints=(pose.actors??[]).flatMap(actor=>actor.footprint?[actor.footprint]:[]).slice(0,2);
  while(footprints.length<2)footprints.push([0,0,1,0]);
  gl.uniform4fv(u['footprints[0]'],footprints.flat());
  gl.uniform1f(u.clock,pose.clock??0);gl.uniform3fv(u.core,CORE);gl.uniform1f(u.flexAmount,0);gl.uniform1f(u.hand,0);gl.uniform1f(u.shadowStep,1/this.size);gl.uniform3f(u.offset,0,0,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D_ARRAY,this.atlas);gl.uniform1i(u.atlas,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.depth);gl.uniform1i(u.shadowMap,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.floorTex);gl.uniform1i(u.floorTex,2);
  // Assign all sampler units before the first draw, including the fallback path.
  gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,this.floorTex);gl.uniform1i(u.skinBase,3);
  gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,this.floorTex);gl.uniform1i(u.skinEmission,4);gl.activeTexture(gl.TEXTURE0);
  const planes=[];for(let i=0;i<3;i++)for(let s of [-1,1]){let pl=[0,1,2,3].map(j=>vp[4*j+3]+s*vp[4*j+i]);planes.push(pl.map(v=>v/Math.hypot(...pl.slice(0,3))));}
  for(const b of this.groups[0])if(planes.every(p=>dot(p.slice(0,3),b.center)+p[3]>-b.radius))this.draw(b);
  for(const xyz of items){if(!planes.every(p=>p[0]*xyz[0]+p[1]*(xyz[1]+.24)+p[2]*xyz[2]+p[3]>-.65))continue;setGlow(xyz[3]??0,xyz[3]?(xyz[0]-eye[0])**2+(xyz[1]+.24-eye[1])**2+(xyz[2]-eye[2])**2:0);gl.uniform3f(u.offset,xyz[0],xyz[1],xyz[2]);for(const b of this.groups[1])this.draw(b);}
  setGlow();
  if(pose.actors?.length){
   gl.uniform3f(u.offset,0,0,0);
   gl.uniform1i(u.worldObject,1);
   gl.uniform1f(u.character,1);gl.uniform1f(u.clay,pose.clay?1:0);
   const transparent=[];
   for(const actor of pose.actors){
    if(actor.root&&!planes.every(p=>p[0]*actor.root[0]+p[1]*actor.root[1]+p[2]*actor.root[2]+p[3]>-3.1))continue;
    const r=actor.root;setGlow(actor.prop&&actor.group===1?actor.cargoGlow??0:0,r?(r[0]-eye[0])**2+(r[1]-eye[1])**2+(r[2]-eye[2])**2:0);
    if(actor.skinName&&this.skins?.has(actor.skinName)){if(actor.skin)this.skins.draw(u,actor.skin,actor.opacity,pose.clay);continue;}
    gl.uniform1f(u.character,actor.prop?0:1);
    gl.uniform1f(u.actorOpacity,actor.opacity??1);
    gl.uniformMatrix4fv(u.objectMatrix,false,actor.matrix);
    for(const b of this.groups[actor.group]){
     if(actor.flex)this.setFlex(u,actor.flex,b);
     if(b.translucent&&!pose.clay){
      const m=actor.matrix,c=b.center;
      const depth=forward.reduce((d,f,i)=>d+f*(m[i]*c[0]+m[4+i]*c[1]+m[8+i]*c[2]+m[12+i]-eye[i]),0);
      transparent.push({b,m,depth,opacity:actor.opacity??1});
     }else this.draw(b);
    }
   }
   setGlow();gl.uniform1f(u.flexAmount,0);
   if(transparent.length){
    transparent.sort((a,b)=>b.depth-a.depth);gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    for(const {b,m,opacity} of transparent){gl.uniform1f(u.actorOpacity,opacity);gl.uniformMatrix4fv(u.objectMatrix,false,m);this.draw(b);}
    gl.depthMask(true);gl.disable(gl.BLEND);
   }
   gl.uniform1i(u.worldObject,0);gl.uniform1f(u.character,0);gl.uniform1f(u.clay,0);
  }
  if(pose.flight&&!pose.assembly){setGlow(pose.cargoGlow);gl.uniformMatrix4fv(u.VP,false,multiply(vp,pose.flight));gl.uniform3f(u.offset,0,0,0);gl.uniform1f(u.hand,1);for(const b of this.groups[1])this.draw(b);}
  setGlow();gl.uniformMatrix4fv(u.VP,false,proj);
  gl.uniform1f(u.hand,1);gl.uniform3f(u.eye,0,0,0);
  if(this.fpModels?.draw(u,pose,setGlow)){setGlow();return;}
  for(const layer of pose.hands){
   setGlow(layer.group===6?pose.cargoGlow:0);
   gl.uniform1i(u.worldObject,Boolean(layer.matrix));
   if(layer.matrix)gl.uniformMatrix4fv(u.objectMatrix,false,layer.matrix);
   gl.uniform3fv(u.offset,layer.offset);
   const flex=layer.flex;
   if(flex){
    for(const [name,value] of [['flexPivot',flex.pivot],['flexForward',flex.forward],['flexNormal',flex.normal],['flexWidth',flex.width]])
     gl.uniform3fv(u[name],value);
    for(const name of Object.keys(defaultFingers))gl.uniform4fv(u[name],flex[name]??defaultFingers[name]);
    gl.uniform4fv(u.fingerAmounts,flex.fingerAmounts??[1,1,1,1]);
   }
   for(const b of this.groups[layer.group]){
    gl.uniform1f(u.flexAmount,flex&&b.shape.includes('_glove_')?flex.amount:0);this.draw(b);
   }
  }
  setGlow();gl.uniform1i(u.worldObject,0);
 }
 project(pt){let v=this.vp;if(!v)return null;const p=[...pt,1],c=[0,1,2,3].map(i=>p.reduce((s,x,j)=>s+x*v[j*4+i],0));return c[3]>.05?[c[0]/c[3],c[1]/c[3]]:null;}
}
