const HALF_PI = Math.PI / 2;

export function buildMachinery(w) {
  const make = (name, color, type = 'metal', emission = 0, scale = 1) =>
    w.mat('equipment-' + name, color, type, emission, scale);
  const m = {
    ochre: make('ochre-enamel', '#ae7b32', 'paint'),
    yellow: make('ochre-lit', '#cb9344', 'paint'),
    ochreDark: make('ochre-shadow', '#785327', 'paint'),
    iron: make('gunmetal', '#333b41'),
    dark: make('blackened-steel', '#20262a'),
    black: make('tire', '#252527', 'rubber'),
    tread: make('tread', '#303032', 'rubber'),
    seat: make('seat-vinyl', '#363236', 'rubber'),
    silver: make('polished-ram', '#9c9d95'),
    zinc: make('zinc', '#777e7c'),
    roll: make('roller', '#92918b'),
    oil: make('chain', '#584c3e'),
    rust: make('oxide', '#815034', 'paint'),
    red: make('drum-oxide', '#8c5042', 'paint'),
    blue: make('drum-blue', '#52616b', 'paint'),
    paper: make('ivory', '#d9c491', 'paint'),
    lamp: make('headlamp', '#f0dbad', 'plain', .3),
    amber: make('amber-lens', '#f3a32d', 'plain', .25),
    green: make('green-switch', '#74ae80', 'paint', .1),
    redSwitch: make('red-switch', '#ae4334', 'paint'),
    board: make('boards', '#866640', 'wood'),
    boardLight: make('board-ends', '#a08056', 'wood'),
    pack: make('transit-cases', '#ac8662', 'carton'),
  };
  forkTruck(w, m);
  conveyor(w, m);
  freight(w, m);
}

