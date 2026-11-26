import {buildVent} from './facility-actions.js';
import {EXTENSION_END,EXTENSION_STAIRS} from './map-layout.js';
export function buildExpansion(w){
 const slab=w.mat('extension-slab','#625e58','concrete'),wall=w.mat('extension-wall','#424a52','concrete'),steel=w.mat('extension-frame','#454d51','metal'),tread=w.mat('extension-tread','#626760','metal'),amber=w.mat('extension-safety','#bd984a','paint'),wood=w.mat('extension-pallet','#765e43','wood'),cargo=w.mat('extension-cargo','#92816b','carton'),black=w.mat('extension-dark','#252a2d','rubber'),red=w.mat('extension-light','#e13b2e','plain',1.4);
 const solid=(x,y,z,a,h,d,m,kind)=>{w.box(x,y+h/2,z,a,h,d,m);w.block(x-a/2,z-d/2,x+a/2,z+d/2,y,y+h,kind);};
 w.box(-14,-.16,90,58,.32,24,slab);
 for(const x of [-43,15])solid(x,0,90,.34,11,24,wall);
 solid(-14,0,EXTENSION_END,58,11,.34,wall,'extension-boundary');
 for(const [a,b] of [[78,84],[90,92.25],[93.75,96],[100,102]])solid(-15,0,(a+b)/2,.25,10.5,b-a,wall);
 solid(-15,1.18,93,.25,9.32,1.5,wall);buildVent(w,93);
 for(const z of [81,87,93,99]){w.box(-14,11.1,z,58,.20,6.1,steel);w.beam([-43,10.6,z],[15,10.6,z],.22,.24,steel);for(const x of [-41,-16,14])solid(x,0,z,.22,10.5,.22,steel);}
 for(const [x,z] of [[-37,86],[-24,83],[-20,93],[-37,97],[-7,86],[6,83],[10,93],[-7,97]]){
  for(const dx of [-1.5,1.5])for(const dz of [-.65,.65])solid(x+dx,0,z+dz,.10,3.8,.10,steel);
  for(const h of [1.25,2.65,3.55])solid(x,h,z,3.1,.13,1.45,tread,'shelf');
  for(const dx of [-1.0,1.0]){solid(x+dx,0,z,.75,.85,1.1,cargo,'climb');solid(x+dx,1.38,z,.75,.65,1.0,wood,'climb');}
  w.box(x,1.30,z-.75,3.1,.06,.04,amber);
 }
 for(const [i,[x,z]] of EXTENSION_STAIRS.entries()){
  for(let j=0;j<6;j++){const h=.24*(j+1),p=z-2.675+j*.55;solid(x,0,p,1.84,h,.55,tread,'climb');w.blocks.at(-1)[8]={id:'ext-stair:'+i,axis:2,low:z-3.17,high:z+.095,top:1.44};w.box(x,h+.004,p-.23,1.78,.008,.075,amber);}
  solid(x,1.31,z+1.5,2.4,.13,2.3,steel,'climb');for(const dx of [-1.13,1.13])for(const dz of [.48,2.47])solid(x+dx,0,z+dz,.12,1.31,.12,steel);
  solid(x,1.44,z+2.60,2.4,.72,.075,amber,'rail');w.sign(x,1.9,z+2.55,1.4,.17,'SERVICE / E-'+String(i+1),'#373d39','#dfcfaa',Math.PI);
 }
 for(const [x,z] of [[-39,90],[-18,86],[-18,96],[-9,90],[12,86],[12,96]]){solid(x,0,z,1.2,.48,1.2,wood,'climb');solid(x,0,z+1.5,1.2,.96,1.1,cargo,'climb');}
 for(const [x,z] of [[-38,87],[-19,91],[-8,87],[11,91]]){solid(x,1.22,z,1.65,.14,1.5,steel);for(const dx of [-.78,.78])solid(x+dx,0,z,.09,1.22,1.5,steel);w.box(x,.02,z,1.5,.04,1.4,black);}
 for(const x of [-36,-24,-6,8])for(const z of [82,90,98]){w.cyl(x,6,z,.33,.20,.33,steel);w.cyl(x,5.86,z,.27,.04,.27,red);w.lights.push([x,5.8,z,1]);}
 for(const x of [-30,0])for(let z=79;z<101;z+=1.4)w.box(x,.012,z,.075,.016,.75,amber);
 w.sign(-30,3.75,78.22,4.5,.4,'E-01 / OVERSIZE FREIGHT','#332c27','#f0d4a3');
 w.sign(0,3.75,78.22,4.5,.4,'E-02 / NIGHT RESERVE','#332c27','#f0d4a3');
}
