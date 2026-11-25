import * as THREE from 'three';
import {signalStateAt,signalLamps} from '../traffic-signal-state.mjs';

// Presentation of declared native controls and mapped crossing ways only.
export function createTrafficFacilities(data,{surfaceHeight=(x,y,z)=>z}={}){
 const group=new THREE.Group();group.name='Recorded signals and mapped crossings';
 const black=new THREE.MeshStandardMaterial({color:0x24292e,roughness:.8});
 const white=new THREE.MeshBasicMaterial({color:0xfaf7df,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
 const paint=[],heads=[],stops=new Set();
 // One fixture per native incoming edge when every represented link has the same
 // recorded state history. Different movements retain separate heads.
 const buckets=new Map();
 for(const h of data.signals?.heads??[]){
  const edge=h.edge??h.lane.replace(/_\d+$/,'');
  const history=data.signals.timeline[h.tls];
  const signature=history?.length?history.map(e=>e.state[h.link_index]).join(''):String(h.link_index);
  const key=JSON.stringify([h.tls,edge,signature]);
  const items=buckets.get(key)??[];items.push(h);buckets.set(key,items);
 }
 const fixtures=[];
 for(const items of buckets.values()){
  // Leftmost lane in ENU: place the representative pole at the road edge.
  const base=items[0],nx=-Math.sin(base.heading),ny=Math.cos(base.heading);
  const h=items.reduce((a,b)=>b.position[0]*nx+b.position[1]*ny+b.lane_width/2>a.position[0]*nx+a.position[1]*ny+a.lane_width/2?b:a);
  fixtures.push(h);
 }
 function rectangle(center,dx,dy,length,width){
  const [x,y,z]=center;
  const point=(a,b)=>{const px=x+dx*a-dy*b,py=y+dy*a+dx*b;return [px,surfaceHeight(px,py,z)+.065,-py]};
  const columns=Math.max(1,Math.ceil(length/.25)),rows=Math.max(1,Math.ceil(width/.25));
  for(let i=0;i<columns;i++)for(let j=0;j<rows;j++){
   const a=-length/2+i*length/columns,b=-width/2+j*width/rows;
   const points=[point(a,b),point(a+length/columns,b),point(a+length/columns,b+width/rows),point(a,b+width/rows)];
   for(const k of [0,1,2,0,2,3])paint.push(...points[k]);
  }
 }
 for(const h of data.signals?.heads??[]){
  if(stops.has(h.lane))continue;stops.add(h.lane);
  const [x,y,z]=h.position,dx=Math.cos(h.heading),dy=Math.sin(h.heading);
  rectangle([x-dx*.35,y-dy*.35,z],dx,dy,.25,h.lane_width-.15);
 }
 for(const h of fixtures){
  const [x,y,z]=h.position,dx=Math.cos(h.heading),dy=Math.sin(h.heading),offset=h.lane_width/2+.5;
  const fixture=new THREE.Group();fixture.position.set(x-dy*offset,z,-y-dx*offset);fixture.rotation.y=h.heading-Math.PI/2;
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,3.8,8),black);pole.position.y=1.9;fixture.add(pole);
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.7,1.95,.35),black);housing.position.y=3.65;fixture.add(housing);
  const lamps={};for(const [name,color,height] of [['red',0xff2828,4.28],['amber',0xffbd20,3.65],['green',0x38ff74,3.02]]){
   const material=new THREE.MeshStandardMaterial({color:0x172029,emissive:color,emissiveIntensity:0,roughness:.4});
   const lamp=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),material);lamp.scale.z=.55;lamp.position.set(0,height,.22);fixture.add(lamp);lamps[name]=material;
  }
  group.add(fixture);heads.push({h,lamps});
 }
 for(const feature of data.crossings??[]){
  let travelled=0;
  for(let i=1;i<feature.line.length;i++){
   const a=feature.line[i-1],b=feature.line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-6)continue;
   const dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
   const rect=(lo,hi,offset,width)=>{const t=(lo+hi)/2,u=t/len;rectangle([a[0]+dx*t-dy*offset,a[1]+dy*t+dx*offset,a[2]+(b[2]-a[2])*u],dx,dy,hi-lo,width)};
   if(feature.kind==='lines'){for(const side of [-1.5,1.5])rect(0,len,side,.12)}
   else for(let start=Math.floor(travelled)-travelled;start<len;start+=1){const lo=Math.max(0,start),hi=Math.min(len,start+(feature.kind==='zebra'?.5:.25));if(hi<=lo)continue;if(feature.kind==='zebra')rect(lo,hi,0,3);else if(feature.kind==='dots')for(const side of [-1.5,1.5])rect(lo,hi,side,.25)}
   travelled+=len;
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(paint,3));geometry.computeVertexNormals();
 const markingMesh=new THREE.Mesh(geometry,white);markingMesh.name='Mapped crossing paint and native stop lines';group.add(markingMesh);
 return {group,headCount:heads.length,setTime(time){for(const {h,lamps} of heads){const state=signalStateAt(data.signals,h.tls,time),on=signalLamps(state?.[h.link_index]);for(const [name,material] of Object.entries(lamps)){material.emissiveIntensity=on[name]?2.5:0;material.color.setHex(on[name]?material.emissive.getHex():0x172029)}}},dispose(){const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());group.removeFromParent();}};
}
