import numpy as np, pathlib, json, base64, trimesh
from skimage.measure import marching_cubes
from scipy.ndimage import gaussian_filter
from scipy.interpolate import CubicSpline
from PIL import Image
R=pathlib.Path(__file__).resolve().parent.parent; A=np.array
unit=lambda x:x/np.linalg.norm(x)
colors={'canvas':'#c2a681','grip':'#5b5049','patch':'#554661','seam':'#907554','thread':'#e0c3a0','uniform':'#51436d','stripe':'#e5b341','cuff':'#40354c','metal':'#37393c','black':'#222428','rim':'#65666b','lens':'#fff0c8'}
textures={k:'gdg-'+('twill' if k in ['uniform','stripe','cuff'] else 'grip' if k in ['grip','black'] else 'metal' if k in ['metal','rim'] else 'weave') for k in colors};textures['lens']='plain'
data={}; poses={}; scenes={}; report={}; sockets={}; flexes={}; grip_anchors={}
def sm(a,b,k):return np.minimum(a,b)-np.maximum(k-np.abs(a-b),0)**2/(4*k)
def ell(p,c,r):
 d=p-A(c);r=A(r);k=np.linalg.norm(d/r,axis=-1);q=np.linalg.norm(d/r**2,axis=-1);return np.where(q>1e-7,k*(k-1)/np.maximum(q,1e-7),-min(r))
def cap(p,a,b,r,s):
 a,b=A(a),A(b);u=b-a;t=np.clip(np.sum((p-a)*u,axis=-1)/np.dot(u,u),0,1);return np.linalg.norm(p-a-t[...,None]*u,axis=-1)-(r+(s-r)*t)
def curve(pts,rs):
 pts=A(pts);t=np.r_[0,np.cumsum(np.linalg.norm(np.diff(pts,axis=0),axis=1))];v=np.linspace(0,t[-1],9);return CubicSpline(t,pts,bc_type='natural')(v),np.interp(v,t,rs)
def chain(p,pts,rs):
 d=np.full(p.shape[:-1],1.); 
 for a,b,r,s in zip(pts[:-1],pts[1:],rs[:-1],rs[1:]):d=sm(d,cap(p,a,b,r,s),.0018)
 return d
def padded_chain(p, digit):
 # Vary the section along the curved digit. Soft fabric bridges the joint;
 # the two shallow valleys separate broad phalange pads without cutting the shell.
 pts,rs=digit
 t=np.linspace(0,1,len(rs))
 padding=1+.12*np.exp(-((t-.20)/.15)**2)+.13*np.exp(-((t-.56)/.14)**2)+.15*np.exp(-((t-.88)/.15)**2)
 padding-=.062*np.exp(-((t-.38)/.08)**2)+.045*np.exp(-((t-.72)/.08)**2)
 d=chain(p,pts,rs*padding)
 # Fabric tension makes shallow creases across each padded joint. Bound the
 # distance evaluation to the finger so that neighbouring fingers remain separate.
 for j in [3,6]:
  tangent=unit(pts[j+1]-pts[j-1])
  along=np.sum((p-pts[j])*tangent,axis=-1)
  d+=.00145*np.exp(-(along/.0027)**2)
 return d

def surface(field,lo,hi,step=.0031):
 grid=[np.arange(a,b+step,step,dtype=np.float32) for a,b in zip(lo,hi)]; p=np.stack(np.meshgrid(*grid,indexing='ij'),-1); f=gaussian_filter(field(p),.66)
 v,faces,_,_=marching_cubes(f,0,spacing=(step,)*3,allow_degenerate=False); v+=A(lo);m=trimesh.Trimesh(v,faces,process=False);trimesh.repair.fix_normals(m);return m
