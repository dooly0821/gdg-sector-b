// Static map geometry is immutable after scene construction. Cache the local
// collision candidates for an entire 4 m cell including its 3 m query margin.
const maps=new WeakMap();
export function nearbyBlocks(blocks,x,z){
 if(blocks.length<100)return blocks;
 let cells=maps.get(blocks);
 if(!cells){cells=new Map();maps.set(blocks,cells);}
 const cx=Math.floor(x/4),cz=Math.floor(z/4),key=cx+','+cz;
 if(!cells.has(key))cells.set(key,blocks.filter(b=>b[2]>=cx*4-3&&b[0]<=cx*4+7&&b[3]>=cz*4-3&&b[1]<=cz*4+7));
 return cells.get(key);
}
// Segment vs. padded box, in world metres. Return the first hit fraction.
export function traceBox(a,b,box,pad=0){
 let enter=0,leave=1;
 for(const [i,lo,hi] of [[0,0,2],[1,4,5],[2,1,3]]){
  const delta=b[i]-a[i],min=box[lo]-pad,max=box[hi]+pad;
  if(Math.abs(delta)<1e-8){if(a[i]<min||a[i]>max)return Infinity;continue;}
  const t=(min-a[i])/delta,u=(max-a[i])/delta;
  enter=Math.max(enter,Math.min(t,u));leave=Math.min(leave,Math.max(t,u));
  if(enter>leave)return Infinity;
 }
 return enter;
}
export function equipmentClearance(s,blocks,dt,dynamic=[]){
 const eye=[s.x,s.y+(s.bodyHeight??1.70)-.12,s.z],cp=Math.cos(s.pitch);
 const f=[-Math.sin(s.yaw)*cp,Math.sin(s.pitch),-Math.cos(s.yaw)*cp];
 const local=nearbyBlocks(blocks,s.x,s.z).concat(dynamic);
 let nearest=1;
 for(const side of [-.22,0,.22]){
  const end=eye.map((v,i)=>v+f[i]*1.12+[side*Math.cos(s.yaw),-.32,-side*Math.sin(s.yaw)][i]);
  for(const b of local)nearest=Math.min(nearest,traceBox(eye,end,b,.12));
 }
 const need=Math.max(0,1-nearest);
 s.obstruction=Math.max(need,(s.obstruction??0)*Math.exp(-dt*11));
}
