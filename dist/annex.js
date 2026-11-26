// The west loading passage links the original warehouse to a second hall.
export const ANNEX={west:-43,east:-15,north:-9,south:21,entry:[-16,0,14]};
export const CORE=[-34,2.8,-3];

export function buildAnnex(w,expanded=false){
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
  for(const [a,b] of segments)solid(x,0,(a+b)/2,.32,11.2,b-a,wall);
 }
 solid(-29,0,-9,28,11.2,.32,wall);
 for(const [a,b] of [[-43,-33],[-27,-15]])solid((a+b)/2,0,21,b-a,11.2,.32,wall);
 solid(-30,3.6,21,6,7.6,.32,wall);
 w.sign(-30,3.82,20.8,3.4,.34,'D-03 / RETURNS','#452c2d','#f4c1a7',Math.PI);
 for(let z=-8;z<21;z+=4){
  w.box(-29,.004,z,27.8,.008,.018,dark);
  for(const x of [-42.5,-15.5])solid(x,0,z,.32,11.1,.37,steel);
  w.beam([-43,10.5,z],[-15,10.5,z],.21,.23,steel);
  for(let x=-42;x<-16;x+=3){
   w.beam([x,10.52,z],[x+2.5,11.7,z],.11,.12,rib);
   w.box(x,11.8,z+1.75,2.99,.13,4,x<-20&&x>-30&&z%8===0?cold:steel);
  }
 }
 // Close the wall-to-skylight gap and give the roof a continuous outline.
 for(const x of [-42.5,-16])w.box(x,11.79,6,1.15,.16,30.2,steel);
 for(const [x,z] of [[-21,14],[-29,13],[-39,10],[-27,3],[-39,-2],[-22,-4]]){
  w.cyl(x,8.89,z,.025,5.55,.025,dark);
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
  for(const dx of [-1.36,1.36])for(const dz of [-.67,.67])solid(x+dx,0,z+dz,.105,8.0,.12,steel);
  for(let level=0;level<3;level++){
   const y=.78+level*1.5;
   w.box(x,y,z,2.86,.15,1.39,rib);
   w.block(x-1.43,z-.695,x+1.43,z+.695,y-.075,y+.075,'shelf');
   if(x===-25&&(level===0||z===7&&level===1)){
    if(z===7&&level===0)solid(x-.57,y+.075,z-.40,.95,1.19,.43,parcel,'climb');
    continue;
   }
   w.block(x-1.32,z-.47,x+1.32,z+.47,y+.08,y+.82,'climb');
   for(let i=0;i<4;i++)w.box(x+(i-1.5)*.68,y+.45,z,.59,.74,.94,parcel,0,.04*(i-1),0);
  }
  for(const y of [5.28,7.08]){
   solid(x,y-.15,z,2.86,.15,1.39,rib,'shelf');
   solid(x,y,z,2.48,.84,1.04,parcel,'climb');
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
 // Staged return crates alongside the open inspection rack form two footholds.
 for(const [x,h] of [[-22.0,.45],[-23.0,.96]]){
  solid(x,0,7,.96,h,1.16,wood,'climb');
  for(const dz of [-.55,.55])w.box(x,h-.08,7+dz,.96,.12,.075,rib);
 }
 // A low inspection deck gives the west hall an alternate path above the floor.
 solid(-34,0,6,8,.86,2.35,steel,'climb');
 for(let i=0;i<5;i++){solid(-29.85+i*.39,0,6,.4,.86-i*.17,2.12,rib);w.blocks.at(-1)[8]={id:'inspection-east',axis:0,low:-27.87,high:-29.745,top:.86};}
 for(let i=0;i<5;i++){solid(-38.15-i*.39,0,6,.4,.86-i*.17,2.12,rib);w.blocks.at(-1)[8]={id:'inspection-west',axis:0,low:-40.13,high:-38.255,top:.86};}
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
 buildSouthExtension(w,expanded);
}

function buildSouthExtension(w,expanded=false){
 const steel=w.mat('extension-steel','#46505a','metal'),floor=w.mat('extension-floor','#68645f','concrete',0,1.4),
 wall=w.mat('extension-wall','#3f4850','concrete'),trim=w.mat('extension-trim','#a16c3a','paint'),
 wood=w.mat('extension-crate','#987653','wood'),dark=w.mat('extension-roof','#303942','metal'),
 amber=w.mat('extension-lamp','#edc190','plain',.65);
 const solid=(x,y,z,a,b,c,m,kind)=>{w.box(x,y+b/2,z,a,b,c,m);w.block(x-a/2,z-c/2,x+a/2,z+c/2,y,y+b,kind);};
 // Two connected halls: D-02 transfer and D-03 returns, both linked to the old map.
 w.box(-14,-.16,37.5,58,.32,33,floor);
 for(const x of [-43,15])solid(x,0,37.5,.34,11,33,wall);
 for(const [a,b] of [[-43,-33],[-27,-3],[3,15]])solid((a+b)/2,0,54,b-a,11,.34,wall);
 for(const x of [-30,0])solid(x,3.6,54,6,7.4,.34,wall);
 // Close the offset between the existing north walls without obstructing the gateways.
 solid(-14.9,0,21.5,.34,11,1,wall);
 for(const [a,b] of [[22,34],[40,54]])solid(-15,0,(a+b)/2,.30,11,b-a,wall);
 solid(-15,3.7,37, .30,7.3,6,wall);
 for(const z of [24,30,36,42,48,53]){
  w.box(-14,11.15,z,58,.18,5.95,dark);
  w.beam([-43,10.75,z],[15,10.75,z],.22,.25,steel);
  for(const x of [-40,-25,-11,11]){solid(x,0,z,.22,10.7,.22,steel);}
  for(const x of [-34,-4,8]){w.box(x,5.9,z,.8,.10,.22,steel);w.box(x,5.82,z,.70,.045,.14,amber);w.lamp(x,5.8,z);}
 }
 for(const [x,z] of [[-35,28],[-35,44],[-23,29],[-23,47],[-9,28],[-9,44],[5,29],[5,46]]){
  for(const dx of [-2.2,2.2])for(const dz of [-.72,.72])solid(x+dx,0,z+dz,.12,8.05,.12,steel);
  for(const y of [.16,1.72,3.27,4.82,6.38,7.92]){
   solid(x,y-.16,z,4.55,.16,1.55,steel,'shelf');
   w.box(x,y-.08,z+.79,4.55,.16,.045,trim);
  }
  for(const dx of [-1.4,1.4])for(const y of [.16,1.72,3.27,6.38,7.92])solid(x+dx,y,z,.82,.86,.98,wood,'climb');
 }
 for(const [x,z] of [[-39,35],[-28,38],[-20,41],[-5,36],[2,40],[10,35]]){
  solid(x,0,z,1.4,.62,1.3,wood,'climb');
  solid(x-.25,.62,z, .80,.54,.92,wood,'climb');
 }
 for(const z of [25,31,37,43,49])for(const x of [-31,-1])w.box(x,.012,z, .10,.02,3.4,trim);
 w.sign(-15.17,3.15,37,2.8,.35,'D-02 / D-03','#392f28','#e5c39b',Math.PI/2);
 w.sign(-30,3.8,22.2,3.4,.35,'RETURNS / D-03','#392f28','#e5c39b');
 w.sign(0,3.8,22.2,3.4,.35,'TRANSFER / D-02','#392f28','#e5c39b');
 buildDeepHalls(w,expanded);
}

export const HIDING_POINTS=[[-35,29.4],[-9,29.4],[-23,48.4],[5,47.4],[-25,7.9],[-37,63],[-22,72],[-7,63],[8,72]];
export const REFUGES=[[-1.6,5.27,2.35,1.15],[-1.6,3.58,.25,1],[-32,3,68,1.05],[-2,3,68,1.05]];
function buildDeepHalls(w,expanded=false){
 const wall=w.mat('deep-wall','#343a42','concrete'),floor=w.mat('deep-floor','#535153','concrete'),steel=w.mat('deep-steel','#3b444a','metal'),rust=w.mat('deep-rust','#784c36','metal'),black=w.mat('deep-black','#242127','rubber'),amber=w.mat('deep-warning','#b58b48','paint'),red=w.mat('deep-red','#db302b','plain',1.25),wood=w.mat('deep-crate','#77583e','wood'),glass=w.mat('deep-vessel','#51282c','metal',.10),pale=w.mat('deep-inside','#694a48','skin');
 const solid=(x,y,z,a,b,c,m,kind)=>{w.box(x,y+b/2,z,a,b,c,m);w.block(x-a/2,z-c/2,x+a/2,z+c/2,y,y+b,kind);};
 w.box(-14,-.16,66,58,.32,24,floor);
 for(const x of [-43,15])solid(x,0,66,.34,11,24,wall);
 if(expanded){for(const [a,b] of [[-43,-33],[-27,-3],[3,15]])solid((a+b)/2,0,78,b-a,11,.34,wall);for(const x of [-30,0])solid(x,3.6,78,6,7.4,.34,wall);}else solid(-14,0,78,58,11,.34,wall);
 for(const [a,b] of [[54,63],[69,78]])solid(-15,0,(a+b)/2,.32,11,b-a,wall);
 solid(-15,3.6,66,.32,7.4,6,wall);
 w.sign(-30,3.85,54.20,4,.4,'C-02 / WASTE PROCESSING','#362b25','#d1b17d');
 w.sign(0,3.85,54.20,4,.4,'D-04 / CONTAINMENT','#3d2024','#f1a99b');
 for(const z of [57,63,69,75]){w.box(-14,11.1,z,58,.20,6.1,steel);w.beam([-43,10.6,z],[15,10.6,z],.22,.24,rust);for(const x of [-40,-18,12])solid(x,0,z,.22,10.5,.22,steel);}
 for(const [x,z] of [[-37,65],[-22,74],[-7,65],[8,74]]){
  solid(x,0,z+1,2.7,2.25,.16,steel);for(const dx of [-1.27,1.27])solid(x+dx,0,z,.16,2.25,2,steel);solid(x,1.33,z,2.7,.15,2.05,steel);
  w.box(x,.025,z,2.5,.04,1.9,black);w.sign(x,1.65,z-1.03,1.5,.22,'SERVICE / LOW CLEARANCE','#433b30','#d6b98e');
 }
 for(const x of [-32,-2]){
  for(let j=0;j<4;j++){const h=.65+j*.62,z=60+j*1.6;solid(x,0,z,1.7,h,1.45,wood,'climb');}
  solid(x,2.82,67.65,3,.18,3.7,steel,'climb');for(const dx of [-1.35,1.35])for(const dz of [-1.35,1.35])solid(x+dx,0,68+dz,.12,2.82,.12,rust);
  w.sign(x,3.22,69.48,1.55,.24,'ESCAPE DECK','#483923','#ffe0a1');
 }
 for(const [x,z] of [[-39,59],[-25,62],[-39,73],[-25,69]]){
  solid(x,0,z,2.6,1.05,2,rust,'climb');w.box(x,.98,z,2.8,.12,2.15,black);
  for(let j=0;j<4;j++)w.box(x-.9+j*.6,1.15,z,.38,.30,.65,wood,0,j*.31);
  for(const dx of [-1,1])w.beam([x+dx,1.1,z],[x+dx,3.1,z+1.3],.14,.17,steel);
 }
 for(const [x,z] of [[-9,58],[6,61],[-10,73],[11,67]]){
  solid(x,0,z,2.2,.36,2.2,steel);w.block(x-1,z-1,x+1,z+1,.36,4.5);w.cyl(x,2.35,z,.89,3.7,.89,glass);
  for(const y of [.56,4.2]){w.cyl(x,y,z,1.02,.23,1.02,steel);w.cyl(x,y+.16,z,.95,.055,.95,red);}
  for(let j=0;j<7;j++){const a=j*2*Math.PI/7;w.box(x+Math.cos(a)*.91,2.35,z+Math.sin(a)*.91,.095,3.7,.095,rust);}
  w.box(x,2.4,z-.91,.38,1.15,.10,pale,0,0,.25);w.sign(x,1.2,z-.99,1.35,.24,'DO NOT OPEN','#4b2024','#ffada1');
 }
 for(const [x,z] of [[-30,56],[-39,67],[-19,76],[0,56],[-11,66],[9,75],[-15,66]]){w.box(x,4.12,z,.38,.18,.35,steel);w.cyl(x,3.9,z,.15,.22,.15,red);w.lights.push([x,3.8,z,1]);}
 for(const x of [-34,-4])for(let z=55;z<77;z+=.9)w.box(x,.014,z,.12,.02,.54,amber,0,.4);
}