def emit(pose,name,m,lab,fn=lambda p:p):
 m=trimesh.Trimesh(fn(m.vertices),m.faces.copy(),process=False);trimesh.repair.fix_normals(m);
 if m.volume<0:m.invert()
 n=m.vertex_normals;sc=scenes.setdefault(pose,trimesh.Scene());report.setdefault(pose,[]).append({'component':name,'triangles':len(m.faces),'watertight':bool(m.is_watertight),'components':len(m.split(only_watertight=False))})
 for mat in sorted(set(lab)):
  ids=np.flatnonzero(lab==mat);f=m.faces[ids].flatten();p=m.vertices[f];normal=n[f];axis=np.repeat(np.argmax(abs(m.face_normals[ids]),axis=1),3);uv=np.zeros((len(p),2))
  for k,(a,b) in enumerate([(2,1),(0,2),(0,1)]):uv[axis==k]=p[axis==k][:,[a,b]]*8
  key=f'vm_{pose}_{name}_{mat}';data[key]=base64.b64encode(np.rint(np.column_stack([p*20000,normal*32767,uv*1000])).astype('<i2').tobytes()).decode();poses.setdefault(pose,[]).append({'shape':key,'material':mat,'triangles':len(ids)})
  sub=m.submesh([ids],append=True,repair=False);rgb=[int(colors[mat][i:i+2],16) for i in [1,3,5]];sub.visual=trimesh.visual.ColorVisuals(sub,vertex_colors=rgb+[255]);sc.add_geometry(sub,node_name=key,geom_name=key)
 if name=='glove':m.export(R/'modeling'/f'{pose}-joined-glove.obj')
def sleeve(pose,wrist,elbow):
 wrist,elbow=A(wrist),A(elbow);sockets[pose]={"wrist":wrist.tolist(),"elbow":elbow.tolist()};U=unit(wrist-elbow);W=unit(np.cross(U,[0,1,0]));N=unit(np.cross(W,U));v=[];f=[];m=[];nr=64;ns=48
 for j in range(nr+1):
  t=j/nr;r=np.interp(t,[0,.25,.55,.77,.9,1],[.105,.098,.089,.078,.059,.050])
  for i in range(ns):
   a=i/ns*2*np.pi;rr=r+.008*np.exp(-((t-.90)/.021)**2)+.007*np.exp(-((t-.974)/.022)**2)-.006*np.exp(-((t-.938)/.020)**2)+(.0055*np.sin(a*5+t*15)+.0035*np.sin(a*3-t*20))*np.sin(np.pi*t)**.5+.004*np.exp(-((t-.93)/.025)**2)+.0045*np.exp(-((t-.70-.035*np.sin(a*2))/.04)**2)-.003*np.exp(-((t-.64-.035*np.sin(a*2))/.035)**2);v.append(elbow+(wrist-elbow)*t+rr*(W*np.cos(a)+N*np.sin(a)*.85))
 for j in range(nr):
  t=(j+.5)/nr;mat='stripe' if .77<t<.87 else 'cuff' if t>.89 else 'uniform'
  for i in range(ns):
   k=j*ns+i;l=j*ns+(i+1)%ns;f.extend([[k,l,l+ns],[k,l+ns,k+ns]]);m.extend([mat,mat])
 for end in [0,nr]:
  q=len(v);v.append(elbow if end==0 else wrist)
  for i in range(ns):f.append([q,end*ns+i,end*ns+(i+1)%ns]);m.append('cuff' if end else 'uniform')
 emit(pose,'sleeve',trimesh.Trimesh(v,f,process=False),A(m))
