// London Tube · scheduled service: the corridor's schematic tunnels and its timetabled trains, in the shared city scene.
//
// Data, declared by the scene's `underground` key and fetched through the scene's routed URLs only when this state is
// first opened: underground.json (track geometry from OpenStreetMap; tunnel depths are assumed typical values) and
// underground_trains_<period>.json (one representative day's timetable). Both are checked against the SHA-256 the
// scene declares before they are decoded. Coordinates are corridor ENU metres; the render frame is (east, up, -north).
//
// Presentation only. Trains follow the archived timetable rule of tube-timetable.mjs: no added stops, doors or
// passengers. This module owns no render loop and no clock of its own beyond the bounded service clock it returns;
// the viewer ticks it while the network state is selected.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CARS, PITCH, clockText, createServiceClock, peakTrains, preparePatterns, trainsAt} from './tube-timetable.mjs';

const RADIUS = {deep: 1.9, subsurface: 2.6, rail: 2.6};
const LINE_OFFSET_M = 4.2, RIBBON_HALF_M = 4.5, RIBBON_ABOVE_M = 900, FAR_CAR_WIDTH = 5, FAR_CAR_HEIGHT = 3;
const point = (east, north, up) => new THREE.Vector3(east, up, -north);

async function verifiedJSON(url, expected, signal) {
  if (!/^[0-9a-f]{64}$/.test(expected ?? '')) throw Error('Tube network data has no declared checksum');
  const response = await fetch(url, {signal, credentials: 'omit'});
  if (!response.ok) throw Error(`Tube network data: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== expected) throw Error('Tube network checksum mismatch');
  signal?.throwIfAborted();
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function createTubeService({scene, config, url, signal}) {
  const dir = config.dir.replace(/\/?$/, '/'), period = config.period ?? 'am_peak';
  const names = ['underground.json', `underground_trains_${period}.json`];
  const [network, schedule] = await Promise.all(names.map(name => verifiedJSON(url(dir + name), config.files?.[name]?.sha256, signal)));
  const lines = new Map(network.lines.map(line => [line.id, line]));
  const group = new THREE.Group(); group.name = 'London Tube · corridor network (scheduled, assumed depths)'; group.visible = false;
  // Drawn through the ground: the tunnels are below the city surface and the camera stays above it.
  const overlay = material => { material.depthTest = false; material.depthWrite = false; material.transparent = true; return material; };

  // Tunnels: one tube per line on each track, offset sideways per line where lines share a track; merged per line.
  const tubes = new Map(), ribbons = new Map();
  for (const track of network.tracks) {
    const served = track.lines?.length ? track.lines : ['unknown'];
    served.forEach((id, k) => {
      const kind = lines.get(id)?.kind ?? 'deep', r = RADIUS[kind] ?? 2, off = (k - (served.length - 1) / 2) * LINE_OFFSET_M;
      const shape = track.shape.map((p, j) => {
        if (!off) return p;
        const a = track.shape[Math.max(0, j - 1)], b = track.shape[Math.min(track.shape.length - 1, j + 1)], h = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        return [p[0] - ((b[1] - a[1]) / h) * off, p[1] + ((b[0] - a[0]) / h) * off, p[2]];
      });
      if (shape.length < 2) return;
      const points = shape.map(p => point(p[0], p[1], p[2] + r));
      let length = 0; for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal', 0), Math.max(2, Math.min(800, Math.round(length / 12))), r, kind === 'deep' ? 10 : 4, false);
      tube.deleteAttribute('uv');
      if (!tubes.has(id)) tubes.set(id, []);
      tubes.get(id).push(tube);
      // A flat ribbon stands in for the tube when the camera is too high for a 2 m tube to show.
      if (!ribbons.has(id)) ribbons.set(id, {position: [], index: []});
      const R = ribbons.get(id), base = R.position.length / 3;
      shape.forEach((p, q) => {
        const a = shape[Math.max(0, q - 1)], b = shape[Math.min(shape.length - 1, q + 1)], h = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ex = -(b[1] - a[1]) / h * RIBBON_HALF_M, ny = (b[0] - a[0]) / h * RIBBON_HALF_M;
        R.position.push(p[0] + ex, p[2], -(p[1] + ny), p[0] - ex, p[2], -(p[1] - ny));
        if (q) R.index.push(base + 2 * q - 2, base + 2 * q - 1, base + 2 * q, base + 2 * q - 1, base + 2 * q + 1, base + 2 * q);
      });
    });
  }
  for (const [id, parts] of tubes) {
    const colour = lines.get(id)?.colour ?? '#888888';
    const mesh = new THREE.Mesh(mergeGeometries(parts), overlay(new THREE.MeshStandardMaterial({color: colour, emissive: colour, emissiveIntensity: 0.35, opacity: 0.55})));
    mesh.name = `Tube tunnel · ${lines.get(id)?.name ?? 'line not identified'}`; mesh.renderOrder = 20; group.add(mesh);
    parts.forEach(part => part.dispose());
  }
  const far = new THREE.Group(); far.name = 'Tube tunnels · high-camera ribbons'; far.visible = false; group.add(far);
  for (const [id, R] of ribbons) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(R.position, 3)); geometry.setIndex(R.index);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: lines.get(id)?.colour ?? '#888888', transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false}));
    mesh.renderOrder = 19; far.add(mesh);
  }

  // Trains: one instanced mesh per line. Its size is the most trains the timetable rule ever draws on that line inside
  // the service period (an exact sweep of the trips' visibility intervals), never a count read off sampled seconds.
  const patterns = preparePatterns(schedule), trips = schedule.trips.filter(trip => patterns.has(trip.pattern));
  const start = schedule.period?.start_s ?? schedule.t0, end = schedule.period?.end_s ?? schedule.t1;
  const peak = peakTrains(patterns, trips, start, end);
  const car = new THREE.BoxGeometry(PITCH - 1, 2.9, 2.7).translate(0, 1.45, 0);
  const fleets = new Map();
  for (const [id, {trains}] of Object.entries(peak.lines)) {
    const colour = lines.get(id)?.colour ?? '#cccccc';
    const mesh = new THREE.InstancedMesh(car, overlay(new THREE.MeshStandardMaterial({color: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.6), emissive: colour, emissiveIntensity: 0.3, opacity: 0.98})), trains * CARS);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 22; mesh.name = `Tube trains · ${lines.get(id)?.name ?? id}`; group.add(mesh); fleets.set(id, mesh);
  }
  // From a high camera a 2.7 m wide car cannot be seen: there the cars are drawn wider and taller, as the tunnels are drawn
  // as ribbons. Positions and lengths stay those of the timetable rule.
  const matrix = new THREE.Matrix4(), turn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), near = new THREE.Vector3(1, 1, 1), wide = new THREE.Vector3(1, FAR_CAR_HEIGHT, FAR_CAR_WIDTH);
  const clock = createServiceClock({start, end, speed: 30});
  const state = {trains: 0, omitted: 0, drawnAt: null, drawnFar: null};
  function draw() {
    const fill = new Map([...fleets.keys()].map(id => [id, 0])); const list = trainsAt(patterns, trips, clock.time);
    state.trains = list.length; state.omitted = 0; const size = far.visible ? wide : near;
    for (const {line, cars} of list) {
      const mesh = fleets.get(line); let i = fill.get(line) ?? 0;
      if (!mesh || i + CARS > mesh.instanceMatrix.count) { state.omitted++; continue; }   // never write past the buffer
      for (const [east, north, z, heading] of cars) { turn.setFromAxisAngle(up, heading); matrix.compose(point(east, north, z), turn, size); mesh.setMatrixAt(i++, matrix); }
      fill.set(line, i);
    }
    for (const [id, mesh] of fleets) { mesh.count = fill.get(id); mesh.instanceMatrix.needsUpdate = true; }
    state.drawnAt = clock.time; state.drawnFar = far.visible;
  }

  draw();
  const resources = new Set();
  group.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.material) resources.add(o.material); });
  const dispose = () => { group.removeFromParent(); for (const r of resources) r.dispose(); };
  if (signal?.aborted) { dispose(); signal.throwIfAborted(); }
  scene.add(group);
  const date = String(network.provenance?.timetables?.service_date ?? schedule.time?.match(/\b(\d{8})\b/)?.[1] ?? '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  return {
    group, clock, peak, period, serviceDate: date,
    capacity: {trains: Object.fromEntries([...fleets].map(([id, mesh]) => [id, mesh.instanceMatrix.count / CARS])), carInstances: [...fleets.values()].reduce((n, mesh) => n + mesh.instanceMatrix.count, 0)},
    get trains() { return state.trains; }, get omitted() { return state.omitted; },
    get carInstances() { return [...fleets.values()].reduce((n, mesh) => n + mesh.count, 0); },
    get label() { return `Tube timetable ${clockText(clock.time)} · scheduled${date ? ' ' + date : ''}, not live`; },
    get timeText() { return clockText(clock.time); },
    scheduleNote: `Scheduled timetable${date ? ' of ' + date : ''}, not live`,
    // A fixed view over the whole corridor; the user may orbit from it.
    pose: {pos: new THREE.Vector3(-900, 6200, 6400), target: new THREE.Vector3(0, -20, 0)},
    /** Counts and one car pose at any service second, without moving the clock (for tests and receipts). */
    sample(time, tripId) {
      const list = trainsAt(patterns, trips, time), byLine = {};
      for (const train of list) byLine[train.line] = (byLine[train.line] ?? 0) + 1;
      return {count: list.length, countsByLine: byLine, firstCar: list.find(train => train.id === tripId)?.cars[0] ?? null};
    },
    seek(time) { clock.seek(time); draw(); },
    get farView() { return far.visible; },
    /** Advance the service clock while playing and keep the far ribbons in step with the camera. True when a redraw is needed. */
    tick(dt, camera) {
      const high = camera ? camera.position.y > RIBBON_ABOVE_M : far.visible; let changed = false;
      if (far.visible !== high) { far.visible = high; changed = true; }
      if (clock.tick(dt) || state.drawnAt !== clock.time || state.drawnFar !== far.visible) { draw(); changed = true; }
      return changed;
    },
    setVisible(on) { group.visible = on; },
    dispose,
  };
}
