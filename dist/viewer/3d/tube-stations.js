// London Tube · any built station, from the geometry-only station file that the scene's `underground.stations` declares.
//
// The file has the container and the fields of the platform source that tube-layer.js reads (window.PILOT_GZ: base64 of
// gzip of JSON; pilot.platforms, assets.shells, assets.links), plus roofs, static platforms and a station list with a
// camera pose per station. It carries no trains, passengers or timetable. It is part of the Scenario data, is fetched
// through the scene's routed URLs only when a station is first chosen, and is checked against the SHA-256 the scene
// declares before it is decoded; it is read as data and never executed.
// Station interiors, stairs, ways out and roofs are representative and assumed, not surveyed.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCameraJourney} from './camera-journey.mjs';
import {stationView} from './tube-station-view.mjs';
import {platformCamera} from './tube-platform-camera.js';

const bytes = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

export async function loadTubeStations({config, signal}) {
  const response = await fetch(config.source, {signal, credentials: 'omit'});
  if (!response.ok) throw Error(`Tube stations: HTTP ${response.status}`);
  if (!/^[0-9a-f]{64}$/.test(config.sha256 ?? '')) throw Error('Tube stations data has no declared checksum');
  const file = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', file)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== config.sha256) throw Error('Tube stations checksum mismatch');
  const encoded = /window\.PILOT_GZ\s*=\s*["']([A-Za-z0-9+/=]+)["']/.exec(new TextDecoder().decode(file))?.[1];
  if (!encoded) throw Error('Unsupported Tube stations wrapper');
  const payload = await new Response(new Blob([bytes(encoded)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  signal?.throwIfAborted();
  const data = JSON.parse(new TextDecoder().decode(payload));
  const byId = new Map(data.stations.map(station => [station.id, station]));
  for (const [id] of config.list) if (!byId.has(id)) throw Error(`Tube station ${id} is not in the pinned data`);
  const P = data.pilot.platforms, S = data.pilot.static_platforms ?? [], A = data.assets, SH = A.shells;
  const loader = new GLTFLoader(), parse = async base64 => (await loader.parseAsync(bytes(base64).buffer, '')).scene;

  /** Build one station in the shared scene, hidden. The caller shows it and disposes it. */
  async function build(scene, id, buildSignal) {
    const station = byId.get(id); if (!station) throw Error('Tube station is unavailable');
    const selected = stationView(station, P, S);
    const info = {id: station.id, name: station.name, service: station.service, platforms: station.platforms.length + station.statics.length, viewKind:'platform', environment:selected.kind};
    const group = new THREE.Group(); group.name = `London Tube · ${station.name} (representative station)`; group.visible = false;
    const i=selected.frame, k=selected.staticFrame, record=i!==undefined?P[i]:S[k];
    const frame = new THREE.Group(), [east,north,up]=record.centre_enu;
    frame.position.set(east,up,-north); frame.rotation.y=record.shell_local_x_heading_rad;
    const models=i!==undefined?[SH.bodies[SH.body_of[i]],SH.parts[i],A.links[i],A.roofs?.[i]]:[SH.bodies[SH.static_body_of[k]],SH.static_parts[k]];
    for(const model of await Promise.all(models.filter(Boolean).map(parse)))frame.add(model);
    group.add(frame,new THREE.HemisphereLight(0xffffff,0x777b85,2)); group.updateMatrixWorld(true);
    const resources = new Set();
    group.traverse(o => { if (o.geometry) resources.add(o.geometry); for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) { resources.add(m); for (const v of Object.values(m)) if (v?.isTexture) resources.add(v); } });
    const dispose = () => { group.removeFromParent(); for (const r of resources) r.dispose(); };
    let standing;try{standing=platformCamera(frame);}catch(error){dispose();throw error;}
    const {position,target,audit}=standing, centre=frame.position;
    info.camera=audit;
    info.sourcePlatform=record.id;
    info.hasDeck=false;frame.traverse(o=>{if(/deck(?:_\d+)?$/.test(o.name))info.hasDeck=true;});
    const view={pose:{pos:new THREE.Vector3(...position),target:new THREE.Vector3(...target)},
      journey:createCameraJourney([
        {time:3.2,position:[centre.x+60,Math.max(100,centre.y+80),centre.z+100],target:[centre.x,centre.y,centre.z]},
        {time:5.6,position,target},
      ],{safeApproach:true})};
    if (buildSignal?.aborted) { dispose(); buildSignal.throwIfAborted(); }
    scene.add(group);
    return {group, station: info, networkLocation: false,
      get journey() { return view.journey; }, get pose() { return view.pose; },
      frameView() {}, setVisible(on) { group.visible = on; }, dispose};
  }
  return {stations: data.stations.map(station => ({id: station.id, name: station.name, service: station.service, ...stationView(station, P, S)})), info: data.wrapper, source: config.source, sha256: digest, build};
}