def relaxed(pose,side,wrist,F,carry=False):
 F=unit(A(F));W=A([side,0,0]);W=unit(W-F*np.dot(W,F));N=unit(np.cross(W,F));N*=np.sign(N[1])
 scale=(1.05 if carry else 1.30)
 fn=lambda p:A(wrist)+(p*scale)@A([W,N,F])
 digits=[]
 if carry:
  specs=[
   (-.032,.086,.074,.0125,.002,-.004,-.050),
   (-.010,.096,.082,.0130,.001,-.005,-.061),
   (.013,.094,.078,.0118,-.001,-.005,-.058),
   (.034,.085,.062,.0100,-.003,-.004,-.048),
  ]
 else:
  specs=[
   (-.034,.084,.070,.0120,.003,-.002,-.018),
   (-.010,.095,.081,.0124,.001,-.003,-.025),
   (.015,.094,.076,.0114,-.001,-.004,-.030),
   (.038,.085,.060,.0100,-.004,-.004,-.036),
  ]
 for x,z,l,r,splay,k1,k2 in specs:
  tipx=x+splay*(1.25 if carry else 1.0)
  p0=[x,-.002,z]
  p1=[x+splay*.34,.007 if not carry else .003,z+l*.30]
  p2=[x+splay*.80,k1,z+l*.61]
  p3=[tipx,k2,z+l*.86]
  digits.append(curve([p0,p1,p2,p3],[r*1.13,r*1.12,r*.98,r*.85]))
 thumb=curve(
  [[-.030,-.007,.031],[-.054,.006 if not carry else .000,.045],[-.073,.002 if not carry else -.005,.064],[-.078,-.015 if not carry else -.022,.087]],
  [.019,.0175,.0150,.0128]
 )
 def field(p):
  # broader palm + thenar/hypothenar thickness so the glove reads less like a thin shell
  d=sm(ell(p,[0,.002,.056],[.055,.038,.058]),ell(p,[0,-.002,.009],[.040,.031,.036]),.012)
  d=sm(d,ell(p,[-.030,-.004,.040],[.031,.033,.032]),.010)
  d=sm(d,ell(p,[.024,-.003,.042],[.028,.029,.029]),.008)
  d=sm(d,ell(p,[0,.009,.096],[.044,.023,.027]),.007)
  d=sm(d,ell(p,[0,.029,.056],[.036,.013,.041]),.004)
  d=sm(d,ell(p,[0,-.029,.058],[.040,.012,.043]),.004)
  for digit in digits:d=sm(d,padded_chain(p,digit),.0044 if carry else .0040)
  return sm(d,padded_chain(p,thumb),.010)
 m=surface(field,[-.12,-.115,-.055],[.092,.072,.228])
 x,y,z=m.triangles_center.T;lab=np.full(len(x),'canvas',dtype='<U10')
 lab[(y<-.008)&(z>.020)]='grip'
 for pts,rs in digits+[thumb]:
  lab[(chain(m.triangles_center,pts[-4:],rs[-4:])<(.0045 if carry else .0042))&(y<.004)]='grip'
 p=(x/.031)**4+((z-.056)/.036)**4
 lab[(y>.011)&(p<1.18)]='seam';lab[(y>.011)&(p<.93)]='patch'
 lab[(y>.011)&(p>.93)&(p<1.18)&(np.sin(np.arctan2((z-.056)/.044,x/.031)*34)>.25)]='thread'
 lab[(y>.0065)&(abs(z-(.101-.155*abs(x)))<.0018)&(abs(x)<.045)]='seam'
 for pts,rs in digits:
  for i in [3,6]:
   dist=np.linalg.norm(m.triangles_center-pts[i],axis=1)
   lab[(abs(dist-rs[i]*1.08)<.0012)&(y>.006)]='seam'
 emit(pose,'glove',m,lab,fn)
 flexes[pose]={'pivot':fn(A([0,0,.087])).tolist(),'forward':F.tolist(),'normal':N.tolist(),'width':W.tolist(),
  'digitWidths':[item[0]*scale for item in specs],
  'knuckles':[(item[1]-.087)*scale for item in specs],
  'digitLengths':[item[2]*scale for item in specs]}
for s,p in [(-1,'emptyL'),(1,'emptyR')]:
 w=[s*(.382 if s<0 else .402),-.325 if s<0 else -.355,-.55 if s<0 else -.525];relaxed(p,s,w,[-s*.52,.28 if s<0 else .23,-.81]);sleeve(p,w,[s*.74,-.64,-.25])
# Contact-defined carry glove. Four fingers follow the side of the carton;
# the opposable thumb wraps the front edge. Subtract the actual carton volume.
BOX_CENTER=A([0,-.584+.446*.88/2,-.864]); BOX_HALF=A([.446/2,.446*.88/2,.446*.82/2])
def box_sdf(p):
 q=abs(p-BOX_CENTER)-BOX_HALF
 return np.linalg.norm(np.maximum(q,0),axis=-1)+np.minimum(np.max(q,axis=-1),0)
