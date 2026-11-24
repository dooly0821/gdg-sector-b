import {gripContacts} from './grip-contacts.js';
import {unit,cross} from './world.js';
import {nearbyBlocks} from './contact.js';
// Developer overlay uses the same camera projection and solids as gameplay.
export function drawTraversalDebug(s,blocks,renderer,pose,eye,view){
 let canvas=document.querySelector('#traversal-debug');
 if(!s.showTraversal){if(canvas)canvas.remove();return;}
 if(!canvas){
  canvas=document.createElement('canvas');canvas.id='traversal-debug';
  canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
  document.querySelector('#play').append(canvas);
 }
 if(canvas.width!==innerWidth||canvas.height!==innerHeight){canvas.width=innerWidth;canvas.height=innerHeight;}
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 const project=p=>{const q=renderer.project(p);return q&&[(1+q[0])*canvas.width/2,(1-q[1])*canvas.height/2];};
 function line(a,b,color){
  const p=project(a),q=project(b);if(!p||!q)return;
  ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();
 }
 for(const b of nearbyBlocks(blocks,s.x,s.z)){
  const top=[[b[0],b[5],b[1]],[b[2],b[5],b[1]],[b[2],b[5],b[3]],[b[0],b[5],b[3]]];
  if(b[7])top.forEach((p,j)=>p[1]=b[7][j<2?1:3]);
  for(let i=0;i<4;i++){
   line(top[i],top[(i+1)%4],b[6]?'#5fddbb':'#cf8c54');
   line(top[i],[top[i][0],b[4],top[i][2]],'#85838a');
  }
 }
 if(s.vault)line([s.x,s.y+.8,s.z],s.vault.grip,'#fff22a');
 for(const a of s.haunt??[])for(const ray of a.rays??[])line(ray.from,ray.to,ray.open?'#ff5468':'#888');
 // Convert the same final viewmodel transform used by WebGL back to world
 // space, including the flashlight aim correction and the held carton offset.
 const right=unit(cross(view,[0,1,0])),up=cross(right,view);
 const names={4:'carryL',5:'carryR',7:'torch',10:'supportL'};
 for(const layer of pose.hands){
  const contacts=gripContacts[names[layer.group]];
  if(!contacts)continue;
  for(const pos of Object.values(contacts)){
   const p=pos.map((v,k)=>v+layer.offset[k]),m=layer.matrix;
   const q=m?[0,1,2].map(k=>m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]+m[12+k]):p;
   const uv=project(eye.map((v,k)=>v+q[0]*right[k]+q[1]*up[k]-q[2]*view[k]));
   if(uv){ctx.beginPath();ctx.arc(...uv,3,0,2*Math.PI);ctx.fillStyle='#53ddff';ctx.fill();}
  }
 }
 ctx.fillStyle='white';ctx.font='15px monospace';
 ctx.fillText((s.vault?(s.vault.high?'climb':'vault'):s.grounded?'ground':'air')+'   '+s.bodyHeight.toFixed(2)+' m',16,canvas.height-64);
}
