import * as THREE from 'https://esm.sh/three@0.180.0';

// 同类静态物体共享几何与材质，植物数量不会线性增加 draw call。
function instances(scene, geometry, material, transforms, castShadow = true) {
  if (!transforms.length) { geometry.dispose(); return; }
  const mesh = new THREE.InstancedMesh(geometry,material,transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach(({x,y,z,sx=1,sy=sx,sz=sx,angle=0,rx=0,rz=0},i) => {
    dummy.position.set(x,y,z); dummy.scale.set(sx,sy,sz); dummy.rotation.set(rx,angle,rz);
    dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
    if (geometry.type === 'IcosahedronGeometry') {
      const shade=.87+((i*19)%23)/23*.23;
      mesh.setColorAt(i,new THREE.Color(shade,shade,shade));
    }
  });
  mesh.castShadow = castShadow; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

export function createTrees(scene, positions, m, mixed=false) {
  const trunks=[], lower=[], middle=[], upper=[],crowns=[],branches=[];
  positions.forEach(([x,z,size=1],index) => {
    const s=size*1.18;
    if(mixed&&index%7===0) {
      trunks.push({x,y:1.1*s,z,sx:s,sy:1.8*s,sz:s});
      crowns.push({x,y:2.55*s,z,sx:1.12*s,sy:1.24*s,sz:1.04*s,angle:index});
      crowns.push({x:x+.58*s,y:2.28*s,z:z+.24*s,sx:.65*s,sy:.73*s,sz:.69*s,angle:index+.5});
      branches.push({x:x+.24*s,y:1.55*s,z,sx:.62*s,sy:.85*s,sz:.62*s,rz:-.65});
      return;
    }
    const breadth=1.0+(index%3)*.06;
    trunks.push({x,y:.58*s,z,sx:s});
    lower.push({x,y:1.58*s,z,sx:s*breadth,sy:s,sz:s*breadth,angle:(x+z)*.4});
    middle.push({x:x+.035*s,y:2.12*s,z,sx:s*breadth,sy:s,sz:s*breadth,angle:(x-z)*.3});
    upper.push({x,y:2.67*s,z:z-.025*s,sx:s*breadth,sy:s,sz:s*breadth,angle:(x-z)*.3});
  });
  const bark = new THREE.MeshStandardMaterial({color:0x79543b,roughness:1});
  instances(scene,new THREE.CylinderGeometry(.12,.17,1.15,6),bark,trunks);
  instances(scene,new THREE.CylinderGeometry(.09,.13,1.15,6),bark,branches);
  instances(scene,new THREE.IcosahedronGeometry(1,1),m.leaves,crowns);
  instances(scene,new THREE.ConeGeometry(.98,1.45,7),m.leaves,lower);
  const lightLeaves = m.leaves.clone(); lightLeaves.color.set(0x789c50);
  instances(scene,new THREE.ConeGeometry(.77,1.25,7),m.leaves,middle);
  instances(scene,new THREE.ConeGeometry(.53,1.05,7),lightLeaves,upper);
}

export function createLandscape(scene, houseRecords, m) {
  const joints=[], shrubs=[], smallShrubs=[], grass=[], stones=[], petals=[], centers=[], gardenPines=[];
  const contactCanvas=document.createElement('canvas');
  contactCanvas.width=contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d');
  const fade=contactContext.createRadialGradient(64,64,30,64,64,64);
  fade.addColorStop(0,'rgba(48,50,28,.65)'); fade.addColorStop(1,'rgba(48,50,28,0)');
  contactContext.fillStyle=fade; contactContext.fillRect(0,0,128,128);
  const contactMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false,opacity:.45});
  const contactGeometry=new THREE.PlaneGeometry(1,1);
  contactGeometry.rotateX(-Math.PI/2);
  instances(scene,contactGeometry,contactMaterial,houseRecords.map(({building})=>({x:building.position.x,y:.009,z:building.position.z,sx:8.2,sy:1,sz:6.5})),false);
  for (const [index,{building}] of houseRecords.entries()) {
    const x=building.position.x,z=building.position.z;
    // 四边人行道外缘恰好到道路边缘 3.6，不跨进车道。
    for (const side of [-1,1]) {

      for (let n=-3;n<=3;n+=.6) {
        joints.push({x:x+n,y:.108,z:z+side*3.35,sx:.012,sy:.008,sz:.5});
        if (Math.abs(n)<3.1) joints.push({x:x+side*3.35,y:.108,z:z+n,sx:.5,sy:.008,sz:.012});
      }
    }
    const front=building.rotation.y ? -1 : 1;
    const variation=.88+(index%4)*.07;
    gardenPines.push([x+(index%2?2.7:-2.7),z+front*2.55,.43+(index%3)*.035]);
    for (const side of [-1,1]) {
      const height=(side>0?1:1.13)*variation;
      shrubs.push({x:x+side*(1.64+(index%3)*.07),y:.54*height,z:z+front*(2.64-(index%2)*.08),sx:.62*variation,sy:.68*height,sz:.49,angle:x+z+index});
      smallShrubs.push({x:x+side*2.56,y:.3,z:z+front*(2.64+(index%2)*.09),sx:.37,sy:.4,sz:.34,angle:z+index});
      shrubs.push({x:x+side*2.76,y:.51*variation,z:z-front*(2.54+(index%3)*.04),sx:.53,sy:.63*variation,sz:.48,angle:x});
      smallShrubs.push({x:x+side*3.0,y:.27,z:z+front*.83,sx:.34,sy:.4,sz:.29,angle:x});
      for (let i=0;i<3;i++) {
        const gx=x+side*(.96+i*.63),gz=z+front*(2.85+Math.sin(index+i*1.9)*.14);
        grass.push({x:gx,y:.12,z:gz,sx:.25,sy:.38,sz:.25,angle:i});
        stones.push({x:gx+.16,y:.055,z:gz-.18,sx:.09,sy:.065,sz:.085});
        for(let bloom=0;bloom<3;bloom++) {
          const fx=gx-.07+Math.cos(bloom*2.4+index)*.11,fz=gz+.06+Math.sin(bloom*2.4)*.12;
          const y=.21+(bloom%2)*.075;
          for (let p=0;p<5;p++) petals.push({x:fx+Math.cos(p*Math.PI*2/5)*.068,y,z:fz+Math.sin(p*Math.PI*2/5)*.068,sx:.054,sy:.03,sz:.054});
          centers.push({x:fx,y:y+.025,z:fz,sx:.034,sy:.027,sz:.034});
        }
      }
    }
  }
  // 带圆角、真实厚度的人行道环，与参考图中的浅色路缘一致。
  function roundedPath(path,half,radius) {
    path.moveTo(-half+radius,-half);path.lineTo(half-radius,-half);
    path.quadraticCurveTo(half,-half,half,-half+radius);path.lineTo(half,half-radius);
    path.quadraticCurveTo(half,half,half-radius,half);path.lineTo(-half+radius,half);
    path.quadraticCurveTo(-half,half,-half,half-radius);path.lineTo(-half,-half+radius);
    path.quadraticCurveTo(-half,-half,-half+radius,-half);
  }
  const curbShape=new THREE.Shape();roundedPath(curbShape,3.6,.32);
  const curbHole=new THREE.Path();roundedPath(curbHole,3.1,.16);curbShape.holes.push(curbHole);
  const lawnShape=new THREE.Shape();roundedPath(lawnShape,3.1,.16);
  const lawnGeometry=new THREE.ShapeGeometry(lawnShape,5);lawnGeometry.rotateX(-Math.PI/2);
  instances(scene,lawnGeometry,m.grass,houseRecords.map(({building})=>({x:building.position.x,y:.006,z:building.position.z})),false);
  const curbGeometry=new THREE.ExtrudeGeometry(curbShape,{depth:.08,bevelEnabled:false,curveSegments:5});
  curbGeometry.rotateX(-Math.PI/2);
  instances(scene,curbGeometry,m.stone,houseRecords.map(({building})=>({x:building.position.x,y:.02,z:building.position.z})),false);

  // 地块角落与湖边的自然点缀，采用固定布局，刷新后保持一致。
  for (const [x,z] of [[-18,-22],[-4,-23],[-2,-29],[17,-27],[19,-20],[-19,20],[20,20],[23,8],[26,-8]]) {
    shrubs.push({x,y:.65,z,sx:.7,sy:.82,sz:.62,angle:x});
    smallShrubs.push({x:x+.65,y:.32,z:z+.4,sx:.35,sy:.4,sz:.32,angle:z});
    for(let i=0;i<4;i++) {
      const gx=x+Math.cos(i*2.3)*1.05,gz=z+Math.sin(i*2.3)*.9;
      grass.push({x:gx,y:.06,z:gz,sx:.34,sy:.5,sz:.3,angle:i*2.3});
      stones.push({x:gx+.2,y:.08,z:gz+.2,sx:.16,sy:.11,sz:.13});
      for(let p=0;p<5;p++)petals.push({x:gx+Math.cos(p*Math.PI*2/5)*.1,y:.24,z:gz+Math.sin(p*Math.PI*2/5)*.1,sx:.07,sy:.025,sz:.07});
      centers.push({x:gx,y:.26,z:gz,sx:.043,sy:.028,sz:.043});
    }
  }
  const plantContacts=shrubs.map(plant=>({x:plant.x,y:.016,z:plant.z,sx:plant.sx*2.8,sy:1,sz:plant.sz*2.8}));
  instances(scene,contactGeometry.clone(),contactMaterial,plantContacts,false);

  instances(scene,new THREE.BoxGeometry(1,1,1),m.joint,joints,false);
  instances(scene,new THREE.IcosahedronGeometry(1,1),m.leaves,shrubs);
  instances(scene,new THREE.IcosahedronGeometry(1,1),m.grass,smallShrubs);
  const bladeGeometry=new THREE.BufferGeometry();
  bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    -.15,0,0,.15,0,0,.3,1,0, 0,0,-.15,0,0,.15,-.1,.85,-.3,
    -.1,0,-.1,.1,0,.1,-.35,.65,.25
  ],3));bladeGeometry.computeVertexNormals();
  const bladeMaterial=m.grass.clone();bladeMaterial.side=THREE.DoubleSide;
  instances(scene,bladeGeometry,bladeMaterial,grass,false);
  instances(scene,new THREE.DodecahedronGeometry(1,0),m.rock,stones,false);
  instances(scene,new THREE.SphereGeometry(1,5,3),m.flower,petals,false);
  instances(scene,new THREE.SphereGeometry(1,6,3),m.flowerCenter,centers,false);
  createTrees(scene,gardenPines,m);

  // 岸石部分埋入沙岸，芦苇与睡莲在水陆交界成组分布。
  const bankRocks=[[-5.7,-1.6,.85],[-5.2,-2.9,.65],[-4.4,3.4,.85],[-3.2,4.0,.5],[3.7,3.7,.7],[6,-.8,.6],[-.9,-4.7,.65],[2.1,1.5,.36]];
  instances(scene,new THREE.DodecahedronGeometry(1,0),m.rock,bankRocks.map(([x,z,s],i)=>({x:8+x,y:s*.18,z:-23+z,sx:s,sy:s*.5,sz:s*.8,angle:i*.73})));
  const reeds=[],heads=[],reedLeaves=[];
  for (const [x,z] of [[2.5,-25.3],[10.4,-27.1],[13.3,-21],[5.2,-18.9]]) {
    for(let i=0;i<6;i++) {
      const dx=Math.sin(i*2.4)*.24,dz=Math.cos(i*2.4)*.24,h=.72+(i%3)*.2;
      reeds.push({x:x+dx,y:h/2+.07,z:z+dz,sx:.035,sy:h,sz:.035});
      heads.push({x:x+dx,y:h+.04,z:z+dz,sx:.065,sy:.19,sz:.065});
      reedLeaves.push({x:x+dx,y:.055,z:z+dz,sx:.35,sy:h*.8,sz:.35,angle:i*2.1});
    }
  }
  instances(scene,new THREE.CylinderGeometry(1,1,1,5),m.reed,reeds,false);
  instances(scene,new THREE.CapsuleGeometry(.5,1,2,5),m.pot,heads,false);
  const reedLeafMaterial=m.reed.clone();reedLeafMaterial.side=THREE.DoubleSide;
  instances(scene,bladeGeometry.clone(),reedLeafMaterial,reedLeaves,false);
  const lilyGeometry=new THREE.CircleGeometry(1,12,0,Math.PI*1.88);
  lilyGeometry.rotateX(-Math.PI/2);
  instances(scene,lilyGeometry,m.lily,[[4.2,-23.8,.4],[4.7,-24.1,.3],[4.55,-23.4,.25],[11.5,-20.5,.38],[11.9,-20.8,.29],[10.8,-21.2,.32],[10.7,-26,.33],[11.2,-25.8,.26]].map(([x,z,s])=>({x,y:.067,z,sx:s,sy:1,sz:s,angle:x})),false);

  const waves=[];
  [[5.4,-22.8,.8],[8.4,-24.9,1.1],[10.1,-21.6,.65]].forEach(([x,z,s],i)=>{
    const material=new THREE.MeshBasicMaterial({color:0xc7e6de,transparent:true,opacity:.25,depthWrite:false});
    const wave=new THREE.Mesh(new THREE.RingGeometry(.48,.495,40),material);
    wave.rotation.x=-Math.PI/2; wave.position.set(x,.073,z); scene.add(wave);
    waves.push({wave,base:s,phase:i*2.1});
  });
  return { diagnostics:()=>({shrubs:shrubs.length+smallShrubs.length,flowers:centers.length,gardenPines:gardenPines.length,reedClusters:4,lilies:8}),update(time) {
    for(const {wave,base,phase} of waves) {
      const progress=(time*.18+phase)%1;
      wave.scale.setScalar(base*(.65+progress*.7));
      wave.material.opacity=Math.sin(progress*Math.PI)*.28;
    }
  }};
}
