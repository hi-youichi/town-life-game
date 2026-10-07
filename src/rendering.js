import * as THREE from 'https://esm.sh/three@0.180.0';
import { EffectComposer } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'https://esm.sh/three@0.180.0/examples/jsm/postprocessing/OutputPass.js';
import { createRefreshGate,createQualityController } from './performance-policy.js';

export function createRendering(renderer,scene,camera,compact) {
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:compact?2:4});
  const composer=new EffectComposer(renderer,target);
  composer.addPass(new RenderPass(scene,camera));
  const ao=new SSAOPass(scene,camera,1,1,compact?16:24);
  ao.kernelRadius=1.1;
  ao.minDistance=.0006;
  ao.maxDistance=.025;
  const resizeAO=ao.setSize.bind(ao);
  let resolution=compact?.6:.8;
  ao.setSize=(width,height)=>resizeAO(Math.max(1,Math.round(width*resolution)),Math.max(1,Math.round(height*resolution)));
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  renderer.info.autoReset=false;
  renderer.shadowMap.autoUpdate=false;
  const size=new THREE.Vector2();
  const quality=createQualityController(compact);
  const shadowGate=createRefreshGate(1000/30);
  const basePixelRatio=renderer.getPixelRatio();
  let width=0,height=0,ratio=0,shadowDirty=true;
  let renders=0,shadowUpdates=0,lastSubmitMs=0,captureRenders=0;
  document.addEventListener('visibilitychange',()=>quality.resetSamples());
  return {
    get renderCount(){return renders;},
    observeFrame(frameMs,now) {
      if(quality.observe(frameMs,!document.hidden,now)) {
        renderer.setPixelRatio(basePixelRatio*quality.settings.renderScale);
      }
    },
    resetSamples(){quality.resetSamples();},
    invalidateShadows(){shadowDirty=true;},
    diagnostics(){return {renders,shadowUpdates,lastSubmitMs,captureRenders,activeAOScale:resolution,shadowHz:30,quality:quality.diagnostics(),pixelRatio:renderer.getPixelRatio()};},
    render({capture=false}={}) {
      const started=performance.now();
      const desiredResolution=capture?(compact?.6:.8):quality.settings.aoScale;
      const aoChanged=resolution!==desiredResolution;
      resolution=desiredResolution;
      renderer.getSize(size);
      const pixelRatio=renderer.getPixelRatio();
      if(width!==size.x||height!==size.y||ratio!==pixelRatio) {
        const resized=width!==size.x||height!==size.y;
        width=size.x;height=size.y;
        if(ratio!==pixelRatio){ratio=pixelRatio;composer.setPixelRatio(ratio);}
        if(resized)composer.setSize(width,height);
      } else if(aoChanged) {
        ao.setSize(width*ratio,height*ratio);
      }
      renderer.info.reset();
      // 连续动画最多 30 Hz 更新；开门、屋顶显隐、昼夜和截图立即更新。
      const updateShadow=shadowGate.take(started,shadowDirty||capture);
      renderer.shadowMap.needsUpdate=updateShadow;
      if(updateShadow){shadowUpdates++;shadowDirty=false;}
      composer.render();
      renders++;if(capture)captureRenders++;
      lastSubmitMs=performance.now()-started;
    }
  };
}
