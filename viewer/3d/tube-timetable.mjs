// Scheduled Tube train positions under the original Imperial Corridor timetable rule, and the service clock that drives them.
// Pure functions without three.js, shared by tube-network.js and visualizer/tests/test_tube_timetable.mjs.
// Paths are scene ENU metres [east, north, z]; times are seconds after midnight of the timetable's service day.
//
// The rule: a trip is drawn while domain_enter_s <= t <= domain_exit_s and within 30 s of its first and last call. Its head
// stands at the station during a call and moves linearly in distance between a departure and the next arrival (GTFS
// whole minutes: no added stop, no acceleration). Where the feed gives one minute for departure and next arrival, the
// train covers that run within a second; such jumps are part of the archived timetable and are kept. Six cars at 17 m
// pitch trail the head; positions are clamped to the path ends.
export const CARS = 6, PITCH = 17, EDGE_S = 30;

export function preparePatterns(schedule) {
  const patterns = new Map();
  for (const p of schedule.patterns) {
    const cum = [0];
    for (let i = 1; i < p.path.length; i++) {
      const a = p.path[i - 1], b = p.path[i];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
    }
    patterns.set(p.id, {...p, cum});
  }
  return patterns;
}
export function pointAt(P, d) {
  const {path, cum} = P; let lo = 0, hi = cum.length - 1;
  d = Math.max(0, Math.min(cum[hi], d));
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
  const u = (d - cum[lo]) / (cum[hi] - cum[lo] || 1), a = path[lo], b = path[hi];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])];
}
export function headDistance(P, times, t) {
  const D = times.length;
  if (t < times[0][1] - EDGE_S || t > times[D - 1][0] + EDGE_S) return null;
  for (let N = 0; N < D; N++) {
    const [arr, dep] = times[N];
    if (t <= dep) {
      if (t >= arr || N === 0) return P.station_offsets_m[N];
      const prev = times[N - 1][1], u = (t - prev) / (arr - prev || 1);
      return P.station_offsets_m[N - 1] + u * (P.station_offsets_m[N] - P.station_offsets_m[N - 1]);
    }
  }
  return P.station_offsets_m[D - 1];
}
/** Car poses at time t: [{id, line, cars: [[east, north, z, heading] x 6]}] in trip order. */
export function trainsAt(patterns, trips, t) {
  const out = [];
  for (const trip of trips) {
    if (trip.domain_enter_s != null && (t < trip.domain_enter_s || t > trip.domain_exit_s)) continue;
    const P = patterns.get(trip.pattern); if (!P) continue;
    const W = headDistance(P, trip.times, t); if (W == null) continue;
    const cars = [];
    for (let j = 0; j < CARS; j++) {
      const Y = W - (j + 0.5) * PITCH, c = pointAt(P, Y), b = pointAt(P, Y - PITCH / 2), f = pointAt(P, Y + PITCH / 2);
      cars.push([c[0], c[1], c[2], Math.atan2(f[1] - b[1], f[0] - b[0])]);
    }
    out.push({id: trip.id, line: P.line, cars});
  }
  return out;
}
/** The closed interval in which the rule draws a trip, cut to [start, end]; null when it is never drawn there. */
export function visibleInterval(trip, start, end) {
  const D = trip.times.length;
  const lo = Math.max(start, trip.times[0][1] - EDGE_S, trip.domain_enter_s ?? -Infinity);
  const hi = Math.min(end, trip.times[D - 1][0] + EDGE_S, trip.domain_exit_s ?? Infinity);
  return lo <= hi ? [lo, hi] : null;
}
/**
 * The most trains the rule draws at one moment in [start, end], for the network and per line. Exact: it sweeps the closed
 * visibility intervals with starts before ends at equal times, so it does not depend on which seconds are sampled.
 */
export function peakTrains(patterns, trips, start, end) {
  const events = [];
  for (const trip of trips) {
    const P = patterns.get(trip.pattern); if (!P) continue;
    const span = visibleInterval(trip, start, end); if (!span) continue;
    events.push([span[0], 1, P.line], [span[1], -1, P.line]);
  }
  events.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const now = new Map(), lines = {}; let all = 0; const network = {trains: 0, first_t_s: null};
  for (const [t, step, line] of events) {
    all += step; const n = (now.get(line) ?? 0) + step; now.set(line, n);
    if (all > network.trains) { network.trains = all; network.first_t_s = t; }
    if (n > (lines[line]?.trains ?? 0)) lines[line] = {trains: n, first_t_s: t};
  }
  return {network, lines};
}
/** Seconds after midnight as HH:MM:SS. */
export function clockText(seconds) {
  const s = Math.floor(seconds);
  return [s / 3600, (s / 60) % 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':');
}
/**
 * Service clock of the network view: bounded timetable time. It only advances through tick() while playing, stops at
 * the end, and Play after the end restarts from the first second.
 */
export function createServiceClock({start, end, speed = 30}) {
  if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) throw Error('Invalid service period');
  const clock = {
    start, end, time: start, playing: false, speed,
    seek(time) { clock.time = Math.max(start, Math.min(end, +time)); if (clock.time >= end) clock.playing = false; return clock.time; },
    tick(dt) { if (!clock.playing) return false; const before = clock.time; clock.seek(clock.time + Math.max(0, dt) * clock.speed); return clock.time !== before; },
    toggle() { if (!clock.playing && clock.time >= end) clock.time = start; clock.playing = !clock.playing; return clock.playing; },
  };
  return clock;
}
