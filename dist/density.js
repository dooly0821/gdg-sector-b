// Curated density pass. Static coordinates, shared by solo and authoritative co-op.
const DIMENSIONS={low:[1.25,.86,.58],stack:[1.65,1.20,2.05],rack:[2.7,1.45,2.45],bin:[1.15,1.05,1.12],locker:[1.16,1.12,2.12],drums:[.95,.95,1.04]};
export const DENSE_PROPS=Object.freeze([["B",4.1,-8.4,"locker",0],["B",-2.4,13.7,"rack",0],["B",10.6,17,"low",0],["B",-3.7,-18.2,"stack",1],["B",2.8,2.6,"bin",0],["B",-5,18.3,"rack",0],["C-01",-40.1,-0.9,"locker",0],["C-01",-22,-5.5,"rack",0],["C-01",-22.6,2.3,"low",1],["C-01",-26.5,17.9,"stack",1],["C-01",-33,17.9,"bin",1],["C-01",-28.5,-5.5,"rack",0],["C-01",-18.1,17.3,"low",1],["D-03",-34.3,33.9,"locker",0],["D-03",-24.6,39.8,"rack",0],["D-03",-27.2,30.7,"low",0],["D-03",-21.3,32,"stack",1],["D-03",-17.4,48.9,"bin",0],["D-03",-35.6,24.8,"rack",0],["D-03",-35.6,46.9,"low",1],["D-03",-17.4,25.5,"stack",1],["D-03",-40.1,50.8,"drums",0],["D-03",-25.2,50.2,"low",0],["D-02",12.6,26.1,"locker",0],["D-02",-6.3,41.1,"rack",0],["D-02",11.9,50.2,"low",0],["D-02",6.7,32,"stack",0],["D-02",-10.2,50.2,"bin",0],["D-02",4.8,43,"rack",0],["D-02",0.9,47.6,"low",0],["D-02",0.9,37.2,"stack",0],["D-02",12.6,43.7,"drums",1],["D-02",-0.4,28.1,"low",0],["C-02",-35,58.8,"locker",0],["C-02",-20.7,57.5,"rack",0],["C-02",-27.8,64.6,"low",1],["C-02",-35.6,73.1,"stack",0],["C-02",-18.7,71.8,"bin",1],["C-02",-27.2,75.7,"rack",0],["C-02",-29.1,58.8,"low",0],["C-02",-17.4,60.7,"stack",1],["D-04",-5,60.1,"locker",0],["D-04",11.9,60.7,"rack",0],["D-04",6.7,66,"low",1],["D-04",2.8,61.4,"stack",0],["D-04",-6.9,75.1,"bin",0],["D-04",6.7,57.5,"rack",0],["D-04",10.6,71.2,"low",1],["D-04",-5.6,68.6,"stack",0]].map(([zone,x,z,kind,rot])=>{
 const [a,b,h]=DIMENSIONS[kind];return Object.freeze({zone,x,z,kind,rot,w:rot?b:a,d:rot?a:b,h});
}));
export const DENSE_LOCKERS=DENSE_PROPS.filter(p=>p.kind==='locker').map(p=>[p.x,p.z]);
export const DENSE_HIDE=DENSE_PROPS.filter(p=>p.kind==='rack').map(p=>[p.x,p.z-p.d/2-.50]);
export function buildDenseDressing(w){
 const steel=w.mat('density-blue-steel','#47555e','metal'),edge=w.mat('density-edge','#b99a5d','paint'),rust=w.mat('density-rust','#775640','metal'),black=w.mat('density-rubber','#343432','rubber'),wood=w.mat('density-pallet','#8b6a48','wood'),card=w.mat('density-carton','#b49a75','carton'),card2=w.mat('density-carton-dark','#967854','carton'),bin=w.mat('density-bin','#60675d','metal'),drum=w.mat('density-drum','#744638','paint');
 for(const p of DENSE_PROPS){
  const {x,z,kind,rot}=p;if(kind==='locker')continue;
  const b=(u,y,v,a,h,d,m,solid=false,type)=>{const X=x+(rot?v:u),Z=z+(rot?u:v),A=rot?d:a,D=rot?a:d;w.box(X,y+h/2,Z,A,h,D,m);if(solid)w.block(X-A/2,Z-D/2,X+A/2,Z+D/2,y,y+h,type);};
  const pallet=(a,d)=>{b(0,0,0,a,.13,d,wood,true,'climb');for(let i=0;i<3;i++)b((i-1)*a*.30,.025,0,.08,.08,d+.015,black);};
  const crate=(u,y,v,a,h,d,m=card)=>{b(u,y,v,a,h,d,m,true,'climb');for(const k of [-1,1]){b(u+k*a*.38,y,v,.045,h,d+.012,wood);b(u,y+h-.07,v+k*d*.49,a,.07,.025,wood);}b(u,y+h+.002,v,.07,.014,d,black);};
  if(kind==='low'){pallet(1.25,.86);crate(0,.13,0,1.19,.45,.81);b(0,.59,0,.44,.008,.12,edge);}
  else if(kind==='stack'){pallet(1.65,1.20);for(const [u,h,m] of [[-.42,1.92,card],[.42,1.37,card2]]){const a=.79,d=1.14;for(let n=0;n<3;n++)crate(u,.13+h*n/3,0,a,h/3,d,m);}}
  else if(kind==='bin'){b(0,0,0,1.15,.13,1.05,wood,true,'climb');b(0,.13,0,1.10,.97,1.00,bin,true,'climb');for(const s of [-1,1]){b(s*.48,.22,0,.055,.76,1.02,rust);b(0,.9,s*.51,1.08,.12,.025,edge);}b(0,1.10,0,1.12,.02,1.04,steel);}
  else if(kind==='drums'){for(const u of [-.24,.24]){w.cyl(x+(rot?0:u),.52,z+(rot?u:0),.225,1.04,.225,drum);for(const y of [.14,.50,.90])w.cyl(x+(rot?0:u),y,z+(rot?u:0),.23,.045,.23,steel);}w.block(x-p.w/2,z-p.d/2,x+p.w/2,z+p.d/2,0,1.04,'climb');}
  else if(kind==='rack'){
   for(const u of [-1.29,1.29])for(const v of [-.67,.67])b(u,0,v,.11,2.45,.11,steel,true);
   b(0,1.18,0,2.7,.14,1.45,steel,true,'shelf');b(0,2.31,0,2.7,.14,1.45,steel,true,'shelf');
   for(const v of [-.70,.70])for(const y of [1.22,2.35])b(0,y,v,2.66,.075,.04,edge);
   // Clear central opening .98 m wide, 1.18 m high; two-way crouch passage.
   for(const u of [-.96,.96])crate(u,0,0,.70,1.18,1.22,card2);
   // A thin back panel above the crouch bay blocks sight through the upper rack.
   b(0,1.32,.68,2.52,.98,.10,rust,true);crate(-.67,1.32,0,1.22,.76,1.11);crate(.67,1.32,0,1.17,.69,1.11,card2);
   w.sign(x,1.25,z-.746,1.02,.11,'LOW ACCESS / '+p.zone,'#313530','#e7ce94',Math.PI);
  }
  w.shadow(x,z,p.w+.17,p.d+.17);
 }
}