def carryhand(pose,side):
 # Model right side in metres, mirror the entire continuous mesh for the left.
 wrist=A([.315,-.557,-.568]); elbow=A([.69,-.78,-.31]);digits=[]
 for y,z,l,r in [(-.437,-.698,.076,.013),(-.463,-.706,.086,.0135),(-.489,-.704,.079,.0125),(-.514,-.694,.062,.0108)]:
  digits.append(curve([[.269,y,z],[.252,y+.002,z-l*.34],[.241,y+.001,z-l*.66],[.235,y-.003,z-l*.89]],[r*1.12,r*1.1,r*.98,r*.85]))
 thumb=curve([[.270,-.438,-.653],[.241,-.410,-.645],[.209,-.402,-.651],[.184,-.411,-.667]],[.019,.017,.015,.013])
 def field(p):
  d=sm(ell(p,[.277,-.480,-.661],[.046,.058,.058]),cap(p,wrist,[.283,-.502,-.636],.042,.046),.014)
  d=sm(d,ell(p,[.264,-.448,-.651],[.032,.034,.038]),.008)
  for digit in digits:d=sm(d,padded_chain(p,digit),.0028)
  d=sm(d,padded_chain(p,thumb),.007)
  return np.maximum(d,.004-box_sdf(p+A([0,.047,0])))
 m=surface(field,[.13,-.624,-.83],[.385,-.370,-.504],.0028)
 x,y,z=m.triangles_center.T;lab=np.full(len(x),'canvas',dtype='<U10');lab[(x<.247)&(z<-.67)]='grip';lab[(z<-.735)]='grip';lab[(x<.224)&(z>-.684)]='grip'
 patch=((y+.48)/.039)**4+((z+.657)/.034)**4;back=x>.284
 lab[back&(patch<1.17)]='seam';lab[back&(patch<.91)]='patch';lab[back&(patch>.91)&(patch<1.17)&(np.sin(np.arctan2((y+.48)/.039,(z+.657)/.034)*31)>.2)]='thread'
 mirror=lambda p:p*A([side,1,1])+A([0,.047,0]);emit(pose,'glove',m,lab,mirror);sleeve(pose,mirror(wrist),elbow*A([side,1,1]))
 grip_anchors[pose]={name:mirror(pts[-1]).tolist() for name,(pts,rs) in zip(['index','middle','ring','little','thumb'],digits+[thumb])}
for s,p in [(-1,'carryL'),(1,'carryR')]:carryhand(p,s)
# One-handed underhand support. Palm faces up; separate finger arcs lie underneath the actual carton.
wrist=A([-.235,-.652,-.570]);elbow=A([-.72,-.81,-.27]);F=unit(A([.66,0,-.75]));W=unit(A([F[2],0,-F[0]]));N=A([0,-1,0]);origin=wrist
fn=lambda p:origin+p@A([W,N,F]);inv=lambda p:(p-origin)@A([W,N,F]).T
digits=[]
for j,(x,z,l,r) in enumerate([(-.033,.089,.085,.014),(-.009,.099,.086,.015),(.016,.096,.078,.014),(.040,.087,.061,.012)]):
 lift=[.0080,.0010,.0014,.0034][j]
 digits.append(curve([[x,0,z],[x,-.002,z+l*.34],[x,-.010-lift*.40,z+l*.70],[x,-.017-lift,z+l*.94]],[r,r*.96,r*.88,r*.78]))
thumb=curve(inv(A([[-.205,-.647,-.615],[-.178,-.615,-.638],[-.146,-.585,-.659],[-.132,-.550,-.665]])),[.020,.018,.015,.013])
def supportfield(p):
 d=sm(ell(p,[0,.003,.056],[.055,.038,.061]),ell(p,[0,.003,.008],[.037,.029,.035]),.012)
 for digit in digits:d=sm(d,padded_chain(p,digit),.004)
 d=sm(d,padded_chain(p,thumb),.008)
 return np.maximum(d,.003-box_sdf(fn(p)))
