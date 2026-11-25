import * as THREE from 'three';

// Display-only approximation from measured footprint / roof masks. Coordinates
// stay in the source ENU frame. Palette is illustrative, not a material survey.
export function buildProxyCity({ footprint, roof, W, H, CELL, X0, ZS, stride = 1 }) {
  if (stride > 1) {
    const w = Math.ceil(W / stride), h = Math.ceil(H / stride);
    const f = new Uint8Array(w*h), r = new Float32Array(w*h);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(footprint[y*W+x]){const i=Math.floor(y/stride)*w+Math.floor(x/stride);f[i]=1;r[i]=Math.max(r[i],roof[y*W+x]||0)}
    footprint=f;roof=r;W=w;H=h;CELL*=stride;
  }
  const columns=[];
  for(let r=0;r<H;r++)for(let c=0;c<W;){
    const i=r*W+c;
    if(!footprint[i]){c++;continue;}
    const h=Math.max(3,roof[i]||0);let end=c;
    while(end+1<W && footprint[r*W+end+1] && Math.abs((roof[r*W+end+1]||0)-(roof[i]||0))<0.5)end++;
    columns.push([X0+(c+end+1)*CELL/2,h/2,ZS-(r+0.5)*CELL,(end-c+1)*CELL,h,CELL,c,r]);c=end+1;
  }
  const geometry=new THREE.BoxGeometry(1,1,1);
  const normals=geometry.attributes.normal, colors=[];
  for(let i=0;i<normals.count;i++){const k=normals.getY(i)>0 ? 1.12 : 0.86;colors.push(k,k,k);}
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const material=new THREE.MeshLambertMaterial({vertexColors:true});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vMobileBox;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMobileBox = position;');
    shader.fragmentShader='varying vec3 vMobileBox;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 edgeDist = abs(abs(vMobileBox) - vec3(0.5));
      vec3 aa = max(fwidth(vMobileBox) * 1.1, vec3(0.0001));
      vec3 edge = 1.0 - smoothstep(vec3(0.0), aa, edgeDist);
      float outline = max(min(edge.x, edge.y), max(min(edge.x, edge.z), min(edge.y, edge.z)));
      diffuseColor.rgb *= 1.0 - 0.18 * outline;
    `);
  };
  const mesh=new THREE.InstancedMesh(geometry,material,columns.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const palette=['#bfcbd1','#d8cbb8','#bb9183','#cad1c5','#a7b7c6'].map(c=>new THREE.Color(c));
  columns.forEach(([x,y,z,sx,sy,sz,c,r],i)=>{
    matrix.compose(position.set(x,y,z),rotation,scale.set(sx,sy,sz));mesh.setMatrixAt(i,matrix);
    const seed=(Math.floor(c/5)*73856093 ^ Math.floor(r/5)*19349663)>>>0;
    mesh.setColorAt(i,palette[seed%palette.length]);
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.name=`Mobile city · ${columns.length} columns`;mesh.userData.proxy=true;
  return {mesh,boxes:columns.length,triangles:columns.length*12};
}
