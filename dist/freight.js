// Staged freight awaits sorting at the rack ends and beside the roller line.
export function stageFreight(w){
 const boards=['#9d7951','#8a6c47','#a48559'].map((v,i)=>w.mat('staging-wood-'+i,v,'wood'));
 const steel=w.mat('load-band','#4a4c48','metal'),kraft=w.mat('staging-cartons','#cfb082','carton');
 function skid(x,z,nx,nz,layers){
  const wide=nx*.57+.06,deep=nz*.49+.08;
  for(let t of [-.4,0,.4])w.box(x+t*wide,.068,z,.11,.136,deep,boards[0]);
  for(let i=0;i<6;i++)w.box(x+wide*((i+.5)/6-.5),.155,z,wide*.15,.038,deep,boards[i%3]);
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const h=.37+.09*((i*7+j*3)%3);const count=layers-((i+j)%3===2?1:0);
   for(let k=0;k<count;k++)w.box(x+(i-(nx-1)/2)*.57,.174+(k+.5)*h,z+(j-(nz-1)/2)*.49,.55,h,.47,kraft,0,((i+j+k)%3-1)*.021);
  }
  w.block(x-wide*.5,z-deep*.5,x+wide*.5,z+deep*.5,0,.174+layers*.46);
  w.shadow(x,z,wide+.28,deep+.32);
 }
 skid(-3.45,5.35,3,3,3);skid(-11.3,10.5,3,2,2);skid(8.90,3.11,3,3,3);skid(8.96,-.16,2,3,2);
 // Slatted shipping case and two steel shipping bands.
 let x=-10,z=11.6;for(let j=0;j<7;j++)w.box(x+(j-3)*.148,.50,z,.144,.96,.86,boards[j%3]);
 for(let d of [-1,1]){w.box(x,.10,z+d*.448,1.12,.13,.046,boards[2]);w.box(x,.91,z+d*.448,1.12,.12,.046,boards[2]);w.beam([x-.46,.17,z+d*.448],[x+.46,.84,z+d*.448],.097,.042,boards[1]);}
 for(let d of [-.37,.37])w.box(x+d,.989,z,.035,.018,.87,steel);
 w.block(x-.56,z-.47,x+.56,z+.47,0,1);w.shadow(x,z,1.36,1.18);
}
