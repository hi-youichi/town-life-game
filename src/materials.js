import * as THREE from 'https://esm.sh/three@0.180.0';

// 程序化瓦缝：一张小纹理被全部屋面共享，不创建逐片瓦模型。
export function createMaterials() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 16; row++) {
    const y = row * 32;
    for (let tile=0;tile<17;tile++) {
      const x=tile*32-(row%2)*16;
      const shade=245+((row*13+tile*7)%10);
      const glaze=ctx.createLinearGradient(x,y,x+32,y+32);
      glaze.addColorStop(0,`rgb(${shade},${shade-1},${shade-3})`);
      glaze.addColorStop(.75,`rgb(${shade-4},${shade-6},${shade-8})`);
      glaze.addColorStop(1,'#ddd0c5');
      ctx.fillStyle=glaze;ctx.fillRect(x,y,32,32);
      ctx.strokeStyle='#c5aa95';ctx.lineWidth=.75;
      ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y+31);ctx.stroke();
    }
    ctx.strokeStyle='#baa18e';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,y+31);ctx.lineTo(512,y+31);ctx.stroke();
    ctx.strokeStyle='#fff7ec';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(0,y+1);ctx.lineTo(512,y+1);ctx.stroke();
  }
  const tiles = new THREE.CanvasTexture(canvas);
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.anisotropy = 4;
  function paintedTexture(paint,size=256) {
    const surface=document.createElement('canvas'); surface.width=surface.height=size;
    paint(surface.getContext('2d'),size);
    const texture=new THREE.CanvasTexture(surface); texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4; return texture;
  }
  const plaster=paintedTexture((context,size)=>{
    const shade=context.createLinearGradient(0,0,0,size);
    shade.addColorStop(0,'#e5d7c8'); shade.addColorStop(.1,'#ffffff');
    shade.addColorStop(.78,'#ffffff'); shade.addColorStop(1,'#c9bcaa');
    context.fillStyle=shade; context.fillRect(0,0,size,size);
  });
  const glass=paintedTexture((context,size)=>{
    const shade=context.createLinearGradient(0,0,size,size);
    shade.addColorStop(0,'#78969c'); shade.addColorStop(.65,'#ecfbff'); shade.addColorStop(1,'#bed9dd');
    context.fillStyle=shade; context.fillRect(0,0,size,size);
    context.fillStyle='#ffffff38';
    context.beginPath();context.moveTo(0,size*.52);context.lineTo(size*.62,0);
    context.lineTo(size*.83,0);context.lineTo(0,size*.77);context.fill();
  });
  const wood=paintedTexture((context,size)=>{
    context.fillStyle='#f8ecdc';context.fillRect(0,0,size,size);
    for(let line=0;line<48;line++) {
      context.strokeStyle=line%4?'#c5a17d35':'#ad85565a';context.lineWidth=line%4?.6:1.1;
      context.beginPath();
      for(let y=0;y<=size;y+=4) {
        const x=line*size/48+Math.sin(y*.031+line*1.8)*1.5+Math.sin(y*.009+line)*2;
        if(y===0)context.moveTo(x,y);else context.lineTo(x,y);
      }
      context.stroke();
    }
  });
  const standard = (color, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness, flatShading:true });
  return {
    wall: new THREE.MeshStandardMaterial({ color:0xf5e3c6,map:plaster,roughness:.9 }),
    roof: new THREE.MeshStandardMaterial({ color:0xcc603b, map:tiles, bumpMap:tiles, bumpScale:.018, roughness:.87 }),
    ridge: standard(0xd46a40),
    trim: standard(0xfff1d5),
    stone: standard(0xd6cdb7),
    joint: standard(0xc4bca7),
    reveal: standard(0xc3b9a2),
    door: new THREE.MeshStandardMaterial({color:0xa66b42,map:wood,bumpMap:wood,bumpScale:.012,roughness:.86}),
    doorInset: standard(0x80462c),
    metal: new THREE.MeshStandardMaterial({ color:0xd7aa52, metalness:.45, roughness:.4 }),
    glass: new THREE.MeshStandardMaterial({ color:0x5c9daa,map:glass,roughness:.22,metalness:.08 }),
    pot: standard(0x9b623d),
    leaves: standard(0x719345),
    flower: standard(0xfff7df),
    flowerCenter: standard(0xeec75d),
    grass: standard(0xadbd58),
    rock: standard(0xbab7a0),
    reed: standard(0x729955),
    lily: standard(0x91b75c)
  };
}
