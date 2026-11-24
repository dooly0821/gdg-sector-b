"""Sample the actual packed WebGL/CPU triangle geometry, not the source SDF."""
import json, numpy as np, base64
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'dist/viewmodel-mesh-data.js').read_text();data=json.loads(s.splitlines()[0].split('=',1)[1][:-1]);report={}
def triangles(key):return np.frombuffer(base64.b64decode(data[key]),dtype='<i2').reshape(-1,8)[:,:3].astype(float).reshape(-1,3,3)/20000
def samples(prefix):
 t=np.concatenate([triangles(k) for k in data if k.startswith(prefix)]);return np.concatenate([t.reshape(-1,3),t.mean(1),(t[:,0]+t[:,1])/2,(t[:,1]+t[:,2])/2,(t[:,2]+t[:,0])/2])
def check(name,d):
 report[name]={'sample_count':len(d),'min_clearance_m':float(d.min()),'penetrating_samples':int(sum(d<0))};assert not np.any(d<0),name
for prefix in ['vm_carryL_glove','vm_carryR_glove','vm_carryL_sleeve','vm_carryR_sleeve','vm_supportL_glove','vm_supportL_sleeve']:
 p=samples(prefix);q=np.abs(p-[0,-.584+.446*.88/2,-.864])-[.446/2,.446*.88/2,.446*.82/2];d=np.linalg.norm(np.maximum(q,0),axis=-1)+np.minimum(np.max(q,axis=-1),0);check(prefix,d)
a=.43;c,s=np.cos(a),np.sin(a);rot=np.array([[c,0,s],[0,1,0],[-s,0,c]]);a=-.24;ct,st=np.cos(a),np.sin(a);rot=np.array([[ct,-st,0],[st,ct,0],[0,0,1]])@rot;pivot=np.array([.340,-.312,-.700]);shift=np.array([.018,-.030,.137]);roll=.58;cr,sr=np.cos(roll),np.sin(roll);rr=np.array([[cr,-sr,0],[sr,cr,0],[0,0,1]]);axis=np.array([.318,-.272,0]);
def inv(p):return (((p-pivot-shift)@rot/1.12+pivot)-axis)@rr+axis
p=inv(samples('vm_torch_glove'));r=np.hypot(p[:,0]-.318,p[:,1]+.272)
prof=[(-.869,.040),(-.868,.042),(-.866,.050),(-.858,.052),(-.838,.052),(-.833,.048),(-.822,.048),(-.819,.046),(-.809,.046),(-.805,.044),(-.789,.042),(-.781,.035),(-.774,.034)]
for z in np.linspace(-.77,-.61,10):prof.extend([(z,.0348),(z+.002,.0355)])
prof.extend([(-.606,.036),(-.601,.039),(-.585,.039),(-.58,.034),(-.578,.0001)]);z,rad=np.array(prof).T;inside=(p[:,2]>=z.min())&(p[:,2]<=z.max());d=(r-np.interp(p[:,2],z,rad))*1.12;check('torch_barrel',d[inside]);
for name,center,radii in [('guard',[.318,-.230,-.773],[.013,.008,.016]),('switch',[.318,-.221,-.773],[.010,.006,.011])]:
 d=np.linalg.norm((p-center)/radii,axis=1);report[name]={'sample_count':len(d),'min_normalized_radius':float(d.min()),'penetrating_samples':int(sum(d<1))};assert np.all(d>=1),name
(root/'modeling/contact-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
