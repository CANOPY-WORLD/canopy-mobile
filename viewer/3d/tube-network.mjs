// Slice authored ENU routes at their recorded platform offsets. No straight-line
// substitutes or new tunnel depths are generated when source routes are absent.
export function clipRoute(path, start, end) {
  if (!Array.isArray(path) || path.length < 2 || path.some(p=>p.length!==3||!p.every(Number.isFinite))) throw Error('Invalid Tube route');
  const cumulative=[0];
  for(let i=1;i<path.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(...path[i].map((v,k)=>v-path[i-1][k])));
  const length=cumulative.at(-1);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>length+.01)throw Error('Tube route offsets outside source path');
  end=Math.min(end,length);
  const at=s=>{
    let i=1;while(i<path.length-1&&cumulative[i]<s)i++;
    const t=(s-cumulative[i-1])/(cumulative[i]-cumulative[i-1]||1);
    return path[i-1].map((v,k)=>v+(path[i][k]-v)*t);
  };
  return [at(start),...path.filter((_,i)=>cumulative[i]>start&&cumulative[i]<end),at(end)];
}

export function selectTubeNetwork(data, config) {
  const wanted=new Set(config.stations.map(s=>s.id));
  const platforms=data.pilot.platforms.map((platform,index)=>({platform,index})).filter(({platform:p})=>wanted.has(p.station_id)&&p.line===config.line);
  const stations=config.stations.map(s=>{
    const matches=platforms.filter(({platform:p})=>p.station_id===s.id);
    if(!matches.length)throw Error(`Tube station unavailable: ${s.id}`);
    const primary=matches.find(({platform:p})=>p.direction==='eastbound')??matches[0];
    return {...s,primary:primary.platform.id,platforms:matches.map(({platform:p})=>p.id)};
  });
  const routes=[];
  for(const pattern of data.pilot.patterns){
    if(pattern.line!==config.line)continue;
    const stops=platforms.map(({platform:p})=>({platform:p,offset:p.s_c_by_pattern?.[pattern.id]})).filter(s=>Number.isFinite(s.offset)).sort((a,b)=>a.offset-b.offset);
    for(let i=1;i<stops.length;i++){
      const a=stops[i-1],b=stops[i];if(a.platform.station_id===b.platform.station_id)continue;
      routes.push({pattern:pattern.id,from:a.platform.station_id,to:b.platform.station_id,path:clipRoute(pattern.path,a.offset,b.offset)});
    }
  }
  for(const station of stations)if(!routes.some(r=>r.from===station.id||r.to===station.id))throw Error(`Tube connection unavailable: ${station.id}`);
  return {stations,platforms,routes};
}
