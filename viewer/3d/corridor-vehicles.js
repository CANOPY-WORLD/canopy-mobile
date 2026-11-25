import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {vehicleDimensions,vehicleCenter} from '../vehicle-types.mjs';

// Generic type-specific bodies. Recorded kinematics and explicit dimensions are authoritative.
export function createCorridorVehicles(capacity,metadata={}){
 const group=new THREE.Group();group.name='Detailed recorded traffic';
 const paint=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.65});
 const glass=new THREE.MeshStandardMaterial({color:'#25404b',roughness:.65});
 const rubber=new THREE.MeshStandardMaterial({color:'#25282b',roughness:.8});
 const headlights=new THREE.MeshBasicMaterial({color:'#fff1c9'}),taillights=new THREE.MeshBasicMaterial({color:'#ae201b'});
 const batches=new Map(),dummy=new THREE.Object3D(),color=new THREE.Color();
 const palette=[0xd45139,0xe5e8e5,0x647c8c,0x363d47,0x8c9d91,0xc6b89a];
 function model(kind){
  const dimensions=vehicleDimensions(kind,metadata.vehicle_types),{length:L,width:W,height:H}=dimensions;
  const buckets=new Map(),add=(g,m)=>{if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g)};
  const box=(x,y,z,w,h,d,m)=>add(new THREE.BoxGeometry(w,h,d).translate(x,y,z),m);
  const radius=Math.min(H*.21,kind==='motorcycle'?.32:.48),axle=L*.32;
  if(kind==='motorcycle'){
   box(0,H*.43,0,L*.5,H*.28,W*.65,paint);box(-L*.08,H*.62,0,L*.35,H*.1,W*.5,rubber);
   box(L*.24,H*.9,0,L*.08,H*.2,W,glass);
   for(const x of [-axle,axle])add(new THREE.CylinderGeometry(radius,radius,W*.22,12).rotateX(Math.PI/2).translate(x,radius,0),rubber);
  }else{
   box(0,radius+.12,0,L,.24,W,paint);
   if(kind==='bus'){
    box(0,H*.43,0,L,H*.5,W,paint);box(0,H*.79,0,L*.94,H*.35,W*.97,glass);box(0,H*.98,0,L,H*.04,W,paint);
    for(let x=-L*.42;x<L*.45;x+=1.1)box(x,H*.79,0,.08,H*.36,W,paint);
   }else if(kind==='hgv'){
    box(-L*.13,H*.57,0,L*.7,H*.86,W,paint);box(L*.37,H*.43,0,L*.26,H*.6,W,paint);box(L*.4,H*.7,0,L*.19,H*.23,W*.97,glass);
   }else if(kind==='lgv'){
    box(-L*.13,H*.56,0,L*.72,H*.88,W,paint);box(L*.34,H*.4,0,L*.3,H*.55,W,paint);box(L*.29,H*.72,0,L*.25,H*.3,W*.95,glass);
   }else{
    box(0,H*.4,0,L,H*.4,W,paint);box(-L*.04,H*.76,0,L*.52,H*.44,W*.94,glass);box(-L*.04,H*.99,0,L*.5,H*.02,W,paint);
   }
   for(const x of [-axle,axle])for(const z of [-W/2+.1,W/2-.1])add(new THREE.CylinderGeometry(radius,radius,.2,12).rotateX(Math.PI/2).translate(x,radius,z),rubber);
   for(const z of [-W*.32,W*.32]){box(L/2-.02,H*.4,z,.04,.12,W*.13,headlights);box(-L/2+.02,H*.4,z,.04,.12,W*.13,taillights)}
  }
  const meshes=[];
  for(const [material,parts] of buckets){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());const mesh=new THREE.InstancedMesh(g,material,capacity);mesh.count=0;mesh.frustumCulled=false;mesh.name=`${kind} body`;group.add(mesh);meshes.push(mesh)}
  const batch={meshes,dimensions,count:0};batches.set(kind,batch);return batch;
 }
 return {group,begin(){for(const b of batches.values())b.count=0},set(id,kind,x,north,heading,height=0,pitch=0){
  const b=batches.get(kind)??model(kind),i=b.count++;
  const reference=metadata.position_reference??'center',center=vehicleCenter(x,north,heading,b.dimensions.length,reference,pitch);
  const centerHeight=reference==='front_bumper'?height-Math.sin(pitch)*b.dimensions.length/2:height;
  dummy.position.set(center[0],centerHeight,-center[1]);dummy.rotation.set(0,heading,pitch,'YXZ');dummy.updateMatrix();
  for(const mesh of b.meshes){mesh.setMatrixAt(i,dummy.matrix);if(mesh.material===paint)mesh.setColorAt(i,color.set(kind==='bus'?0xe6b13c:palette[id%palette.length]))}
 },finish(){let count=0;const counts={};for(const [kind,b] of batches){counts[kind]=b.count;count+=b.count;for(const m of b.meshes){m.count=b.count;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}}group.count=count;group.userData={counts,styling:'Generic type-specific bodies; explicit run dimensions and position reference respected'}}};
}
