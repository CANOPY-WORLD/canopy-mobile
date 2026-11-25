import {currentTerrain} from './corridor-terrain.js';
import {createCameraJourney} from './camera-journey.mjs';
// Presentation adapter for an already aligned, static concept interior.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function createInteriorLayer({scene,renderer,config,url}) {
  const group=new THREE.Group();group.name='I-HUB concept interior';group.visible=false;
  const loader=new GLTFLoader();
  async function load(path){
    const response=await fetch(url(path));
    if(!response.ok)throw Error(`Interior geometry: HTTP ${response.status}`);
    const buffer=path.endsWith('.gz')
      ? await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : await response.arrayBuffer();
    return (await loader.parseAsync(buffer,'')).scene;
  }
  const [building,office]=await Promise.all([load(config.building),load(config.office)]);
  building.name='I-HUB retained shell';office.name='I-HUB retained office';
  // The office export repeats the same facade at the floor level. The intact
  // building shell supplies it once, avoiding coplanar flicker during approach.
  office.traverse(o=>{if(o.name==='facade')o.visible=false;});
  // Restore the authored v10 ceiling omitted by its visible-only GLB export.
  if(config.ceiling){
    const c=config.ceiling,shape=new THREE.Shape(c.footprint_x_north_m.map(p=>new THREE.Vector2(...p)));
    const ceiling=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:c.thickness_m,bevelEnabled:false}),new THREE.MeshStandardMaterial({color:0xfafaf7,roughness:.84,side:THREE.DoubleSide}));
    ceiling.name='Retained v10 continuous ceiling';ceiling.rotation.x=-Math.PI/2;ceiling.position.y=c.height_m;group.add(ceiling);
  }
  group.add(building,office);scene.add(group);
  const height=currentTerrain()?.sample(config.camera.position[0],config.camera.position[2]) ?? 0;
  group.position.y=height;
  const raised=v=>[v[0],v[1]+height,v[2]];
  const pose={target:new THREE.Vector3(...raised(config.camera.target)),pos:new THREE.Vector3(...raised(config.camera.position))};
  return {group,building,office,pose,journey:config.journey?createCameraJourney(config.journey.keyframes.map(f=>({...f,position:raised(f.position),target:raised(f.target)})),{safeApproach:true}):null,setVisible(on){group.visible=on;},dispose(){group.removeFromParent();const resources=new Set();group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();}};
}
