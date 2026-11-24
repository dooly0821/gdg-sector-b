import {Sculpt} from './creature-mesh.js';
import {registerGeometry} from './geometry.js';
import {World} from './world.js';

const bone=(name,pivot,parent)=>({name,pivot,parent});
function skeleton({neck,shoulder,elbow,wrist,hip,knee,tail}){
 const mirror=([x,y,z])=>[-x,y,z];
 return [
  bone('body',[0,0,0]),bone('head',neck,0),
  bone('leftArm',mirror(shoulder),0),bone('rightArm',shoulder,0),
  bone('leftLeg',mirror(hip),0),bone('rightLeg',hip,0),
  bone('leftElbow',mirror(elbow),2),bone('rightElbow',elbow,3),
  bone('leftKnee',mirror(knee),4),bone('rightKnee',knee,5),
  bone('leftHand',mirror(wrist),6),bone('rightHand',wrist,7),bone('tail',tail,0)
 ];
}
const profiles=[
 {name:'flicker',neck:[0,1.48,.04],shoulder:[.26,1.43,0],elbow:[.65,1.39,.08],wrist:[.82,1.07,.25],hip:[.18,.64,0],knee:[.18,.35,0],tail:[0,.83,-.13]},
 {name:'boxhead',neck:[0,1.57,0],shoulder:[.25,1.44,0],elbow:[.42,1.03,.09],wrist:[.48,.72,.24],hip:[.13,.84,0],knee:[.19,.45,.03],tail:[0,.97,-.14]},
 {name:'imp',neck:[0,.63,0],shoulder:[.29,.52,0],elbow:[.42,.38,.1],wrist:[.54,.23,.2],hip:[.14,.35,0],knee:[.18,.21,.03],tail:[0,.52,-.13]},
 {name:'wraith',neck:[0,1.61,.03],shoulder:[.24,1.47,0],elbow:[.51,1.14,.08],wrist:[.68,.94,.25],hip:[.13,.77,0],knee:[.19,.48,0],tail:[0,.92,-.12]}
];
export const CREATURE_JOINTS=profiles.map(skeleton);
const point=(p,x=0,y=0,z=0)=>[p[0]+x,p[1]+y,p[2]+z];
const section=(p,x,y=x)=>[...p,x,y];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const pick=(array,i)=>array[i%array.length];

