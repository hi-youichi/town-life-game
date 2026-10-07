import * as THREE from 'https://esm.sh/three@0.180.0';
import { characterStyle } from './character-styles-v12.js';

let sharedTextures;
const sharedMaterials = new Map();
function hairTexture() {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(512,128);
  for(let y=0;y<128;y++)for(let x=0;x<512;x++){
    const value=128+Math.sin(y*Math.PI/2+Math.sin(x*Math.PI/64)*2)*23+Math.sin(y*Math.PI/8)*6;
    const i=(y*512+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}
// Small, deterministic, seamless textures shared by every instance and joint.
function weaveTexture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const warp = Math.sin(x * Math.PI / 2), weft = Math.sin(y * Math.PI / 2);
    const thread = kind === 'denim' ? Math.sin((x + y) * Math.PI / 3.2)
      : kind === 'knit' ? Math.sin(x * Math.PI / 4 + Math.sin(y * Math.PI / 8)) : warp * weft;
    const value = Math.round(226 + thread * 15 + (warp + weft) * 4);
    const i = (y * 256 + x) * 4;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'knit' ? 3 : 5, kind === 'knit' ? 2 : 4);
  texture.anisotropy = 4;
  const colorCanvas = document.createElement('canvas');colorCanvas.width=colorCanvas.height=256;
  const colorContext=colorCanvas.getContext('2d'),colorPixels=colorContext.createImageData(256,256);
  for(let i=0;i<pixels.data.length;i+=4){
    const value=246+(pixels.data[i]-226)*.3;
    colorPixels.data[i]=colorPixels.data[i+1]=colorPixels.data[i+2]=value;colorPixels.data[i+3]=255;
  }
  colorContext.putImageData(colorPixels,0,0);
  const color=new THREE.CanvasTexture(colorCanvas);color.colorSpace=THREE.SRGBColorSpace;
  color.wrapS=color.wrapT=THREE.RepeatWrapping;color.repeat.copy(texture.repeat);color.anisotropy=4;
  return {bump:texture,color};
}

export function createCharacterMaterials(styleId='cozy') {
  const style=characterStyle(styleId),colors=style.palette;
  if (sharedMaterials.has(style.id)) return sharedMaterials.get(style.id);
  sharedTextures ||= { cloth:weaveTexture('cloth'),denim:weaveTexture('denim'),knit:weaveTexture('knit'),hair:hairTexture() };
  const {cloth,denim,knit}=sharedTextures;
  function fabric(color, texture, bumpScale = .0012) {
    return new THREE.MeshStandardMaterial({ color, roughness: .86, map:texture.color, bumpMap: texture.bump, bumpScale });
  }
  const skin = new THREE.MeshStandardMaterial({ color: 0xf7c79f, roughness: .68 });
  const face = skin.clone(); face.vertexColors = true;
  const materials = {
    skin, face,
    ear: new THREE.MeshStandardMaterial({ color: 0xdc9a80, roughness: .76 }),
    hair: new THREE.MeshStandardMaterial({ color: colors.hair, roughness: .67, bumpMap:sharedTextures.hair,bumpScale:.001 }),
    coat: fabric(colors.coat, cloth), trim: fabric(colors.trim, cloth),
    cream: fabric(colors.cream, knit, .0015), strap: fabric(colors.strap, cloth),
    pants: fabric(colors.pants, denim), pack: fabric(colors.pack, cloth),
    accent: fabric(colors.accent, cloth), tee: fabric(colors.tee, knit),
    shoes: new THREE.MeshStandardMaterial({ color: colors.shoes, roughness: .77 }),
    sole: new THREE.MeshStandardMaterial({ color: 0xe9e1c9, roughness: .84 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa88c68, metalness: .4, roughness: .58 }),
    buckle: new THREE.MeshStandardMaterial({ color: 0x354647, roughness: .65 }),
    eyes: new THREE.MeshStandardMaterial({ color: 0x251b17, roughness: .24 }),
    shine: new THREE.MeshBasicMaterial({ color: 0xfff8e7 }),
  };
  sharedMaterials.set(style.id,materials);
  return materials;
}
