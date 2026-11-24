import {cross,dot,unit} from './world.js';
import {POSES,MATERIALS,TORCH_LOCAL,SOCKETS,FINGER_FLEX} from "./viewmodel-mesh-data.js";
export {TORCH_LOCAL,SOCKETS,FINGER_FLEX};
const PI=Math.PI;
export function buildParcel(w, x, y, z, size) {
  const h = size * 0.88;
  const d = size * 0.82;
  const mid = y + h / 2;
  const front = w.imageMat("parcel_original_front", "assets/package-front.webp");
  const side = w.imageMat("parcel_original_side", "assets/package-side.webp");
  const top = w.imageMat("parcel_original_lid", "assets/package-top.webp");
  const liner = w.mat("parcel_flute", "#ae8051", "cardboard");
  const crease = w.mat("parcel_crease", "#705034", "cardboard");
  const seal = w.mat("parcel_seal", "#d69a28", "paint");
  const gap = size * 0.001;
  w.box(x, mid, z, size, h, d, liner);
  w.face(x, mid, z+d/2+gap, size, h, front);
  w.face(x+size/2+gap, mid, z, d, h, side, 0, PI/2, 0);
  w.face(x-size/2-gap, mid, z, d, h, side, 0, -PI/2, 0);
  w.face(x, y+h+gap, z, size, d, top, -PI/2, 0, 0);
  // The original upper seal continues onto the unprinted reverse carton flap.
  w.box(x, mid, z-d/2-gap, size*.004, h, gap, crease);
  w.box(x, y+h*.895, z-d/2-2*gap, size*.18, h*.21, gap, seal);
  w.box(x, y-gap, z, size*.18, gap, d, seal);
}


function model(w,pose,channel){
 for(const part of POSES[pose]){const a=MATERIALS[part.material],m=w.mat('vm_'+part.material,a.color,a.texture==='plain'?'plain':'image',part.material==='lens'?.7:0);if(a.texture!=='plain')m.url='assets/'+a.texture+'.webp';w.parts.push({shape:part.shape,pos:[0,0,0],axes:[[1,0,0],[0,1,0],[0,0,1]],m,channel:(pose.startsWith("carry")&&part.shape.includes("_sleeve_"))?channel+"Sleeve":channel});}
}
export function buildHands(w,carrying){
 if(carrying){buildParcel(w,0,-.584,-.864,.446);for(const p of w.parts)p.channel='parcel';model(w,'carryL','left');model(w,'carryR','right');model(w,'supportL','support');}
 else{model(w,'emptyL','left');model(w,'emptyR','right');}
}
export function buildFlashlight(w){model(w,'torch','right');}

// Place the actual sculpted glove in another rig by its wrist and finger axes.
export function gloveMatrix(pose,wrist,direction,lateral,scale){
 const f=FINGER_FLEX[pose],forward=unit(direction);
 const width=unit(lateral.map((v,i)=>v-dot(lateral,forward)*forward[i]));
 const handedness=Math.sign(dot(cross(f.width,f.forward),f.normal));
 const normal=cross(width,forward).map(v=>v*handedness);
 const axes=[0,1,2].map(i=>[0,1,2].map(j=>scale*(width[j]*f.width[i]+normal[j]*f.normal[i]+forward[j]*f.forward[i])));
 const pos=wrist.map((v,j)=>v-axes.reduce((sum,a,i)=>sum+a[j]*SOCKETS[pose].wrist[i],0));
 return new Float32Array([...axes[0],0,...axes[1],0,...axes[2],0,...pos,1]);
}
export function buildInspectionGlove(w,pose){
 model(w,pose,'glove');
 w.parts=w.parts.filter(p=>p.shape.includes('_glove_')||p.shape.endsWith('_sleeve_cuff'));
 return w;
}