function forkTruck(w, m) {
  const originX = -4.5, originZ = 9.2;
  const point = (x, y, z) => [originX + x, y, originZ + z];
  const box = (x,y,z,a,b,c,mat,rx=0,ry=0,rz=0) =>
    w.box(...point(x,y,z),a,b,c,mat,rx,ry,rz);
  const cyl = (x,y,z,r,h,mat,rx=0,rz=0) =>
    w.cyl(...point(x,y,z),r,h,r,mat,rx,0,rz);
  const oval = (x,y,z,rx,ry,rz,mat) =>
    w.ball(...point(x,y,z),rx,ry,rz,mat);
  const beam = (a,b,width,depth,mat) =>
    w.beam(point(...a),point(...b),width,depth,mat);
  const sign = (x,y,z,ww,hh,txt,bg,fg,turn=0) =>
    w.sign(...point(x,y,z),ww,hh,txt,bg,fg,turn);

  // Undercarriage, engine mass and cast rear counterweight.
  box(-.12,.43,0,2.3,.31,1.10,m.dark);
  box(-.1,.60,0,2.14,.32,1.08,m.ochreDark);
  box(-.65,.79,0,1.20,.4,1.19,m.ochre);
  oval(-1.02,.71,0,.40,.42,.61,m.ochre);
  box(-1.11,.63,0,.38,.36,1.07,m.ochre);
  box(-1.32,.52,0,.17,.17,.85,m.dark);
  box(-.75,1.00,0,.92,.12,1.13,m.yellow);
  box(-.79,1.07,0,.72,.06,.91,m.dark);
  box(-.79,1.10,0,.68,.042,.87,m.ochre);
  for (const side of [-1,1]) {
    const s = side;
    box(-.58,.76,.605*s,1.12,.30,.032,m.ochre);
    box(-.60,.605,.626*s,.98,.035,.022,m.ochreDark);
    box(.31,.49,.60*s,.52,.070,.22,m.iron);
    for(let i=0;i<7;i++) box(.08+i*.072,.532,.61*s,.026,.009,.175,m.zinc);
    for(let i=0;i<6;i++) box(-1.02+i*.047,.78,.629*s,.016,.128,.008,m.dark);
    box(-.67,.91,.626*s,.47,.031,.008,m.yellow);
    for(const f of [-1.05,-.14]) cyl(f,.66,.631*s,.012,.021,m.zinc,HALF_PI);
    for(const f of [.37,.47,.57]) box(f,.87,.58*s,.055,.03,.012,m.paper);
    sign(-.38,.778,.628*s,.43,.126,'FL–07','#453b2d','#f2dba0',s>0?0:Math.PI);
  }
  box(.51,.733,0,.73,.158,1.18,m.ochre);
  box(.62,.827,0,.49,.050,1.17,m.yellow);
  box(.26,.663,0,.49,.025,.99,m.black);
  // Unequal pneumatic wheels, pressed wheel dishes, lug pitch circle and valve.
  for(const [axle,radius] of [[-.90,.295],[.65,.393]]) {
    for(const side of [-1,1]){
      const t=.595*side, y=radius+.015;
      cyl(axle,y,t,radius,.246,m.black,HALF_PI);
      cyl(axle,y,t+.103*side,radius*.90,.063,m.tread,HALF_PI);
      cyl(axle,y,t+.139*side,radius*.685,.018,m.black,HALF_PI);
      cyl(axle,y,t+.153*side,radius*.55,.025,m.iron,HALF_PI);
      cyl(axle,y,t+.177*side,radius*.40,.026,m.zinc,HALF_PI);
      cyl(axle,y,t+.195*side,radius*.21,.033,m.iron,HALF_PI);
      for(let j=0;j<8;j++){
        const a=j*Math.PI/4;
        cyl(axle+Math.cos(a)*radius*.33,y+Math.sin(a)*radius*.33,t+.201*side,.016,.024,m.zinc,HALF_PI);
      }
      for(let j=0;j<20;j++){
        const a=j*Math.PI/10;
        box(axle+Math.cos(a)*radius*.98,y+Math.sin(a)*radius*.98,t,.026,.071,.225,m.tread,0,0,a);
      }
    }
  }
  // Protective cage uses an open roof so that the overhead grid casts readable silhouettes.
  for(const s of [-.53,.53]){
    beam([-.81,.97,s],[-.80,2.07,s],.075,.075,m.iron);
    beam([.59,.83,s],[.42,2.07,s],.065,.075,m.iron);
    box(-.17,2.085,s,1.36,.096,.082,m.dark);
    beam([-.81,1.89,s],[-.61,2.05,s],.045,.05,m.iron);
  }
  for(let i=0;i<8;i++) box(-.81+i*.18,2.107,0,.060,.054,1.03,m.iron);
  box(-.20,2.143,0,1.16,.025,.55,m.iron);
  // Driver's compartment, instrument console, wheel, hoses and parked levers.
  box(-.39,1.015,0,.55,.09,.65,m.iron);
  oval(-.37,1.098,0,.32,.089,.345,m.seat);
  box(-.39,1.104,0,.44,.105,.60,m.seat);
  box(-.615,1.298,0,.11,.43,.59,m.seat,0,0,.14);
  oval(-.655,1.475,0,.062,.084,.284,m.seat);
  box(.55,.94,0,.22,.45,.77,m.iron);
  beam([.54,.96,-.09],[.30,1.31,-.09],.046,.046,m.dark);
  const wheelCenter=[.295,1.32,-.09], wr=.159;
  const wheelPoint = a => [wheelCenter[0]+Math.cos(a)*wr*.86,wheelCenter[1]+Math.cos(a)*wr*.51,wheelCenter[2]+Math.sin(a)*wr];
  for(let j=0;j<16;j++) beam(wheelPoint(Math.PI*j/8),wheelPoint(Math.PI*(j+1)/8),.027,.027,m.black);
  for(let j=0;j<3;j++) beam(wheelCenter,wheelPoint(Math.PI*2*j/3),.021,.017,m.iron);
  for(let i=0;i<3;i++){
    const z=.12+.09*i;
    beam([.45,1.055,z],[.37,1.31+i*.017,z],.016,.016,m.zinc);
    oval(.37,1.32+i*.017,z,.035,.033,.031,m.black);
  }
  // Horizontal LPG vessel, end domes, saddle straps, valve and feed pipe.
  cyl(-.96,1.236,0,.168,.67,m.zinc,HALF_PI);
  for(const s of [-1,1]){
    oval(-.96,1.236,.331*s,.164,.164,.067,m.zinc);
    cyl(-.96,1.236,.205*s,.175,.038,m.iron,HALF_PI);
  }
  cyl(-.91,1.414,-.14,.028,.055,m.oil);
  box(-.91,1.451,-.14,.10,.02,.035,m.redSwitch);
  // Mast, nested channel sections, visible chain, central lift ram and fork carrier.
  for(const s of [-.455,.455]){
    box(.987,1.32,s,.13,2.44,.105,m.iron);
    box(.928,1.32,s+.042,.055,2.44,.047,m.dark);
    box(1.043,1.428,s*.77,.09,2.14,.079,m.zinc);
    box(1.053,1.43,s*.70,.043,2.12,.043,m.dark);
    box(1.105,1.09,s*.64,.039,1.60,.033,m.oil);
    for(let j=0;j<16;j++) box(1.11,.37+j*.093,s*.64,.048,.021,.045,m.zinc);
    beam([.62,.51,s],[.916,.91,s],.078,.08,m.dark);
    cyl(.855,.76,s,.036,.22,m.silver,0,-.58);
    cyl(1.026,2.40,s*.65,.076,.053,m.iron,HALF_PI);
  }
  box(1.00,2.49,0,.105,.113,1.02,m.iron);
  box(1.002,1.65,0,.075,.08,.83,m.iron);
  box(1.015,.39,0,.11,.14,.83,m.dark);
  cyl(1.028,.867,0,.078,1.00,m.dark);
  cyl(1.028,1.73,0,.043,.82,m.silver);
  box(1.16,.21,0,.13,.13,1.12,m.iron);
  box(1.16,.65,0,.105,.095,1.10,m.dark);
  for(let i=0;i<6;i++) box(1.16,.43,-.46+i*.184,.067,.36,.043,m.iron);
  for(const s of [-.362,.362]){
    box(1.24,.35,s,.094,.57,.123,m.dark);
    box(1.78,.083,s,1.15,.066,.126,m.iron);
    box(2.37,.068,s,.15,.038,.115,m.zinc,0,0,-.06);
    w.block(originX+1.21,originZ+s-.065,originX+2.44,originZ+s+.065,.04,.68);
  }
  for(const s of [-.50,.50]){
    box(.395,2.035,s,.117,.102,.117,m.dark);
    box(.457,2.034,s,.018,.069,.083,m.lamp);
  }
  cyl(-.72,2.17,-.37,.061,.048,m.dark);
  cyl(-.72,2.22,-.37,.049,.079,m.amber);
  w.shadow(originX-.04,originZ,3.25,1.87);
  w.block(originX-1.42,originZ-.74,originX+1.25,originZ+.74,0,2.57);
}

