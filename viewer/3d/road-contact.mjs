// Display-only draping/contact; source lane elevations remain unchanged.
export const ROAD_SURFACE_OFFSET=.025;
export function resampleRoadLine(points,spacing=5){
 if(!points.length)return [];
 if(!(spacing>0))throw new RangeError("Road sample spacing must be positive");
 const out=[points[0]];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));for(let j=1;j<=steps;j++)out.push(a.map((v,k)=>v+(b[k]-v)*j/steps))}
 return out;
}

export function roadContactPolicy(network) {
 const excludedEdges=new Set(),excludedJunctions=new Set();
 network.edges.forEach((edge,i)=>{
  if(Number(edge.level)>0 || (edge.structure||[]).some(tag=>['bridge','tunnel','covered'].includes(tag))){
   excludedEdges.add(i);excludedJunctions.add(edge.from);excludedJunctions.add(edge.to);
  }
 });
 return {
  junction:junction=>!excludedJunctions.has(junction.id),
  lane:lane=>lane.edge!=null ? !excludedEdges.has(lane.edge) :
   !!network.junctions[lane.junction]&&!excludedJunctions.has(network.junctions[lane.junction].id)
 };
}

export function contactTriangles(a,b,sample,displayOffset) {
 // The shader adds displayOffset to every vertex, including the seam foot.
 const foot=p=>[p[0],p[1],sample(p[0],p[1])-displayOffset];
 const af=foot(a),bf=foot(b);
 if(Math.max(Math.abs(af[2]-a[2]),Math.abs(bf[2]-b[2]))<.01)return [];
 // Split at a cut/fill transition to avoid a self-intersecting quad.
 const da=af[2]-a[2],db=bf[2]-b[2];
 if(da*db<0){
  const t=da/(da-db),mid=a.map((v,i)=>v+(b[i]-v)*t);
  return [a,mid,af,mid,b,bf];
 }
 return [a,b,bf,a,bf,af];
}
