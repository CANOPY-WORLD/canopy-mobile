// Versioned public presentation adapter. No resampling, terrain fitting or solver calls.
export function validateNativeTraffic(data) {
  if (data.schema !== 'experimental-offline-sumo-review-1' || data.coordinate_frame !== 'ENU' || data.position_reference !== 'front_bumper') throw Error('Unsupported native traffic recording');
  if (!Array.isArray(data.frames) || data.frames.length < 2) throw Error('Missing traffic frames');
  const ids = new Map();
  const frames = data.frames.map((frame, i) => {
    if (!Number.isFinite(frame.time) || i && Math.abs(frame.time - data.frames[i-1].time - .1) > 1e-6) throw Error('Missing 0.1 s traffic sample');
    const vehicles = new Map();
    for (const v of frame.vehicles) {
      if (v.length !== 8 || typeof v[0] !== 'string' || !data.vehicle_types[v[1]] || !v.slice(2).every(Number.isFinite) || vehicles.has(v[0])) throw Error('Invalid traffic vehicle');
      if (!ids.has(v[0])) ids.set(v[0], ids.size);
      vehicles.set(v[0], v);
    }
    return {time: frame.time, vehicles};
  });
  return {frames, ids};
}
export function nativeTrafficSamples(frames, position) {
  const k = Math.max(0, Math.min(frames.length-1, position)), index = Math.floor(k), alpha = k-index;
  const a = frames[index], b = frames[Math.min(index+1,frames.length-1)], result = [];
  for (const [id,v] of a.vehicles) {
    if (!alpha) {result.push(v);continue;}
    const w = b.vehicles.get(id);
    // Never extrapolate a vehicle into an interval where it is absent.
    if (!w || w[1] !== v[1]) continue;
    const p = v.slice();
    for (const i of [2,3,4,6,7]) p[i] += (w[i]-v[i])*alpha;
    p[5] += Math.atan2(Math.sin(w[5]-v[5]),Math.cos(w[5]-v[5]))*alpha;
    result.push(p);
  }
  return {time:a.time+(b.time-a.time)*alpha, vehicles:result};
}
