import {World,unit} from './world.js';
import {Renderer} from './renderer.js';
import {buildWorker} from './worker.js';
import {hauntLayers,buildHauntRigs,ACTOR_START} from './haunt.js';
const scene=new World(),floor=scene.imageMat('building-slab','assets/floor-deck.webp');
scene.box(0,-.24,0,16,.20,16,floor);
scene.box(0,-.074,0,16,.14,16,scene.mat("studio-floor","#686777","concrete"));
scene.lamp(-3,5,4);scene.lamp(4,5,-5);
for(let i=2;i<8;i++)scene.lamp(90,40,50+i);
const renderer=new Renderer(document.querySelector('canvas'));
const rigs=buildHauntRigs(),worker=buildWorker();
await renderer.prepare([scene,...Array.from({length:ACTOR_START-1},()=>new World()),...rigs,worker]);
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const select=document.querySelector('select'),rotation=document.querySelector('[type=range]'),lamp=document.querySelector('[type=checkbox]');
function draw(ms){
 const i=select.selectedIndex-1,t=ms/1000,a=Number(rotation.value)*Math.PI/180;
 const h=[1.65,2.48,2.12,1.10,2.60][i+1],r=h*.87;
 const eye=[r*Math.sin(a),h*.53,r*Math.cos(a)],dir=unit([-eye[0],-.035,-eye[2]]);
 const actor={kind:i,x:0,z:0,yaw:0,state:'patrol',speed:.55,phase:t*2,aggression:0,age:4};
 const actors=i<0?[{group:ACTOR_START+rigs.length,matrix:identity}]:hauntLayers({x:0,z:1,haunt:[actor]});
 renderer.render(eye,dir,[],{hands:[],actors,clock:t,flashlight:lamp.checked?.045:0},1);
 document.body.dataset.ready='true';
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
