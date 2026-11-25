// Display interpolation only: recorded samples and identities stay authoritative.
const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const tangent=(a,b)=>a*b<=0?0:2*a*b/(a+b);
function smooth(a,b,t,previous,next){
  const delta=b-a;
  if(delta===0)return a;
  const m0=previous===undefined?delta:tangent(a-previous,delta);
  const m1=next===undefined?delta:tangent(delta,next-b);
  const t2=t*t,t3=t2*t;
  const value=a+(t3-2*t2+t)*m0+(-2*t3+3*t2)*delta+(t3-t2)*m1;
  return Math.max(Math.min(a,b),Math.min(Math.max(a,b),value));
}
export function interpolateVehicle(a,b,alpha,previous,next){
  if(!b||b.id!==a.id||alpha<=0)return a;
  const t=Math.max(0,Math.min(1,alpha));
  if(t===1)return b;
  previous=previous?.id===a.id?previous:undefined;
  next=next?.id===a.id?next:undefined;
  const out={...a};
  for(const key of ['x','north','height','pitch'])out[key]=smooth(a[key],b[key],t,previous?.[key],next?.[key]);
  // Unwrap around this interval, keeping the shortest recorded turn.
  const heading=a.heading+turn(a.heading,b.heading);
  out.heading=smooth(a.heading,heading,t,
    previous? a.heading-turn(previous.heading,a.heading):undefined,
    next? heading+turn(b.heading,next.heading):undefined);
  return out;
}
