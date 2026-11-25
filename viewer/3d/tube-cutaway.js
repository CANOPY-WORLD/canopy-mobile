import * as THREE from 'three';

// A presentation cutaway through the city around the selected representative platform.
// Source geometry and elevations stay untouched; previous material clipping is restored on exit.
export function createTubeCutaway(scene) {
  let active = null;
  const saved = new Map();
  const restore = () => {
    for (const [material, old] of saved) {
      material.clippingPlanes = old.planes; material.clipIntersection = old.intersection; material.needsUpdate = true;
    }
    saved.clear(); active = null;
  };
  return {
    set(platform) {
      if (platform === active) return;
      restore();
      if (!platform) return;
      active = platform; platform.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(platform).expandByScalar(2);
      const planes = [new THREE.Plane(new THREE.Vector3(1,0,0),-box.max.x), new THREE.Plane(new THREE.Vector3(-1,0,0),box.min.x),
        new THREE.Plane(new THREE.Vector3(0,0,1),-box.max.z), new THREE.Plane(new THREE.Vector3(0,0,-1),box.min.z),
        new THREE.Plane(new THREE.Vector3(0,-1,0),box.min.y)];
      for (const root of scene.children) if (root !== platform) root.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!material || saved.has(material)) continue;
          saved.set(material, {planes: material.clippingPlanes, intersection: material.clipIntersection});
          material.clippingPlanes = planes; material.clipIntersection = true; material.needsUpdate = true;
        }
      });
    },
    get active() { return Boolean(active); },
    dispose: restore,
  };
}
