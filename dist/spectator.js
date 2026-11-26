import {traceBox,nearbyBlocks} from './contact.js';
import {basis,unit} from './world.js';
export function spectatorTarget(players,you,current,direction=0){
 const alive=(players??[]).filter(p=>p.id!==you&&!p.failed);
 if(!alive.length)return null;
 const i=alive.findIndex(p=>p.id===current);
 return alive[i<0?0:(i+direction%alive.length+alive.length)%alive.length];
}
export function spectatorCamera(p,blocks,previous,dt,extra=[]){
 const yaw=p.yaw??0,alpha=1-Math.exp(-Math.max(0,dt)*15),same=previous?.id===p.id;
 const anchor=[p.x,p.y+Math.min(1.35,(p.bodyHeight??1.7)*.8),p.z];
 const smoothed=same?anchor.map((v,i)=>previous.anchor[i]+(v-previous.anchor[i])*alpha):anchor;
 const angle=same?previous.yaw+Math.atan2(Math.sin(yaw-previous.yaw),Math.cos(yaw-previous.yaw))*alpha:yaw;
 // Camera behind the teammate, above the shoulder. Sweep against actual walls and doors.
 const wanted=[smoothed[0]+Math.sin(angle)*3.15,smoothed[1]+1.05,smoothed[2]+Math.cos(angle)*3.15];
 const obstacles=nearbyBlocks(blocks,p.x,p.z).concat(nearbyBlocks(blocks,wanted[0],wanted[2]),extra);
 let fraction=1;for(const b of obstacles){const hit=traceBox(smoothed,wanted,b,.14);if(Number.isFinite(hit))fraction=Math.min(fraction,Math.max(.015,hit-.045));}
 const eye=smoothed.map((v,i)=>v+(wanted[i]-v)*fraction);
 const aim=[smoothed[0]-Math.sin(angle)*1.4,smoothed[1]-.05,smoothed[2]-Math.cos(angle)*1.4];
 return {id:p.id,anchor:smoothed,yaw:angle,eye,view:unit(aim.map((v,i)=>v-eye[i]))};
}
export function downedMatrix(p){
 // Lay the existing worker model along the floor; keep the torso at the revive coordinate.
 const axes=basis(Math.PI/2,Math.PI+(p.yaw??0),0),origin=[p.x-axes[1][0]*.75,p.y+.23,p.z-axes[1][2]*.75];
 return new Float32Array([...axes.flatMap(a=>[...a,0]),...origin,1]);
}
export function rescueLayers(players,you,group){
 return (players??[]).filter(p=>p.failed&&p.id!==you).map(p=>{
  const matrix=downedMatrix(p);
  return {group,matrix,root:[p.x,p.y+.25,p.z],skinName:'player',skin:{name:'player',root:matrix,floor:null,state:{speed:0,steps:0,bodyHeight:1.7,carried:-1,vault:false}}};
 });
}
