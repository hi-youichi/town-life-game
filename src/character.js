import * as THREE from 'https://esm.sh/three@0.180.0';
import { createCharacter } from './character-refined.js';
import { characterStyle } from './character-styles.js';
export { createCharacter };

// Keep the world-space walker stable: routes, camera following and indoor visibility
// continue referring to the same group when the wardrobe changes.
export function createCharacterRoster(initialStyle='cozy') {
  const walker=new THREE.Group();walker.name='town-walker';
  const models=new Map();let active,phase=0,moving=false,lastTime=0;
  function setStyle(id) {
    const style=characterStyle(id);
    if(active?.diagnostics().variant===style.id)return false;
    const next=models.get(style.id)||createCharacter(style.id);
    models.set(style.id,next);
    if(active)walker.remove(active.walker);
    active=next;walker.add(active.walker);walker.userData.characterStyle=style.id;
    active.setGait(phase,moving);active.update(lastTime);
    return true;
  }
  setStyle(initialStyle);
  return {
    walker,setStyle,
    setGait(nextPhase,walking){phase=nextPhase;moving=walking;active.setGait(phase,moving);},
    update(time){lastTime=time;active.update(time);},
    diagnostics(){return {...active.diagnostics(),cachedVariants:models.size};},
  };
}