function materials(world,name){
 const m=(id,color,type='cardboard',emission=0,sheen=.11)=>Object.assign(world.mat(name+'-'+id,color,type,emission),{sheen});
 const image=(id,url)=>world.imageMat(name+'-'+id,'assets/'+url+'.webp');
 return {
  mint:Object.assign(m('mint','#85a99b','skin',.07,.38),{rim:true}),
  ecto:Object.assign(m('ecto','#aacba5','skin',.09,.44),{rim:true}),
  violet:m('violet','#9f8aa6','skin',0,.29),clay:m('clay','#89716e','skin',0,.21),
  folds:m('folds','#645561','cloth'),wrap:m('wrap','#9e8874','cloth'),
  boot:m('boot','#4f4245','rubber',0,.19),sole:m('sole','#2f272a','rubber'),
  pulp:m('pulp','#af825e'),liner:m('liner','#c99d70'),tear:m('tear','#e6c59b'),
  crease:m('crease','#6b4835'),tape:m('tape','#d5a248','paint',0,.77),tapeEdge:m('tape-edge','#e6c17c','paint',0,.45),
  wood:m('wood','#a06f49','wood'),end:m('grain','#805233','wood'),rivet:m('rivet','#878080','metal',0,.89),
  roller:m('roller','#6c6267','metal',0,.92),black:m('void','#130d16','plain'),mouth:m('mouth','#3b2435','skin',0,.21),
  amber:m('amber-eye','#ff9b45','plain',1.07,.30),hot:m('eye-core','#ffe8b7','plain',1.27,.34),
  red:m('scanner-eye','#ff563d','plain',1.48,.23),redCore:m('scanner-core','#ffac80','plain',1.40,.20),
  bubble:m('bubble','#b4a4be','paint',.03,.82),paper:m('paper','#dfc4a4'),receipt:image('receipt','gdg-receipt'),
  label:image('label','gdg-barcode'),fragile:image('fragile','gdg-fragile')
 };
}
function limb(mesh,m,a,b,width,fold=.12){
 const sections=[section(point(a,0,.01),width*.38),section(lerp(a,b,.17),width,width*.77),
  section(point(lerp(a,b,.48),0,0,.027),width*.84,width*.74),section(lerp(a,b,.83),width*.75),
  section(b,width*.49),section(point(b,0,-.023),.001)];
 mesh.sweep(m,sections,{fold});
}
function wrapping(mesh,m,a,b,r,count){
 for(let i=0;i<count;i++){
  const t=(i+.45)/(count+.12),c=lerp(a,b,t),width=.032+r*.29;
  const strip=[[],[]];
  for(let j=0;j<=18;j++){
   const angle=j/18*Math.PI*2+.23*i;
   const dx=r*Math.cos(angle),dz=r*.85*Math.sin(angle),dy=.38*r*Math.sin(angle)+.003*Math.cos(j*1.8);
   strip[0].push(point(c,dx,dy,dz));strip[1].push(point(c,dx,dy+width,dz));
  }
  mesh.strip(m,strip[0],strip[1],{thickness:.004});
 }
}
function hand(mesh,mat,side,p,scale,ghost){
 const s=(x,y,z)=>point(p,side*x*scale,y*scale,z*scale);
 mesh.sweep(mat,[section(s(-.018,.055,-.026),.014*scale),section(s(0,.008,0),.09*scale,.063*scale),
  section(s(.023,-.052,.042),.117*scale,.072*scale),section(s(.027,-.08,.072),.087*scale,.051*scale),
  section(s(.027,-.109,.079),.011*scale)],{fold:.15,steps:4});
 const lengths=ghost?[.14,.208,.227,.184]:[.102,.145,.159,.125];
 for(let i=0;i<4;i++){
  const x=(i-1.5)*.052,l=lengths[i],r=(.024+Math.sin(i/3*Math.PI)*.007)*scale;
  mesh.sweep(mat,[section(s(x,-.054,.065),r*.81),section(s(x*1.10,-.095,l*.62+.05),r),
   section(s(x*1.16,-l*.72,l+.049),r*.88),section(s(x*1.06,-l*.99,l*.94+.034),r*.64),
   section(s(x*.9,-l*1.09,l*.77+.024),.0008)],{sides:12,steps:3,fold:.11});
 }
 mesh.sweep(mat,[section(s(-.064,-.009,.01),.022*scale),section(s(-.113,-.045,.043),.037*scale),
  section(s(-.13,-.098,.103),.025*scale),section(s(-.112,-.12,.14),.001)],{sides:12,steps:3,fold:.05});
}
function eye(mesh,m,x,y,z,kind){
 if(kind==='scan'){
  mesh.panel(m.red,[[x-.032,y-.082,z],[x+.032,y-.071,z],[x+.032,y+.078,z],[x-.032,y+.067,z]]);
  mesh.panel(m.redCore,[[x-.019,y-.067,z+.002],[x+.016,y-.063,z+.002],[x+.017,y+.062,z+.002],[x-.017,y+.059,z+.002]]);
 }else if(kind==='imp'){
  const mirror=x<0?-1:1;
  const outline=[
   [x-mirror*.066,y+.057,z],[x+mirror*.076,y+.018,z],
   [x+mirror*.045,y-.028,z+.005],[x-mirror*.019,y-.022,z+.007]
  ];
  if(mirror<0)outline.reverse();
  mesh.panel(m.amber,outline);
  mesh.panel(m.hot,outline.map(p=>[x+(p[0]-x)*.76,y+(p[1]-y)*.70,p[2]+.006]),{thickness:.006});
 }else{
  const r=kind==='ghost'?.046:.034;
  mesh.ellipsoid(m.amber,[x,y,z],[r*1.28,r*1.40,.019]);
  mesh.ellipsoid(m.hot,[x,y+.004,z+.012],[r*.84,r*1.06,.014]);
 }
}
function flicker(meshes,m,joints){
 const [body,head]=meshes,tail=meshes[12];
 body.sweep(m.mint,[[.11,.19,-.35,.001,.001],[.06,.43,-.24,.068,.042],[-.008,.68,-.15,.126,.072],
  [-.03,.89,-.10,.19,.12],[0,1.12,-.025,.275,.20],
  [0,1.40,0,.32,.205],[0,1.56,0,.217,.15],[0,1.65,0,.045,.04]],{sides:28,steps:5,fold:.10});
 for(const s of [-1,1]){
  const a=[],b=[];
  for(let i=0;i<=10;i++){
   const t=i/10,x=s*(.19+.46*t),z=.02+.06*t;
   a.push([x,1.43-.08*t,z+.01*Math.sin(i)]);
   b.push([x,1.26-.12*Math.sin(Math.PI*t)-.07*Math.sin(i*1.9),z-.036]);
  }
  body.strip(m.ecto,b,a,{thickness:.012});
 }
 // Raised filaments wrap around the silhouette and reveal the depth of the mantle.
 for(let i=0;i<9;i++){
  const angle=i*Math.PI*2/9,sections=[];
  for(let k=0;k<6;k++){
   const t=k/5,a=angle+.28*Math.sin(t*4+i),r=.12+.19*t;
   sections.push([r*Math.cos(a),.65+.77*t,-.14+.14*t+r*.66*Math.sin(a),.005+.012*Math.sin(t*Math.PI),.009]);
  }
  body.sweep(m.ecto,sections,{sides:8,steps:2,fold:.06});
 }
 for(let i=0;i<8;i++){
  const a=i*2.4,x=Math.cos(a)*.16,z=Math.sin(a)*.12;
  tail.sweep(i%2?m.mint:m.ecto,[[x,.94,z,.065,.043],[x*.92,.73,z-.07,.067,.04],
   [x*.68+.04,.45-(i%3)*.09,z-.19,.036,.026],[x*.53+.08,.24-(i%3)*.07,z-.28,.016,.009],
   [x*.45+.11,.16-(i%3)*.045,z-.34,.0005,.0005]],{steps:3,sides:12,fold:.11});
 }
 head.sweep(m.ecto,[[0,1.17,.044,.035,.029],[0,1.30,.045,.17,.128],[0,1.53,.035,.221,.171],
  [0,1.72,.005,.207,.169],[0,1.85,-.031,.145,.121],[0,1.92,-.055,.002,.002]],{sides:36,steps:5,fold:.055});
 head.ellipsoid(m.mouth,[0,1.496,.167],[.145,.244,.068],.09);
 head.ellipsoid(m.black,[0,1.413,.222],[.096,.131,.036],.16);
 head.ellipsoid(m.violet,[0,1.338,.249],[.045,.042,.013]);
 for(const s of [-1,1]){
  head.ellipsoid(m.black,[s*.082,1.654,.163],[.069,.08,.057],.07);
  eye(head,m,s*.082,1.651,.222,'ghost');
  head.sweep(m.ecto,[[s*.132,1.743,.144,.028,.022],[s*.155,1.60,.186,.028,.024],
   [s*.151,1.471,.203,.020,.016],[s*.130,1.36,.213,.001,.001]],{sides:12});
  head.sweep(m.ecto,[[s*.056,1.52,.245,.018,.014],[s*.052,1.466,.258,.015,.013],[s*.048,1.435,.263,.001,.001]],{sides:10});
 }
 for(const index of [2,3,6,7]){
  const child=index+4;
  limb(meshes[index],m.violet,joints[index].pivot,joints[child].pivot, .094,.14);
 }
 for(const index of [10,11])hand(meshes[index],m.violet,index===10?-1:1,joints[index].pivot,1.08,true);
}
function cartonHead(mesh,m,imp){
 const y=imp?.82:1.86,w=imp?.37:.315,z=imp?.28:.255,h=imp?.205:.263;
 const lx=-w+.019,rx=w-.015,bot=y-h,top=y+h;
 const options={edge:m.tear,thickness:.022};
 // Six folded flaps leave a torn opening, with a recessed interior for the eyes.
 mesh.panel(m.pulp,[[lx,bot,-z],[rx,bot+.012,-z],[rx+.03,top,-z-.015],[lx-.01,top-.031,-z]],options);
 mesh.panel(m.pulp,[[lx-.018,bot,z],[lx-.026,bot,-z],[lx-.01,top+.016,-z],[lx+.007,top-.027,z]],options);
 mesh.panel(m.liner,[[rx,bot,-z],[rx-.02,bot+.02,z],[rx+.023,top-.031,z],[rx+.036,top,-z]],options);
 mesh.panel(m.liner,[[lx,bot,-z],[rx,bot,-z],[rx-.021,bot+.01,z],[lx-.015,bot,z]],options);
 mesh.panel(m.pulp,[[lx-.02,top-.023,z],[.006,top+.02,z+.012],[.003,top+.036,-z],[lx-.006,top-.034,-z]],options);
 mesh.panel(m.liner,[[.012,top+.018,z],[rx+.024,top-.022,z],[rx+.034,top-.01,-z],[.02,top+.025,-z]],options);
 mesh.panel(m.black,[[lx+.027,bot+.027,z-.076],[rx-.035,bot+.016,z-.076],[rx-.029,top-.039,z-.076],[lx+.019,top-.042,z-.076]]);
 const cut=imp?[.13,.09,.14,.09,.13,.1,.16]:
  [.05,.13,.29,.23,.40,.35,.45,.30,.43,.39,.46,.27,.18];
 const lo=[],hi=[];
 for(let i=0;i<cut.length;i++){
  const x=lx+(rx-lx)*i/(cut.length-1);
  lo.push([x,bot+(top-bot)*cut[i]+(imp?.14:.01),z-.010+(i%2)*.017]);
  hi.push([x,top+.012*Math.sin(i*1.5),z+.004+.012*Math.sin(i*.98)]);
 }
 mesh.strip(m.pulp,lo,hi,options);
 // Open corrugations follow the torn contour of the head flap.
 for(let j=0;j<lo.length-1;j++)for(let n=0;n<4;n++){
  const a=lerp(lo[j],lo[j+1],n/4),b=lerp(lo[j],lo[j+1],(n+1)/4);
  mesh.tri(m.liner,point(a,0,-.002,.001),point(b,0,-.002,.001),point(lerp(a,b,.5),0,-.009,-.014));
 }
 if(!imp){
  const crack=[[-.247,top-.04,z+.01],[-.188,top-.115,z+.022],[-.216,top-.17,z+.026],
   [-.119,top-.223,z+.018],[-.142,top-.284,z+.015]];
  mesh.strip(m.crease,crack,crack.map((p,i)=>point(p,.012+i*.002,-.004,.001)),{thickness:.002,edge:m.tear});
  const corner=[point(hi.at(-1),.006,.007,.006),[rx-.033,top-.086,z+.044],[rx-.112,top-.160,z+.023],[rx-.033,top-.177,z-.008]];
  mesh.panel(m.liner,corner,{thickness:.013,edge:m.tear});
 }
 mesh.panel(m.liner,[[lx-.016,bot-.015,z],[rx-.014,bot+.004,z],[rx-.021,bot+.057,z+.012],[lx,bot+.044,z+.017]],options);
 for(let i=0;i<19;i++){
  const x=lx+i*(rx-lx)/18;
  mesh.tri(m.crease,[x,bot+.012,z+.018],[x+.007,bot+.011,z+.018],[x+.004,bot+.027,z+.017]);
 }
 const tape=[[],[]];
 for(let i=0;i<=13;i++){
  const a=i/13,t=a*Math.PI*.97,y0=top+.011+.045*Math.sin(t);
  tape[0].push([-.062,y0,-z+.026+a*(2*z+.13)]);
  tape[1].push([.049+.023*Math.sin(i*.77),y0+.008*Math.sin(i),-z+.027+a*(2*z+.13)]);
 }
 mesh.strip(m.tape,tape[0],tape[1],{edge:m.tapeEdge,thickness:.005});
 if(imp){
  for(const s of [-1,1]){
   const px=s*(w+.018),axis=[s,0,0];
   mesh.ring(m.roller,[px,y+.08,-.02],.118,.115,.031,{axis});
   mesh.ring(m.rivet,[px+s*.024,y+.08,-.02],.076,.076,.012,{axis});
   mesh.ellipsoid(m.black,[px+s*.030,y+.08,-.02],[.025,.052,.052]);
  }
  for(const side of [-1,1]){
   const x=side*w;
   mesh.strip(m.tape,[[x*.83,top+.032,-z],[x*1.02,top+.04,-z*.6],[x*1.08,top-.06,-z*.24],[x*1.16,top-.035,z*.1]],
    [[x*.83,top+.032,-z+.05],[x*1.02,top+.04,-z*.6+.05],[x*1.08,top-.06,-z*.24+.05],[x*1.16,top-.035,z*.1+.04]],{thickness:.005});
  }
  for(let j=0;j<3;j++){
   const y0=top-.13+j*.064,d=.027+j*.009;
   mesh.panel(j===1?m.liner:m.wood,[[lx-.052,y0,z+d],[rx+.053,y0+.028,z+d],
    [rx+.036,y0+.091,z+d-.008],[lx-.036,y0+.063,z+d+.005]],{edge:m.end,thickness:.043});
   for(const x of [lx-.008,rx+.012])mesh.ellipsoid(m.rivet,[x,y0+.039,z+d+.010],[.012,.013,.009]);
   for(let n=0;n<7;n++){
    const x=lx+.055+n*.075,k=n%2?1:-1,a=[x,y0+.034+(n%3)*.008,z+d+.006];
    mesh.tri(m.end,a,point(a,.027*k,.004,.001),point(a,.044*k,.009,.002));
   }
  }
  for(let i=0;i<9;i++){
   const x=(i-4)*.043,base=bot+.039+Math.abs(i-4)*.010;
   const tip=.034+.008*Math.sin(i*2.8),face=z-.004+.004*Math.cos(i);
   mesh.panel(i%2?m.amber:m.hot,[[x-.019,base,face],[x+.019,base+.004,face],
    [x+.013,base+tip,face],[x-.009,base+tip+.007,face]],{edge:m.amber,thickness:.014});
  }
 }
 for(const s of [-1,1])eye(mesh,m,s*(imp?.115:.089),bot+(imp?.155:.144),z-.023,imp?'imp':'box');
 const labelY=imp?top-.002:y+.13,labelZ=z+(imp?.07:.026);
 mesh.panel(m.label,[[-.13,labelY-.023,labelZ],[.075,labelY-.006,labelZ],[.069,labelY+.056,labelZ],[-.135,labelY+.039,labelZ]],{edge:m.tear,thickness:.003});
 mesh.panel(m.fragile,[[rx-.092,y+.047,labelZ],[rx-.014,y+.028,labelZ],[rx-.003,y+.123,labelZ],[rx-.077,y+.141,labelZ]],{edge:m.tear,thickness:.003});
}
function boots(mesh,m,c,small){
 const s=small?.82:1,y=c[1];
 mesh.sweep(m.sole,[
  section(point(c,0,-.015,-.079*s),.078*s,.021),
  section(point(c,0,-.013,-.049*s),.112*s,.030),
  section(point(c,0,-.008,.125*s),.124*s,.034),
  section(point(c,0,-.008,.205*s),.097*s,.025),
  section(point(c,0,-.011,.229*s),.002,.002)
 ],{axis:[0,1,0],fold:.10});
 mesh.sweep(m.boot,[
  section(point(c,0,.041,-.09*s),.001),
  section(point(c,0,.058,-.047*s),.102*s,.049),
  section(point(c,0,.057,.035*s),.123*s,.073),
  section(point(c,0,.039,.149*s),.125*s,.049),
  section(point(c,0,.028,.208*s),.069*s,.027),
  section(point(c,0,.022,.231*s),.001)
 ],{axis:[0,1,0],fold:.11});
 for(let i=0;i<6;i++){
  const x=c[0]+(i-2.5)*.038*s,z=c[2]+(.196-.010*Math.abs(i-2.5))*s;
  mesh.panel(m.sole,[[x-.013,y-.023,z+.022],[x+.013,y-.023,z+.022],[x+.013,y+.005,z+.018],[x-.013,y+.005,z+.018]]);
 }
 mesh.strip(m.tape,[point(c,-.097*s,.02,.036),point(c,-.070*s,.099,.063),point(c,.018*s,.118,.084),point(c,.111*s,.035,.09)],
  [point(c,-.098*s,.02,.073),point(c,-.071*s,.086,.101),point(c,.018*s,.094,.128),point(c,.11*s,.026,.128)],{edge:m.tapeEdge});
}
function wrapped(meshes,m,joints,imp){
 const [body,head]=meshes;
 const k=imp?.42:1,shift=imp?.05:0;
 body.sweep(m.folds,[[0,.61*k+shift,0,.025,.021],[0,.78*k+shift,0,.158*(imp?1.23:1),.114],
  [0,1.03*k+shift,-.02,.195,.13],[0,1.24*k+shift,-.025,.214,.152],
  [0,1.46*k+shift,0,.277,.165],[0,1.58*k+shift,0,.146,.10],[0,1.63*k+shift,0,.02,.02]],{sides:24,steps:4,fold:.19});
 wrapping(body,m.wrap,[0,.76*k+shift,0],[0,1.49*k+shift,0],imp?.226:.221,imp?3:6);
 cartonHead(head,m,imp);
 for(const index of [2,3,6,7,4,5]){
  const dest=index+4,a=joints[index].pivot,b=joints[dest].pivot;
  const r=(index<4?.090:index<6?.084:.085)*(imp?.81:1);
  limb(meshes[index],m.clay,a,b,r,.17);
  const collar=index<4?(imp?.078:.091):index<6?(imp?.079:.088):r*.83;
  meshes[index].ellipsoid(index<6?m.folds:m.clay,a,[collar,collar*1.12,collar*.90],.12);
  wrapping(meshes[index],m.tape,a,b,r*.92,1);
 }
 for(const j of [8,9]){
  const a=joints[j].pivot,ankle=[a[0]*1.16,.074,.033];
  limb(meshes[j],m.folds,a,ankle,imp?.072:.075,.18);
  const knee=imp?.066:.073;
  meshes[j].ellipsoid(m.folds,a,[knee,knee*1.08,knee*.87],.14);
  wrapping(meshes[j],m.wrap,a,ankle,imp?.073:.071,1);
  boots(meshes[j],m,point(ankle,0,-.038,0),imp);
 }
 for(const j of [10,11])hand(meshes[j],m.clay,j===10?-1:1,joints[j].pivot,imp?.68:1.14,false);
 if(imp){
  for(let i=0;i<22;i++){
   const a=i*2.4,r=.20+.03*Math.sin(i),x=r*Math.cos(a),z=-.09+r*.43*Math.sin(a);
   const q=.027+.019*(.5+.5*Math.sin(i*1.3));
   meshes[12].ellipsoid(m.bubble,[x,.53+(i%6)*.024,z],[q,q*.8,q*.92]);
  }
 }
 for(const s of [-1,1]){
  const a=[],b=[],base=imp?.93:2.02;
  for(let i=0;i<=12;i++){
   const t=i/12,x=s*(.22+t*(imp?.43:.23)),y=base+.08*Math.sin(t*6)-t*.27,z=-.08-t*.26;
   a.push([x,y,z]);b.push([x+s*(.075-.022*t),y-.029,z+.015]);
  }
  head.strip(m.tape,a,b,{edge:m.tapeEdge});
 }
}
function papers(mesh,m,origin,{count,width,length,radius,spread=.20,phase=0}){
 for(let i=0;i<count;i++){
  const a=i*2.399+phase,r=radius*(.82+.19*Math.sin(i*3.1));
  const [x,y,z]=point(origin,Math.cos(a)*r,(i/count-.5)*spread,Math.sin(a)*r);
  const U=[Math.sin(a),0,-Math.cos(a)],w=width*(.82+.23*Math.cos(i*1.7)),len=length*(.87+.28*Math.sin(i*1.17));
  const l=[],rgt=[];
  for(let j=0;j<=8;j++){
   const t=j/8,tip=.04*Math.sin(t*5+a),offset=(1+t*.43)*tip;
   const center=[x+Math.cos(a)*t*.07,y+(1-t)*len,z+Math.sin(a)*t*.075];
   l.push(point(center,U[0]*(offset-w*.5),.018*Math.sin(i+j*1.9),U[2]*(offset-w*.5)));
   rgt.push(point(center,U[0]*(offset+w*.5*(1-.22*t)),.016*Math.cos(i-j*1.9),U[2]*(offset+w*.5*(1-.22*t))));
  }
  mesh.strip(pick([m.paper,m.receipt,m.paper,m.label,m.tape,m.paper,m.fragile],i),rgt,l,{edge:m.tear,thickness:.003});
 }
}
function wraith(meshes,m,joints){
 const [body,head]=meshes;
 body.sweep(m.folds,[[0,.62,-.15,.001,.001],[0,.72,-.12,.103,.08],[0,1,.0,.165,.136],
  [0,1.37,0,.241,.182],[0,1.58,0,.219,.16],[0,1.69,0,.001,.001]],{sides:20,fold:.20});
 papers(body,m,[0,1.33,0],{count:24,width:.29,length:.29,radius:.236,spread:.36});
 papers(body,m,[0,1.025,-.035],{count:22,width:.27,length:.27,radius:.193,spread:.43,phase:2.1});
 body.panel(m.label,[[-.145,1.29,.251],[.135,1.26,.251],[.165,1.41,.228],[-.122,1.44,.229]],{edge:m.tear,thickness:.005});
 papers(meshes[12],m,[0,.57,-.16],{count:11,width:.18,length:.30,radius:.127,spread:.53});
 head.ellipsoid(m.black,[0,1.74,.141],[.19,.211,.082],.13);
 papers(head,m,[0,1.85,-.004],{count:13,width:.24,length:.16,radius:.206,spread:.23,phase:Math.PI});
 head.strip(m.paper,[[-.206,1.868,.170],[-.147,1.906,.223],[-.035,1.937,.239],[.068,1.908,.224],[.196,1.872,.181]],
  [[-.238,1.931,-.016],[-.175,2.004,.012],[-.032,2.017,.057],[.110,1.987,.026],[.228,1.931,-.032]],{edge:m.tear,thickness:.010});
 for(const s of [-1,1]){
  eye(head,m,s*.075,1.783,.228,'scan');
  head.strip(m.receipt,[[s*.15,1.92,.13],[s*.25,1.87,.07],[s*.29,1.80,-.04],[s*.33,1.84,-.08]],
   [[s*.12,1.95,.11],[s*.22,1.90,.04],[s*.27,1.83,-.07],[s*.30,1.86,-.10]],{edge:m.tear,thickness:.004});
  head.panel(m.paper,[[s*.052,1.534,.24],[s*.172,1.614,.229],[s*.197,1.716,.222],[s*.118,1.626,.240]],{edge:m.tear,thickness:.008});
 }
 for(let i=0;i<6;i++){
  const x=(i-2.5)*.049;
  head.tri(m.tear,[x-.024,1.577,.236],[x+.025,1.584,.239],[x+.010,1.639+(i%2)*.053,.249]);
 }
 for(const j of [2,3,6,7]){
  const a=joints[j].pivot,b=joints[j+4].pivot;
  limb(meshes[j],m.wrap,a,b,.066,.13);
  papers(meshes[j],m,lerp(a,b,.53),{count:8,width:.127,length:.184,radius:.077,spread:.26,phase:j});
 }
 for(const j of [10,11]){
  hand(meshes[j],m.liner,j===10?-1:1,joints[j].pivot,.85,true);
  papers(meshes[j],m,point(joints[j].pivot,0,-.048,.016),{count:6,width:.105,length:.101,radius:.077,spread:.16});
 }
}
let cached;
export function buildCreatureRigs(){
 if(cached)return cached;
 cached=profiles.flatMap((profile,i)=>{
  const world=new World(),m=materials(world,profile.name),joints=CREATURE_JOINTS[i];
  const meshes=joints.map(()=>new Sculpt());
  if(i===0)flicker(meshes,m,joints);
  else if(i===3)wraith(meshes,m,joints);
  else wrapped(meshes,m,joints,i===2);
  return meshes.map((mesh,j)=>({materials:world.materials,parts:mesh.layers('creature_'+profile.name+'_'+joints[j].name,registerGeometry)}));
 });
 return cached;
}
