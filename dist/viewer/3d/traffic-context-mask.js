import * as THREE from 'three';

// Replace overlapping road furniture only. Shared city geometry is untouched.
// World-space clipping also works for instanced mapped signal fixtures.
export function createTrafficContextMask({center,radius}) {
  const active={value:0},region={value:new THREE.Vector3(center[0],-center[1],radius)};
  const patched=new WeakMap();
  return {
    setActive(value){active.value=value?1:0;},
    add(root,side){
      root.traverse(object=>{
        if(!object.isMesh&&!object.isLine)return;
        const apply=source=>{
          let variants=patched.get(source);
          if(!variants){variants=new Map();patched.set(source,variants);}
          if(variants.has(side))return variants.get(side);
          const material=source,compile=source.onBeforeCompile,key=source.customProgramCacheKey.bind(source);
          material.onBeforeCompile=(shader,renderer)=>{
            compile.call(source,shader,renderer);
            shader.uniforms.trafficContextActive=active;shader.uniforms.trafficContextRegion=region;
            shader.vertexShader='varying vec2 trafficContextXZ;\n'+shader.vertexShader.replace('#include <project_vertex>',`
              vec4 trafficPoint=vec4(transformed,1.0);
              #ifdef USE_INSTANCING
                trafficPoint=instanceMatrix*trafficPoint;
              #endif
              trafficContextXZ=(modelMatrix*trafficPoint).xz;
              #include <project_vertex>`);
            shader.fragmentShader='varying vec2 trafficContextXZ;\nuniform float trafficContextActive;\nuniform vec3 trafficContextRegion;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`
              #include <clipping_planes_fragment>
              if(trafficContextActive>0.5 && distance(trafficContextXZ,trafficContextRegion.xy) ${side==='outside'?'<':'>='} trafficContextRegion.z) discard;`);
          };
          material.customProgramCacheKey=()=>key()+'|traffic-context-'+side;
          material.needsUpdate=true;variants.set(side,material);return material;
        };
        object.material=Array.isArray(object.material)?object.material.map(apply):apply(object.material);
      });
    }
  };
}
