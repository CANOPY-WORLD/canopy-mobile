import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {LineSegments2} from 'three/addons/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {selectTubeNetwork} from './tube-network.mjs';
import {createCameraJourney} from './camera-journey.mjs';

function bytes(base64) { return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }

/** Read the pinned data wrapper as data, never execute the external viewer. */
export async function createTubeLayer({scene, camera, config, signal}) {
  const response = await fetch(config.source, {signal, credentials:'omit'});
  if (!response.ok) throw Error(`Tube geometry: HTTP ${response.status}`);
  const text = await response.text();
  const encoded = /window\.PILOT_GZ\s*=\s*["']([A-Za-z0-9+/=]+)["']/.exec(text)?.[1];
  if (!encoded) throw Error('Unsupported Tube data wrapper');
  const payload = await new Response(new Blob([bytes(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',payload)), b=>b.toString(16).padStart(2,'0')).join('');
  if (digest !== config.sha256) throw Error('Tube source checksum mismatch');
  signal?.throwIfAborted();
  const data = JSON.parse(new TextDecoder().decode(payload));
  const selected=selectTubeNetwork(data,config),shells=data.assets.shells;
  const loader=new GLTFLoader(),resources=new Set(),bodies=new Map(),views=new Map();
  const group=new THREE.Group();group.name='London Tube · neighbourhood';group.visible=false;
  const network=new THREE.Group();network.name='Authored Piccadilly routes · x-ray overview';group.add(network);
  const trackMaterials=[],labels=[];
  const trackMaterial=new LineMaterial({color:0x457dff,linewidth:4,depthTest:false,depthWrite:false,toneMapped:false});
  trackMaterials.push(trackMaterial);resources.add(trackMaterial);
  const keep=root=>root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
  const load=async b64=>{signal?.throwIfAborted();const root=(await loader.parseAsync(bytes(b64).buffer,'')).scene;keep(root);return root;};
  const dispose=()=>{group.removeFromParent();for(const r of resources)r.dispose();};
  try {
    for(const {platform,index} of selected.platforms){
      const key=shells.body_of[index];
      if(!bodies.has(key))bodies.set(key,await load(shells.bodies[key]));
      const local=new THREE.Group();local.name=platform.id;
      local.add(bodies.get(key).clone(true),await load(shells.parts[index]));
      if(data.assets.links[index])local.add(await load(data.assets.links[index]));
      // Shared corridor ENU: east/up/negative-north, exactly once.
      const [east,north,up]=platform.centre_enu;
      local.position.set(east,up,-north);local.rotation.y=platform.shell_local_x_heading_rad;
      group.add(local);local.updateMatrixWorld(true);
      const world=p=>local.localToWorld(new THREE.Vector3(...p)).toArray();
      // Short orbit radius permits looking along the platform without a wide swing.
      const position=world([30,2.35,-3.1]),target=world([28,2.3266666667,-3.1]);
      views.set(platform.id,{platform,pose:{pos:new THREE.Vector3(...position),target:new THREE.Vector3(...target)},
        journey:createCameraJourney([{time:2.8,position:[east+60,100,-north+100],target:[east,0,-north]},{time:5,position,target}],{safeApproach:true})});
    }
    const bounds=new THREE.Box3();
    for(const route of selected.routes){
      const points=route.path.map(([e,n,u])=>new THREE.Vector3(e,u,-n));points.forEach(p=>bounds.expandByPoint(p));
      const geometry=new LineSegmentsGeometry();geometry.setPositions(points.slice(1).flatMap((p,i)=>[...points[i].toArray(),...p.toArray()]));
      const line=new LineSegments2(geometry,trackMaterial);line.name=route.from+' → '+route.to;line.renderOrder=100;network.add(line);
    }
    for(const station of selected.stations){
      const p=views.get(station.primary).platform.centre_enu;
      const marker=new THREE.Mesh(new THREE.SphereGeometry(13,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,depthWrite:false}));
      marker.position.set(p[0],p[2],-p[1]);marker.renderOrder=101;network.add(marker);
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=72;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#15232be8';ctx.fillRect(0,0,512,72);ctx.fillStyle='#ffffff';ctx.font='600 44px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(station.label,256,36);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false,sizeAttenuation:false,toneMapped:false}));labels.push(label);
      label.name=station.label;label.position.copy(marker.position).add(new THREE.Vector3(0,65,0));label.scale.set(300,42,1);label.renderOrder=102;network.add(label);
    }
    keep(network);
    const centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    const overviewPose=()=>{
      const fit=Math.max(size.x/Math.max(.3,camera.aspect),size.z)/2/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*1.3;
      return {pos:centre.clone().add(new THREE.Vector3(0,fit+300,200)),target:centre.clone()};
    };
    const light=new THREE.HemisphereLight(0xffffff,0x777b85,2);group.add(light);
    let current=null,selection=null;
    const api={group,network,stations:selected.stations,routes:selected.routes,platformCount:selected.platforms.length,source:config.source,sha256:digest,
      get selection(){return selection;},get journey(){return current.journey;},get platform(){return current.platform;},get pose(){return current.pose;},
      select(id){
        const station=selected.stations.find(s=>s.id===id);
        if(id!=='network'&&!station)throw Error('Unknown Tube view: '+id);
        if(current)current.journey.playing=false;
        selection=id;network.visible=id==='network';light.visible=!network.visible;
        if(network.visible){const pose=overviewPose();current={pose,journey:createCameraJourney([{time:2.6,position:pose.pos.toArray(),target:pose.target.toArray()}])};}
        else current=views.get(station.primary);
      },
      setVisible(on){group.visible=on;if(on){for(const m of trackMaterials)m.resolution.set(innerWidth,innerHeight);const pixel=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/innerHeight;for(const label of labels)label.scale.set(150*pixel,24*pixel,1);}},dispose};
    api.select(config.defaultView??'network');signal?.throwIfAborted();scene.add(group);return api;
  } catch(error){dispose();throw error;}
}
