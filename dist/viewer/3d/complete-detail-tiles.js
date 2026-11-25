// Load all detail tiles, sharing compatible textures and materials across files.
import {drapeBuildings} from './corridor-terrain.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

export function createDetailTiles({scene,camera,coarse,indexUrl,priorityCentre=null,onChange=()=>{}}) {
 const group=new THREE.Group();group.name='streamed_detail_geometry';scene.add(group);
 const progress={loaded:0,total:0,complete:false,errors:[]};
 let completeResolve,completeReject,indexLoaded=false;
 const complete=new Promise((resolve,reject)=>{completeResolve=resolve;completeReject=reject;});
 complete.catch(()=>{}); // Startup observes failures after the index is ready.
 const sourceVisibility=new Map();
 const texturePool=new Map(),materialPool=new Map(),records=new Map();
 let tiles=[],enabled=true,active=0,last=-Infinity,anchor=priorityCentre,routePins=new Set(),pinUntil=0;
 let occupancy,extent,grid;const patched=new Set();
 const stats={textures:0,materials:0,residentTiles:0,inFlight:0,evictions:0};
 function acquire(pool,key,value){let e=pool.get(key);if(!e){e={value,refs:0};pool.set(key,e);}e.refs++;return e.value;}
 function release(pool,key){const e=pool.get(key);if(e&&!--e.refs){e.value.dispose();pool.delete(key);}}
 function share(gltf,url){
  const textureKeys=new Set(),materialKeys=new Set(),originalMaterials=new Set(),originalTextures=new Set();
  gltf.scene.traverse(o=>{if(!o.isMesh)return;const wasArray=Array.isArray(o.material),list=wasArray?o.material:[o.material];o.material=list.map(m=>{
   originalMaterials.add(m);
   for(const slot of Object.keys(m)){const t=m[slot];if(!t?.isTexture)continue;originalTextures.add(t);
    const assoc=gltf.parser.associations.get(t),def=gltf.parser.json.textures?.[assoc?.textures],im=gltf.parser.json.images?.[def?.source];
    if(!im?.uri)continue;
    const tj={};for(const prop of ['mapping','channel','wrapS','wrapT','magFilter','minFilter','anisotropy','format','internalFormat','type','colorSpace','flipY','premultiplyAlpha','unpackAlignment','generateMipmaps','matrixAutoUpdate','rotation'])tj[prop]=t[prop];for(const prop of ['offset','repeat','center','matrix'])tj[prop]=t[prop].toArray();
    const key=JSON.stringify([new URL(im.uri,url).href,tj]);
    if(!textureKeys.has(key)){m[slot]=acquire(texturePool,key,t);textureKeys.add(key);}else m[slot]=texturePool.get(key).value;
   }
   const meta={textures:{},images:{}};for(const t of Object.values(m))if(t?.isTexture)meta.textures[t.uuid]={uuid:t.uuid};const data=m.toJSON(meta);for(const k of ['uuid','name','metadata','textures','images'])delete data[k];
   const key=JSON.stringify(data);
   if(!materialKeys.has(key)){materialKeys.add(key);return acquire(materialPool,key,m);}return materialPool.get(key).value;
  });if(!wasArray)o.material=o.material[0];});
  const keptM=new Set([...materialPool.values()].map(e=>e.value)),keptT=new Set([...texturePool.values()].map(e=>e.value));
  for(const m of originalMaterials)if(!keptM.has(m))m.dispose();for(const t of originalTextures)if(!keptT.has(t))t.dispose();
  return ()=>{const gs=new Set();gltf.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);});for(const g of gs)g.dispose();for(const k of materialKeys)release(materialPool,k);for(const k of textureKeys)release(texturePool,k);};
 }
 function refresh(){
  if(occupancy){occupancy.image.data.fill(0);for(const r of records.values())if(r.complete&&enabled)occupancy.image.data[r.tile._cell]=255;occupancy.needsUpdate=true;}
  stats.textures=texturePool.size;stats.materials=materialPool.size;stats.residentTiles=records.size;stats.inFlight=active;
  progress.loaded=[...records.values()].filter(r=>r.complete).length;progress.total=tiles.length;progress.complete=indexLoaded&&enabled&&progress.loaded===progress.total&&!active;
  if(progress.complete)completeResolve(progress.loaded);
  if(new URLSearchParams(location.search).has('geometryQA'))document.title=`Geometry QA: ${stats.residentTiles} tiles, ${stats.textures} textures, ${stats.materials} materials, ${stats.evictions} evictions, ${progress.errors.length} errors`;
  coarse.visible=enabled;group.visible=enabled;onChange();
 }
 function patchCoarse(){
  coarse.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){if(patched.has(m))continue;patched.add(m);const previous=m.onBeforeCompile,oldKey=m.customProgramCacheKey.bind(m);
   m.onBeforeCompile=(shader,renderer)=>{previous.call(m,shader,renderer);shader.uniforms.detailOccupancy={value:occupancy};shader.uniforms.detailExtent={value:extent};shader.vertexShader='varying vec2 detailWorldXZ;\n'+shader.vertexShader.replace('#include <project_vertex>','detailWorldXZ = (modelMatrix * vec4(transformed, 1.0)).xz;\n#include <project_vertex>');shader.fragmentShader='uniform sampler2D detailOccupancy;\nuniform vec4 detailExtent;\nvarying vec2 detailWorldXZ;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec2 detailUV=(detailWorldXZ-detailExtent.xy)/detailExtent.zw;\nif(all(greaterThanEqual(detailUV,vec2(0.0))) && all(lessThan(detailUV,vec2(1.0))) && texture2D(detailOccupancy,detailUV).r>0.5) discard;');};
   m.customProgramCacheKey=()=>oldKey()+'|detail-stream-v1';m.needsUpdate=true;
  }});
 }
 function evict(r){r.token.cancelled=true;group.remove(r.root);for(const dispose of r.disposers)dispose();records.delete(r.tile.id);stats.evictions++;}
 async function load(tile){
  const token={cancelled:false},root=new THREE.Group(),r={tile,token,root,complete:false,disposers:[],lastWanted:performance.now()};records.set(tile.id,r);root.visible=false;group.add(root);active++;refresh();
  try{for(const file of [tile.file,...(tile.landmarks||[]).map(l=>l.file)].filter(Boolean)){
    if(token.cancelled||!tile._wanted)break;
    const url=new URL(file,indexUrl).href,gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url),dispose=share(gltf,url);
    if(token.cancelled||!tile._wanted){dispose();break;}
    gltf.scene.userData.sourceAsset=file;gltf.scene.visible=sourceVisibility.get(file)??true;
    r.disposers.push(dispose);root.add(gltf.scene);drapeBuildings(gltf.scene);group.updateWorldMatrix(true,false);root.updateWorldMatrix(true,false);gltf.scene.updateWorldMatrix(true,true);gltf.scene.traverse(o=>{o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;});
   }
   if(!token.cancelled&&tile._wanted){r.complete=true;root.visible=true;}else if(records.get(tile.id)===r)evict(r);
  }catch(e){progress.errors.push(String(e));completeReject(e);tile._retry=performance.now()+15000;if(records.get(tile.id)===r)evict(r);console.error(e);}finally{active--;refresh();pump();}
 }
 function pump(){if(!enabled)return;for(const t of tiles.filter(t=>t._wanted).sort((a,b)=>a._distance-b._distance)){if(active>=3)break;if(!records.has(t.id)&&!(t._retry>performance.now()))void load(t);}}
 function update(now=performance.now()){
  if(!tiles.length||now-last<300)return;last=now;
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);const distance=forward.y<-.05?Math.max(0,Math.min(7000,-camera.position.y/forward.y)):1500;const focus=camera.position.clone().addScaledVector(forward,distance);
  if(anchor){focus.set(anchor[0],0,anchor[2]);anchor=null;}
  if(now>pinUntil)routePins.clear();
  for(const t of tiles){t._distance=Math.hypot(focus.x-t.centre_xz[0],focus.z-t.centre_xz[1]);const r=records.get(t.id);t._wanted=enabled;if(r){if(t._wanted)r.lastWanted=now;else if(now-r.lastWanted>4000)evict(r);}}
  patchCoarse();pump();refresh();
 }
 const ready=(async()=>{const response=await fetch(indexUrl);if(!response.ok)throw Error(`Detail index HTTP ${response.status}`);const index=await response.json();tiles=index.tiles;
  const xs=[...new Set(tiles.map(t=>t.centre_xz[0]))].sort((a,b)=>a-b),zs=[...new Set(tiles.map(t=>t.centre_xz[1]))].sort((a,b)=>a-b),half=tiles[0].half_m;grid=[xs.length,zs.length];extent=new THREE.Vector4(xs[0]-half,zs[0]-half,xs.at(-1)-xs[0]+2*half,zs.at(-1)-zs[0]+2*half);
  occupancy=new THREE.DataTexture(new Uint8Array(grid[0]*grid[1]),...grid,THREE.RedFormat);occupancy.minFilter=occupancy.magFilter=THREE.NearestFilter;occupancy.generateMipmaps=false;
  for(const t of tiles)t._cell=xs.indexOf(t.centre_xz[0])+grid[0]*zs.indexOf(t.centre_xz[1]);indexLoaded=true;update();return tiles.length;
 })().catch(e=>{progress.errors.push(String(e));completeReject(e);console.error(e);return 0;});
 return {ready,complete,group,progress,stats,update,setSourceVisible(file,on){if(!file||sourceVisibility.get(file)===on)return;sourceVisibility.set(file,on);for(const r of records.values())for(const child of r.root.children)if(child.userData.sourceAsset===file)child.visible=on;onChange();},setEnabled(on){enabled=on;last=-Infinity;update();refresh();},get loaded(){return [...records.values()].filter(r=>r.complete).map(r=>r.tile.id);},hasPoints(points){const needed=new Set();for(const p of points){const t=tiles.find(t=>Math.abs(p[0]-t.centre_xz[0])<=t.half_m&&Math.abs(p[2]-t.centre_xz[1])<=t.half_m);if(!t)return false;needed.add(t.id);}routePins=needed;pinUntil=performance.now()+2000;return [...needed].every(id=>records.get(id)?.complete);}};
}