function conveyor(w,m) {
  const x=7.15, width=1.28, zA=-10, zB=4;
  const height=z=>1.01+.53*Math.min(1,Math.max(0,(1.2-z)/6.8));
  // Twin steel channels, rising middle flight and short flat discharge.
  for(const [a,b] of [[zA,-5.6],[-5.6,1.2],[1.2,zB]]) {
    for(const side of [-1,1]) {
      const sx=x+side*(width*.5+.034);
      w.beam([sx,height(a)-.052,a],[sx,height(b)-.052,b],.084,.156,m.iron);
      w.beam([sx+side*.047,height(a)-.025,a],[sx+side*.047,height(b)-.025,b],.014,.032,m.ochreDark);
      w.beam([sx,height(a)+.060,a],[sx,height(b)+.060,b],.057,.023,m.zinc);
    }
  }
  for(let i=0;i<=91;i++){
    const z=zA+(zB-zA)*i/91;
    w.cyl(x,height(z),z,.058,width,.058,i%4===0?m.zinc:m.roll,0,0,HALF_PI);
    if(i%3===0) for(const side of [-1,1]) w.cyl(x+side*(width*.5+.088),height(z)-.05,z,.017,.018,.017,m.zinc,0,0,HALF_PI);
  }
  for(const z of [-9.85,-7.6,-5.1,-2.6,-.1,2.6,3.84]){
    const h=height(z)-.15;
    for(const side of [-1,1]){
      const xx=x+side*.48;
      w.box(xx,h*.5,z,.073,h,.081,m.iron);
      w.box(xx,.035,z,.187,.07,.18,m.zinc);
      w.box(xx,.17,z,.092,.16,.096,m.zinc);
      w.beam([xx,.27,z],[xx,h-.06,z+(z===3.84?-.39:.39)],.034,.05,m.iron);
    }
    w.box(x,h-.026,z,1.17,.080,.085,m.dark);
    w.box(x,.29,z,.94,.04,.063,m.iron);
  }
  // End-roller sprocket and enclosed gear motor, cooling fins, electrical enclosure.
  w.cyl(x,height(zB)-.005,zB,.116,width+.11,.116,m.dark,0,0,HALF_PI);
  w.box(x-.79,.87,3.66,.18,.32,.72,m.ochre);
  w.cyl(x-.90,.81,3.59,.179,.133,.179,m.ochreDark,0,0,HALF_PI);
  w.cyl(x-.98,.78,3.27,.14,.52,.14,m.blue,HALF_PI);
  for(let i=0;i<6;i++) w.cyl(x-.98,.78,3.07+i*.064,.15,.025,.15,m.iron,HALF_PI);
  w.box(x-.97,.951,3.27,.15,.084,.18,m.iron);
  w.box(x-.73,1.10,1.92,.163,.25,.44,m.ochre);
  w.box(x-.73,1.236,1.92,.173,.034,.42,m.iron);
  w.cyl(x-.73,1.277,2.034,.047,.06,.047,m.redSwitch);
  w.cyl(x-.73,1.267,1.818,.024,.034,.024,m.green);
  w.sign(x-.51,.91,4.021,.31,.085,'C–04','#394043','#ddd6b7');
  w.block(x-.72,zA-.085,x+.72,zB+.09,0,1.64);
  w.block(x-1.16,2.98,x-.69,3.99,.41,1.11);
  w.shadow(x,(zA+zB)/2,2.08,zB-zA+.36);
}

