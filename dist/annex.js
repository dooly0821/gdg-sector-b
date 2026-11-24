// The west loading passage links the original warehouse to a second hall.
export const ANNEX={west:-43,east:-15,north:-9,south:21,entry:[-16,0,14]};
export const CORE=[-34,2.8,-3];

export function buildAnnex(w){
 const steel=w.mat('annex-steel','#354253','metal'),rib=w.mat('annex-rib','#66737c','metal');
 const wall=w.mat('annex-wall','#485463','concrete'),slab=w.mat('annex-floor','#77706a','concrete',0,1.5);
 const amber=w.mat('annex-safety','#c79546','paint'),wood=w.mat('annex-pallet','#8b6346','wood');
 const dark=w.mat('annex-black','#24262c','rubber'),cold=w.mat('annex-glazing','#8aaed4','plain',.65);
 const bulb=w.mat('annex-bulb','#ffd39a','plain',1.1),red=w.mat('annex-stator','#9b282d','metal',.65);
 const filament=w.mat('annex-filament','#ff6649','plain',1.9),glassFrame=w.mat('annex-vessel','#54333d','metal',.16);
 const parcel=w.mat('annex-carton','#aa8056','carton');
 const solid=(x,y,z,a,b,c,m,kind)=>{
  w.box(x,y+b/2,z,a,b,c,m);
  w.block(x-a/2,z-c/2,x+a/2,z+c/2,y,y+b,kind);
 };
 w.box(-29,-.17,6,28,.34,30,slab);
 for(const x of [-43,-15]){
  const segments=x===-43?[[-9,21]]:[[-9,12],[16,21]];
  for(const [a,b] of segments)solid(x,0,(a+b)/2,.32,8.2,b-a,wall);
 }
 for(const z of [-9,21])solid(-29,0,z,28,8.2,.32,wall);
 for(let z=-8;z<21;z+=4){
  w.box(-29,.004,z,27.8,.008,.018,dark);
  for(const x of [-42.5,-15.5])solid(x,0,z,.32,8.1,.37,steel);
  w.beam([-43,7.5,z],[-15,7.5,z],.21,.23,steel);
  for(let x=-42;x<-16;x+=3){
   w.beam([x,7.52,z],[x+2.5,8.7,z],.11,.12,rib);
   w.box(x,8.8,z+1.75,2.99,.13,4,x<-20&&x>-30&&z%8===0?cold:steel);
  }
 }
 // Close the wall-to-skylight gap and give the roof a continuous outline.
 for(const x of [-42.5,-16])w.box(x,8.79,6,1.15,.16,30.2,steel);
 for(const [x,z] of [[-21,14],[-29,13],[-39,10],[-27,3],[-39,-2],[-22,-4]]){
  w.cyl(x,7.39,z,.025,2.55,.025,dark);
  w.cyl(x,6.10,z,.44,.20,.44,steel);w.cyl(x,5.99,z,.35,.035,.35,bulb);w.lamp(x,5.95,z);
 }
 for(const x of [-15.48,-14.64])w.sign(x,3.12,14,3.55,.42,'C-01 / NIGHT SORTING','#332c27','#eac98f',x<-15?-Math.PI/2:Math.PI/2);
 for(const z of [12.02,15.98])w.box(-15,1.8,z,.55,3.6,.14,amber);
 w.box(-15,3.62,14,.55,.22,4.12,steel);
 for(let x=-41;x<-16;x+=1.25){
  w.box(x,.014,12.1,.83,.019,.07,amber);
  w.box(x,.014,15.9,.83,.019,.07,amber);
 }
 for(const [x,z] of [[-25,7],[-25,-3],[-39,2],[-39,18.7],[-23,19]]){
  solid(x,0,z,2.85,.18,1.36,wood);
  for(const dx of [-1.36,1.36])for(const dz of [-.67,.67])solid(x+dx,0,z+dz,.105,5.55,.12,steel);
  for(let level=0;level<3;level++){
   const y=.78+level*1.5;
   w.box(x,y,z,2.86,.15,1.39,rib);
   w.block(x-1.36,z-.65,x+1.36,z+.65,y-.075,y+.80);
   for(let i=0;i<4;i++)w.box(x+(i-1.5)*.68,y+.45,z,.59,.74,.94,parcel,0,.04*(i-1),0);
  }
  w.sign(x,4.4,z+.72,.86,.22,'C / ' + Math.abs(x+z).toFixed(0),'#343331','#eadabe');
 }
 for(const [x,z] of [[-21,10],[-30,17.8],[-37,11],[-29,-3]]){
  solid(x,0,z,1.6,.17,1.22,wood);
  solid(x,.17,z,1.25,.55,.96,wood,'climb');
  for(const dz of [-.49,.49]){
   for(const dx of [-.55,.55])w.box(x+dx,.44,z+dz,.12,.56,.06,wood);
   w.beam([x-.55,.25,z+dz],[x+.55,.67,z+dz],.084,.07,wood);
  }
 }
 // A low inspection deck gives the west hall an alternate path above the floor.
 solid(-34,0,6,8,.86,2.35,steel,'climb');
 for(let i=0;i<5;i++)solid(-29.85+i*.39,0,6,.4,.86-i*.17,2.12,rib);
 for(let i=0;i<5;i++)solid(-38.15-i*.39,0,6,.4,.86-i*.17,2.12,rib);
 for(const z of [4.84,7.16]){
  for(let x=-37.94;x<-30;x+=1.3)w.cyl(x,1.35,z,.04,.98,.04,amber);
  for(const y of [1.31,1.85])w.box(-34,y,z,8,.055,.055,amber);
  const postsTop=1.35+.98/2,railTop=1.85+.055/2;
  w.block(-38,z-.045,-30,z+.045,.86,Math.max(postsTop,railTop),'rail');
 }
 for(let i=0;i<14;i++)w.box(-37.7+i*.55,.867,6,.032,.014,2.12,dark);
 const [cx,,cz]=CORE;
 solid(cx,0,cz,4.7,.40,4.7,steel);
 w.block(cx-1.72,cz-1.72,cx+1.72,cz+1.72,.4,5.1);
 w.cyl(cx,2.8,cz,1.38,4.65,1.38,dark);
 for(const y of [.65,1.08,4.5,4.87]){
  w.cyl(cx,y,cz,1.77,.22,1.77,steel);
  w.cyl(cx,y+.13,cz,1.66,.065,1.66,red);
 }
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,x=cx+1.65*Math.cos(a),z=cz+1.65*Math.sin(a);
  w.box(x,2.78,z,.17,3.6,.17,rib);
  const b=a+.22,px=cx+1.53*Math.cos(b),pz=cz+1.53*Math.sin(b);
  w.box(px,2.76,pz,.55,3.28,.08,glassFrame,0,Math.PI/2-b,0);
  for(let j=0;j<4;j++){
   const y=1.25+j*.77,glowX=cx+1.585*Math.cos(b),glowZ=cz+1.585*Math.sin(b);
   w.beam([glowX-.13*Math.sin(b),y,glowZ+.13*Math.cos(b)],[glowX+.15*Math.sin(b),y+.61,glowZ-.15*Math.cos(b)],.025,.04,filament);
  }
 }
 for(const x of [cx-1.2,cx+1.2]){
  w.beam([x,4.98,cz],[x,6.45,cz],.38,.39,steel);
  w.beam([x,6.45,cz],[x,6.45,-8.9],.40,.42,steel);
 }
 w.sign(cx,4.1,cz+1.77,1.62,.30,'CONTAINMENT 01','#371e27','#ffd1a1');
 for(const x of [-36.9,-31.1])for(let z=-6;z<1;z+=.66){
  w.box(x,.019,z,.16,.025,.52,amber,0,.6);
 }
 for(const x of [-39,-29,-20]){
  w.box(x,2.2,-8.78,3.2,1.7,.24,steel);
  w.box(x,2.2,-8.60,2.98,1.5,.12,dark);
  for(let i=0;i<10;i++)w.box(x,1.53+i*.15,-8.49,2.88,.065,.12,rib);
  w.box(x+1.32,2.86,-8.46,.10,.055,.025,filament);
 }
 for(let z=-7.5;z<4;z+=.6)w.box(-31.15,.018,z,.48,.022,.10,amber,0,-.65);
}
