import * as THREE from 'three';

// Source way paths locate crossings; stripe dimensions are illustrative.
export async function createRoadCrossings({url, terrain}) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`Crossings HTTP ${response.status}`);
  const data = await response.json(), flat = [], elevated = [];
  for (const feature of data.features) {
    let travelled = 0;
    const line = feature.line_enu_m;
    for (let i = 1; i < line.length; i++) {
      const a = line[i-1], b = line[i], length = Math.hypot(b[0]-a[0], b[1]-a[1]);
      if (length < 0.001) continue;
      const dx = (b[0]-a[0])/length, dn = (b[1]-a[1])/length;
      // Carry the stripe phase through polyline vertices, including partial stripes.
      for (let start = Math.floor(travelled)-travelled; start < length; start += 1) {
        const lo=Math.max(0,start),hi=Math.min(length,start+.5);
        if(hi-lo<.0001)continue;
        const corners = [[lo,-1.5],[hi,-1.5],[hi,1.5],[lo,1.5]].map(([s,w]) => {
          const x=a[0]+dx*s-dn*w, north=a[1]+dn*s+dx*w;
          const match=terrain.match(x,north,undefined,undefined,false);
          return {x,north,height:match.height+(terrain.roadOffset??.025)+.015,valid:match.distance!==null&&match.distance<4};
        });
        // Exclude source ways that do not align with the available road network.
        if (!corners.every(p=>p.valid)) continue;
        for (const j of [0,1,2,0,2,3]) {
          const p=corners[j];flat.push(p.x,.29,-p.north);elevated.push(p.x,p.height,-p.north);
        }
      }
      travelled += length;
    }
  }
  const geometry = positions => {
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
  };
  const flatGeometry=geometry(flat), terrainGeometry=geometry(elevated);
  const mesh=new THREE.Mesh(terrainGeometry,new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
  mesh.name='mapped_zebra_crossings';mesh.userData.stripes=flat.length/18;
  mesh.userData.attribution=data.attribution;
  mesh.userData.dimensions='Illustrative 0.5 m stripes at 1 m spacing, 3 m width; source crossing paths';
  mesh.setTerrain=enabled=>{mesh.geometry=enabled?terrainGeometry:flatGeometry;};
  return mesh;
}
