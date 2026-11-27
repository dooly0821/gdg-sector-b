import {traceBox} from './contact.js';
// Presentation only: never modify signal lifetime, actor AI or interaction reach.
export function activeSignal(s){const signal=s.signals?.[s.id??'solo'];return signal&&signal.until>s.elapsed&&signal.start<=s.elapsed?signal:null;}
export function signalPower(signal,elapsed){
 if(!signal||elapsed>=signal.until)return 1;
 const age=Math.max(0,elapsed-signal.start),fade=Math.min(1,Math.max(0,(signal.until-elapsed)/.30));
 // Smooth, two slow swells instead of hard on/off flashes.
 return 1+fade*(.65+.65*(.5+.5*Math.cos(age*Math.PI*2)));
}
export function visibleSignalPoint(signal,eye,blocks){
 const point=[signal.x,Number.isFinite(signal.y)?signal.y:.18,signal.z];
 if(!point.every(Number.isFinite)||Math.hypot(point[0]-eye[0],point[2]-eye[2])>25)return null;
 const minX=Math.min(point[0],eye[0]),maxX=Math.max(point[0],eye[0]),minZ=Math.min(point[2],eye[2]),maxZ=Math.max(point[2],eye[2]);
 for(const b of blocks){if(b[0]>maxX||b[2]<minX||b[1]>maxZ||b[3]<minZ)continue;if(traceBox(eye,point,b)<.985)return null;}
 return point;
}
export function clearSignalFeedback(host,status){if(host){host.hidden=true;host.replaceChildren();}if(status)status.hidden=true;}
export function renderSignalFeedback(s,eye,blocks,project,host,status,now){
 if(!host||!status)return;
 if(s.failed){clearSignalFeedback(host,status);return;}
 const own=activeSignal(s);
 status.hidden=!own;
 if(own){const left=Math.max(0,own.until-s.elapsed);status.querySelector('i').style.transform='scaleX('+Math.min(1,left/2)+')';}
 const list=Object.values(s.signals??{}).filter(sig=>sig.until>s.elapsed&&sig.start<=s.elapsed).slice(0,4);
 host.hidden=!list.length;
 if(!list.length){if(host.childElementCount)host.replaceChildren();return;}
 const seen=new Set(),cache=s.signalSightCache??={};
 for(const sig of list){
  const id=String(sig.id),key=id;seen.add(key);
  let el=[...host.children].find(n=>n.dataset.signal===key);
  if(!el){el=document.createElement('div');el.className='lure-marker';el.dataset.signal=key;el.innerHTML='<span class="lure-ring"></span><span class="lure-dot"></span><b></b>';host.append(el);}
  el.classList.toggle('own',sig.owner===(s.id??'solo'));
  let test=cache[key];
  if(!test||now-test.at>=75||Math.hypot(eye[0]-test.eye[0],eye[1]-test.eye[1],eye[2]-test.eye[2])>.18||test.blocks!==blocks){
   // Cache LOS independently of projection; the marker stays attached to the world.
   test=cache[key]={at:now,eye:eye.slice(),blocks,point:visibleSignalPoint(sig,eye,blocks)};
  }
  const clip=test.point&&project(test.point);el.hidden=!clip||!clip.every(Number.isFinite)||Math.abs(clip[0])>.94||Math.abs(clip[1])>.91;
  if(!el.hidden){
   el.style.left=(clip[0]+1)*50+'%';el.style.top=(1-clip[1])*50+'%';
   const label=(sig.owner===(s.id??'solo')?'유인 지점':'팀원 유인')+' · '+Math.round(Math.hypot(sig.x-eye[0],sig.z-eye[2]))+'m';
   if(el.lastElementChild.textContent!==label)el.lastElementChild.textContent=label;
  }
 }
 for(const el of [...host.children])if(!seen.has(el.dataset.signal))el.remove();
 for(const id of Object.keys(cache))if(!seen.has(id))delete cache[id];
}