# Lift wrist to position the inner palm directly against the lower surface (y=-.584).
origin=wrist=A([-.235,-.617,-.570]);m=surface(supportfield,[-.125,-.140,-.05],[.095,.080,.222],.0028)
x,y,z=m.triangles_center.T;lab=np.full(len(x),'canvas',dtype='<U10');lab[y<-.009]='grip';patch=(x/.033)**4+((z-.056)/.037)**4;lab[(y>.012)&(patch<1.18)]='seam';lab[(y>.012)&(patch<.91)]='patch';lab[(y>.012)&(patch>.91)&(patch<1.18)&(np.sin(np.arctan2((z-.056)/.037,x/.033)*34)>.2)]='thread'
grip_anchors['supportL']={name:fn(pts[-1]).tolist() for name,(pts,rs) in zip(['index','middle','ring','little','thumb'],digits+[thumb])}
emit('supportL','glove',m,lab,fn);sleeve('supportL',wrist,elbow)
# A cylindrical grip with explicit finger centre lines around its circumference.
# Hand and tool share the SAME rigid transform; no separately rotated hand.
angle=.43;c,s=np.cos(angle),np.sin(angle);rot=A([[c,0,s],[0,1,0],[-s,0,c]])
pivot=A([.340,-.312,-.700]);shift=A([.018,-.030,.137]);tilt=-.24;ct,st=np.cos(tilt),np.sin(tilt);tiltR=A([[ct,-st,0],[st,ct,0],[0,0,1]]);rot=tiltR@rot;base_tf=lambda p:1.12*(p-pivot)@rot.T+pivot+shift
x0,y0=.318,-.272;digits=[];roll=.58;cr,sr=np.cos(roll),np.sin(roll);rr=A([[cr,-sr,0],[sr,cr,0],[0,0,1]]);axis=A([x0,y0,0]);tf=lambda p:base_tf((p-axis)@rr.T+axis);gf=tf
for j,z in enumerate([-.747,-.715,-.684,-.654]):
 r=[.0148,.0152,.0139,.0124][j];theta=np.deg2rad([-12,-53,-99,-145,-190])+np.deg2rad([3,0,-3,-7][j]);radii=.0349+np.array([r,r*.98,r*.92,r*.82,r*.72])+.002
 pts=np.column_stack([x0+radii*np.cos(theta),y0+radii*np.sin(theta),z+np.array([0,0,.001,.004,.007])]);digits.append(curve(pts,[r,r*.98,r*.92,r*.82,r*.72]))
thumb=curve([[.383,-.250,-.691],[.367,-.230,-.720],[.337,-.217,-.738],[.307,-.222,-.750]],[.017,.015,.013,.011]);wrist=A([.426,-.347,-.610])
def gripfield(p):
 d=sm(ell(p,[.384,-.274,-.696],[.038,.049,.062]),cap(p,wrist,[.396,-.290,-.662],.039,.039),.011)
 d=sm(d,ell(p,[.377,-.250,-.687],[.030,.031,.045]),.007)
 for digit in digits:d=sm(d,padded_chain(p,digit),.0023)
 d=sm(d,padded_chain(p,thumb),.007)
 # Clearance around barrel; thumb and fingertip contacts stay outside hard surface.
 radial=np.hypot(p[...,0]-x0,p[...,1]-y0)
 return np.maximum(d,.0394-radial)
