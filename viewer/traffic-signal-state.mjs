// Hold actual recorded switch states; never derive phases from static schedules.
export function signalStateAt(signals,tls,time){
 const interval=signals.recorded_interval;
 if(!interval||!Number.isFinite(time)||time<interval[0]||time>=interval[1])return null;
 const events=signals.timeline[tls];if(!events?.length||time<events[0].time)return null;
 let lo=0,hi=events.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(events[mid].time<=time)lo=mid;else hi=mid}
 return events[lo].state;
}
export function signalLamps(state){
 return {red:state==='r'||state==='R'||state==='u',amber:state==='y'||state==='Y'||state==='u',green:state==='g'||state==='G'||state==='s'};
}
