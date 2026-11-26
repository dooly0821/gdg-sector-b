// Storage system B. Coordinates and all dimensions are in metres, Y up.
// Uprights repeat at each bay line. A divider at the centre carries the two
// pallet lanes, so the four-metre end frame never spans an unsupported deck.
export function buildStorage(w) {
  const material = (key, color, type = 'metal', scale = 1) => w.mat(`storage-${key}`, color, type, 0, scale);
  const steel = material('steel', '#536574');
  const steelEdge = material('flange', '#73838b');
  const innerSteel = material('channel', '#34424b');
  const hole = material('punched-hole', '#1d282b', 'plain');
  const bolt = material('galvanized', '#a1a6a0');
  const rust = material('rust', '#674a36');
  const orange = material('load-beam', '#b45d32', 'paint');
  const orangeEdge = material('beam-lip', '#d28348', 'paint');
  const safety = material('post-guard', '#ce9947', 'paint');
  const wood = ['#92704a', '#866847', '#ab855a', '#886746', '#a87e55'].map((c, i) => material(`pine-${i}`, c, 'wood'));
  const agedWood = material('weathered-crate', '#846748', 'wood');
  const crateFrame = material('crate-frame', '#ab8358', 'wood');
  const wrap = material('banding', '#53564c', 'rubber');
  const carton = ['#c59a69', '#d0a974', '#b18961', '#cc9c6c', '#a88360', '#cfb38b', '#b69978', '#bc8f67'].map((c, i) => material(`carton-${i}`, c, 'carton'));
  const box = (...args) => w.box(...args);
  const beam = (...args) => w.beam(...args);
  let state = 4920183;
  function rand() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  }
  const choose = items => items[Math.floor(rand() * items.length)];

  // Pallet stringers run front to back. The narrow fork channels read from
  // across the aisle even when the load sits at the very lip of the shelf.
  function pallet(x, y, z, width, depth) {
    const timber = choose(wood);
    const runnerWidth = Math.min(0.12, width * 0.12);
    for (const ratio of [-0.42, 0, 0.42]) {
      box(x + width * ratio, y + 0.064, z, runnerWidth, 0.108, depth - 0.035, timber);
    }
    for (let j = 0; j < 5; j++) {
      box(x, y + 0.136, z + (j - 2) * depth / 5, width, 0.036, depth * 0.172, choose(wood));
    }
    w.block(x-width/2,z-depth/2,x+width/2,z+depth/2,y,y+.154,'climb');
    return y + 0.154;
  }

  function crate(x, ground, z, width, height, depth) {
    w.block(x-width/2,z-depth/2,x+width/2,z+depth/2,ground,ground+height,'climb');
    const y = ground + height / 2;
    box(x, y, z, width - 0.065, height - 0.065, depth - 0.065, agedWood);
    const batten = Math.min(0.085, height * 0.11);
    for (const side of [-1, 1]) {
      const front = z + side * (depth / 2 - 0.018);
      for (const yEdge of [ground + batten / 2, ground + height - batten / 2]) {
        box(x, yEdge, front, width, batten, 0.035, crateFrame);
      }
      for (const s of [-1, 1]) {
        box(x + s * (width / 2 - batten / 2), y, front, batten, height - 2 * batten, 0.036, crateFrame);
      }
      beam([x - width / 2 + batten, ground + batten, front], [x + width / 2 - batten, ground + height - batten, front], batten, 0.038, choose(wood));
      const end = x + side * (width / 2 - 0.018);
      box(end, ground + batten / 2, z, 0.035, batten, depth - 0.055, crateFrame);
      box(end, ground + height - batten / 2, z, 0.035, batten, depth - 0.055, crateFrame);
      box(end, y, z, 0.035, height - 2 * batten, batten, crateFrame);
    }
  }

  // Paint and paper content are mapped onto the carton faces by the renderer.
  // Each column keeps its own footprint, which prevents unsupported upper loads.
  function stack(x, base, z, width, depth, clearance, variant) {
    const top = pallet(x, base, z, width, depth);
    const avail = clearance - 0.21;
    if (variant < 0.105) {
      crate(x, top, z, width * 0.96, Math.min(avail, 0.75 + rand() * 0.5), depth * 0.96);
      return;
    }
    const nx = width > 1.35 && rand() < 0.65 ? 2 : 1;
    const nz = depth > 1.1 && rand() < 0.55 ? 2 : 1;
    const maxLayers = variant > 0.83 ? 1 : 2 + Math.floor(rand() * 2);
    const slim = variant > 0.63 && variant < 0.78;
    const cellW = (width - 0.055) / nx;
    const cellD = (depth - 0.055) / nz;
    const h = Math.min(slim ? 0.255 : 0.37 + rand() * 0.25, avail / maxLayers);
    const groupMaterial = choose(carton);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const cx = x + (i + 0.5 - nx / 2) * cellW;
        const cz = z + (j + 0.5 - nz / 2) * cellD;
        const layers = Math.max(1, maxLayers - (rand() < 0.30 ? 1 : 0));
        const dw = cellW * (0.86 + rand() * 0.10);
        const dd = cellD * (0.85 + rand() * 0.11);
        for (let level = 0; level < layers; level++) {
          const offX = level ? (rand() - 0.5) * 0.035 : 0;
          const offZ = level ? (rand() - 0.5) * 0.035 : 0;
          const mat = rand() < 0.65 ? groupMaterial : choose(carton);
          w.block(cx+offX-dw/2,cz+offZ-dd/2,cx+offX+dw/2,cz+offZ+dd/2,top+h*level,top+h*(level+1),'climb');
          box(cx + offX, top + h * (level + 0.5), cz + offZ, dw, h, dd, mat, 0, (rand() - 0.5) * 0.025, 0);
        }
        if (slim && nx === 1 && layers > 1) {
          for (const q of [-0.31, 0.31]) {
            const strapX = cx + dw * q;
            box(strapX, top + layers * h + 0.002, cz, 0.027, 0.004, dd, wrap);
            for (const k of [-1, 1]) box(strapX, top + layers * h / 2, cz + k * (dd / 2 + 0.009), 0.027, layers * h, 0.008, wrap);
          }
        }
      }
    }
  }

  function upright(x, z, height, detailed, outward) {
    w.block(x-.071,z-.073,x+.071,z+.073,0,height);
    box(x, 0.037, z, 0.25, 0.074, 0.24, rust);
    box(x, height / 2, z, 0.108, height, 0.113, steel);
    for (const k of [-1, 1]) box(x + k * 0.06, height / 2, z, 0.022, height, 0.145, steelEdge);
    if (!detailed) return;
    // Punched oblong holes are inset into the dark face of the rolled profile.
    const end = z + outward * 0.0585;
    for (let y = 0.33; y < height - 0.15; y += 0.245) {
      box(x, y, end, 0.034, 0.066, 0.004, hole);
    }
    box(x, 0.29, z + outward * 0.083, 0.16, 0.49, 0.035, safety);
    box(x, 0.32, z + outward * 0.102, 0.166, 0.068, 0.005, innerSteel);
  }

  function rack(x0, x1, z0, z1, bayCount, id, height = 9.05) {
    const xMid = (x0 + x1) / 2;
    const halfWidth = (x1 - x0) / 2;
    const bayLen = (z1 - z0) / bayCount;
    const levels = [0.16, 1.88, 3.58, 5.27];
    for(const y of levels)w.block(x0-.06,z0-.05,x1+.06,z1+.05,y-.16,y,'shelf');
    w.shadow(xMid, (z0 + z1) / 2, x1 - x0 + 0.42, z1 - z0 + 0.44);
    for (let j = 0; j <= bayCount; j++) {
      const z = z0 + j * bayLen;
      const end = j === 0 || j === bayCount;
      const face = j === 0 ? -1 : 1;
      for (const x of [x0, xMid, x1]) upright(x, z, height, end, face);
      for (let k = 0; k < levels.length; k++) {
        const y = levels[k] - 0.07;
        // Short end-spacers support loads; the aisle-facing beams run along Z.
        box(xMid, y, z, x1 - x0 - 0.085, 0.14, 0.092, end ? orange : steel);
        if (end) {
          box(xMid, y + 0.052, z + face * 0.052, x1 - x0 - 0.14, 0.017, 0.016, orangeEdge);
          for (const x of [x0, xMid, x1]) {
            box(x, y, z + face * 0.078, 0.115, 0.223, 0.024, orange);
            box(x, y + 0.05, z + face * 0.094, 0.027, 0.027, 0.013, bolt);
          }
        }
      }
      // Tie bars run down a small number of frame bays. Keep the front of
      // storage lanes open for lifting, with lateral bracing in the end walls.
      if (end) {
        const bracedX = j === bayCount ? x0 : xMid;
        for (let k = 0; k < 3; k++) {
          const left = bracedX + 0.095;
          const right = bracedX + halfWidth - 0.095;
          const low = levels[k] + 0.06;
          const high = levels[k + 1] - 0.19;
          for(let n=0;n<10;n++){
            const xStart=k%2?right:left,xEnd=k%2?left:right;
            const a=xStart+(xEnd-xStart)*n/10,b=xStart+(xEnd-xStart)*(n+1)/10;
            w.block(Math.min(a,b)-.03,z+face*.069-.02,Math.max(a,b)+.03,z+face*.069+.02,low+(high-low)*n/10,low+(high-low)*(n+1)/10);
          }
          beam([k % 2 ? right : left, low, z + face * 0.069], [k % 2 ? left : right, high, z + face * 0.069], 0.056, 0.038, steel);
        }
      }
    }
    for (let j = 0; j < bayCount; j++) {
      const z = z0 + (j + 0.5) * bayLen;
      for (let k = 0; k < levels.length; k++) {
        const base = levels[k];
        for (const x of [x0, xMid, x1]) {
          box(x, base - 0.084, z, 0.12, 0.166, bayLen - 0.07, orange);
          box(x, base - 0.022, z, 0.134, 0.027, bayLen - 0.09, orangeEdge);
        }
        // Galvanized deck supports run across each pallet slot.
        for (const s of [-0.37, -0.13, 0.13, 0.37]) box(xMid, base - 0.034, z + s * bayLen, x1 - x0 - 0.03, 0.06, 0.095, innerSteel);
        for (let lane = 0; lane < 2; lane++) {
          for (let slot = 0; slot < 2; slot++) {
            const x = x0 + halfWidth * (lane + 0.5);
            const loadZ = z + (slot - 0.5) * bayLen * 0.49;
            const prominent = j === bayCount - 1 && slot === 1;
            if (!prominent && rand() < (k === 3 ? 0.26 : 0.11)) continue;
            const variant = prominent && (k + lane) % 4 === 1 ? 0.03 : rand();
            // Reserve the middle B-12 bay as a clear traversal / hiding route.
            // Keep all decks and uprights collidable; only omit cargo in this bay.
            if (id === 'B-12' && (j === 1 || (j === 2 && k === 3))) continue;
            stack(x, base, loadZ, halfWidth - 0.19, bayLen * 0.465 - 0.05, k === 3 ? 1.35 : 1.49, variant);
          }
        }
      }
      // One location card per accessible bay at typical picker eye height.
      if (j === bayCount - 1 || j === 0) {
        w.sign(x1 + 0.077, 1.799, z + bayLen * 0.31, 0.36, 0.135, id, '#dbca9d', '#322b27', Math.PI / 2);
      }
    }
    for(const y of [7.02,8.72]){
      w.block(x0-.06,z0-.05,x1+.06,z1+.05,y-.16,y,'shelf');
      for(let j=0;j<bayCount;j++){
        const z=z0+(j+.5)*bayLen;
        for(const x of [x0,xMid,x1])box(x,y-.08,z,.12,.16,bayLen-.07,orange);
        for(const f of [-.36,-.12,.12,.36])box(xMid,y-.035,z+f*bayLen,x1-x0-.04,.06,.10,innerSteel);
        for(const lane of [0,1]){
          if((j+lane+(y>8?1:0))%3===0)continue;
          const x=x0+halfWidth*(lane+.5),a=halfWidth-.23,d=bayLen*.70;
          box(x,y+.075,z,a,.15,d,wood[0]);w.block(x-a/2,z-d/2,x+a/2,z+d/2,y,y+.15,'climb');
          box(x,y+.53,z,a*.92,.76,d*.9,carton[(j+lane)%carton.length]);w.block(x-a*.46,z-d*.45,x+a*.46,z+d*.45,y+.15,y+.91,'climb');
        }
      }
    }
    w.sign(x1 - 0.32, 1.79, z1 + 0.10, 0.43, 0.155, id, '#e8d8b8', '#2e2a26');
  }

  rack(-4.8, -0.8, -16, -6.55, 3, 'B-14');
  rack(-4.8, -0.8, -3.48, 4, 3, 'B-12');
  rack(-13, -10, -16, -6.55, 3, 'B-09');
  rack(-13, -10, -3.48, 9.0, 4, 'B-07');
  rack(3, 7, -17, -14, 1, 'B-18');
  // Staggered service footholds outside B-12, with real steel decks and supports.
  for(let i=0;i<6;i++){
    const x=.02,z=-2.9+i*1.05,y=.72+i*.82;
    box(x,y-.08,z,1.12,.16,.96,innerSteel);
    box(x+.55,y-.08,z,.045,.16,.96,orangeEdge);
    w.block(x-.56,z-.48,x+.56,z+.48,y-.16,y,'climb');
    for(const dx of [-.50,.50])for(const dz of [-.42,.42]){
      box(x+dx,y/2-.08,z+dz,.055,y-.16,.055,steel);
      w.block(x+dx-.0275,z+dz-.0275,x+dx+.0275,z+dz+.0275,0,y-.16);
    }
  }
  w.sign(.60,1.05,-3.13,.45,.18,'B-12 / CLIMB','#443123','#f5ca83',Math.PI/2);
}