m=surface(gripfield,[.235,-.418,-.845],[.505,-.177,-.528],.0028);x,y,z=m.triangles_center.T;lab=np.full(len(x),'canvas',dtype='<U10')
lab[(x<.327)|(y<-.310)]='grip';p=((z+.69)/.040)**4+((y+.269)/.025)**4;back=(x>.393)
lab[back&(p<1.20)]='seam';lab[back&(p<.91)]='patch';lab[back&(p>.91)&(p<1.20)&(np.sin(np.arctan2((y+.269)/.025,(z+.69)/.04)*31)>.3)]='thread'
grip_anchors['torch']={name:gf(pts[-1]).tolist() for name,(pts,rs) in zip(['index','middle','ring','little','thumb'],digits+[thumb])}
emit('torch','glove',m,lab,gf);sleeve('torch',gf(wrist),base_tf(A([.77,-.68,-.30])))
def lathe(profile):
 v=[];f=[];m=[];n=48
 for z,r,mat in profile:
  for i in range(n):a=i/n*2*np.pi;v.append([x0+r*np.cos(a),y0+r*np.sin(a),z])
 for j in range(len(profile)-1):
  for i in range(n):a=j*n+i;b=j*n+(i+1)%n;f.extend([[a,b,b+n],[a,b+n,a+n]]);m.extend([profile[j][2]]*2)
 for j in [0,len(profile)-1]:
  q=len(v);v.append([x0,y0,profile[j][0]])
  for i in range(n):f.append([q,j*n+i,j*n+(i+1)%n]);m.append('lens' if j==0 else 'metal')
 emit('torch','flashlight',trimesh.Trimesh(v,f,process=False),A(m),tf)
prof=[(-.869,.0001,'lens'),(-.869,.040,'lens'),(-.868,.042,'rim'),(-.866,.050,'metal'),(-.858,.052,'metal'),(-.838,.052,'metal'),(-.833,.048,'metal'),(-.822,.048,'black'),(-.819,.046,'metal'),(-.809,.046,'black'),(-.805,.044,'metal'),(-.789,.042,'metal'),(-.781,.035,'metal'),(-.774,.034,'black')]
for z in np.linspace(-.77,-.61,10):prof.extend([(z,.0348,'black'),(z+.002,.0355,'black')])
prof.extend([(-.606,.036,'metal'),(-.601,.039,'metal'),(-.585,.039,'metal'),(-.58,.034,'rim'),(-.578,.0001,'metal')]);lathe(prof)
for name,center,r,mat in [('switch_guard',[.318,-.230,-.773],[.013,.008,.016],'metal'),('switch',[.318,-.221,-.773],[.010,.006,.011],'black')]:
 m=trimesh.creation.icosphere(subdivisions=2);m.vertices=m.vertices*A(r)+A(center);emit('torch',name,m,np.full(len(m.faces),mat),gf)
rng=np.random.default_rng(1985);n=512;yy,xx=np.mgrid[:n,:n];noise=rng.normal(0,1,(n,n));soft=gaussian_filter(noise,6);soft/=soft.std()
for k,t in {'weave':225+12*np.sin(xx*np.pi/3)*np.sin(yy*np.pi/3)+8*np.cos((xx+yy)*np.pi/3)+5*noise+5*soft,'twill':225+13*np.cos((xx+yy)*np.pi/4)+7*np.sin(xx*np.pi/3)+5*noise+4*soft,'grip':220+22*np.sin(xx*np.pi/5)*np.sin(yy*np.pi/5)+8*noise+4*soft,'metal':230+5*np.sin(yy*np.pi/2)+3*noise+5*soft}.items():Image.fromarray(np.uint8(np.clip(t,0,255))).convert('RGB').save(R/'dist/assets'/('gdg-'+k+'.webp'),quality=93)
(R/'dist/viewmodel-mesh-data.js').write_text('export const MESH_DATA='+json.dumps(data,separators=(',',':'))+';\nexport const POSES='+json.dumps(poses,separators=(',',':'))+';\nexport const MATERIALS='+json.dumps({k:{'color':v,'texture':textures[k]} for k,v in colors.items()},separators=(',',':'))+';\nexport const TORCH_LOCAL='+json.dumps({'position':tf(A([x0,y0,-.870])).tolist(),'direction':(rot@A([0,0,-1])).tolist()})+';\nexport const SOCKETS='+json.dumps(sockets)+';\nexport const FINGER_FLEX='+json.dumps(flexes)+';\n')
for name,sc in scenes.items():sc.export(R/'modeling'/(name+'.glb'))
(R/'modeling/mesh-report.json').write_text(json.dumps(report,indent=2));print({k:sum(a['triangles'] for a in v) for k,v in poses.items()})

(R/'modeling/grip-anchors.json').write_text(json.dumps(grip_anchors,indent=2)+'\n')
