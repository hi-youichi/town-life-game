// Browser integration checks for all three real character models; not shipped.
window.characterDesignQAReady=(async()=>{
  const THREE=await import('https://esm.sh/three@0.180.0');
  const {createCharacter,createCharacterRoster}=await import('/src/character.js');
  const {CHARACTER_STYLES}=await import('/src/character-styles.js');
  const results=[],textureSets=[];
  for(const style of CHARACTER_STYLES) {
    const c=createCharacter(style.id),textures=new Set();let nonfinite=0,normalErrors=0,invalidWeights=0;
    c.update(2);c.walker.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(c.walker);
    c.walker.traverse(o=>{
      if(!o.isMesh)return;
      for(const attr of Object.values(o.geometry.attributes))for(const v of attr.array)if(!Number.isFinite(v))nonfinite++;
      const n=o.geometry.attributes.normal;for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(length<.5||length>1.01)normalErrors++;}
      for(const key of ['map','bumpMap'])if(o.material[key])textures.add(o.material[key]);
      if(o.isSkinnedMesh){const a=o.geometry.attributes.skinWeight;for(let i=0;i<a.count;i++)if(Math.abs(a.getX(i)+a.getY(i)+a.getZ(i)+a.getW(i)-1)>1e-6)invalidWeights++;}
    });
    const pants=c.walker.getObjectByName('character-right-trousers');
    const rest=pants.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(pants.matrixWorld);
    c.walker.position.set(4,.04,7);c.walker.updateMatrixWorld(true);
    const moved=pants.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(pants.matrixWorld);
    const translationError=moved.distanceTo(rest.clone().add(c.walker.position));
    c.setGait(0,true);for(let i=0;i<30;i++)c.update(2+(i+1)/60);c.walker.updateMatrixWorld(true);
    const bendDisplacement=pants.getVertexPosition(0,new THREE.Vector3()).applyMatrix4(pants.matrixWorld).distanceTo(moved);
    const cargo=c.walker.getObjectByName('character-right-cargo-pocket');
    c.setGait(Math.PI/2,true);for(let i=0;i<30;i++)c.update(3+(i+1)/60);
    const hip=c.walker.getObjectByName('character-left-hip').rotation.x,arm=c.walker.getObjectByName('character-left-arm').rotation.x;
    c.setGait(0,false);for(let i=0;i<60;i++)c.update(4+(i+1)/60);
    const eyes=c.walker.getObjectByName('character-eyes');c.update(9.47);const closed=eyes.scale.y;c.update(9.6);const open=eyes.scale.y;
    let hood=false;c.walker.traverse(o=>{if(o.userData.parts?.includes('character-hood'))hood=true;});
    const result={variant:style.id,diagnostics:c.diagnostics(),nonfinite,normalErrors,invalidWeights,bounds:{min:box.min.toArray(),max:box.max.toArray()},translationError,bendDisplacement,
      oppositeSwing:hip*arm<0,stopped:c.diagnostics().stride,blink:{closed,open},hood,cargoAttachedToHip:!!cargo&&cargo.parent.name==='character-right-hip',textureCount:textures.size};
    if(nonfinite||normalErrors||invalidWeights||box.min.y<-.001||box.max.y>1.85||translationError>1e-5||bendDisplacement<.005||!result.oppositeSwing||result.stopped>.001||closed>.2||open!==1||result.diagnostics.skinnedMeshes!==2)throw Error('Invalid model: '+JSON.stringify(result));
    if(style.id==='adventure'&&(!hood||!result.cargoAttachedToHip))throw Error('Explorer hood or articulated cargo pockets missing');
    results.push(result);textureSets.push(textures);
  }
  const sharedTextures=textureSets.every(set=>set.size===textureSets[0].size&&[...set].every(t=>textureSets[0].has(t)));
  if(!sharedTextures)throw Error('Character variants duplicate texture resources');
  const roster=createCharacterRoster(),identity=roster.walker;identity.position.set(5,.04,8);identity.rotation.y=.8;identity.visible=false;
  roster.setGait(1,true);roster.update(2);const switches=[];
  for(const id of ['adventure','urban','cozy','adventure','urban']){roster.setStyle(id);roster.update(2.1);switches.push({...roster.diagnostics(),children:identity.children.length,position:identity.position.toArray(),visible:identity.visible,rotation:identity.rotation.y});}
  const stableWalker=roster.walker===identity&&switches.every(s=>s.children===1&&s.position[0]===5&&s.position[2]===8&&s.rotation===.8&&!s.visible&&s.moving);
  if(!stableWalker)throw Error('Switching changed world walker or motion state');
  window.characterDesignResults={models:results,sharedTextures,stableWalker,switches};
  return window.characterDesignResults;
})();
