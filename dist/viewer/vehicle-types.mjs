// Fallback illustrative dimensions; explicit run metadata takes precedence.
export const VEHICLE_TYPES={
 car:{length:4.5,width:1.8,height:1.5},taxi:{length:4.8,width:1.9,height:1.9},
 bus:{length:10.5,width:2.55,height:4.4},lgv:{length:5.5,width:2,height:2.5},
 hgv:{length:10.5,width:2.55,height:3.6},motorcycle:{length:2.2,width:.8,height:1.4}
};
export function vehicleDimensions(kind,types={}){
 const d=types[kind]??VEHICLE_TYPES[kind];
 if(!d||!['length','width','height'].every(k=>Number.isFinite(d[k])&&d[k]>0))throw Error(`Invalid vehicle dimensions: ${kind}`);
 return d;
}
export function vehicleCenter(x,north,heading,length,reference='center',pitch=0){
 if(reference==='center')return [x,north];
 if(reference!=='front_bumper')throw Error(`Unsupported vehicle position reference: ${reference}`);
 return [x-Math.cos(heading)*Math.cos(pitch)*length/2,north-Math.sin(heading)*Math.cos(pitch)*length/2];
}
