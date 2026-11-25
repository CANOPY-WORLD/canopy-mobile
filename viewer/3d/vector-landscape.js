import * as THREE from 'three';
// Mobile display adapter: retained flat polygons, low-poly sampled vegetation.
// Source coordinates and polygon boundaries stay unchanged; terrain refinement is omitted.
export async function createVectorLandscape({url,onChange}) {
 const base=new URL('../../mobile-assets/',import.meta.url);
 const get=async path=>{const r=await fetch(new URL(path,base));if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return path.endsWith('.gz')?new Response(r.body.pipeThrough(new DecompressionStream('gzip'))):r};
 const [meta,source]=await Promise.all([get('landscape.json').then(r=>r.json()),get('landscape-source.json.gz').then(r=>r.json())]);
 const surface=new THREE.Group(),vegetation=new THREE.Group();surface.name='vector_landscape';vegetation.name='mobile_vegetation';
 await Promise.all(meta.layers.map(async layer=>{
  const bytes=await get(layer.file).then(r=>r.arrayBuffer());
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(bytes),3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:layer.color,side:THREE.DoubleSide}));mesh.name=layer.name;mesh.userData.flatGeometry=g;mesh.userData.terrainGeometry=g;surface.add(mesh);
 }));
 const trees=source.trees;
 const mesh=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,5),new THREE.MeshLambertMaterial({color:0x4e7652}),trees.length);
 const dummy=new THREE.Object3D();trees.forEach(([x,y,seed],i)=>{const h=9+seed*5;dummy.position.set(x,h/2,-y);dummy.scale.set(h*.32,h,h*.32);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.computeBoundingSphere();vegetation.add(mesh);
 surface.userData.counts=meta;vegetation.userData.counts={trees:trees.length};onChange();
 return {surface,vegetation,meta,signalPlacements:source.placements?.traffic_signal,sourcePlacements:source.placements};
}
