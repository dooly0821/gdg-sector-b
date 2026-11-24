import {buildInspectionGlove,gloveMatrix,FINGER_FLEX} from './viewmodel.js';
import {World,unit,multiply,cameraView,dot} from './world.js';
import {geometry} from './geometry.js';
import {Renderer} from './renderer.js';
import {buildWorker} from './worker.js';
import {hauntLayers,buildHauntRigs,ACTOR_START} from './haunt.js';
const scene=new World(),floor=scene.imageMat('building-slab','assets/floor-deck.webp');
scene.box(0,-.24,0,16,.20,16,floor);
scene.box(0,-.074,0,16,.14,16,scene.mat("studio-floor","#686777","concrete"));
scene.lamp(-2,4,3);scene.lamp(3,4,2);
for(let i=2;i<8;i++)scene.lamp(90,40,50+i);
const renderer=new Renderer(document.querySelector('canvas'));
const rigs=buildHauntRigs(),worker=buildWorker();
const worlds=[scene,...Array.from({length:ACTOR_START-1},()=>new World()),...rigs,worker,buildInspectionGlove(new World(),'emptyR')];
await renderer.prepare(worlds);
function corners(min,max){
 return Array.from({length:8},(_,i)=>min.map((n,k)=>i&(1<<k)?max[k]:n));
}
const bounds=worlds.map((world,index)=>{
 if(index<ACTOR_START||!world.parts.length)return [];
 const lo=[Infinity,Infinity,Infinity],hi=lo.map(v=>-v);
 for(const part of world.parts){
  const vertices=geometry(part.shape);
  for(let j=0;j<vertices.length;j+=8)for(let k=0;k<3;k++){
   const p=part.pos[k]+part.axes[0][k]*vertices[j]+part.axes[1][k]*vertices[j+1]+part.axes[2][k]*vertices[j+2];
   lo[k]=Math.min(lo[k],p);hi[k]=Math.max(hi[k],p);
  }
 }
 return corners(lo,hi);
});
function frameSubject(actors,angle){
 const points=actors.flatMap(({group,matrix:m})=>bounds[group].map(p=>
  [0,1,2].map(k=>m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]+m[12+k])));
 const center=[0,1,2].map(k=>(Math.max(...points.map(p=>p[k]))+Math.min(...points.map(p=>p[k])))/2);
 const back=[Math.sin(angle),.035,Math.cos(angle)],right=[Math.cos(angle),0,-Math.sin(angle)];
 const aspect=renderer.canvas.clientWidth/renderer.canvas.clientHeight,halfFov=Math.tan(39*Math.PI/180);
 const radius=Math.max(...points.map(p=>{
  const d=p.map((v,k)=>v-center[k]);
  return dot(d,back)+Math.max(Math.abs(d[1]),Math.abs(dot(d,right))/aspect)*1.10/halfFov;
 }));
 return [center.map((v,k)=>v+back[k]*radius),unit(back.map(v=>-v))];
}
const ortho=new Float32Array([.51,0,0,0,0,.48,0,0,0,0,-.22,0,0,0,-1,1]);
renderer.lightVP=multiply(ortho,cameraView([-2.4,4.4,2.5],unit([2.4,-3.55,-2.5])));
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const select=document.querySelector('select'),rotation=document.querySelector('[type=range]'),lamp=document.querySelector('#light'),clay=document.querySelector('#clay'),bend=document.querySelector('#bend');
const motion=document.querySelector('#motion');
let lastView='',lastShadow='',framing='',camera;
function draw(ms){
 const i=select.selectedIndex-1,t=ms/1000,a=Number(rotation.value)*Math.PI/180;
 const moving=i>=0&&i<4,phase=moving&&motion.checked?t:0;
 document.querySelector('#motion-control').hidden=!moving;
 const view=[i,a,clay.checked,lamp.checked,bend.value,phase,innerWidth,innerHeight].join('/');
 if(view===lastView){requestAnimationFrame(draw);return;}
 lastView=view;
 const actor={kind:i,x:0,z:0,yaw:0,state:'patrol',speed:.55,phase:phase*2,aggression:0,age:4};
 const glove=i===4;
 document.querySelector('#bend-control').hidden=!glove;
 const actors=glove?[{group:ACTOR_START+rigs.length+1,matrix:gloveMatrix('emptyR',[.12,.30,0],[-.25,.95,-.18],[-.97,-.25,0],5.1),
  flex:{...FINGER_FLEX.emptyR,amount:Number(bend.value)*.013,fingerAmounts:[.74,.92,1.01,1.12]}}]:i<0?[{group:ACTOR_START+rigs.length,matrix:identity,footprint:[0,0,.31,.48]}]:hauntLayers({x:0,z:1,haunt:[actor]});
 const shadow=[i,bend.value,phase].join('/');
 if(lastShadow!==shadow){renderer.studioShadow(actors);lastShadow=shadow;}
 const framingKey=[i,a,innerWidth,innerHeight].join('/');
 if(framing!==framingKey){
  const neutral=moving?hauntLayers({x:0,z:1,haunt:[{...actor,phase:0}]}):actors;
  camera=frameSubject(neutral,a);framing=framingKey;
 }
 const [eye,dir]=camera;
 renderer.render(eye,dir,[],{hands:[],actors,clay:clay.checked,clock:phase,flashlight:lamp.checked?.045:0},1);
 document.body.dataset.ready='true';
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
