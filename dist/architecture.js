// One metre per world unit. Structural steel bays are spaced on a 5.5 m grid.
export function buildArchitecture(w) {
  const mat = (name, color, texture, emission = 0, scale = 1) =>
    w.mat('building-' + name, color, texture, emission, scale);
  const m = {
    slab:w.imageMat('building-slab','assets/floor-deck.webp'),
    seam:mat('joint','#494743','rubber'), threshold:mat('threshold','#5d6263','metal'),
    wall:mat('wall','#566475','concrete',0,0.75), wall2:mat('wall-panel','#617080','paint'),
    wallDark:mat('wall-base','#384652','concrete'), trim:mat('panel-seams','#414d5b','metal'),
    roof:mat('roof-sheet','#45505b','metal'), rib:mat('roof-ribs','#53606a','metal'),
    iron:mat('primary-steel','#293440','metal'), steel:mat('flange','#465363','metal'),
    edge:mat('scuffed-edge','#79828a','metal'), plate:mat('gussets','#384856','metal'),
    bolt:mat('bolt-head','#818a92','metal'), yellow:mat('safety-rail','#b48639','paint'),
    line:mat('traffic-paint','#bd9852','paint'), lineWorn:mat('traffic-wear','#938360','paint'),
    blueGlass:mat('dim-pane','#648baa','plain',0.25), glass:mat('lit-pane','#82aed0','plain',0.34),
    darkGlass:mat('deep-pane','#526c8a','plain',0.17), sky:mat('rooflight','#8dbee0','plain',0.52),
    shutter:mat('shutter','#65717c','metal'), shutterEdge:mat('shutter-fold','#7c8589','metal'),
    amber:mat('bulb','#ffdda2','plain',0.92), lampRim:mat('aged-aluminium','#a19d8d','metal'),
    lamp:mat('shade','#4b5055','metal'), black:mat('rubber','#282d32','rubber'),
    signal:mat('unloading-indicator','#ecbc74','plain',0.55),
    walkway:mat('deck-plate','#515962','metal'), white:mat('tube','#e4e3d2','plain',0.74)
  };
  const box=(...v)=>w.box(...v), beam=(a,b,thick,wide,material)=>w.beam(a,b,thick,wide,material);
  const post=(x,y,z,height,r,material)=>w.cyl(x,y+height/2,z,r,height,r,material);
  const rail=(a,b,r,material)=>beam(a,b,r,r,material);
  const block=(...v)=>w.block(...v);
  const pi=Math.PI;
  function column(x,z){
    box(x,4.36,z,.20,8.72,.33,m.iron);
    for(const offset of [-.18,.18]) box(x,4.36,z+offset,.40,8.72,.048,m.steel);
    box(x,.11,z,.62,.22,.60,m.plate);
    for(const dx of [-.22,.22]) for(const dz of [-.19,.19]) post(x+dx,.22,z+dz,.06,.038,m.bolt);
    box(x,7.98,z,.42,.82,.42,m.plate);
    if(Math.abs(x)>14) block(x-.24,z-.23,x+.24,z+.23,0,8.72);
  }
  function truss(z) {
    const ridge=x=>8.3+1.43*(1-Math.abs(x)/14.7);
    beam([-14.72,7.63,z],[14.72,7.63,z],.13,.16,m.iron);
    for (const [a,b] of [[-14.76,0],[0,14.76]]) beam([a,ridge(a),z],[b,ridge(b),z],.19,.21,m.steel);
    for (let i=0;i<12;i++){
      const a=-14.7+i*2.45,b=a+2.45;
      beam([a,7.68,z],[a,ridge(a),z],.078,.09,m.steel);
      beam(i%2?[a,ridge(a)-.06,z]:[a,7.68,z],i%2?[b,7.68,z]:[b,ridge(b)-.06,z],.078,.09,m.iron);
      box(a,7.70,z,.21,.22,.19,m.plate);
    }
  }
  function sideWindow(x,z,length) {
    const side=Math.sign(x), face=x-side*.10;
    box(x,6.70,z,.105,1.41,length,m.iron);
    const num=6, width=(length-.18)/num;
    for(let i=0;i<num;i++){
      const center=z-length/2+.09+(i+.5)*width;
      const glass=[m.blueGlass,m.glass,m.darkGlass,m.blueGlass,m.glass][(i+Math.abs(Math.floor(z)))%5];
      box(face,6.73,center,.032,1.19,width-.066,glass);
    }
    box(face-side*.036,6.1,z,.19,.094,length+.11,m.edge);
    box(face-side*.036,7.38,z,.13,.092,length+.05,m.steel);
  }
  function endWindow(z,x,length){
    const face=z-Math.sign(z)*.13;
    box(x,6.70,z,length,1.52,.12,m.iron);
    const width=(length-.18)/6;
    for(let i=0;i<6;i++)box(x-length/2+.09+(i+.5)*width,6.72,face,width-.07,1.29,.026,i%3?m.blueGlass:m.glass);
    box(x,6.00,face,length+.09,.10,.18,m.edge);
    box(x,7.42,face,length+.09,.09,.13,m.steel);
  }
  function loadingDoor(x,number) {
    const z=-21.70;
    box(x,2.53,z+.06,5.2,5.06,.16,m.black);
    box(x,2.32,z+.18,4.52,4.52,.09,m.shutter);
    for(let i=0;i<30;i++){
      const y=.15+i*.15;
      box(x,y,z+.245,4.52,.029,.047,m.shutterEdge);
      box(x,y-.025,z+.245,4.51,.023,.023,m.trim);
    }
    box(x,.17,z+.32,4.56,.22,.12,m.black);
    for (const side of [-1,1]){
      box(x+side*2.39,2.37,z+.26,.18,4.74,.21,m.steel);
      box(x+side*2.52,2.37,z+.24,.09,4.73,.34,m.plate);
      box(x+side*2.51,.57,z+.41,.24,1.14,.21,m.black);
      box(x+side*2.51,.92,z+.52,.24,.13,.032,m.line);
    }
    box(x,4.85,z+.29,5.24,.42,.40,m.iron);
    box(x,5.05,z+.34,5.42,.08,.46,m.edge);
    w.sign(x,4.86,z+.51,2.45,.31,'LOADING  /  '+number,'#28323a','#ddd5b9');
    box(x+2.87,1.66,z+.31,.25,.38,.12,m.plate);
    box(x+2.87,1.74,z+.39,.11,.10,.034,m.signal);
    box(x,.015,z+.77,4.66,.025,1.12,m.threshold);
  }
  function hatch(x,z,width,depth) {
    const thick=.09;
    for(const side of [-1,1]){
      box(x+side*(width-thick)/2,.019,z,thick,.014,depth,m.line);
      box(x,.019,z+side*(depth-thick)/2,width,.014,thick,m.line);
    }
    for(let a=-width/2+.48;a<width/2-.45;a+=.70)
      box(x+a,.022,z+depth/2-.37,.12,.012,.65,m.lineWorn,0,-.54);
  }
  // Slab joints follow the actual pouring bays, including small offsets at intersections.
  box(0,-.16,0,30.16,.32,44.16,m.slab);
  for(let z=-16.5;z<=16.51;z+=5.5) box(0,.004,z,29.8,.006,.021,m.seam);
  for(let x=-10;x<=10;x+=5) box(x,.004,0,.018,.006,43.85,m.seam);
  for (const x of [-1.55,5.66]) {
    for(let z=-18.5;z<19;z+=2.1)box(x,.017,z,.091,.014,1.32,(Math.round(z*10)%3)?m.line:m.lineWorn);
  }
  hatch(-7,-19.5,5.8,3.4);
  hatch(4.6,-19.5,5.8,3.4);
  // Safety marking at the approach to the stair flight.
  for (let n=0;n<6;n++)box(11.83+n*.27,.019,15.5,.12,.015,.38,m.line,0,-.48);
  for(const x of [-15,15]){
    box(x,4.3,0,.28,8.6,44.0,m.wall);
    box(x-Math.sign(x)*.16,.46,0,.09,.92,43.87,m.wallDark);
    for(let n=0;n<8;n++) {
      const z=-19.25+n*5.5;
      sideWindow(x-Math.sign(x)*.16,z,4.65);
      box(x-Math.sign(x)*.155,3.72,z,.06,.09,5.5,m.trim);
      box(x-Math.sign(x)*.15,5.53,z,.05,.055,5.45,m.trim);
      for(let s=0;s<5;s++) box(x-Math.sign(x)*.16,8.03,z-2.1+s*1.03,.055,.85,.043,m.trim);
    }
    for(let n=0;n<9;n++)column(x-Math.sign(x)*.39,-22+n*5.5);
  }
  for(const z of [-22,22]){
    const s=Math.sign(z);
    box(0,4.3,z,30,8.6,.27,m.wall);
    box(0,.43,z-s*.152,29.9,.86,.07,m.wallDark);
    box(0,5.48,z-s*.18,29.8,.08,.085,m.trim);
    for (const x of [-11.25,-3.75,3.75,11.25])endWindow(z-s*.20,x,6.39);
    for (const x of [-14.56,-7.5,0,7.5,14.56]){
      box(x,4.22,z-s*.23,.20,8.44,.24,m.steel);
      box(x,4.22,z-s*.39,.31,8.44,.043,m.plate);
    }
  }
  loadingDoor(-7,'01');loadingDoor(4.6,'02');
  // Blue roof glazing sits between opaque roof sheets. Flush secondary ribs form the pane frame.
  const slope=1.43/14.7, roofHeight=x=>8.58+(14.7-Math.abs(x))*slope;
  for(let n=0;n<8;n++){
    const z=-19.25+n*5.5;
    for (const side of [-1,1]){
      const glassBay=(n===1||n===4||n===6);
      const strips=glassBay?[[0,3.5,false],[3.5,6.6,true],[6.6,15,false]]:[[0,15,false]];
      for (const [start,end,glazed] of strips){
        const x=side*(start+end)/2;
        box(x,roofHeight(x),z,(end-start)*Math.sqrt(1+slope*slope)+.025,.12,5.49,glazed?m.sky:m.roof,0,0,-side*Math.atan(slope));
        if(glazed){
          for(const b of [start,end])box(side*b,roofHeight(side*b)-.085,z,.10,.11,5.50,m.iron);
          for(let j=0;j<5;j++)box(x,roofHeight(x)-.081,z-2.70+j*1.35,end-start,.09,.09,m.steel,0,0,-side*Math.atan(slope));
        }
      }
    }
  }
  for(let x=-14;x<=14;x+=1.75)box(x,roofHeight(x)-.15,0,.098,.146,43.91,m.rib);
  for (let z=-21.85;z<=21.86;z+=5.465) truss(z);
  // Suspended spun-metal reflectors with recessed warm lenses and visible suspension hardware.
  function lamp(x,z,base) {
    const top=roofHeight(x)-.23;
    post(x,base+.40,z,top-base-.40,.019,m.black);
    post(x,base+.28,z,.18,.094,m.iron);
    post(x,base+.16,z,.15,.166,m.lamp);
    w.ball(x,base+.135,z,.37,.126,.37,m.lamp);
    post(x,base+.03,z,.071,.386,m.lampRim);
    post(x,base-.017,z,.018,.338,m.amber);
    w.lamp(x,base-.08,z);
  }
  for (const z of [-15.0,-3.6,8.4,18.4]){
    lamp(-7.7,z,6.34);lamp(4.9,z-1.50,6.58);
  }
  // Elevated service route. Its south end is open at the width of the stair flight.
  box(12.95,3.52,-6.5,3.90,.16,27,m.walkway);
  for (const x of [11.07,14.82]){
    box(x,3.34,-6.5,.13,.42,27.05,m.iron);
    box(x,3.13,-6.5,.27,.074,27.10,m.steel);
    box(x,3.58,-6.5,.27,.07,27.10,m.steel);
  }
  for(let z=-19.64;z<7.0;z+=3.75){
    box(12.94,3.35,z,3.80,.24,.14,m.steel);
    for(const x of [11.13,14.73]){
      box(x,1.59,z,.145,3.18,.20,m.iron);
      box(x,.070,z,.33,.14,.38,m.plate);
      block(x-.112,z-.122,x+.112,z+.122,0,3.43);
    }
    beam([11.13,2.54,z],[11.83,3.33,z],.085,.11,m.steel);
    box(12.94,3.61,z,3.71,.015,.026,m.seam);
  }
  for(const z of [-14.2,-4.3,4]){
    box(12.76,3.23,z,1.60,.10,.175,m.plate);
    box(12.76,3.163,z,1.43,.034,.12,m.white);
  }
  function deckRail(x1,z1,x2,z2){
    const length=Math.hypot(x2-x1,z2-z1), count=Math.ceil(length/1.53);
    for(let i=0;i<=count;i++){
      const t=i/count,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;
      post(x,3.60,z,.99,.037,m.yellow);
      box(x,3.63,z,.12,.06,.12,m.plate);
    }
    for (const height of [4.07,4.60])rail([x1,height,z1],[x2,height,z2],.058,m.yellow);
    block(Math.min(x1,x2)-.045,Math.min(z1,z2)-.045,Math.max(x1,x2)+.045,Math.max(z1,z2)+.045,3.60,4.63);
  }
  deckRail(11.075,-19.94,11.075,6.96);
  deckRail(11.075,-19.94,14.74,-19.94);
  deckRail(11.075,6.95,11.60,6.95);
  deckRail(13.40,6.95,14.74,6.95);
  // Open-riser stair with rolled channels, bolted plate treads and anti-slip nosings.
  const steps=22,run=8/steps,rise=3.6/steps;
  for(let i=0;i<steps;i++){
    const z=15-(i+.5)*run,top=(i+1)*rise;
    box(12.5,top-.041,z,1.70,.082,run+.025,m.walkway);
    box(12.5,top-.017,z+run*.46,1.69,.061,.055,i===0||i===steps-1?m.line:m.edge);
    for(const x of [11.71,13.29]){
      box(x,top-.090,z,.055,.14,.198,m.plate);
      block(x-.050,z-run*.5,x+.050,z+run*.5,top-.02,top+.97);
    }
  }
  for(const x of [11.66,13.34]){
    beam([x,.00,15.08],[x,3.50,6.88],.15,.20,m.iron);
    beam([x,.09,15.08],[x,3.61,6.88],.080,.105,m.steel);
    for (let i=0;i<=6;i++){
      const t=i/6, z=14.95-7.92*t,y=.09+3.50*t;
      post(x,y,z,.97,.037,m.yellow);
    }
    for(const ht of [.57,1.04])rail([x,.08+ht,15.05],[x,3.59+ht,6.98],.061,m.yellow);
  }
  w.sign(11.60,3.36,7.115,1.02,.26,'CATWALK','#3e4447','#e3d9bd');
  // Employee access and utility cabinets on the south wall.
  function serviceDoor(x,z) {
    box(x,1.26,z,.99,2.51,.17,m.iron);
    box(x,1.22,z-.104,.86,2.39,.05,m.wall2);
    box(x,1.66,z-.14,.46,.42,.04,m.iron);
    box(x,1.66,z-.165,.37,.33,.018,m.darkGlass);
    box(x,1.06,z-.175,.68,.060,.06,m.edge);
    box(x,.25,z-.14,.81,.37,.024,m.steel);
    w.sign(x,2.8,z-.13,1.30,.32,'STAFF ACCESS','#33483f','#d4d8c1',pi);
  }
  serviceDoor(1.65,21.73);
  for (const x of [-9.8,-9.12,-8.44]) {
    box(x,1.42,21.65,.63,.97,.32,m.plate);
    box(x,1.42,21.46,.55,.89,.07,m.shutter);
    box(x+.19,1.39,21.405,.031,.18,.05,m.black);
    for (let i=0;i<4;i++)box(x,1.19+i*.046,21.405,.31,.019,.018,m.trim);
    post(x,1.93,21.64,1.65,.028,m.steel);
  }
}
