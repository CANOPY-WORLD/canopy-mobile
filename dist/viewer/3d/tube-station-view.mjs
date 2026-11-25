// Select an exported platform; deep frames are preferred at mixed stations, without moving source coordinates.
export function stationView(station, platforms, statics) {
  const deep = station.platforms.filter(i => platforms[i].template === 'deep');
  const frame = deep.includes(station.view.frame) ? station.view.frame : deep[0] ?? station.view.frame ?? station.platforms[0];
  const staticFrame = frame === undefined ? station.view.frame_static ?? station.statics[0] : undefined;
  const record = frame !== undefined ? platforms[frame] : statics[staticFrame];
  if (!record?.centre_enu?.every(Number.isFinite)) throw Error('Tube station has no usable source position');
  return {kind: record.template === 'deep' ? 'deep' : 'open', frame, staticFrame, centre:record.centre_enu,
    label:`${station.name} · platform`};
}
