// Local browser QA only. Load in the game tab with eval(await fetch(...).then(r=>r.text())).
// This file is not copied into dist or used by the game's normal startup.
window.characterQAReady = (async () => {
  const THREE = await import('https://esm.sh/three@0.180.0');
  const { createCharacter } = await import('/src/character.js');
  const { getSceneDiagnostics } = await import('/src/main.js');
  const qa = { errors: [], originalRAF: window.requestAnimationFrame, originalDelta: THREE.Clock.prototype.getDelta,
    now: performance.now(), diagnostics: getSceneDiagnostics };
  window.characterQA = qa;
  window.addEventListener('error', e => qa.errors.push(e.message));
  window.addEventListener('unhandledrejection', e => qa.errors.push(String(e.reason)));
  qa.originalError = console.error;
  console.error = (...args) => { qa.errors.push(args.map(String).join(' ')); qa.originalError.apply(console, args); };
  window.requestAnimationFrame = fn => { qa.frame = fn; return 0; };
  THREE.Clock.prototype.getDelta = () => .05;
  qa.step = count => {
    if (!qa.frame) throw new Error('RAF callback has not been captured yet');
    for (let i = 0; i < count; i++) { qa.now += 1000 / 60; qa.frame(qa.now); }
  };
  qa.camera = position => {
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { widgetState: { privateContent: { camera: position } } } } }));
    qa.step(1);
  };
  qa.clickWorld = (x, y, z) => {
    const d = getSceneDiagnostics(), canvas = document.querySelector('canvas'), b = canvas.getBoundingClientRect();
    const camera = new THREE.PerspectiveCamera(50, b.width / b.height, .1, 140);
    camera.position.fromArray(d.camera); camera.lookAt(new THREE.Vector3().fromArray(d.target)); camera.updateMatrixWorld();
    const p = new THREE.Vector3(x, y, z).project(camera);
    const clientX = b.left + (p.x + 1) * b.width / 2, clientY = b.top + (1 - p.y) * b.height / 2;
    for (const type of ['pointerdown', 'pointerup']) canvas.dispatchEvent(new PointerEvent(type, { clientX, clientY, pointerId: 1, bubbles: true }));
    return [clientX, clientY];
  };
  qa.restore = () => {
    THREE.Clock.prototype.getDelta = qa.originalDelta; window.requestAnimationFrame = qa.originalRAF; console.error = qa.originalError;
    if (qa.frame) qa.originalRAF.call(window,qa.frame);
  };
  const character = createCharacter(); character.update(2);
  let nonfinite = 0, normalErrors = 0;
  character.walker.traverse(o => {
    if (!o.isMesh) return;
    for (const a of Object.values(o.geometry.attributes)) for (const v of a.array) if (!Number.isFinite(v)) nonfinite++;
    const n = o.geometry.attributes.normal;
    for (let i = 0; i < n.count; i++) {
      const length = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); if (length < .5 || length > 1.01) normalErrors++;
    }
  });
  const bounds = new THREE.Box3().setFromObject(character.walker);
  const skins=[];character.walker.traverse(o=>{if(o.isSkinnedMesh)skins.push(o);});
  let invalidWeights=0,bendDisplacement=0,translationError=0;
  for(const skin of skins){
    const weights=skin.geometry.attributes.skinWeight,indices=skin.geometry.attributes.skinIndex;
    for(let i=0;i<weights.count;i++){
      const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);
      if(Math.abs(sum-1)>1e-6||weights.getX(i)<0||weights.getY(i)<0||indices.getX(i)>1||indices.getY(i)>1)invalidWeights++;
    }
  }
  if(skins.length){
    character.walker.updateMatrixWorld(true);
    const right=character.walker.getObjectByName('character-right-trousers'),vertex=0;
    const rest=right.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(right.matrixWorld);
    character.walker.position.set(3,.04,7);character.walker.updateMatrixWorld(true);
    const translated=right.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(right.matrixWorld);
    translationError=translated.distanceTo(rest.clone().add(character.walker.position));
    character.setGait(0,true);for(let i=0;i<30;i++)character.update(2+(i+1)/60);
    character.walker.updateMatrixWorld(true);
    const bent=right.getVertexPosition(vertex,new THREE.Vector3()).applyMatrix4(right.matrixWorld);bendDisplacement=bent.distanceTo(translated);
    character.walker.position.set(0,0,0);
  }
  character.setGait(Math.PI / 2, true); for (let i = 0; i < 30; i++) character.update(2 + (i + 1) / 60);
  const hip = character.walker.getObjectByName('character-left-hip').rotation.x;
  const arm = character.walker.getObjectByName('character-left-arm').rotation.x;
  const knee = character.walker.getObjectByName('character-right-knee');
  character.setGait(0, true); character.update(2.7); const kneeFlex = knee.rotation.x;
  character.setGait(0, false); for (let i = 0; i < 60; i++) character.update(3 + (i + 1) / 60);
  const stopped = character.diagnostics().stride;
  const eyes = character.walker.getObjectByName('character-eyes'); character.update(4.77); const closed = eyes.scale.y; character.update(5); const open = eyes.scale.y;
  const second = createCharacter();
  const texturesA = new Set(), texturesB = new Set();
  for (const [c, set] of [[character, texturesA], [second, texturesB]]) c.walker.traverse(o => { if (o.isMesh) { if (o.material.bumpMap) set.add(o.material.bumpMap); if (o.material.map) set.add(o.material.map); } });
  qa.geometry = { nonfinite, normalErrors, skinning:{meshes:skins.length,invalidWeights,bendDisplacement,translationError},bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    gait: { hip, arm, opposite: hip * arm < 0, kneeFlex, stopped }, blink: { closed, open },
    sharedTextures: texturesA.size === texturesB.size && [...texturesA].every(t => texturesB.has(t)), textureCount: texturesA.size,
    character: character.diagnostics() };
  if (nonfinite || normalErrors || invalidWeights || translationError>1e-5 || (skins.length&&bendDisplacement<.005) || bounds.min.y < -.001 || bounds.max.y > 1.6 || hip * arm >= 0 || kneeFlex <= .1 || stopped > .001 || closed > .2 || open !== 1 || !qa.geometry.sharedTextures)
    throw new Error('Character geometry or animation checks failed');
  return qa.geometry;
})();
