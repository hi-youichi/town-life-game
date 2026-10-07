// Browser-only checks for the v13 trouser seam and concept-led proportions.
window.characterProportionQAReady=(async()=>{
 const THREE=await import('https://esm.sh/three@0.180.0');
 const {createCharacter}=await import('/src/character.js');
 const {CHARACTER_STYLES}=await import('/src/character-styles.js');
 const results=[];
 for(const style of CHARACTER_STYLES){
  const c=createCharacter(style.id);c.update(2);c.walker.updateMatrixWorld(true);
  const head=c.walker.getObjectByName('character-head'),body=c.walker.getObjectByName('character-upper-body');
  const headScale=head.getWorldScale(new THREE.Vector3()),bodyScale=body.getWorldScale(new THREE.Vector3());
  const seams=[];
  for(const side of ['left','right']){
   const pants=c.walker.getObjectByName(`character-${side}-trousers`),knee=c.walker.getObjectByName(`character-${side}-knee`);
   const start=pants.userData.seamVertexStart,count=pants.userData.seamVertexCount;
   if(!Number.isInteger(start)||count<100)throw Error('Trouser seam metadata missing');
   const before=pants.getVertexPosition(start,new THREE.Vector3()).applyMatrix4(pants.matrixWorld);
   knee.rotation.x=.35;c.walker.updateMatrixWorld(true);
   const after=pants.getVertexPosition(start,new THREE.Vector3()).applyMatrix4(pants.matrixWorld);
   const bend=before.distanceTo(after);
   if(bend<.01)throw Error('Trouser seam did not bend with the knee');
   knee.rotation.x=0;c.walker.updateMatrixWorld(true);
   const weights=pants.geometry.attributes.skinWeight;
   for(let i=start;i<start+count;i++)if(Math.abs(weights.getX(i)+weights.getY(i)-1)>1e-6)throw Error('Seam weights invalid');
   seams.push({side,vertices:count,bend});
  }
  if(Math.abs(headScale.x-style.headScale)>1e-6||Math.abs(bodyScale.y-style.torsoScale)>1e-6)throw Error('Proportions did not reach world geometry');
  results.push({variant:style.id,headScale:headScale.x,torsoScale:bodyScale.y,legScale:style.legScale,seams});
 }
 window.characterProportionResults=results;return results;
})();