function freight(w,m){
  function drum(x,z,body){
    const r=.292,h=.878;
    w.cyl(x,h/2+.022,z,r,h,r,body);
    for(const y of [.041,.291,.605,.883]){
      w.cyl(x,y,z,.303,.037,.303,m.iron);
      w.cyl(x,y+.018,z,.302,.011,.302,body);
    }
    w.cyl(x,.9,z,.282,.014,.282,body);
    w.cyl(x+.148,.916,z-.105,.032,.024,.032,m.zinc);
    w.cyl(x-.118,.916,z+.077,.016,.015,.016,m.dark);
    w.shadow(x,z,.81,.81);
    w.block(x-r,z-r,x+r,z+r,0,.93);
  }
  drum(8.92,-11.18,m.red);
  drum(9.63,-11.33,m.blue);
  drum(9.29,-11.89,m.iron);
  drum(-6.51,-16.64,m.blue);
  drum(-7.13,-16.31,m.iron);
  function pallet(x,z){
    for(const s of [-.49,0,.49]){
      w.box(x+s,.03,z,.12,.06,1.04,m.board);
      for(const k of [-.419,0,.419]) w.box(x+s,.111,z+k,.14,.102,.17,m.board);
    }
    for(let n=0;n<6;n++) w.box(x-.517+n*.207,.180,z,.176,.04,1.08,m.boardLight);
    for(const t of [-.25,.25]){
      w.box(x+t,.447,z,.469,.493,.92,m.pack);
      w.box(x+t,.862,z-.176,.467,.335,.56,m.pack);
    }
    w.shadow(x,z,1.56,1.44);
    w.block(x-.61,z-.54,x+.61,z+.54,0,1.04);
  }
  pallet(9.19,-13.7);
  pallet(-7.44,-17.73);
}
