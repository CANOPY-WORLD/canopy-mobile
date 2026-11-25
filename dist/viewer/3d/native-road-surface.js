import * as THREE from 'three';

// Presentation-only boundary stitching. Native trajectories and source heights
// remain unchanged; no terrain or bridge levels are inferred here.
export function nativeRoadTriangles(data){
 const triangles=[],ends=[];
 const emit=p=>triangles.push(p[0],(p[2]??0)+.02,-p[1]);
 for(const lane of data.lanes){
  if(lane.internal||lane.shape.length<2)continue;
  const p=lane.shape,edges=[];
  for(let i=0;i<p.length;i++){
   const normal=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return l?[-dy/l,dx/l]:[0,0]};
   const n0=normal(p[Math.max(0,i-1)],p[i===0?1:i]),n1=normal(p[i],p[Math.min(p.length-1,i+1)]);
   let nx=n0[0]+n1[0],ny=n0[1]+n1[1],length=Math.hypot(nx,ny);
   if(!length){nx=n0[0];ny=n0[1];length=1}nx/=length;ny/=length;
   const half=lane.width/2,scale=half/Math.max(.5,nx*n0[0]+ny*n0[1]);
   edges.push([[p[i][0]+nx*scale,p[i][1]+ny*scale,p[i][2]??0],[p[i][0]-nx*scale,p[i][1]-ny*scale,p[i][2]??0]]);
  }
  for(let i=1;i<edges.length;i++){const [a,b]=edges[i-1],[c,d]=edges[i];for(const v of [a,b,c,b,d,c])emit(v)}
  ends.push({edge:edges[0],junction:lane.from_junction},{edge:edges.at(-1),junction:lane.to_junction});
 }
 for(const junction of data.junctions){
  if(junction.shape.length<3)continue;
  const p=junction.shape.map(v=>{
   let best=.6,z=v[2]??0;
   for(const end of ends){
    if(end.junction&&end.junction!==junction.id)continue;
    const [a,b]=end.edge;
    const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
    const t=den?Math.max(0,Math.min(1,((v[0]-a[0])*dx+(v[1]-a[1])*dy)/den)):0;
    const distance=Math.hypot(v[0]-a[0]-t*dx,v[1]-a[1]-t*dy);
    // Do not join a different vertical level at an XY crossing.
    if(distance<best&&(end.junction===junction.id&&end.junction!=null||Math.abs((v[2]??0)-a[2])<1)){best=distance;z=a[2]}
   }
   return [v[0],v[1],z];
  });
  for(const triangle of THREE.ShapeUtils.triangulateShape(p.map(v=>new THREE.Vector2(v[0],-v[1])),[]))for(const i of triangle)emit(p[i]);
 }
 return triangles;
}
export function roadHeightAt(triangles,x,y,fallback){
 let result=fallback,found=false;
 for(let i=0;i<triangles.length;i+=9){
  const ax=triangles[i],ay=-triangles[i+2],bx=triangles[i+3],by=-triangles[i+5],cx=triangles[i+6],cy=-triangles[i+8];
  const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-10)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,w=1-u-v;
  if(Math.min(u,v,w)<-1e-7)continue;
  const z=u*triangles[i+1]+v*triangles[i+4]+w*triangles[i+7]-.02;
  const delta=Math.abs(z-fallback);if(delta<1&&(!found||z>result)){found=true;result=z}
 }
 return result;
}
export function createNativeRoadSurface(data){
 const triangles=nativeRoadTriangles(data);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#46525b',roughness:1,side:THREE.DoubleSide}));
 const cells=new Map(),size=10;
 for(let i=0;i<triangles.length;i+=9){
  const t=triangles.slice(i,i+9),xs=[t[0],t[3],t[6]],ys=[-t[2],-t[5],-t[8]];
  for(let x=Math.floor(Math.min(...xs)/size);x<=Math.floor(Math.max(...xs)/size);x++)for(let y=Math.floor(Math.min(...ys)/size);y<=Math.floor(Math.max(...ys)/size);y++){
   const key=`${x},${y}`,cell=cells.get(key)??[];cell.push(...t);cells.set(key,cell);
  }
 }
 mesh.userData.heightAt=(x,y,z)=>roadHeightAt(cells.get(`${Math.floor(x/size)},${Math.floor(y/size)}`)??[],x,y,z);return mesh;
}
