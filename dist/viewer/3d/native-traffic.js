import * as THREE from 'three';
import {createCorridorVehicles} from './corridor-vehicles.js';
import {createNativeRoadSurface} from './native-road-surface.js';
import {createTrafficFacilities} from './traffic-facilities.js';
import {validateNativeTraffic,nativeTrafficSamples} from '../native-traffic-samples.mjs';

export async function createNativeTraffic({url,panel,onChange}) {
  const response=await fetch(url);
  if(!response.ok)throw Error('Native traffic recording unavailable');
  const data=await response.json(),{frames,ids}=validateNativeTraffic(data);
  const group=new THREE.Group();group.name='Recorded native SUMO traffic';group.visible=false;
  const roads=createNativeRoadSurface(data),facilities=createTrafficFacilities(data,{surfaceHeight:roads.userData.heightAt});
  const vehicles=createCorridorVehicles(Math.max(...frames.map(f=>f.vehicles.size)),data);
  // Native asphalt and mapped walk/cycle polygons both use a 2 cm display lift.
  // Resolve coplanar fragments without moving recorded heights or vehicle poses.
  roads.material.polygonOffset=true;roads.material.polygonOffsetFactor=-4;roads.material.polygonOffsetUnits=-4;
  group.add(roads,facilities.group,vehicles.group);
  const slider=panel.querySelector('#corridor-traffic-step'),rate=panel.querySelector('#corridor-traffic-rate'),clock=panel.querySelector('#corridor-traffic-time'),button=panel.querySelector('#corridor-traffic-play');
  slider.max=frames.length-1;slider.step='0.01';rate.value='1';
  let position=0,playing=false;
  function show(value){
    position=Math.max(0,Math.min(frames.length-1,value));
    const sample=nativeTrafficSamples(frames,position);vehicles.begin();
    for(const v of sample.vehicles)vehicles.set(ids.get(v[0]),v[1],v[2],v[3],v[5],v[4],v[6]);
    vehicles.finish();facilities.setTime(sample.time);slider.value=position;
    clock.textContent=`SUMO ${sample.time.toFixed(2)} s · ${sample.vehicles.length} vehicles`;onChange();
  }
  function setPlaying(value){playing=Boolean(value);if(playing&&position>=frames.length-1)show(0);button.textContent=playing?'Pause traffic':'Play traffic';onChange();}
  button.onclick=()=>setPlaying(!playing);slider.oninput=()=>show(Number(slider.value));
  panel.querySelector('#corridor-traffic-visible').onchange=e=>{vehicles.group.visible=e.target.checked;onChange();};
  show(0);
  return {group,roads,facilities,coverage:{center:data.center,radius:data.radius},cars:vehicles.group,meta:{schema:data.schema,dt:.1,t0:frames[0].time,frames:frames.length,provenance:data.provenance},frames,
    get frame(){return Math.floor(position)},get position(){return position},get playing(){return playing},show,setPlaying,
    tick(dt){if(playing){show(position+dt*Number(rate.value)/.1);if(position>=frames.length-1)setPlaying(false);}}
  };
}
