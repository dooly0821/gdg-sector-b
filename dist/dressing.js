// Curated, collision-checked set dressing. Coordinates in metres.
export const DRESSING=[
 {zone:'B',stairs:[5.5,8],rack:[-7,-2],stack:[4.5,-3]},
 {zone:'C-01',stairs:[-30,11.5],rack:[-26,0],stack:[-35.5,2.5]},
 {zone:'D-02',stairs:[5,37],rack:[-3,31],stack:[9.5,45]},
 {zone:'D-03',stairs:[-31.5,38],rack:[-31.5,31],stack:[-21,44]},
 {zone:'C-02',stairs:[-21.5,66.5],rack:[-25,57],stack:[-37,68.5]},
 {zone:'D-04',stairs:[3,70],rack:[-10.5,61],stack:[-1,73]}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const STEP_H=.24,TREAD=.55,DECK_Y=1.44;
export const CLIMB_ROUTES=DRESSING.map(({stairs:[x,z],zone})=>({
 zone,x,z,top:DECK_Y,deck:[x-1.2,z+.35,x+1.2,z+2.65],
 nodes:[[x,0,z-3.28],...Array.from({length:6},(_,i)=>[x,STEP_H*(i+1),z-2.675+i*TREAD]),[x,DECK_Y,z+1.05],[x,DECK_Y,z+1.85]]
}));
// Low rack bays are physical cover, not immunity zones.
export const DRESSING_HIDE=DRESSING.flatMap(({rack:[x,z],stairs:[a,b]})=>[[x,z-.90],[a,b+1.7]]);
export function buildDressing(w){
 const metal=w.mat('dressing-frame','#505b5d','metal'),steel=w.mat('dressing-tread','#656660','metal'),dark=w.mat('dressing-shadow','#292d2c','metal'),amber=w.mat('dressing-edge','#b38e4c','paint'),wood=w.mat('dressing-pallet','#785e42','wood'),card=w.mat('dressing-cardboard','#968061','wood'),strap=w.mat('dressing-strap','#343c37','rubber'),bin=w.mat('dressing-bin','#535b54','metal'),red=w.mat('dressing-pump','#684239','paint');
 const solid=(x,y,z,a,h,d,m,kind)=>{w.box(x,y+h/2,z,a,h,d,m);w.block(x-a/2,z-d/2,x+a/2,z+d/2,y,y+h,kind);};
 const crate=(x,y,z,a,h,d,m=wood)=>{solid(x,y,z,a,h,d,m,'climb');for(const k of [-1,1]){w.box(x+k*(a*.39),y+h/2,z,a*.065,h+.01,d+.018,strap);w.box(x,y+h-.04,z+k*(d*.48),a,.08,.035,wood);}w.box(x,y+.07,z,a+.02,.08,d+.02,wood);};
 for(const [i,{zone,stairs:[x,z],rack:[rx,rz],stack:[sx,sz]}] of DRESSING.entries()){
  // Six actual .24m treads, a raised loading platform and an open crouch bay.
  for(let j=0;j<6;j++){const h=(j+1)*STEP_H,p=z-2.675+j*TREAD;solid(x,0,p,1.84,h,TREAD,steel,'climb');w.box(x,h+.004,p-TREAD*.5+.045,1.78,.008,.075,amber);for(const side of [-1,1])w.box(x+side*.89,h*.50,p,.055,h,.51,dark);}
  solid(x,DECK_Y-.13,z+1.50,2.4,.13,2.30,metal,'climb');
  for(const side of [-1,1])for(const dz of [.48,2.47])solid(x+side*1.13,0,z+dz,.12,DECK_Y-.13,.12,metal);
  // Rear half guard, side exit remains open for a jump. Below remains crawlable.
  for(const side of [-1,1]){solid(x+side*1.16,DECK_Y,z+2.15,.055,.80,.055,metal);w.box(x+side*.84,DECK_Y+.77,z+2.15,.64,.055,.055,amber);}
  solid(x,DECK_Y,z+2.60,2.4,.72,.075,metal,'rail');
  w.sign(x,DECK_Y+.42,z+2.55,1.52,.17,zone+' / SERVICE PLATFORM','#373d39','#dfcfaa',Math.PI);
  w.shadow(x,z+.3,2.6,6.3);
  // Rack island: lower middle opening, closed cargo faces at each side.
  for(const dx of [-1.65,1.65])for(const dz of [-.79,.79])solid(rx+dx,0,rz+dz,.12,2.75,.12,metal);
  for(const h of [1.25,2.65]){solid(rx,h,rz,3.42,.13,1.72,steel,'shelf');w.box(rx,h+.06,rz-.88,3.42,.10,.045,amber);}
  for(const dx of [-1.15,1.15]){crate(rx+dx,0,rz,.86,.92,1.42,i%2?bin:wood);crate(rx+dx,1.38,rz,.93,.75,1.40,card);}
  crate(rx-.50,2.78,rz,.88,.60,1.38,card);crate(rx+.65,2.78,rz,1.12,.50,1.30,wood);
  w.sign(rx,1.31,rz-.915,1.04,.10,'LOW ACCESS / '+zone,'#343a36','#dbbf84',Math.PI);w.shadow(rx,rz,3.55,1.9);
  // Lower staggered palletised cargo and maintenance objects.
  crate(sx-.65,0,sz-.45,1.22,.56,1.15,wood);
  crate(sx+.55,0,sz+.25,1.22,1.07,1.18,i===5?bin:card);
  if(i%2===0){crate(sx+.55,1.07,sz+.25,.88,.60,.90,wood);for(const dz of [-.58,.58]){solid(sx-1.08,0,sz+.55+dz,.47,.83,.48,red);w.cyl(sx-1.08,.86,sz+.55+dz,.19,.06,.19,dark);}}
  else {solid(sx-.7,0,sz+.72,.74,1.38,.60,bin);w.box(sx-.7,1.07,sz+.38,.44,.11,.07,amber);w.box(sx-.7,.18,sz+.38,.36,.12,.07,dark);}
  w.shadow(sx,sz,2.65,2.85);
 }
}
export function routeForPlayer(s){
 if(s.y<.55||s.vault||!s.grounded)return null;
 return CLIMB_ROUTES.find(r=>Math.abs(s.x-r.x)<1.22&&s.z>r.z-2.7&&s.z<r.z+2.5&&s.y<=r.top+.25)??null;
}
export function onRouteSupport(route,x,y,z){
 if(Math.abs(x-route.x)>1.13)return false;
 const [, , ,maxZ]=route.deck;
 if(z>=route.deck[1]&&z<=maxZ)return Math.abs(y-route.top)<.08;
 const k=Math.floor((z-(route.z-2.95))/TREAD);
 return k>=0&&k<6&&Math.abs(y-STEP_H*(k+1))<.08;
}
