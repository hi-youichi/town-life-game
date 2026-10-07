import * as THREE from 'https://esm.sh/three@0.180.0';

export function configureRenderer(renderer, compact) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,compact?1.5:2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.02;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.VSMShadowMap;
}

export function createLighting(scene, compact) {
  const hemisphere=new THREE.HemisphereLight(0xfff2d8,0xa6a47b,1.5);
  scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xffe7c1,2.65);
  sun.position.set(-22,27,18); sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-29,right:29,top:29,bottom:-29,near:.5,far:100});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias=-.00012; sun.shadow.normalBias=.035;
  sun.shadow.radius=5;
  sun.shadow.blurSamples=8;
  scene.add(sun);
  return {hemisphere,sun};
}

export function updateLighting(scene, renderer, lights, materials, night) {
  const {sun,hemisphere}=lights;
  hemisphere.intensity=night?.85:1.5;
  sun.intensity=night?.45:2.65;
  sun.color.set(night?0xb5ccff:0xffe7c1);
  renderer.toneMappingExposure=night?1.1:1.02;
  scene.background=new THREE.Color(night?0x172737:0xe7eedc);
  if (!scene.fog) scene.fog=new THREE.Fog(scene.background,60,125);
  scene.fog.color.copy(scene.background);
  materials.wall.color.set(night?0x9096a0:0xf5e3c6);
  materials.roof.color.set(night?0xb1684b:0xc9784d);
  materials.ridge.color.set(night?0xb1684b:0xce8051);
  materials.grass.color.set(night?0x718647:0xadbd58);
  materials.glass.emissive.set(night?0xffc46b:0x000000);
  materials.glass.emissiveIntensity=night?.3:0;
}
