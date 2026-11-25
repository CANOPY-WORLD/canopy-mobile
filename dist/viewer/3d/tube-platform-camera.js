import * as THREE from 'three';

// Stand on an exported platform surface, not a guessed track offset. All station types use the same eye height.
export function platformCamera(frame) {
  frame.updateMatrixWorld(true);
  const floors = [];
  frame.traverse(object => { if (object.isMesh && (/station\.?platform\.?floor/.test(object.name) || /^shell.*platform(?:_\d+)?$/.test(object.name))) floors.push(object); });
  if (!floors.length) throw Error('Source station has no identified platform surface');
  const inverse = frame.matrixWorld.clone().invert(), bounds = new THREE.Box3(), relative = new THREE.Matrix4();
  for (const mesh of floors) {
    mesh.geometry.computeBoundingBox(); relative.multiplyMatrices(inverse, mesh.matrixWorld);
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(relative));
  }
  const centre = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3()), ray = new THREE.Raycaster();
  for (const x of [.28, .18, -.28, -.18, 0]) for (const z of [0, -.12, .12]) {
    const local = new THREE.Vector3(centre.x + size.x * x, bounds.max.y + 5, centre.z + size.z * z);
    const above = frame.localToWorld(local.clone()); ray.set(above, new THREE.Vector3(0,-1,0));
    const floor = ray.intersectObjects(floors, false)[0]; if (!floor) continue;
    const foot = frame.worldToLocal(floor.point.clone());
    if (foot.x < bounds.min.x + .8 || foot.x > bounds.max.x - .8 || foot.z < bounds.min.z + .4 || foot.z > bounds.max.z - .4) continue;
    const position = floor.point.clone().add(new THREE.Vector3(0,1.6,0));
    const forward = new THREE.Vector3(-1,0,0).transformDirection(frame.matrixWorld);
    ray.set(position, forward); const obstruction = ray.intersectObject(frame,true)[0];
    if (obstruction && obstruction.distance < 15) continue;
    let clear = true;
    for (const direction of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0)]) {
      ray.set(position,direction.transformDirection(frame.matrixWorld));
      if (ray.intersectObject(frame,true)[0]?.distance < .3) { clear=false; break; }
    }
    if (!clear) continue;
    return {position:position.toArray(), target:position.clone().addScaledVector(forward,25).toArray(),
      audit:{eyeHeight:1.6,foot:floor.point.toArray(),localFoot:foot.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},floor:floor.object.name,forwardClearance:obstruction?.distance??null}};
  }
  throw Error('No clear standing camera found on the source platform');
}
