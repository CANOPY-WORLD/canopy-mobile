// Camera presentation time only; this does not alter recorded simulation data.
export function sampleJourney(frames,time){
  const t=Math.max(0,Math.min(frames.at(-1).time,time));
  let i=1;while(i<frames.length-1&&frames[i].time<t)i++;
  const a=frames[i-1],b=frames[i],u=(t-a.time)/(b.time-a.time),s=u*u*(3-2*u);
  return {position:a.position.map((v,k)=>v+(b.position[k]-v)*s),target:a.target.map((v,k)=>v+(b.target[k]-v)*s)};
}
export function createCameraJourney(keyframes, {safeApproach=false}={}){
  if(!keyframes?.length||keyframes.some((f,i)=>!Number.isFinite(f.time)||f.time<=0||(i&&f.time<=keyframes[i-1].time)||['position','target'].some(k=>f[k]?.length!==3||!f[k].every(Number.isFinite))))throw Error('Invalid camera journey');
  let frames=null, approach=null;
  const j={time:0,duration:keyframes.at(-1).time,playing:false,speed:1,
    start(position,target,reduced=false){frames=[{time:0,position:[...position],target:[...target]},...keyframes];approach=null;
      if(safeApproach && Math.hypot(position[0]-keyframes[0].position[0],position[2]-keyframes[0].position[2])>150){
        const extra=Math.max(0,3.2-keyframes[0].time);
        frames=frames.map((f,i)=>i?{...f,time:f.time+extra}:f);
        approach={height:Math.max(180,position[1],frames[1].position[1]),end:frames[1].time};
      }
      j.duration=frames.at(-1).time;j.time=reduced?j.duration:0;j.playing=!reduced;return j.pose;},
    get pose(){
      if(!frames)return null;
      const pose=sampleJourney(frames,j.time);
      if(approach && j.time<approach.end){
        const u=j.time/approach.end, s=u*u*(3-2*u), a=frames[0].position,b=frames[1].position;
        pose.position[1]=(1-s)**3*a[1]+3*(1-s)*s*approach.height+s**3*b[1];
      }
      return pose;
    },
    seek(time){j.time=Math.max(0,Math.min(j.duration,time));if(j.time===j.duration)j.playing=false;return j.pose;},
    tick(dt){if(j.playing)j.seek(j.time+Math.max(0,dt)*j.speed);return j.pose;},
    toggle(){if(j.time>=j.duration)j.time=0;j.playing=!j.playing;}
  };return j;
}
