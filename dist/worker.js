import {buildInspectionGlove,gloveMatrix} from './viewmodel.js';
// Warehouse uniform, facing +Z. Ring profiles are measured in world metres.
import {World} from './world.js';
import {Sculpt} from './creature-mesh.js';
import {registerGeometry} from './geometry.js';
let boots;
export function buildLegs(){
 if(boots)return boots;
 boots=[-1,1].map(side=>{
  const w=new World(),mesh=new Sculpt(),x=side*.115;
  const fabric=w.mat('worker-indigo','#393652','cloth'),trim=w.mat('worker-cap binding','#504661','cloth');
  const rubber=w.mat('worker-tread','#333039','rubber'),leather=w.mat('worker-toecap','#544846','rubber');
  const bulb=(m,x,y,z,a,b,c)=>mesh.ellipsoid(m,[x,y,z],[a,b,c],.006);
  const loft=(m,rows,fold)=>mesh.sweep(m,rows,{sides:28,steps:3,fold});
  const thread=(m,points,r)=>mesh.sweep(m,points.map((p,i)=>[...p,i===0||i===points.length-1?r*.25:r,r*.8]),{sides:9,steps:2,fold:.01});
  loft(fabric,[[x,.15,0,.086,.085],[x,.194,-.01,.115,.117],[x,.235,.013,.112,.115],[x,.288,-.004,.101,.093],[x,.37,.013,.116,.114],[x,.49,0,.124,.112],[x,.63,0,.126,.126],[x,.68,0,.104,.112]],.055);
  loft(rubber,[[x,.014,.038,.096,.139],[x,.022,.041,.123,.163],
   [x,.050,.043,.126,.166],[x,.062,.044,.120,.159]],.012);
  loft(leather,[[x,.058,.043,.120,.16],[x,.084,.047,.121,.16],
   [x,.111,.049,.119,.153],[x,.138,.035,.115,.139],[x,.163,.012,.104,.113],
   [x,.194,-.017,.09,.083]],.012);
  thread(trim,Array.from({length:17},(_,i)=>{
   const a=(i/16-.5)*Math.PI*1.38;
   return [x+.120*Math.sin(a),.082+.004*Math.cos(a),.045+.160*Math.cos(a)];
  }),.003);
  for(const y of [.105,.13])thread(trim,[[x-.075,y,.147],[x,y+.023,.152],[x+.074,y,.148]],.009);
  // Bellows pocket, overlapping flap and stitch line follow each trouser leg.
  loft(fabric,[[side*.221,.319,.011,.007,.033],[side*.224,.328,.012,.018,.058],
   [side*.229,.354,.013,.026,.068],[side*.229,.423,.009,.025,.067],
   [side*.223,.47,.003,.015,.061],[side*.221,.476,.003,.007,.050]],.035);
  loft(trim,[[side*.238,.427,.006,.008,.053],[side*.242,.437,.006,.015,.068],
   [side*.240,.458,.004,.016,.070],[side*.232,.47,.004,.012,.064]],.016);
  thread(trim,[[side*.21,.32,.063],[side*.25,.36,.077],[side*.25,.451,.075]],.004);
  for(const dx of [-.086,.086])for(const dz of [-.055,.023,.097]){
   bulb(rubber,x+dx,.017,dz,.034,.012,.032);
  }
  w.parts.push(...mesh.layers('worker_leg_'+side,registerGeometry));
  return w;
 });
 return boots;
}
export function buildWorker(){
 const w=new World(),mesh=new Sculpt();
 const mat=(name,color,type)=>w.mat('worker-'+name,color,type);
 const fabric=mat('indigo','#393652','cloth'),trim=mat('cap binding','#504661','cloth'),stripe=mat('reflector','#e5a631','paint');
 const hair=mat('chestnut','#583327','plain'),curl=mat('hair highlights','#714133','plain');
 const skin=mat('face','#edb487','plain'),lip=mat('smile','#8a4a3c','plain'),iris=mat('iris','#372421','plain'),white=mat('ivory','#fff0d9','plain');
 const rubber=mat('tread','#333039','rubber'),leather=mat('toecap','#544846','rubber');
 const bulb=(m,x,y,z,a,b,c)=>mesh.ellipsoid(m,[x,y,z],[a,b,c],.006);
 function loft(m,rows,fold=.025){mesh.sweep(m,rows,{sides:28,steps:3,fold});}
 function thread(m,points,r){mesh.sweep(m,points.map((p,i)=>[...p,i===0||i===points.length-1?r*.25:r,r*.8]),{sides:9,steps:2,fold:.01});}
 loft(fabric,[[0,.60,0,.19,.13],[0,.68,0,.235,.163],[0,.78,0,.219,.15],[0,.96,0,.235,.154],[0,1.045,0,.194,.118],[0,1.07,0,.077,.08]]);
 loft(stripe,[[0,.854,0,.244,.165],[0,.88,0,.246,.165],[0,.918,0,.248,.166]],.012);
 loft(leather,[[0,.63,0,.232,.163],[0,.659,0,.233,.163]]);
 bulb(skin,0,1.08,0,.084,.10,.078);
 loft(skin,[[0,1.065,.048,.025,.033],[0,1.092,.041,.15,.115],[0,1.15,.03,.227,.177],[0,1.24,.018,.265,.212],[0,1.37,0,.253,.216],[0,1.48,-.003,.194,.17],[0,1.53,0,.025,.022]],.003);
 bulb(skin,0,1.225,.224,.031,.029,.028);
 thread(lip,[[-.060,1.184,.210],[-.028,1.170,.217],[.02,1.168,.218],[.064,1.183,.209]],.005);
 for(const side of [-1,1]){
  const x=side*.115;
  loft(fabric,[[side*.208,1.01,0,.085,.085],[side*.244,.96,0,.094,.099],[side*.261,.875,.003,.080,.09],[side*.269,.842,.005,.082,.09]]);
  loft(skin,[[side*.263,.853,.004,.063,.066],[side*.274,.795,.012,.061,.061],[side*.282,.721,.029,.046,.052]]);
  const pose=side<0?'emptyL':'emptyR';
  const glove=buildInspectionGlove(new World(),pose);
  const transform=gloveMatrix(pose,[side*.282,.733,.03],[side*.06,-1,.24],[0,0,side],.72);
  for(const part of glove.parts)w.parts.push({...part,pos:[...transform.slice(12,15)],
   axes:[0,4,8].map(k=>[...transform.slice(k,k+3)])});
  bulb(skin,side*.25,1.245,-.004,.049,.059,.034);
  bulb(white,side*.099,1.286,.201,.056,.063,.022);bulb(iris,side*.094,1.287,.219,.035,.052,.013);
  thread(iris,[[side*.044,1.315,.208],[side*.075,1.341,.209],[side*.120,1.342,.201],[side*.151,1.315,.189],[side*.165,1.324,.181]],.006);
  bulb(white,side*.093-.009,1.306,.231,.010,.012,.005);
  thread(hair,[[side*.048,1.354,.21],[side*.093,1.375,.20],[side*.147,1.357,.175]],.012);
  for(let j=0;j<3;j++)bulb(lip,side*(.143+.014*j),1.222+.006*(j%2),.202-.007*j,.003,.003,.003);
  mesh.panel(trim,[[side*.02,1.04,.103],[side*.15,1.04,.097],[side*.105,.968,.151]],{thickness:.009});
  thread(trim,[[side*.18,.941,.1],[side*.167,.83,.137],[side*.157,.745,.137]],.005);
  for(let row=0;row<4;row++){
   const z=.13-.065*row;
   loft(row%2?hair:curl,[[side*(.105+row*.021),1.43,z+.026,.034,.033],
    [side*(.199+row*.011),1.385,z+.023,.05,.053],
    [side*.239,1.333,z,.048,.052],[side*.247,1.276,z-.032,.03,.034],
    [side*.235,1.256,z-.052,.005,.006]],.055);
  }
  for(let j=0;j<7;j++){
   const a=j*.52,xx=side*(.18+.067*Math.sin(a)),zz=-.21+.042*j;
   const yy=1.18+.046*Math.cos(a);
   bulb(hair,xx,yy,zz,.077,.079,.070);
   const lock=Array.from({length:12},(_,n)=>{
    const t=n/11*Math.PI*1.8;
    return [xx+side*.070*Math.sin(t),yy+.067*Math.cos(t),zz+.038*n/11];
   });
   thread(curl,lock,.023);
  }
  thread(stripe,[[side*.182,1.035,.095],[side*.20,1.01,.111],[side*.208,.975,.117]],.010);
 }
 bulb(hair,0,1.329,-.070,.268,.204,.199);
 for(let j=0;j<7;j++){
  const x=(j-3)*.067;
  thread(j%2?hair:curl,[[x+.045,1.477,.115],[x+.017,1.423,.167],[x-.014,1.385,.196-Math.abs(x)*.3],[x-.049,1.355+Math.abs(x)*.20,.20-Math.abs(x)*.37]],.028);
 }
 loft(fabric,[[0,1.385,-.025,.27,.211],[0,1.413,-.02,.282,.225],[0,1.52,-.028,.266,.215],[0,1.616,-.042,.18,.15],[0,1.655,-.048,.035,.035]],.023);
 bulb(fabric,0,1.416,.160,.256,.031,.164);
 for(let j=0;j<6;j++){
  const a=j*Math.PI/3;
  thread(trim,Array.from({length:9},(_,n)=>{
   const t=n/8*Math.PI*.48;
   return [.28*Math.cos(a)*Math.cos(t),1.411+.242*Math.sin(t),-.022+.219*Math.sin(a)*Math.cos(t)];
  }),.004);
 }
 bulb(trim,0,1.649,-.04,.025,.012,.024);
 bulb(trim,0,1.418,-.23,.085,.023,.013);
 w.sign(0,1.519,.218,.142,.064,'GDG','#ca9b66','#282334');
 w.sign(.111,.901,.151,.070,.10,'ID','#d5c6aa','#503f3a');
 // Enlarge the head assembly about the neck, retaining every facial attachment.
 for(const verts of mesh.batches.values())for(let k=0;k<verts.length;k+=8){
  if(verts[k+1]<=1.075)continue;
  const blend=Math.min(1,(verts[k+1]-1.075)/.065);
  verts[k]*=1+.16*blend;verts[k+2]*=1+.10*blend;
  verts[k+1]=1.075+(verts[k+1]-1.075)*1.12;
 }
 const patch=w.parts.find(p=>p.m.label==='GDG');
 patch.pos[1]=1.075+(patch.pos[1]-1.075)*1.12;patch.pos[2]*=1.1;
 w.parts.push(...mesh.layers('gdg_worker',registerGeometry),...buildLegs().flatMap(w=>w.parts));
 return w;
}
