import * as THREE from 'https://esm.sh/three@0.180.0';
import { Reflector } from 'https://esm.sh/three@0.180.0/examples/jsm/objects/Reflector.js';
import { createRefreshGate } from './performance-policy.js';

// 湖面只在主画面阶段更新倒影；AO 法线阶段不能覆盖颜色贴图。
export function createWater(geometry, compact) {
  const resolution=compact?384:512;
  const shader={
    name:'TownWater',
    uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
      time:{value:0},night:{value:0},texel:{value:new THREE.Vector2(1/resolution,1/resolution)}},
    vertexShader:`
      uniform mat4 textureMatrix;
      varying vec4 reflectionUv;
      varying vec3 worldPosition;
      void main() {
        reflectionUv=textureMatrix*vec4(position,1.0);
        worldPosition=(modelMatrix*vec4(position,1.0)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float time;
      uniform float night;
      uniform vec2 texel;
      varying vec4 reflectionUv;
      varying vec3 worldPosition;
      void main() {
        vec2 p=worldPosition.xz;
        vec2 wave=vec2(sin(p.y*2.6+time*.7)+sin(p.x*1.7-time*.4),
          cos(p.x*2.3+time*.5)+sin(p.y*1.4+time*.3));
        vec2 uv=reflectionUv.xy/reflectionUv.w+wave*.0035;
        vec3 reflection=texture2D(tDiffuse,uv).rgb*.4;
        reflection+=texture2D(tDiffuse,uv+texel*vec2(1.5,0.0)).rgb*.15;
        reflection+=texture2D(tDiffuse,uv-texel*vec2(1.5,0.0)).rgb*.15;
        reflection+=texture2D(tDiffuse,uv+texel*vec2(0.0,1.5)).rgb*.15;
        reflection+=texture2D(tDiffuse,uv-texel*vec2(0.0,1.5)).rgb*.15;
        float facing=abs(normalize(cameraPosition-worldPosition).y);
        float fresnel=pow(1.0-facing,2.0);
        float depth=clamp(1.0-length((p-vec2(8.0,-23.0))/vec2(7.3,5.0)),0.0,1.0);
        vec3 shallow=mix(color*1.28,color*.87,smoothstep(0.0,.7,depth));
        vec3 water=mix(shallow,reflection*mix(.4,.7,night),.34+fresnel*.32);
        float glint=pow(max(0.0,sin(p.x*5.0+sin(p.y*3.0+time*.4)+time*.6)),24.0);
        water+=vec3(.025,.038,.038)*glint*(1.0-night*.75);
        gl_FragColor=vec4(water,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const mesh=new Reflector(geometry,{textureWidth:resolution,textureHeight:resolution,
    multisample:0,clipBias:.002,color:0x348da6,shader});
  const reflect=mesh.onBeforeRender;
  const previousPosition=new THREE.Vector3();
  const previousRotation=new THREE.Quaternion();
  const position=new THREE.Vector3(),rotation=new THREE.Quaternion();
  const refreshHz=compact?12:18;
  const refreshGate=createRefreshGate(1000/refreshHz);
  const size=new THREE.Vector2();
  let updates=0,sizeKey='';
  mesh.onBeforeRender=function(renderer,scene,camera) {
    if(scene.overrideMaterial) return;
    renderer.getSize(size);
    const key=`${size.x}:${size.y}:${renderer.getPixelRatio()}`;
    const now=performance.now();
    camera.getWorldPosition(position);camera.getWorldQuaternion(rotation);
    const jump=updates>0&&(position.distanceToSquared(previousPosition)>64
      ||rotation.angleTo(previousRotation)>Math.PI/3);
    if(!refreshGate.take(now,mesh.forceUpdate||key!==sizeKey||jump)) return;
    reflect.call(mesh,renderer,scene,camera);
    previousPosition.copy(position);previousRotation.copy(rotation);sizeKey=key;updates++;
  };
  return {mesh,
    update(time) { mesh.material.uniforms.time.value=time; },
    forceRefresh(){mesh.forceUpdate=true;},
    setNight(night) {
      mesh.material.uniforms.color.value.set(night?0x345f72:0x348da6);
      mesh.material.uniforms.night.value=night?1:0;
      mesh.forceUpdate=true;
    },
    diagnostics() {return {resolution,updates,refreshHz};}
  };
}
